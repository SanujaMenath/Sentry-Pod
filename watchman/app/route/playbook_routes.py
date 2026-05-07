# app/route/playbook_routes.py
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import subprocess
import os
from pathlib import Path

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
