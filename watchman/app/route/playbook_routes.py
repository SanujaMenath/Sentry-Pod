# app/route/playbook_routes.py
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import subprocess
import os
from pathlib import Path
import json

router = APIRouter(prefix="/playbooks", tags=["Playbooks"])

class PlaybookRequest(BaseModel):
    playbook_name: str
    description: str = None

class PlaybookResponse(BaseModel):
    status: str
    playbook_name: str
    message: str
    output: str = None

# Get the directory where this script is located
BASE_DIR = Path(__file__).parent.parent.parent
PLAYBOOKS_DIR = BASE_DIR / "playbooks"

@router.post("/execute", response_model=PlaybookResponse)
async def execute_playbook(request: PlaybookRequest):
    """Execute an Ansible playbook by name"""
    
    try:
        # Validate playbook exists
        playbook_path = PLAYBOOKS_DIR / request.playbook_name
        if not playbook_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Playbook '{request.playbook_name}' not found"
            )
        
        if not str(playbook_path).endswith('.yml') and not str(playbook_path).endswith('.yaml'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .yml and .yaml files are allowed"
            )
        
        # Execute the playbook
        result = subprocess.run(
            ['ansible-playbook', str(playbook_path), '-i', str(PLAYBOOKS_DIR / 'hosts.ini')],
            cwd=str(PLAYBOOKS_DIR),
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        return PlaybookResponse(
            status="success" if result.returncode == 0 else "failed",
            playbook_name=request.playbook_name,
            message=f"Playbook execution {'completed' if result.returncode == 0 else 'failed'}",
            output=result.stdout + result.stderr
        )
        
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Playbook execution timeout"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/execute-stream/{playbook_name}")
async def execute_playbook_stream(playbook_name: str):
    """Execute an Ansible playbook and stream output in real-time using Server-Sent Events"""
    
    try:
        # Validate playbook exists
        playbook_path = PLAYBOOKS_DIR / playbook_name
        if not playbook_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Playbook '{playbook_name}' not found"
            )
        
        if not str(playbook_path).endswith('.yml') and not str(playbook_path).endswith('.yaml'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .yml and .yaml files are allowed"
            )
        
        async def event_generator():
            """Stream output from ansible-playbook as Server-Sent Events"""
            try:
                # Start the playbook process
                process = subprocess.Popen(
                    ['ansible-playbook', str(playbook_path), '-i', str(PLAYBOOKS_DIR / 'hosts.ini')],
                    cwd=str(PLAYBOOKS_DIR),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,  # Line buffered
                )
                
                # Stream each line as it arrives
                for line in iter(process.stdout.readline, ''):
                    if line:
                        # Send as SSE event
                        event_data = json.dumps({
                            "type": "output",
                            "line": line.rstrip('\n')
                        })
                        yield f"data: {event_data}\n\n"
                
                # Wait for process to complete
                returncode = process.wait()
                
                # Send completion event
                completion_data = json.dumps({
                    "type": "complete",
                    "status": "success" if returncode == 0 else "failed",
                    "returncode": returncode
                })
                yield f"data: {completion_data}\n\n"
                
            except Exception as e:
                error_data = json.dumps({
                    "type": "error",
                    "message": str(e)
                })
                yield f"data: {error_data}\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/list")
async def list_playbooks():
    """List all available playbooks"""
    try:
        playbooks = [
            f.name for f in PLAYBOOKS_DIR.glob('*.yml')
        ] + [
            f.name for f in PLAYBOOKS_DIR.glob('*.yaml')
        ]
        
        # Filter out host_vars and other non-executable files
        playbooks = [p for p in playbooks if not p.startswith('.')]
        
        return {
            "status": "success",
            "playbooks": sorted(playbooks),
            "count": len(playbooks)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
