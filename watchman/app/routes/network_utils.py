import json
import os
import re
from typing import Optional, List

from app.database import devices_collection


def load_metrics() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    candidates = [
        os.path.join(repo_root, "snmp_output", "per_interface_metrics.json"),
        os.path.join(repo_root, "playbooks", "snmp_output", "per_interface_metrics.json"),
    ]
    for metrics_path in candidates:
        try:
            if os.path.exists(metrics_path):
                with open(metrics_path, "r", encoding="utf-8") as fh:
                    return json.load(fh)
        except Exception:
            continue
    return {}


def load_host_aliases() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    inventory_path = os.path.join(repo_root, "playbooks", "hosts.ini")
    aliases = {}
    section_ranks = {
        "edge_routers": 0, "core_switches": 1,
        "distribution_switches": 2, "access_switches": 3,
    }
    current_rank = 99
    if not os.path.exists(inventory_path):
        return aliases
    host_re = re.compile(r"^(?P<name>\S+)\s+.*?ansible_host=(?P<ip>\S+)")
    try:
        with open(inventory_path, "r", encoding="utf-8") as fh:
            for line in fh:
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                if stripped.startswith("[") and stripped.endswith("]"):
                    current_rank = section_ranks.get(stripped.strip("[]").lower(), 99)
                    continue
                match = host_re.search(stripped)
                if match:
                    aliases[match.group("ip")] = {
                        "name": match.group("name"),
                        "rank": current_rank,
                    }
    except Exception:
        return aliases
    return aliases


def load_devices_from_inventory() -> list:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    inventory_path = os.path.join(repo_root, "playbooks", "hosts.ini")
    group_type_map = {
        "edge_routers": "router", "core_switches": "switch",
        "distribution_switches": "switch", "access_switches": "switch",
    }
    if not os.path.exists(inventory_path):
        return []
    devices = []
    seen_names = set()
    current_section = None
    host_re = re.compile(r"^(?P<name>\S+)\s+.*?ansible_host=(?P<ip>\S+)")
    try:
        with open(inventory_path, "r", encoding="utf-8") as fh:
            for line in fh:
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                if stripped.startswith("[") and stripped.endswith("]"):
                    section = stripped.strip("[]").lower().partition(":")[0]
                    current_section = group_type_map.get(section)
                    continue
                if current_section is None:
                    continue
                match = host_re.search(stripped)
                if match and match.group("name") not in seen_names:
                    seen_names.add(match.group("name"))
                    devices.append({
                        "id": slugify(match.group("name")),
                        "name": match.group("name"),
                        "ip": match.group("ip"),
                        "type": current_section,
                        "model": "Cisco IOS Device", "version": "Unknown",
                        "uptime": "N/A", "cpu": 0, "memory": 0, "online": True,
                    })
    except Exception:
        return devices
    return devices


def load_hosts_ini_credentials() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    inventory_path = os.path.join(repo_root, "playbooks", "hosts.ini")
    if not os.path.exists(inventory_path):
        return {}
    credentials = {}
    in_vars_section = False
    try:
        with open(inventory_path, "r", encoding="utf-8") as fh:
            for line in fh:
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                if stripped.startswith("[") and stripped.endswith("]"):
                    in_vars_section = stripped[1:-1].lower() == "allhosts:vars"
                    continue
                if in_vars_section and "=" in stripped:
                    key, _, value = stripped.partition("=")
                    stripped_key = key.strip()
                    if stripped_key == "ansible_user":
                        credentials["username"] = value.strip()
                    elif stripped_key == "ansible_password":
                        credentials["password"] = value.strip()
    except Exception:
        return credentials
    return credentials


def get_host_sort_key(host: str, host_aliases: dict) -> tuple:
    alias = host_aliases.get(host, {})
    label = alias.get("name", host).lower()
    parts = re.split(r"(\d+)", label)
    natural_parts = [int(part) if part.isdigit() else part for part in parts]
    return tuple(natural_parts + [host])


def normalize_interface_status(value: Optional[str]) -> str:
    if not value:
        return ""
    return str(value).strip().lower()


def is_interface_up(item: dict) -> bool:
    admin_status = normalize_interface_status(item.get("ifAdminStatus"))
    oper_status = normalize_interface_status(item.get("ifOperStatus"))
    if admin_status or oper_status:
        return admin_status == "up" and oper_status == "up"
    return int(item.get("ciscoMacNotification", 0)) > 0


