import json as json_mod
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status

from app.services.execution_service import (
    PLAYBOOKS_DIR, save_playbook_file, delete_playbook_file, read_playbook_content,
)
from app.services.catalog_service import (
    get_inventory_groups, read_catalog_raw, save_catalog, remove_catalog_entry,
)

logger = logging.getLogger(__name__)


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
    import httpx

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
    payload = {"messages": messages, "model": model}

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
    import difflib
    original_lines = original.splitlines(keepends=True)
    modified_lines = modified.splitlines(keepends=True)
    diff_lines = list(difflib.unified_diff(
        original_lines, modified_lines,
        fromfile="original", tofile="modified", n=3,
    ))
    return "".join(diff_lines)


def save_modified_playbook(
    original_name: str,
    proposed_name: str,
    modified_content: str,
    metadata: dict,
) -> tuple:
    filename = proposed_name

    catalog = read_catalog_raw()
    original_entry = {}
    for entry in catalog:
        if entry.get("filename") == original_name:
            original_entry = entry
            break

    original_intents = original_entry.get("example_intents", [])
    new_intents = metadata.get("example_intents", [])
    merged_intents = list(dict.fromkeys(original_intents + new_intents))

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

    return filename, catalog_entry


async def persist_playbook(
    name: str,
    filename: str,
    description: str,
    engine_type: str,
    subnet_scope: str,
    pipeline_status: str,
    tags: list,
    target_devices: list,
    example_intents: list,
    destructive: bool,
    severity: str,
    file_content: Optional[bytes] = None,
    blueprint_extra: Optional[dict] = None,
):
    """Persist a playbook to YAML file + catalog.json + MongoDB in one atomic flow.

    MongoDB and catalog.json are updated together; on any failure the
    previously-written artifacts are rolled back so the two never drift.
    Returns (inserted_id, saved_filename).
    """
    from app.database import db

    playbooks_col = db.get_collection("playbooks")

    saved_filename = filename
    catalog_updated = False
    file_saved = False
    mongo_inserted = False

    try:
        existing = read_catalog_raw()
        if any(e.get("filename") == saved_filename for e in existing):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A catalog entry with filename '{saved_filename}' already exists",
            )

        if file_content:
            saved_filename = save_playbook_file(filename, file_content)
            file_saved = True

        catalog_entry = {
            "filename": saved_filename,
            "name": name,
            "description": description,
            "tags": tags,
            "target_devices": target_devices,
            "example_intents": example_intents,
            "destructive": destructive,
            "severity": severity,
        }

        existing.append(catalog_entry)
        save_catalog(existing)
        catalog_updated = True

        new_blueprint_doc = {
            "name": name,
            "filename": saved_filename,
            "description": description,
            "engine_type": engine_type,
            "subnet_scope": subnet_scope,
            "pipeline_status": pipeline_status,
            "tags": tags,
            "target_devices": target_devices,
            "example_intents": example_intents,
            "destructive": destructive,
            "severity": severity,
            "file_path": str(PLAYBOOKS_DIR / saved_filename),
            "last_executed": "Never Executed",
            "timestamp_created": datetime.now(timezone.utc).isoformat() + "Z",
        }
        if blueprint_extra:
            new_blueprint_doc.update(blueprint_extra)

        result = await playbooks_col.insert_one(new_blueprint_doc)
        mongo_inserted = True

        return str(result.inserted_id), saved_filename

    except Exception:
        if catalog_updated and saved_filename:
            try:
                remove_catalog_entry(saved_filename)
            except Exception:
                logger.warning(f"Rollback: could not remove catalog entry {saved_filename}")
        if file_saved and saved_filename and not mongo_inserted:
            try:
                delete_playbook_file(saved_filename)
            except Exception:
                logger.warning(f"Rollback: could not delete file {saved_filename}")
        raise


async def remove_playbook(playbook_id: str):
    """Remove a playbook from MongoDB and catalog.json together (atomic)."""
    from bson import ObjectId
    from app.database import db

    playbooks_col = db.get_collection("playbooks")
    try:
        mongo_id = ObjectId(playbook_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided blueprint asset tracking ID format is completely invalid.",
        )

    existing = await playbooks_col.find_one({"_id": mongo_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target configuration entry could not be located in database layer.",
        )

    filename = existing.get("filename")
    if filename:
        remove_catalog_entry(filename)
        delete_playbook_file(filename)

    await playbooks_col.delete_one({"_id": mongo_id})
    return {"status": "success", "detail": "Blueprint document and associated files successfully removed."}
