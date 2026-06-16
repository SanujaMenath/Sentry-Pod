import os
import re
import asyncio
import logging
from pathlib import Path
from collections import deque
from datetime import datetime, timezone
from typing import List, Dict, Optional

from app.database import db
from app.services.playbook_service import PLAYBOOKS_DIR, get_podman_command

logger = logging.getLogger(__name__)

CDP_OUTPUT_DIR = PLAYBOOKS_DIR / "cdp_output"

TIER_ORDER = ["edge", "core", "distribution", "access"]

# --- CDP Detail Parser ---
# Multi-entry CDP neighbors detail has entries separated by "-------------------------"
# Each entry has: Device ID, IP address(es), Platform, Capabilities, Interface, Port ID

CDP_DETAIL_ENTRY_SPLIT = re.compile(r"-{25,}")

def _strip_domain(device_id: str) -> str:
    return device_id.split(".")[0] if "." in device_id else device_id


def _parse_detail_entry(entry: str, source_device: str) -> Optional[dict]:
    target_device = _extract_field(entry, r"Device ID:\s*(.+)")
    if not target_device:
        return None
    target_device = _strip_domain(target_device)

    target_ip = _extract_field(entry, r"IP address:\s*(\S+)")
    platform_line = _extract_field(entry, r"Platform:\s*(.+?),")
    capabilities_line = _extract_field(entry, r"Capabilities:\s*(.+?)(?:\n|$)")
    interface_line = _extract_field(entry, r"Interface:\s*(.+?),")
    port_id_line = _extract_field(entry, r"Port ID \(outgoing port\):\s*(.+)")

    return {
        "source_device": source_device,
        "source_interface": interface_line.strip() if interface_line else "",
        "target_device": target_device.strip(),
        "target_interface": port_id_line.strip() if port_id_line else "",
        "target_platform": platform_line.strip() if platform_line else "",
        "target_capabilities": capabilities_line.strip() if capabilities_line else "",
        "target_ip": target_ip.strip() if target_ip else "",
        "protocol": "cdp",
    }


# --- CDP Brief Parser ---
# show cdp neighbors output (table format):
# Device ID        Local Intrfce     Holdtme    Capability  Platform    Port ID
# R1               Gig 0/1           145        R           ISR4321     Gig 0/0

_CAPABILITY_MAP = {
    "R": "Router",
    "S": "Switch",
    "H": "Host",
    "I": "IGMP",
    "T": "TransBridge",
    "B": "SourceRouteBridge",
    "M": "Switch",
    "r": "Repeater",
    "P": "Phone",
}

BRIEF_COLUMNS = re.compile(r"\s{2,}")

def _expand_capabilities(abbr_str: str) -> str:
    expanded = []
    for ch in abbr_str.strip():
        if ch in _CAPABILITY_MAP:
            expanded.append(_CAPABILITY_MAP[ch])
    return " ".join(expanded) if expanded else abbr_str


def _parse_brief_line(line: str, source_device: str) -> Optional[dict]:
    parts = BRIEF_COLUMNS.split(line.strip())
    if len(parts) < 6:
        return None

    target_device = _strip_domain(parts[0])
    local_intf = parts[1]
    capability = _expand_capabilities(parts[3])
    platform = parts[4]
    port_id = parts[5]

    return {
        "source_device": source_device,
        "source_interface": local_intf,
        "target_device": target_device,
        "target_interface": port_id,
        "target_platform": platform,
        "target_capabilities": capability,
        "target_ip": "",
        "protocol": "cdp",
    }


def _extract_field(text: str, pattern: str) -> str:
    m = re.search(pattern, text)
    return m.group(1).strip() if m else ""


def _is_brief_format(text: str) -> bool:
    return bool(re.search(r"Device ID\s+Local Intrfce", text))


def parse_cdp_output(source_device: str, raw_text: str) -> List[dict]:
    if not raw_text.strip():
        return []

    if _is_brief_format(raw_text):
        records = []
        for line in raw_text.splitlines():
            line = line.strip()
            if not line or line.startswith("Device ID"):
                continue
            record = _parse_brief_line(line, source_device)
            if record:
                records.append(record)
        return records

    records = []
    entries = CDP_DETAIL_ENTRY_SPLIT.split(raw_text)
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        record = _parse_detail_entry(entry, source_device)
        if record:
            records.append(record)
    return records


def parse_all_cdp_files() -> List[dict]:
    if not CDP_OUTPUT_DIR.exists():
        logger.warning(f"CDP output directory not found: {CDP_OUTPUT_DIR}")
        return []

    all_records = []
    for fpath in sorted(CDP_OUTPUT_DIR.glob("*.txt")):
        device_name = fpath.stem
        text = fpath.read_text(encoding="utf-8", errors="ignore")
        records = parse_cdp_output(device_name, text)
        all_records.extend(records)
        logger.info(f"Parsed {len(records)} neighbors from {device_name}")

    return all_records


# --- Tier Discovery ---

