# app/route/llm_routes.py
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import httpx  # type: ignore
import os
import logging
import asyncio

# Import playbook matching utilities
from . import playbook_routes

logger = logging.getLogger(__name__)

router = APIRouter(tags=["LLM"], prefix="/llm")

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_HF_RETRIES = 3
MAX_RETRY_DELAY_SECONDS = 10

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
I didn't find any existing playbooks that match your request, so I'll generate new commands for you.
Action: <one short sentence>
Commands:
<one command per line>
Notes: <single short caution or validation tip>

"""

PLAYBOOK_SUGGESTION_INSTRUCTION = """

IMPORTANT - PLAYBOOK SUGGESTIONS:
Before generating new commands or solutions, check the available playbooks listed below.
If the user's request matches only one existing playbook, recommend it first with a message like:
"I found an existing playbook that matches your request: [Playbook Name] ([filename]). 
It does [description]. Would you like me to help you execute it?"
If multiple playbooks are relevant, change the mewssage to:
"I found several existing playbooks that might match your request:
1. [Playbook Name 1] ([filename]) - [description]
2. [Playbook Name 2] ([filename]) - [description]
Would you like me to help you execute one of these, or do you want me to generate new commands for you?"
Only generate new commands if no suitable playbook exists or the user explicitly asks for something different.
If the scrore is less than 5, first display this message to the user:
"I didn't find any existing playbooks that match your request, so I'll generate new commands for you."
Then proceed to generate the response as normal.

"""

class ChatRequest(BaseModel):
    prompt: str
    model: str = "deepseek-ai/DeepSeek-R1:novita"


SUPPORTED_MODELS = {
    "deepseek-ai/DeepSeek-R1:novita": "DeepSeek R1",
    "google/gemma-4-31B-it:novita": "Gemma 4 31B",
    "Qwen/Qwen3.5-4B:featherless-ai": "Qwen3.5-4B",
    "meta-llama/Llama-3.1-8B-Instruct:novita": "Llama-3.1-8B-Instruct",
}


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Proxy request to Hugging Face Router API with supported chat models.
    Uses chat completions endpoint for better conversational responses.
    Keeps API key safe on backend, avoids CORS issues.
    Also searches for and suggests matching playbooks before generating new responses.
    """
    if not HF_API_KEY:
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
    suggestions = playbook_routes.find_playbook_suggestions(request.prompt, top_k=3)
    
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
            system_prompt += f"\n   Match reason: {suggestion.reason} (score: {suggestion.match_score:.1%})"
    
    headers = {
        "Authorization": f"Bearer {HF_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": request.prompt,
            }
        ],
        "model": model,
    }

    logger.info(f"Calling HF Router API with model: {model}")
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

            return {
                "text": content,
                "reasoning": reasoning,
                "model": model,
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
