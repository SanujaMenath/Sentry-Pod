# app/route/llm_routes.py
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from bson import ObjectId
import httpx  # type: ignore
import os
import logging
import asyncio
from datetime import datetime, timezone
from pathlib import Path

# Import playbook matching utilities
from . import playbook_routes
import app.services.playbook_service as playbook_service
from app.core.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["LLM"], prefix="/llm")

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_HF_RETRIES = 3
MAX_RETRY_DELAY_SECONDS = 10
MAX_HISTORY_MESSAGES = 10

SYSTEM_PROMPT_BASE = """You are SentryPod's network operations assistant.

Response rules:
- Be concise and practical.
- Return plain text only. Do not use markdown (no **bold**, headings, lists, or code fences).
- For configuration requests, provide only the requested action, not alternatives unless explicitly asked.
- Prefer device-ready Cisco IOS style commands when applicable.
- Keep responses short (typically 4-8 lines).
- If a placeholder is required, use <interface> style placeholders.
- Be friendly and supportive for users of all skill levels, but do not include greetings or sign-offs in your response.

For command-style requests, use this structure:
I did not find an exact playbook match for your request, so here are the commands to accomplish it:
Action: <one short sentence>
Commands:
<one command per line>
Notes: <single short caution or validation tip>

"""

PLAYBOOK_SUGGESTION_INSTRUCTION = """

RESPONSE PRIORITY — follow this order strictly. Do not skip steps.

Step 1 — PERFECT MATCH:
If a playbook's PURPOSE AND scope both match the user's request, recommend it directly.
Say: "I found [playbook] that does exactly this. Would you like me to run it?"
Do NOT generate commands. Stop here.

Step 2 — SCOPE MISMATCH (purpose matches, scope doesn't):
If a playbook's PURPOSE matches but its target_devices don't match the user's scope:
- Get the correct playbook from the list — the one whose purpose and description
  best match what the user wants, regardless of target_devices.
- Say: "I found [playbook] which [purpose]. It targets [current scope] but you asked
  about [user's scope]. I can modify it to target [user's scope] for you."
- Tell them to click the "Modify" button or type "Modify [filename] to [change]".
- Do NOT generate commands. Stop here.

Step 3 — NO MATCHING PLAYBOOK:
Only if no playbook exists whose PURPOSE matches the user's request at all,
generate commands manually.

EXAMPLES:
User: "Gather facts on edge routers"
  Step 1 check: get_facts.yml matches PURPOSE but targets allHosts → go to Step 2.
  Step 2: Say "I found get_facts.yml which collects device info. It targets all
    hosts but you asked about edge routers. I can modify it for you."
  Stop. Do not generate commands.

User: "Configure NTP on edge routers"
  Step 1 check: NTP_edge.yml matches PURPOSE AND scope → Step 1 applies.
  Say "I found NTP_edge.yml that configures NTP on edge routers. Would you
  like me to run it?" Stop.

User: "Show me the weather"
  Step 1: no playbook matches. Step 2: no playbook matches. Step 3: generate commands.

INCORRECT behaviors (do NOT do these):
- Recommending NTP_edge.yml when user wants facts (wrong purpose — skip to next playbook)
- Generating commands when Step 2 applies (playbook just needs scope adjustment)
- Saying "alternatively, here are the commands" — stop at Step 2, do not mention commands
- Suggesting to modify a playbook to change its PURPOSE (e.g. facts playbook → NTP config)

"""

class ChatRequest(BaseModel):
    prompt: str
    model: str = "deepseek-ai/DeepSeek-R1:novita"
    session_id: str | None = None


SUPPORTED_MODELS = {
    "deepseek-ai/DeepSeek-R1:novita": "DeepSeek R1",
    "google/gemma-4-31B-it:novita": "Gemma 4 31B",
    "Qwen/Qwen3.5-4B:featherless-ai": "Qwen3.5-4B",
    "meta-llama/Llama-3.1-8B-Instruct:novita": "Llama-3.1-8B-Instruct",
}


# ============================================================
# API KEY MANAGEMENT HELPER
# ============================================================

class ApiKeyRequest(BaseModel):
    api_key: str


