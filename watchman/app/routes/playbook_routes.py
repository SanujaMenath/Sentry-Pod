# app/route/playbook_routes.py
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import subprocess
import os
from pathlib import Path
import json
import logging
import yaml

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/playbooks", tags=["Playbooks"])

class PlaybookRequest(BaseModel):
    playbook_name: str
    description: str = None

class PlaybookResponse(BaseModel):
    status: str
    playbook_name: str
    message: str
    output: str = None

class PlaybookCatalogItem(BaseModel):
    filename: str
    name: str
    description: str
    tags: list[str]
    target_devices: list[str]
    example_intents: list[str]
    destructive: bool = False
    severity: str = "medium"

class PlaybookSuggestion(BaseModel):
    filename: str
    name: str
    description: str
    tags: list[str]
    match_score: float
    reason: str
    destructive: bool
    severity: str
    target_devices: list[str]
    playbook_preview: str = ""

# Get the directory where this script is located
BASE_DIR = Path(__file__).parent.parent.parent
PLAYBOOKS_DIR = BASE_DIR / "playbooks"
HOSTS_INI_PATH = PLAYBOOKS_DIR / "hosts.ini"
CATALOG_PATH = PLAYBOOKS_DIR / "catalog.json"

# Cache for catalog
_catalog_cache = None

def load_catalog() -> list[PlaybookCatalogItem]:
    """Load playbook catalog from JSON file"""
    global _catalog_cache
    
    if _catalog_cache is not None:
        return _catalog_cache
    
    if not CATALOG_PATH.exists():
        logger.warning(f"Catalog file not found at {CATALOG_PATH}")
        return []
    
    try:
        with open(CATALOG_PATH, 'r') as f:
            data = json.load(f)
        _catalog_cache = [PlaybookCatalogItem(**item) for item in data]
        return _catalog_cache
    except Exception as e:
        logger.error(f"Error loading catalog: {str(e)}")
        return []

def extract_playbook_preview(filename: str) -> str:
    """
    Read a playbook YAML file and extract key task information.
    Returns a brief preview of what the playbook does.
    """
    try:
        playbook_path = PLAYBOOKS_DIR / filename
        if not playbook_path.exists():
            return ""
        #OPEN A PLAYBOOK
        with open(playbook_path, 'r') as f:
            content = yaml.safe_load(f)
        
        if not content or not isinstance(content, list):
            return ""
        
        # Extract task names and modules from the first play
        play = content[0]
        if not isinstance(play, dict):
            return ""
        
        tasks = play.get('tasks', [])
        if not tasks:
            return ""
        
        # Get first 3-4 task names
        task_names = []
        modules_used = set()
        
        for task in tasks[:4]:
            if isinstance(task, dict):
                task_name = task.get('name', 'unnamed task')
                task_names.append(task_name)
                
                # Extract module name (e.g., 'cisco.ios.ios_command')
                for key in task.keys():
                    if key not in ['name', 'register', 'when', 'debug', 'copy', 'set_fact']:
                        if '.' in key or key in ['command', 'shell', 'copy', 'debug']:
                            modules_used.add(key)
        
        # Build preview string
        preview_parts = []
        if task_names:
            preview_parts.append("Tasks: " + "; ".join(task_names[:3]))
        if modules_used:
            modules_list = "; ".join(sorted(list(modules_used))[:3])
            preview_parts.append("Uses: " + modules_list)
        
        return " | ".join(preview_parts) if preview_parts else ""
    
    except Exception as e:
        logger.warning(f"Could not extract preview from {filename}: {str(e)}")
        return ""

