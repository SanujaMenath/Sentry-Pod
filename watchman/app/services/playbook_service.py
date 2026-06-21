import os
import json
import yaml
import logging
import subprocess
import platform
import re
from pathlib import Path
from typing import List, Tuple, Generator, Optional
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
    cmd = ["podman", "run", "--rm", "--pull=never"]
    
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

def invalidate_catalog_cache():
    global _catalog_cache
    _catalog_cache = None

def read_catalog_raw() -> list:
    invalidate_catalog_cache()
    try:
        if not CATALOG_PATH.exists():
            logger.warning(f"Catalog file not found at {CATALOG_PATH}")
            return []
        with open(CATALOG_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading catalog raw: {str(e)}")
        return []

def save_catalog(entries: list) -> bool:
    try:
        temp_path = CATALOG_PATH.with_suffix('.json.tmp')
        with open(temp_path, 'w') as f:
            json.dump(entries, f, indent=2)
            f.write('\n')
        temp_path.replace(CATALOG_PATH)
        invalidate_catalog_cache()
        return True
    except Exception as e:
        logger.error(f"Error saving catalog: {str(e)}")
        return False

def update_catalog_entry(filename: str, updates: dict) -> bool:
    entries = read_catalog_raw()
    found = False
    for entry in entries:
        if entry.get("filename") == filename:
            entry.update(updates)
            found = True
            break
    if not found:
        return False
    return save_catalog(entries)

def remove_catalog_entry(filename: str) -> bool:
    entries = read_catalog_raw()
    new_entries = [e for e in entries if e.get("filename") != filename]
    if len(new_entries) == len(entries):
        return False
    return save_catalog(new_entries)

def save_playbook_file(filename: str, content: bytes) -> str:
    import shutil
    filepath = PLAYBOOKS_DIR / filename
    if filepath.exists():
        stem = filepath.stem
        suffix = filepath.suffix
        counter = 1
        while filepath.exists():
            filepath = PLAYBOOKS_DIR / f"{stem}_{counter}{suffix}"
            counter += 1
    try:
        filepath.write_bytes(content)
        return filepath.name
    except Exception as e:
        logger.error(f"Error saving playbook file: {str(e)}")
        raise

def read_playbook_file(filename: str) -> Optional[str]:
    filepath = PLAYBOOKS_DIR / filename
    if not filepath.exists():
        return None
    try:
        return filepath.read_text(encoding='utf-8')
    except Exception as e:
        logger.error(f"Error reading playbook file {filename}: {str(e)}")
        return None

def delete_playbook_file(filename: str) -> bool:
    filepath = PLAYBOOKS_DIR / filename
    if not filepath.exists():
        return False
    try:
        filepath.unlink()
        return True
    except Exception as e:
        logger.error(f"Error deleting playbook file {filename}: {str(e)}")
        return False

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

def check_modification_potential(prompt: str, catalog_item: PlaybookCatalogItem) -> bool:
    """Check if a playbook could be modified to better match the user's request.

    Returns True when there's a scope mismatch in either direction:
    - User wants broad scope (all/every) but playbook targets a specific group
    - User mentions a specific group but playbook targets allHosts
    """
    prompt_lower = prompt.lower()

    broad_keywords = ["all", "every", "entire", "whole", "any", "each"]
    has_broad_scope = any(kw in prompt_lower for kw in broad_keywords)

    specific_keywords = [
        "edge", "core", "distribution", "access", "router", "switch",
        "gateway", "firewall", "border", "dmz", "spine", "leaf",
    ]
    has_specific_group = any(kw in prompt_lower for kw in specific_keywords)

    is_all_hosts = all(
        t.lower() in ("allhosts", "all", "all_devices", "all devices")
        for t in catalog_item.target_devices
    )
    is_specific_scope = any(
        t.lower() not in ("allhosts", "all", "all_devices", "all devices")
        for t in catalog_item.target_devices
    )

    if has_broad_scope and is_specific_scope:
        return True

    if has_specific_group and is_all_hosts:
        return True

    return False


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
            mod_potential = check_modification_potential(prompt, item)
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
                    modification_potential=mod_potential,
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

def get_inventory_groups() -> List[str]:
    """Return all Ansible group names from hosts.ini (e.g. allHosts, Edge_routers, etc.)."""
    if not HOSTS_INI_PATH.exists():
        return []
    groups: List[str] = []
    with HOSTS_INI_PATH.open("r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if line.startswith("[") and line.endswith("]"):
                group_name = line[1:-1]
                groups.append(group_name)
    return groups

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
    """Executes drift analysis inside the sentry-ansible container."""
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()
    scripts_abs_path = (BASE_DIR / "scripts").resolve()
    
    cmd = ["podman", "run", "--rm", "--pull=never"]
    if system == "Linux":
        cmd.append("--network=host")
        
    vol_pb = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    vol_scripts = f"{scripts_abs_path}:/scripts:Z" if system == "Linux" else f"{scripts_abs_path}:/scripts"
    cmd.extend([
        "-v", vol_pb,
        "-v", vol_scripts,
        PODMAN_CONTAINER_IMAGE,
        "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_action.sh", "drift"
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
    """Executes baseline collection inside the sentry-ansible container."""
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()

    cmd = ["podman", "run", "--rm", "--pull=never"]
    if system == "Linux":
        cmd.append("--network=host")

    vol_flag = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    cmd.extend([
        "-v", vol_flag,
        PODMAN_CONTAINER_IMAGE,
        "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_action.sh", "collect"
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
    """Executes baseline refresh inside the sentry-ansible container.

    Re-runs SNMP bulkwalk collection and metric parsing to refresh
    the per_interface_metrics.json file consumed by the Network Baseline graph.
    """
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()
    scripts_abs_path = (BASE_DIR / "scripts").resolve()

    cmd = ["podman", "run", "--rm", "--pull=never"]
    if system == "Linux":
        cmd.append("--network=host")

    vol_pb = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    vol_scripts = f"{scripts_abs_path}:/scripts:Z" if system == "Linux" else f"{scripts_abs_path}:/scripts"
    cmd.extend([
        "-v", vol_pb,
        "-v", vol_scripts,
        PODMAN_CONTAINER_IMAGE,
        "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_action.sh", "refresh"
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


def read_playbook_content(filename: str) -> str:
    """Read a playbook YAML file and return its content as a string."""
    content = read_playbook_file(filename)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Playbook '{filename}' not found"
        )
    return content


MODIFY_SYSTEM_PROMPT = """You are a YAML modification expert for Ansible playbooks.

Given an original playbook YAML and a modification request, you must:

1. Change ONLY what the user explicitly asked to modify. Keep everything else exactly as-is.
2. The modified playbook MUST be valid YAML — same structure, indentation, and format as the original.
3. Output the full modified playbook YAML inside a ```yaml code block.
4. After the YAML block, output metadata inside a ```json code block.

CRITICAL — only change what the user asked:
- Wrong: User asks "change hosts to Edge_routers" and you also change gather_facts, gather_subset, etc.
- Right: Only change hosts. Everything else identical to the original.

CRITICAL — exact host group names (Ansible is case-sensitive):
When changing the "hosts:" value, you MUST use one of the exact group names listed in
"Valid inventory groups for this playbook" below. Match capitalization precisely.
If the user says "edge" or "edge routers" and the valid group is "Edge_routers",
use "Edge_routers". Never change capitalization or use generic names.

Wrong: hosts: edge_routers    → will match 0 devices, playbook fails
Wrong: hosts: edge            → doesn't exist
Right: hosts: Edge_routers    → matches correctly

Example:
Original (partial):
  hosts: allHosts
  gather_facts: false
  
  tasks:
    - name: Collect all available facts
      cisco.ios.ios_facts:
        gather_subset: all

User: "Change hosts from allHosts to edge routers"
Valid groups: allHosts, Edge_routers, Core_Switches

Correct modified YAML (only hosts changed, exact group name used):
  hosts: Edge_routers
  gather_facts: false
  
  tasks:
    - name: Collect all available facts
      cisco.ios.ios_facts:
        gather_subset: all

Format your response exactly like this (no other text before or after):

```yaml
<full modified playbook YAML>
```

```json
{
  "name": "<short display name>",
  "description": "<description>",
  "tags": ["<include original tags>"],
  "severity": "<low|medium|high|critical>",
  "destructive": <true|false>,
  "target_devices": ["<target device groups>"],
  "example_intents": ["<keep original intents, add new ones for this modification>"],
  "plain_explanation": "<one sentence on what changed>"
}
```"""


async def generate_playbook_modification(
    playbook_name: str,
    modification: str,
    hf_api_key: str,
    model: str = "deepseek-ai/DeepSeek-R1:novita"
) -> dict:
    """Call the HF API to generate a modified playbook YAML based on a description."""
    import httpx
    import json as json_mod

    original_content = read_playbook_content(playbook_name)

    hf_api_url = "https://router.huggingface.co/v1/chat/completions"

    valid_groups = get_inventory_groups()
    groups_str = ", ".join(valid_groups) if valid_groups else "N/A"

    messages = [
        {"role": "system", "content": MODIFY_SYSTEM_PROMPT},
        {"role": "user", "content": f"Original playbook YAML:\n```yaml\n{original_content}\n```\n\nModification request: {modification}\n\nValid inventory groups for this playbook (use exact capitalization): {groups_str}"}
    ]

    headers = {
        "Authorization": f"Bearer {hf_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "messages": messages,
        "model": model,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(hf_api_url, json=payload, headers=headers)

    if response.status_code != 200:
        error_text = response.text[:300]
        raise HTTPException(
            status_code=response.status_code,
            detail=f"HF API error during modification generation: {error_text}",
        )

    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

    # Extract YAML from ```yaml block and metadata from ```json block
    import re
    yaml_match = re.search(r'```yaml\n([\s\S]*?)```', content)
    json_match = re.search(r'```json\n([\s\S]*?)```', content)

    if not yaml_match:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM response missing ```yaml code block. Response: {content[:500]}",
        )

    modified_yaml = yaml_match.group(1).strip()

    metadata = {}
    if json_match:
        try:
            metadata = json_mod.loads(json_match.group(1))
        except json_mod.JSONDecodeError:
            logger.warning(f"Failed to parse metadata JSON from LLM response: {content[:300]}")

    return {
        "original_content": original_content,
        "modified_content": modified_yaml,
        "name": metadata.get("name", f"{Path(playbook_name).stem} (Modified)"),
        "description": metadata.get("description", f"Modified version of {playbook_name}"),
        "tags": metadata.get("tags", []),
        "severity": metadata.get("severity", "medium"),
        "destructive": metadata.get("destructive", False),
        "target_devices": metadata.get("target_devices", []),
        "example_intents": metadata.get("example_intents", []),
        "plain_explanation": metadata.get("plain_explanation", f"Modified {playbook_name} based on request."),
    }


def derive_modified_filename(original_name: str) -> str:
    """Derive a new filename for the modified playbook, avoiding collisions."""
    p = Path(original_name)
    stem = p.stem
    suffix = p.suffix or ".yml"
    new_name = f"{stem}_modified{suffix}"
    filepath = PLAYBOOKS_DIR / new_name
    counter = 1
    while filepath.exists():
        new_name = f"{stem}_modified_{counter}{suffix}"
        filepath = PLAYBOOKS_DIR / new_name
        counter += 1
    return new_name


def compute_yaml_diff(original: str, modified: str) -> str:
    """Compute a unified diff between original and modified YAML content."""
    import difflib
    original_lines = original.splitlines(keepends=True)
    modified_lines = modified.splitlines(keepends=True)
    diff_lines = list(difflib.unified_diff(
        original_lines,
        modified_lines,
        fromfile="original",
        tofile="modified",
        n=3,
    ))
    return "".join(diff_lines)


def save_modified_playbook(
    original_name: str,
    proposed_name: str,
    modified_content: str,
    metadata: dict,
) -> tuple:
    """Save a modified playbook: write YAML, update catalog.

    Returns (filename, catalog_entry_dict) so the caller can persist to MongoDB.
    """
    filename = save_playbook_file(proposed_name, modified_content.encode("utf-8"))

    # Read original catalog entry to inherit example_intents and other metadata
    catalog = read_catalog_raw()
    original_entry = {}
    for entry in catalog:
        if entry.get("filename") == original_name:
            original_entry = entry
            break

    original_intents = original_entry.get("example_intents", [])
    new_intents = metadata.get("example_intents", [])
    merged_intents = list(dict.fromkeys(original_intents + new_intents))

    # Build catalog entry
    catalog_entry = {
        "filename": filename,
        "name": metadata.get("name", f"{Path(original_name).stem} (Modified)"),
        "description": metadata.get("description", f"Modified version of {original_name}"),
        "tags": metadata.get("tags", original_entry.get("tags", [])),
        "target_devices": metadata.get("target_devices", original_entry.get("target_devices", [])),
        "example_intents": merged_intents,
        "destructive": metadata.get("destructive", original_entry.get("destructive", False)),
        "severity": metadata.get("severity", original_entry.get("severity", "medium")),
    }

    # Add to catalog
    catalog.append(catalog_entry)
    if not save_catalog(catalog):
        delete_playbook_file(filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to write catalog.json",
        )

    return filename, catalog_entry


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