DEFAULT_DEVICES = [
    {"id": "core-sw-01", "name": "core-sw-01", "ip": "192.168.1.1", "type": "switch",
     "model": "Cisco Catalyst 9300", "version": "IOS-XE 17.6.3", "uptime": "45 days", "cpu": 34, "memory": 62, "online": True},
    {"id": "router-edge-01", "name": "router-edge-01", "ip": "10.0.0.1", "type": "router",
     "model": "Cisco ISR 4451", "version": "IOS-XE 16.12.5", "uptime": "12 days", "cpu": 87, "memory": 71, "online": True},
    {"id": "access-sw-02", "name": "access-sw-02", "ip": "192.168.1.12", "type": "switch",
     "model": "Cisco Catalyst 2960X", "version": "IOS 15.2(7)", "uptime": "89 days", "cpu": 28, "memory": 54, "online": True},
    {"id": "dist-sw-03", "name": "dist-sw-03", "ip": "192.168.1.13", "type": "switch",
     "model": "Cisco Catalyst 2960X", "version": "IOS 15.2(7)", "uptime": "89 days", "cpu": 31, "memory": 59, "online": True},
]

DEVICE_TIER = {
    "R1": "edge", "R2": "edge",
    "ESW1": "core", "ESW2": "core",
    "ESW3": "distribution", "ESW4": "distribution",
    "ESW5": "distribution", "ESW6": "distribution",
    "ESW7": "access", "ESW8": "access", "ESW9": "access", "ESW10": "access",
    "ESW11": "access", "ESW12": "access", "ESW13": "access", "ESW14": "access",
}

TIER_ORDER = ["edge", "core", "distribution", "access"]

TIER_LABELS = {"edge": "Edge/WAN", "core": "Core", "distribution": "Distribution", "access": "Access"}

STATUS_REASON_LABELS = {
    "edge_layer_down": "Edge/WAN layer is fully down — lower tiers cannot route out",
    "core_layer_down": "Core layer is fully down — distribution and access are isolated",
    "distribution_layer_down": "Distribution layer is fully down — access switches isolated",
}


