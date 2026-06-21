import os
import json
import yaml
import logging
from pathlib import Path
from typing import List, Tuple, Optional
from fastapi import HTTPException, status

from app.models.playbook import PlaybookCatalogItem, PlaybookSuggestion

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent.parent
PLAYBOOKS_DIR = BASE_DIR / "playbooks"
CATALOG_PATH = PLAYBOOKS_DIR / "catalog.json"
HOSTS_INI_PATH = PLAYBOOKS_DIR / "hosts.ini"

_catalog_cache = None


def load_catalog() -> List[PlaybookCatalogItem]:
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


def get_playbook_files() -> List[str]:
    playbooks = [f.name for f in PLAYBOOKS_DIR.glob('*.yml')] + [f.name for f in PLAYBOOKS_DIR.glob('*.yaml')]
    return sorted([p for p in playbooks if not p.startswith('.')])


def extract_playbook_preview(filename: str) -> str:
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