async def get_stored_api_key():
    """Retrieve the stored API key from MongoDB."""
    from app.database import api_keys_collection
    
    doc = await api_keys_collection.find_one({"_id": "huggingface"})
    if doc:
        return doc.get("key")
    return None


def update_env_file(api_key: str):
    """Update the HUGGINGFACE_API_KEY in the .env file."""
    env_path = Path(__file__).parent.parent.parent / ".env"
    
    if not env_path.exists():
        logger.warning(f".env file not found at {env_path}")
        return
    
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
        
        # Find and update the HUGGINGFACE_API_KEY line
        updated = False
        for i, line in enumerate(lines):
            if line.startswith("HUGGINGFACE_API_KEY="):
                lines[i] = f"HUGGINGFACE_API_KEY={api_key}\n"
                updated = True
                break
        
        # If not found, add it at the beginning
        if not updated:
            lines.insert(0, f"HUGGINGFACE_API_KEY={api_key}\n")
        
        with open(env_path, "w") as f:
            f.writelines(lines)
        
        logger.info("Successfully updated HUGGINGFACE_API_KEY in .env file")
    except Exception as e:
        logger.error(f"Error updating .env file: {str(e)}")
        raise


# ============================================================
# HELPER: Load / Save Conversations
# ============================================================

async def load_conversation(session_id: str):
    from app.database import conversations_collection
    doc = await conversations_collection.find_one({"_id": ObjectId(session_id)})
    return doc


async def save_conversation(session_id: str, messages: list):
    from app.database import conversations_collection
    await conversations_collection.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"messages": messages, "updated_at": datetime.now(timezone.utc)}}
    )


# ============================================================
# CHAT ENDPOINT
# ============================================================