def _build_device_status() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    all_devices = load_devices_from_inventory()
    active_devices_path = os.path.join(repo_root, "nmap_output", "active_devices.json")
    active_ips = set()
    active_device_map = {}
    scan_timestamp = None
    try:
        if os.path.exists(active_devices_path):
            with open(active_devices_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for d in data.get("devices", []):
                    active_ips.add(d["ip"])
                    active_device_map[d["ip"]] = d
                scan_timestamp = data.get("scan_timestamp")
    except Exception:
        pass
    for device in all_devices:
        ip = device["ip"]
        is_online = ip in active_ips
        device["online"] = is_online
        device["tier"] = DEVICE_TIER.get(device["name"], "access")
        if is_online:
            nmap_device = active_device_map.get(ip, {})
            if nmap_device.get("model") and nmap_device["model"] != "Cisco IOS Device":
                device["model"] = nmap_device["model"]
            if nmap_device.get("version"):
                device["version"] = nmap_device["version"]
            if nmap_device.get("uptime"):
                device["uptime"] = nmap_device["uptime"]
    cascade_down = False
    cascade_reason = None
    for tier in TIER_ORDER:
        tier_devices = [d for d in all_devices if d.get("tier") == tier]
        if not tier_devices:
            continue
        tier_online_count = sum(1 for d in tier_devices if d.get("online"))
        if cascade_down:
            for d in tier_devices:
                d["effective_status"] = "degraded"
                d["status_reason"] = cascade_reason
        elif tier_online_count == 0:
            for d in tier_devices:
                d["effective_status"] = "offline"
                d["status_reason"] = None
            cascade_down = True
            cascade_reason = f"{tier}_layer_down"
        else:
            for d in tier_devices:
                d["effective_status"] = "online" if d.get("online") else "offline"
                d["status_reason"] = None
    total = len(all_devices)
    online_count = sum(1 for d in all_devices if d.get("effective_status") == "online")
    degraded_count = sum(1 for d in all_devices if d.get("effective_status") == "degraded")
    tier_summary = {}
    for tier in TIER_ORDER:
        tier_devices = [d for d in all_devices if d.get("tier") == tier]
        if tier_devices:
            tier_online = sum(1 for d in tier_devices if d.get("online"))
            tier_summary[tier] = {
                "total": len(tier_devices), "online": tier_online,
                "healthy": tier_online > 0, "label": TIER_LABELS.get(tier, tier),
            }
    return {
        "devices": all_devices, "online_count": online_count,
        "offline_count": total - online_count - degraded_count,
        "degraded_count": degraded_count, "total_count": total,
        "scan_timestamp": scan_timestamp, "tier_summary": tier_summary,
    }


async def find_device(device_id: str):
    device = await devices_collection.find_one({"$or": [{"id": device_id}, {"name": device_id}]})
    if device:
        return serialize_device(device)
    device = next(
        (d for d in DEFAULT_DEVICES if d["id"] == device_id or d["name"] == device_id), None,
    )
    if device:
        return dict(device)
    return next(
        (d for d in load_devices_from_inventory() if d["id"] == device_id or d["name"] == device_id), None,
    )


def serialize_device(device: dict) -> dict:
    device.pop("_id", None)
    device.setdefault("id", slugify(device.get("name", device.get("ip", "device"))))
    device.setdefault("type", "switch")
    device.setdefault("model", "Pending discovery")
    device.setdefault("version", "Unknown")
    device.setdefault("uptime", "N/A")
    device.setdefault("cpu", 0)
    device.setdefault("memory", 0)
    device.setdefault("online", False)
    return device


def slugify(value: str) -> str:
    cleaned = []
    last_dash = False
    for char in value.lower():
        if char.isalnum():
            cleaned.append(char)
            last_dash = False
        elif not last_dash:
            cleaned.append("-")
            last_dash = True
    return "".join(cleaned).strip("-")


def escape_regex(value: str) -> str:
    return "".join(f"\\{char}" if char in r"\.^$*+?{}[]|()" else char for char in value)


def build_prompt(device: dict) -> str:
    if device["type"] == "router":
        return "R1#"
    if device["type"] == "firewall":
        return "FW1#"
    if device["name"].startswith("core"):
        return "CORE1#"
    if device["name"].startswith("dist"):
        return "DIST1#"
    return "SW1#"


def build_terminal_output(device: dict, command: str) -> str:
    normalized = " ".join(command.lower().split())
    if normalized in {"sh ip int br", "show ip int br", "show ip interface brief"}:
        return build_ip_interface_brief(device)
    if normalized in {"show version", "sh version", "show ver", "sh ver"}:
        return "\n".join([
            f"Cisco IOS Software, {device['model']} Software",
            f"System image file is \"flash:{device['version'].replace(' ', '_')}.bin\"",
            f"{device['name']} uptime is {device['uptime']}",
            f"Processor board ID {device['id'].upper().replace('-', '')}",
        ])
    if normalized in {"show running-config", "sh run"}:
        return "\n".join([
            "Building configuration...", "",
            "Current configuration : 1248 bytes", "!",
            f"hostname {build_prompt(device).rstrip('#')}", "!",
            "interface GigabitEthernet0/0",
            f" ip address {device['ip']} 255.255.255.0", " no shutdown", "!",
            "line vty 0 4", " login local", " transport input ssh", "!", "end",
        ])
    if normalized.startswith("ping "):
        target = command.split(maxsplit=1)[1]
        return "\n".join([
            "Type escape sequence to abort.",
            f"Sending 5, 100-byte ICMP Echos to {target}, timeout is 2 seconds:",
            "!!!!!",
            "Success rate is 100 percent (5/5), round-trip min/avg/max = 1/3/8 ms",
        ])
    if normalized in {"show interfaces status", "sh interfaces status", "show int status"}:
        return "\n".join([
            "Port      Name               Status       Vlan       Duplex  Speed Type",
            "Gi0/0                        connected    routed     a-full  a-1000 10/100/1000BaseTX",
            "Gi0/1                        connected    10         a-full  a-1000 10/100/1000BaseTX",
            "Gi0/2                        notconnect   1          auto    auto   10/100/1000BaseTX",
        ])
    if normalized in {"help", "?"}:
        return "\n".join([
            "Common commands:",
            "  show ip interface brief",
            "  show version",
            "  show running-config",
            "  show interfaces status",
            "  ping <ip-address>",
        ])
    return f"% Invalid input detected at '^' marker.\n{command}\n^"


def build_ip_interface_brief(device: dict) -> str:
    if device["type"] == "router":
        rows = [
            ("FastEthernet0/0", "10.1.0.1", "YES", "NVRAM", "up", "up"),
            ("FastEthernet0/1", "10.0.0.13", "YES", "NVRAM", "up", "up"),
            ("FastEthernet1/0", "unassigned", "YES", "NVRAM", "administratively down", "down"),
            ("FastEthernet1/1", "unassigned", "YES", "NVRAM", "administratively down", "down"),
            ("GigabitEthernet2/0", "192.168.122.252", "YES", "NVRAM", "up", "up"),
            ("Loopback0", device["ip"], "YES", "NVRAM", "up", "up"),
        ]
    else:
        rows = [
            ("Vlan1", "unassigned", "YES", "NVRAM", "administratively down", "down"),
            ("Vlan10", device["ip"], "YES", "NVRAM", "up", "up"),
            ("GigabitEthernet0/1", "unassigned", "YES", "unset", "up", "up"),
            ("GigabitEthernet0/2", "unassigned", "YES", "unset", "up", "up"),
            ("GigabitEthernet0/3", "unassigned", "YES", "unset", "down", "down"),
            ("Loopback0", "10.0.0.1", "YES", "NVRAM", "up", "up"),
        ]
    lines = ["Interface              IP-Address      OK? Method Status                Protocol"]
    for interface, ip_address, ok, method, status_value, protocol in rows:
        lines.append(f"{interface:<22} {ip_address:<15} {ok:<3} {method:<6} {status_value:<21} {protocol}")
    return "\n".join(lines)
