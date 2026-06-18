from fastapi import APIRouter, WebSocket

from app.utils.console_utils import run_console

router = APIRouter()


@router.websocket("/console/ws")
async def console_websocket(websocket: WebSocket):
    await run_console(websocket)