def score_playbook_match(catalog_item: PlaybookCatalogItem, prompt: str) -> tuple[float, str]:
    """
    Score how well a playbook matches a user prompt using multiple matching strategies.
    Returns (score: float 0-10, reason: str)
    
    Scoring strategy (lower threshold allows more suggestions):
    - Filename exact match: +5 points
    - Name exact match: +4 points
    - Tag matches: +2 points each (increased from +1)
    - Example intent match: +3 points each (increased from +2)
    - Threshold: score > 2 (lowered from 5 to catch more relevant playbooks)
    """
    prompt_lower = prompt.lower()
    prompt_words = set(prompt_lower.split())
    score = 0.0
    reasons = []
    
    # Check filename exact match (highest priority)
    if catalog_item.filename.lower() in prompt_lower:
        score += 5
        reasons.append(f"filename match: {catalog_item.filename}")
    
    # Check name exact match (high priority)
    if catalog_item.name.lower() in prompt_lower:
        score += 4
        reasons.append(f"name match: {catalog_item.name}")
    
    # Check tag matches (increased weight from 1 to 2)
    tag_matches = 0
    for tag in catalog_item.tags:
        if tag.lower() in prompt_lower or tag.lower() in prompt_words:
            score += 2
            tag_matches += 1
            reasons.append(f"tag match: {tag}")
    
    # Check example intents (increased weight from 2 to 3)
    for intent in catalog_item.example_intents:
        if intent.lower() in prompt_lower:
            score += 3
            reasons.append(f"intent match: {intent}")
    
    # Normalize score to 0-10
    score = min(score, 10.0)
    
    reason = "; ".join(reasons) if reasons else "no keyword match"
    return score, reason

def find_playbook_suggestions(prompt: str, top_k: int = 3) -> list[PlaybookSuggestion]:
    """
    Find the best matching playbooks for a user prompt.
    Returns top_k suggestions ranked by relevance.
    Includes dynamic playbook content preview from YAML files.
    
    Threshold: score >= 2 (catches keyword matches while filtering out spurious matches)
    """
    catalog = load_catalog()
    if not catalog:
        return []
    
    suggestions = []
    for item in catalog:
        score, reason = score_playbook_match(item, prompt)
        if score >= 2:  # Changed from > 5 to >= 2 to catch more relevant matches
            # Extract playbook preview from YAML
            preview = extract_playbook_preview(item.filename)
            
            suggestions.append(
                PlaybookSuggestion(
                    filename=item.filename,
                    name=item.name,
                    description=item.description,
                    tags=item.tags,
                    match_score=score,
                    reason=reason,
                    destructive=item.destructive,
                    severity=getattr(item, "severity", "medium"),
                    target_devices=item.target_devices,
                    playbook_preview=preview,
                )
            )
    
    # Sort by score descending
    suggestions.sort(key=lambda x: x.match_score, reverse=True)
    
    return suggestions[:top_k]


def get_all_hosts_from_inventory() -> list[str]:
    """Return all hostnames listed under [allHosts] in hosts.ini."""
    if not HOSTS_INI_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory file 'hosts.ini' not found"
        )

    hostnames: list[str] = []
    in_all_hosts = False

    with HOSTS_INI_PATH.open("r", encoding="utf-8") as inventory_file:
        for raw_line in inventory_file:
            line = raw_line.strip()

            if not line or line.startswith("#") or line.startswith(";"):
                continue

            if line.startswith("[") and line.endswith("]"):
                in_all_hosts = line.lower() == "[allhosts]"
                continue

            if not in_all_hosts:
                continue

            # Ansible inventory host entries can include inline variables.
            hostname = line.split()[0]
            hostnames.append(hostname)

    return hostnames

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

@router.get("/catalog")
async def get_playbook_catalog():
    """Get the complete playbook catalog with metadata"""
    try:
        catalog = load_catalog()
        return {
            "status": "success",
            "catalog": catalog,
            "count": len(catalog)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/suggest")
async def suggest_playbooks(request: PlaybookRequest):
    """Find playbook suggestions matching a user prompt"""
    try:
        if not request.playbook_name or not request.playbook_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt cannot be empty"
            )
        
        suggestions = find_playbook_suggestions(request.playbook_name, top_k=3)
        return {
            "status": "success",
            "prompt": request.playbook_name,
            "suggestions": suggestions,
            "count": len(suggestions)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/inventory/all-hosts-count")
async def get_all_hosts_count():
    """Return the number of devices listed under [allHosts] in hosts.ini."""
    try:
        hostnames = get_all_hosts_from_inventory()
        return {
            "status": "success",
            "group": "allHosts",
            "count": len(hostnames),
            "hosts": hostnames,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
