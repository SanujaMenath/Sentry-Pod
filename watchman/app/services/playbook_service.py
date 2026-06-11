import os
import json
import yaml
import logging
import subprocess
import platform
import re
from pathlib import Path
from typing import List, Tuple, Generator
from fastapi import HTTPException, status

from app.models.playbook import PlaybookCatalogItem, PlaybookSuggestion

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent.parent
PLAYBOOKS_DIR = BASE_DIR / "playbooks"
HOSTS_INI_PATH = PLAYBOOKS_DIR / "hosts.ini"
CATALOG_PATH = PLAYBOOKS_DIR / "catalog.json"

# ANSI escape code pattern
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

# Podman container configuration
PODMAN_CONTAINER_IMAGE = "localhost/sentry-ansible"
PODMAN_ANSIBLE_DIR = "/ansible"  # Mount point inside container

_catalog_cache = None


def get_podman_command(playbook_name: str) -> List[str]:
    """
    Build a cross-platform Podman command for running Ansible playbooks.
    
    Works on both Windows and Linux by:
    - Using absolute paths for volume mounts
    - Avoiding network=host on Windows (use default networking)
    - Normalizing path separators for the container
    
    Args:
        playbook_name: Name of the playbook file (e.g., "get_facts.yml")
    
    Returns:
        List of command arguments for subprocess
    """
    system = platform.system()
    
    # Get absolute paths
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()
    
    # Build the podman command
    cmd = ["podman", "run", "--rm"]
    
    # Add networking flag (only on Linux)
    if system == "Linux":
        cmd.append("--network=host")
    
    # Add volume mount (SELinux :Z flag is Linux-only)
    vol_flag = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    cmd.extend(["-v", vol_flag])
    
    # Container image
    cmd.append(PODMAN_CONTAINER_IMAGE)
    
    # Ansible command inside the container
    cmd.extend(["ansible-playbook", f"{PODMAN_ANSIBLE_DIR}/{playbook_name}", 
                "-i", f"{PODMAN_ANSIBLE_DIR}/hosts.ini"])
    
    logger.debug(f"Podman command: {' '.join(cmd)}")
    return cmd

def load_catalog() -> List[PlaybookCatalogItem]:
    """Load playbook catalog from JSON file with caching."""
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
    """Read a playbook YAML file and extract key task information."""
    try:
        playbook_path = PLAYBOOKS_DIR / filename
        if not playbook_path.exists():
            return ""
            
        with open(playbook_path, 'r') as f:
            content = yaml.safe_load(f)
        
        if not content or not isinstance(content, list):
            return ""
        
        play = content[0]
        if not isinstance(play, dict):
            return ""
        
        tasks = play.get('tasks', [])
        if not tasks:
            return ""
        
        task_names = []
        modules_used = set()
        
        for task in tasks[:4]:
            if isinstance(task, dict):
                task_name = task.get('name', 'unnamed task')
                task_names.append(task_name)
                
                for key in task.keys():
                    if key not in ['name', 'register', 'when', 'debug', 'copy', 'set_fact']:
                        if '.' in key or key in ['command', 'shell', 'copy', 'debug']:
                            modules_used.add(key)
        
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

def score_playbook_match(catalog_item: PlaybookCatalogItem, prompt: str) -> Tuple[float, str]:
    """Score how well a playbook matches a user prompt using multiple matching strategies."""
    prompt_lower = prompt.lower()
    prompt_words = set(prompt_lower.split())
    score = 0.0
    reasons = []
    
    if catalog_item.filename.lower() in prompt_lower:
        score += 5
        reasons.append(f"filename match: {catalog_item.filename}")
    
    if catalog_item.name.lower() in prompt_lower:
        score += 4
        reasons.append(f"name match: {catalog_item.name}")
    
    for tag in catalog_item.tags:
        if tag.lower() in prompt_lower or tag.lower() in prompt_words:
            score += 2
            reasons.append(f"tag match: {tag}")
    
    for intent in catalog_item.example_intents:
        if intent.lower() in prompt_lower:
            score += 3
            reasons.append(f"intent match: {intent}")
    
    score = min(score, 10.0)
    reason = "; ".join(reasons) if reasons else "no keyword match"
    return score, reason

