# app/route/llm_routes.py
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import httpx
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["LLM"], prefix="/llm")

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"


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

    headers = {
        "Authorization": f"Bearer {HF_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "messages": [
            {
                "role": "user",
                "content": request.prompt,
            }
        ],
        "model": model,
    }

    logger.info(f"Calling HF Router API with model: {model}")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(HF_API_URL, json=payload, headers=headers)

        logger.info(f"HF Router API response status: {response.status_code}")

        if response.status_code != 200:
            error_text = response.text
            logger.error(f"HF Router API error: {error_text}")
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
            }

        # Handle error response from HF
        if "error" in data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"API error: {data['error']}",
            )

        # Fallback
        return {"text": str(data), "reasoning": None, "model": model}

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