@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Proxy request to Hugging Face Router API with supported chat models.
    Supports session memory: persists conversation history and sends
    the last MAX_HISTORY_MESSAGES exchanges as context to the LLM.
    """
    # Try to get the stored API key first, fall back to env var
    stored_key = await get_stored_api_key()
    api_key = stored_key or HF_API_KEY

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Hugging Face API key not configured on server (HUGGINGFACE_API_KEY)",
        )

    if not request.prompt or not request.prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt cannot be empty",
        )

    model = request.model if request.model in SUPPORTED_MODELS else "deepseek-ai/DeepSeek-R1:novita"

    # Find playbook suggestions
    suggestions = playbook_service.find_playbook_suggestions(request.prompt, top_k=3)

    # Build system prompt with playbook suggestions
    system_prompt = SYSTEM_PROMPT_BASE
    if suggestions:
        system_prompt += PLAYBOOK_SUGGESTION_INSTRUCTION
        system_prompt += "\n\nAvailable playbooks for this request:"
        for i, suggestion in enumerate(suggestions, 1):
            system_prompt += f"\n{i}. {suggestion.name} ({suggestion.filename})"
            system_prompt += f"\n   Description: {suggestion.description}"
            if suggestion.playbook_preview:
                system_prompt += f"\n   Details: {suggestion.playbook_preview}"
            system_prompt += f"\n   Targets: {', '.join(suggestion.target_devices) if suggestion.target_devices else 'N/A'}"
            system_prompt += f"\n   Match reason: {suggestion.reason} (score: {suggestion.match_score:.1%})"
            if suggestion.modification_potential:
                system_prompt += f"\n   ⚠ Note: targets {', '.join(suggestion.target_devices)} but user scope may differ."

    # --- Session Memory ---
    from app.database import conversations_collection

    conversation = None
    session_id = request.session_id

    if session_id:
        conversation = await load_conversation(session_id)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found",
            )
    else:
        # Auto-create a new conversation
        title = request.prompt[:60] + ("..." if len(request.prompt) > 60 else "")
        result = await conversations_collection.insert_one({
            "title": title,
            "messages": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        session_id = str(result.inserted_id)
        conversation = {"messages": []}

    # Build history list for the LLM (last MAX_HISTORY_MESSAGES exchanges)
    history = conversation.get("messages", [])
    trimmed_history = history[-MAX_HISTORY_MESSAGES:]

    messages_for_llm = [
        {"role": "system", "content": system_prompt},
    ]
    for msg in trimmed_history:
        messages_for_llm.append({"role": msg["role"], "content": msg["content"]})
    messages_for_llm.append({"role": "user", "content": request.prompt})

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "messages": messages_for_llm,
        "model": model,
    }

    logger.info(f"Calling HF Router API with model: {model}, session: {session_id}, history messages: {len(trimmed_history)}")
    if suggestions:
        logger.info(f"Found {len(suggestions)} playbook suggestions for prompt")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = None
            for attempt in range(MAX_HF_RETRIES + 1):
                response = await client.post(HF_API_URL, json=payload, headers=headers)

                if response.status_code == 200:
                    break

                error_text = response.text
                error_text_lower = error_text.lower()
                is_retryable_error = (
                    response.status_code in RETRYABLE_STATUS_CODES
                    or "server_overload" in error_text_lower
                    or "overload" in error_text_lower
                )

                if is_retryable_error and attempt < MAX_HF_RETRIES:
                    retry_after = response.headers.get("Retry-After")
                    if retry_after and retry_after.isdigit():
                        delay_seconds = min(int(retry_after), MAX_RETRY_DELAY_SECONDS)
                    else:
                        delay_seconds = min(2 ** attempt, MAX_RETRY_DELAY_SECONDS)

                    logger.warning(
                        "HF Router transient failure (status=%s), retry %s/%s in %ss",
                        response.status_code,
                        attempt + 1,
                        MAX_HF_RETRIES,
                        delay_seconds,
                    )
                    await asyncio.sleep(delay_seconds)

        if response is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No response received from Hugging Face Router",
            )

        logger.info(f"HF Router API response status: {response.status_code}")

        if response.status_code != 200:
            error_text = response.text
            logger.error(f"HF Router API error: {error_text}")

            is_overloaded = (
                response.status_code in {429, 503}
                or "server_overload" in error_text.lower()
                or "overload" in error_text.lower()
            )

            if is_overloaded:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="HF Router is temporarily overloaded. Please try again in a moment.",
                )

            raise HTTPException(
                status_code=response.status_code,
                detail=f"HF Router API error: {error_text[:300]}",
            )

        data = response.json()
        logger.info(f"HF Router API response received")

        # Handle chat completions response format
        if "choices" in data and len(data["choices"]) > 0:
            message_data = data["choices"][0].get("message", {})

            # Extract reasoning (thinking phase) if available
            reasoning = message_data.get("reasoning_content", None)
            content = message_data.get("content", "")

            # --- Persist both messages to conversation ---
            user_msg = {"role": "user", "content": request.prompt, "created_at": datetime.now(timezone.utc).isoformat()}
            assistant_msg = {
                "role": "assistant",
                "content": content,
                "reasoning": reasoning,
                "model": model,
                "playbook_suggestions": [s.dict() if hasattr(s, 'dict') else s for s in suggestions] if suggestions else [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            updated_messages = history + [user_msg, assistant_msg]
            await save_conversation(session_id, updated_messages)

            return {
                "text": content,
                "reasoning": reasoning,
                "model": model,
                "session_id": session_id,
                "playbook_suggestions": suggestions,
            }

        # Handle error response from HF
        if "error" in data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"API error: {data['error']}",
            )

        # Fallback
        return {
            "text": str(data),
            "reasoning": None,
            "model": model,
            "session_id": session_id,
            "playbook_suggestions": suggestions,
        }

    except HTTPException:
        raise
    except httpx.RequestError as e:
        logger.error(f"Request failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reach Hugging Face API: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}",
        )


# ============================================================
# SESSION MANAGEMENT ENDPOINTS
# ============================================================

@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    """List all conversations for the current user, sorted by most recent."""
    from app.database import conversations_collection
    
    cursor = conversations_collection.aggregate([
        {"$sort": {"updated_at": -1}},
        {"$project": {
            "title": 1,
            "created_at": 1,
            "updated_at": 1,
            "message_count": {"$size": {"$ifNull": ["$messages", []]}}
        }}
    ])
    
    sessions = []
    async for doc in cursor:
        sessions.append({
            "session_id": str(doc["_id"]),
            "title": doc.get("title", "New Chat"),
            "created_at": doc["created_at"].isoformat() if isinstance(doc.get("created_at"), datetime) else str(doc.get("created_at", "")),
            "updated_at": doc["updated_at"].isoformat() if isinstance(doc.get("updated_at"), datetime) else str(doc.get("updated_at", "")),
            "message_count": doc.get("message_count", 0),
        })
    
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get full conversation for a session."""
    conversation = await load_conversation(session_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    return {
        "session_id": session_id,
        "title": conversation.get("title", "New Chat"),
        "messages": conversation.get("messages", []),
        "created_at": conversation["created_at"].isoformat() if isinstance(conversation.get("created_at"), datetime) else str(conversation.get("created_at", "")),
        "updated_at": conversation["updated_at"].isoformat() if isinstance(conversation.get("updated_at"), datetime) else str(conversation.get("updated_at", "")),
    }


@router.post("/sessions")
async def create_session(current_user: dict = Depends(get_current_user)):
    """Create a new empty conversation."""
    from app.database import conversations_collection
    
    result = await conversations_collection.insert_one({
        "title": "New Chat",
        "messages": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    
    return {
        "session_id": str(result.inserted_id),
        "title": "New Chat",
        "messages": [],
    }


@router.put("/sessions/{session_id}")
async def update_session(session_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update session title."""
    from app.database import conversations_collection
    
    title = body.get("title", "").strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty",
        )
    
    result = await conversations_collection.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"title": title, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    return {"status": "success", "title": title}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a conversation."""
    from app.database import conversations_collection
    
    result = await conversations_collection.delete_one({"_id": ObjectId(session_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    return {"status": "success", "message": "Session deleted"}


# ============================================================
# API KEY MANAGEMENT ENDPOINTS
# ============================================================

@router.get("/api-key-status")
async def get_api_key_status():
    """Check if an API key is configured (from DB or env var)."""
    stored_key = await get_stored_api_key()
    env_key = HF_API_KEY
    has_key = (stored_key is not None and len(stored_key) > 0) or (env_key is not None and len(env_key) > 0)
    return {
        "has_key": has_key,
    }


@router.post("/api-key")
async def save_api_key(request: ApiKeyRequest):
    """Save or update the Hugging Face API key."""
    from app.database import api_keys_collection
    
    if not request.api_key or not request.api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key cannot be empty",
        )
    
    try:
        # Update MongoDB
        await api_keys_collection.update_one(
            {"_id": "huggingface"},
            {
                "$set": {
                    "_id": "huggingface",
                    "key": request.api_key.strip(),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        
        # Update .env file
        update_env_file(request.api_key.strip())
        
        return {"status": "success", "message": "API key saved successfully"}
    except Exception as e:
        logger.error(f"Error saving API key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save API key",
        )


@router.delete("/api-key")
async def delete_api_key():
    """Delete the stored Hugging Face API key."""
    from app.database import api_keys_collection
    
    try:
        await api_keys_collection.delete_one({"_id": "huggingface"})
        
        # Clear from .env file (set to empty)
        update_env_file("")
        
        return {"status": "success", "message": "API key deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting API key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete API key",
        )


@router.post("/api-key-test")
async def test_api_key(request: ApiKeyRequest):
    """Test if the provided API key is valid."""
    if not request.api_key or not request.api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key cannot be empty",
        )
    
    headers = {
        "Authorization": f"Bearer {request.api_key.strip()}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "Say 'OK' in one word only.",
            }
        ],
        "model": "google/gemma-4-31B-it:novita",
        "max_tokens": 10,
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(HF_API_URL, json=payload, headers=headers)
            
            if response.status_code == 200:
                return {"status": "success", "message": "API key is valid and working"}
            elif response.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API key is invalid or expired",
                )
            else:
                error_data = response.json() if response.headers.get("content-type") == "application/json" else {"error": response.text}
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"API test failed: {error_data.get('error', 'Unknown error')}",
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing API key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test API key: {str(e)}",
        )