def find_playbook_suggestions(prompt: str, top_k: int = 3) -> List[PlaybookSuggestion]:
    """Find the best matching playbooks for a user prompt ranked by relevance."""
    catalog = load_catalog()
    if not catalog:
        return []
    
    suggestions = []
    for item in catalog:
        score, reason = score_playbook_match(item, prompt)
        if score >= 2:
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
    
    suggestions.sort(key=lambda x: x.match_score, reverse=True)
    return suggestions[:top_k]

def get_all_hosts_from_inventory() -> List[str]:
    """Return all hostnames listed under [allHosts] in hosts.ini."""
    if not HOSTS_INI_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory file 'hosts.ini' not found"
        )

    hostnames: List[str] = []
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

            hostname = line.split()[0]
            hostnames.append(hostname)

    return hostnames

def validate_playbook_path(playbook_name: str) -> Path:
    """Helper to validate playbook file presence and extension constraints."""
    playbook_path = PLAYBOOKS_DIR / playbook_name
    if not playbook_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Playbook '{playbook_name}' not found"
        )
    if not playbook_name.endswith(('.yml', '.yaml')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .yml and .yaml files are allowed"
        )
    return playbook_path

def run_playbook(playbook_name: str) -> Tuple[int, str]:
    """Executes an Ansible playbook inside Podman container with blocking call."""
    playbook_path = validate_playbook_path(playbook_name)
    try:
        cmd = get_podman_command(playbook_name)
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Playbook execution timeout (300s)"
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Podman not found. Ensure Podman is installed and in PATH"
        )

def run_drift_analysis() -> Tuple[int, str]:
    """Executes run_drift_analysis.sh inside the sentry-ansible container."""
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()
    scripts_abs_path = (BASE_DIR / "scripts").resolve()
    
    cmd = ["podman", "run", "--rm"]
    if system == "Linux":
        cmd.append("--network=host")
        
    vol_pb = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    vol_scripts = f"{scripts_abs_path}:/scripts:Z" if system == "Linux" else f"{scripts_abs_path}:/scripts"
    cmd.extend([
        "-v", vol_pb,
        "-v", vol_scripts,
        PODMAN_CONTAINER_IMAGE,
        "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_drift_analysis.sh"
    ])
    
    logger.debug(f"Running drift analysis command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Drift analysis execution timeout (300s)"
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Podman not found. Ensure Podman is installed and in PATH"
        )

def get_baselined_devices() -> List[str]:
    """Get list of hostnames that have golden state files saved."""
    golden_dir = PLAYBOOKS_DIR / "goldenState"
    devices = []
    if golden_dir.exists() and golden_dir.is_dir():
        for path in golden_dir.glob("GS_*.txt"):
            hostname = path.name.replace("GS_", "").replace(".txt", "")
            devices.append(hostname)
    return sorted(devices)

def run_baseline_collection() -> Tuple[int, str]:
    """Executes run_baseline_collection.sh inside the sentry-ansible container."""
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()

    cmd = ["podman", "run", "--rm"]
    if system == "Linux":
        cmd.append("--network=host")

    vol_flag = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    cmd.extend([
        "-v", vol_flag,
        PODMAN_CONTAINER_IMAGE,
        "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_baseline_collection.sh"
    ])

    logger.debug(f"Running baseline collection command: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Baseline collection execution timeout (300s)"
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Podman not found. Ensure Podman is installed and in PATH"
        )

def run_baseline_refresh() -> Tuple[int, str]:
    """Executes run_baseline_refresh.sh inside the sentry-ansible container.

    Re-runs SNMP bulkwalk collection and metric parsing to refresh
    the per_interface_metrics.json file consumed by the Network Baseline graph.
    """
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()
    scripts_abs_path = (BASE_DIR / "scripts").resolve()

    cmd = ["podman", "run", "--rm"]
    if system == "Linux":
        cmd.append("--network=host")

    vol_pb = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    vol_scripts = f"{scripts_abs_path}:/scripts:Z" if system == "Linux" else f"{scripts_abs_path}:/scripts"
    cmd.extend([
        "-v", vol_pb,
        "-v", vol_scripts,
        PODMAN_CONTAINER_IMAGE,
        "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_baseline_refresh.sh"
    ])

    logger.debug(f"Running baseline refresh command: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Baseline refresh execution timeout (300s)"
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Podman not found. Ensure Podman is installed and in PATH"
        )