# Hardcoded override for known devices — takes priority over BFS auto-discovery.
# Add new devices here as your network grows.
DEVICE_TIER = {
    "R1": "edge", "R2": "edge",
    "ESW1": "core", "ESW2": "core",
    "ESW3": "distribution", "ESW4": "distribution",
    "ESW5": "distribution", "ESW6": "distribution",
    "ESW7": "access", "ESW8": "access", "ESW9": "access", "ESW10": "access",
    "ESW11": "access", "ESW12": "access", "ESW13": "access", "ESW14": "access",
}


def discover_tiers(neighbors: List[dict]) -> Dict[str, str]:
    adjacency: Dict[str, set] = {}
    capabilities: Dict[str, str] = {}
    all_devices: set = set()

    for n in neighbors:
        src = n["source_device"]
        tgt = n["target_device"]
        all_devices.add(src)
        all_devices.add(tgt)
        adjacency.setdefault(src, set()).add(tgt)
        adjacency.setdefault(tgt, set()).add(src)

        cap = n.get("target_capabilities", "")
        if tgt not in capabilities:
            capabilities[tgt] = cap

    edge_devices = {
        d for d in all_devices
        if "Router" in capabilities.get(d, "")
    }

    if not edge_devices:
        logger.warning("No Router-capable devices found, marking all as unknown")
        return {d: "unknown" for d in all_devices}

    tiers: Dict[str, str] = {}
    visited: set = set()
    queue: deque = deque()

    for d in edge_devices:
        tiers[d] = "edge"
        visited.add(d)
        queue.append((d, 1))

    while queue:
        current, depth = queue.popleft()
        for neighbor in adjacency.get(current, set()):
            if neighbor in visited:
                continue
            visited.add(neighbor)

            if depth == 1:
                tier = "core"
            elif depth == 2:
                tier = "distribution"
            else:
                tier = "access"

            tiers[neighbor] = tier
            queue.append((neighbor, depth + 1))

    for d in all_devices:
        if d not in tiers:
            tiers[d] = "unknown"

    for device, tier in DEVICE_TIER.items():
        if device in tiers:
            tiers[device] = tier

    return tiers


# --- Graph Builder ---

def build_graph(neighbors: List[dict]) -> dict:
    tiers = discover_tiers(neighbors)

    node_map: Dict[str, dict] = {}
    edges: List[dict] = []
    edge_set: set = set()

    for n in neighbors:
        src = n["source_device"]
        tgt = n["target_device"]

        if src not in node_map:
            node_map[src] = {
                "id": src,
                "label": src,
                "tier": tiers.get(src, "unknown"),
                "ip": "",
                "platform": "",
            }
        if tgt not in node_map:
            node_map[tgt] = {
                "id": tgt,
                "label": tgt,
                "tier": tiers.get(tgt, "unknown"),
                "ip": n.get("target_ip", ""),
                "platform": n.get("target_platform", ""),
            }

        edge_key = tuple(sorted([src, tgt]))
        if edge_key not in edge_set:
            edge_set.add(edge_key)
            edges.append({
                "id": f"{src}--{tgt}",
                "source": src,
                "target": tgt,
                "source_interface": n.get("source_interface", ""),
                "target_interface": n.get("target_interface", ""),
            })

    nodes = list(node_map.values())
    nodes.sort(key=lambda n: (TIER_ORDER.index(n["tier"]) if n["tier"] in TIER_ORDER else 99, n["label"]))

    return {"nodes": nodes, "edges": edges}


# --- MongoDB Operations ---

async def store_neighbors(neighbors: List[dict]):
    collection = db.get_collection("cdp_neighbors")
    await collection.delete_many({})
    if neighbors:
        now = datetime.now(timezone.utc)
        for n in neighbors:
            n["last_seen"] = now
        await collection.insert_many(neighbors)


async def store_graph(graph: dict):
    collection = db.get_collection("topology_cache")
    graph["last_refreshed"] = datetime.now(timezone.utc)
    await collection.replace_one({"_id": "current"}, graph, upsert=True)


async def get_topology_graph() -> Optional[dict]:
    collection = db.get_collection("topology_cache")
    doc = await collection.find_one({"_id": "current"})
    if doc:
        doc.pop("_id", None)
    return doc


# --- Orchestration ---

async def refresh_topology():
    logger.info("Starting CDP collection via ansible-playbook")
    cmd = get_podman_command("getCDPNeighbors.yml")
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    output = stdout.decode() if stdout else ""
    logger.info(f"Playbook exit code: {proc.returncode}")

    logger.info("Parsing CDP output files")
    neighbors = parse_all_cdp_files()
    logger.info(f"Parsed {len(neighbors)} neighbor records")

    if not neighbors:
        logger.warning("No neighbors found — keeping existing cached graph intact")
        existing = await get_topology_graph()
        if existing:
            return {
                "nodes": len(existing["nodes"]),
                "edges": len(existing["edges"]),
                "neighbors": 0,
                "note": "No CDP data found, returning cached graph",
            }
        return {"nodes": 0, "edges": 0, "neighbors": 0, "note": "No CDP data found"}

    logger.info("Building topology graph")
    graph = build_graph(neighbors)
    logger.info(f"Graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")

    await store_neighbors(neighbors)
    await store_graph(graph)

    return {"nodes": len(graph["nodes"]), "edges": len(graph["edges"]), "neighbors": len(neighbors)}