def run_playbook_stream_generator(playbook_name: str) -> Generator[str, None, None]:
    """Starts the Podman subprocess and yields SSE formatted event payloads data."""
    playbook_path = validate_playbook_path(playbook_name)
    try:
        cmd = get_podman_command(playbook_name)
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        
        for line in iter(process.stdout.readline, ''):
            if line:
                event_data = json.dumps({"type": "output", "line": line.rstrip('\n')})
                yield f"data: {event_data}\n\n"
        
        returncode = process.wait()
        completion_data = json.dumps({
            "type": "complete",
            "status": "success" if returncode == 0 else "failed",
            "returncode": returncode
        })
        yield f"data: {completion_data}\n\n"
        
    except FileNotFoundError:
        error_data = json.dumps({
            "type": "error", 
            "message": "Podman not found. Ensure Podman is installed and in PATH"
        })
        yield f"data: {error_data}\n\n"
    except Exception as e:
        error_data = json.dumps({"type": "error", "message": str(e)})
        yield f"data: {error_data}\n\n"

def get_playbook_files() -> List[str]:
    """Gather physical playbook files inside directory paths."""
    playbooks = [f.name for f in PLAYBOOKS_DIR.glob('*.yml')] + [f.name for f in PLAYBOOKS_DIR.glob('*.yaml')]
    return sorted([p for p in playbooks if not p.startswith('.')])


def parse_config_drift_reports() -> List[dict]:
    """Parse config drift diff files saved by the Ansible playbook.

    Returns a list of summaries with full diff content and structured change info:
    {hostname, path, mtime, diff_content, additions, removals, summary}
    """
    def strip_ansi(text: str) -> str:
        """Remove ANSI escape codes from text."""
        return ANSI_ESCAPE.sub('', text)
    
    drift_dir = PLAYBOOKS_DIR / "configDrift"
    results: List[dict] = []

    if not drift_dir.exists() or not drift_dir.is_dir():
        return results

    for path in sorted(drift_dir.glob('DRIFT_*.diff')):
        try:
            hostname = path.name.replace('DRIFT_', '').replace('.diff', '')
            text = path.read_text(encoding='utf-8', errors='ignore')
            # Strip ANSI color codes from diff output
            text = strip_ansi(text)
            lines = text.splitlines()

            additions = []
            removals = []
            for ln in lines:
                if ln.startswith('+++') or ln.startswith('---'):
                    continue
                if ln.startswith('+') and not ln.startswith('++'):
                    additions.append(ln[1:].strip())
                elif ln.startswith('-') and not ln.startswith('--'):
                    removals.append(ln[1:].strip())

            summary = None
            if additions or removals:
                summary = {
                    "added": len(additions),
                    "removed": len(removals),
                }

            results.append({
                "hostname": hostname,
                "path": str(path.relative_to(BASE_DIR)),
                "mtime": int(path.stat().st_mtime),
                "diff_content": text,  # Full diff for structured parsing in frontend
                "additions": additions,  # Keep for backward compatibility
                "removals": removals,    # Keep for backward compatibility
                "summary": summary,
            })
        except Exception:
            # best-effort parsing; skip files we cannot read
            continue

    return results


def read_config_drift_file(hostname: str) -> str:
    """Return the raw diff file contents for a given hostname (DRIFT_<hostname>.diff)"""
    def strip_ansi(text: str) -> str:
        """Remove ANSI escape codes from text."""
        return ANSI_ESCAPE.sub('', text)
    
    drift_dir = PLAYBOOKS_DIR / "configDrift"
    target = drift_dir / f"DRIFT_{hostname}.diff"
    if not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drift report not found")
    try:
        text = target.read_text(encoding='utf-8', errors='ignore')
        return strip_ansi(text)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))