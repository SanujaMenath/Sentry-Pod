import asyncio
import contextlib
import json
import os
import math
import re
import sys
import subprocess

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from typing import List, Optional
from app.database import device_configurations_collection, devices_collection
from app.models.telemetry import (
    DeviceConfiguration,
    DeviceConfigurationRequest,
    DeviceConfigurationResponse,
    NetworkDevice,
    NetworkDeviceCreate,
    NetworkTerminalCommand,
    NetworkTerminalResponse,
    TrafficDataPoint,
)
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/network", tags=["Network Telemetry"])


def load_metrics() -> dict:
    """Load per-interface metrics from the repository `snmp_output` dump.

    Falls back to an empty dict if the file is missing or invalid.
    """
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
    """Map SNMP host IPs to inventory hostnames from the Ansible inventory."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    inventory_path = os.path.join(repo_root, "playbooks", "hosts.ini")
    aliases = {}
    section_ranks = {
        "edge_routers": 0,
        "core_switches": 1,
        "distribution_switches": 2,
        "access_switches": 3,
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
    {
        "id": "core-sw-01",
        "name": "core-sw-01",
        "ip": "192.168.1.1",
        "type": "switch",
        "model": "Cisco Catalyst 9300",
        "version": "IOS-XE 17.6.3",
        "uptime": "45 days",
        "cpu": 34,
        "memory": 62,
        "online": True,
    },
    {
        "id": "router-edge-01",
        "name": "router-edge-01",
        "ip": "10.0.0.1",
        "type": "router",
        "model": "Cisco ISR 4451",
        "version": "IOS-XE 16.12.5",
        "uptime": "12 days",
        "cpu": 87,
        "memory": 71,
        "online": True,
    },
    {
        "id": "access-sw-02",
        "name": "access-sw-02",
        "ip": "192.168.1.12",
        "type": "switch",
        "model": "Cisco Catalyst 2960X",
        "version": "IOS 15.2(7)",
        "uptime": "89 days",
        "cpu": 28,
        "memory": 54,
        "online": True,
    },
    {
        "id": "dist-sw-03",
        "name": "dist-sw-03",
        "ip": "192.168.1.13",
        "type": "switch",
        "model": "Cisco Catalyst 2960X",
        "version": "IOS 15.2(7)",
        "uptime": "89 days",
        "cpu": 31,
        "memory": 59,
        "online": True,
    },
]

@router.get("/traffic-history", response_model=List[TrafficDataPoint])
async def get_traffic_history(device: Optional[str] = None, ifIndex: Optional[int] = None, allInterfaces: Optional[bool] = False):
    """
    Returns a simple 24h series (13 points every 2 hours) using the latest
    `ciscoMacNotification` value from the parsed metrics. If `ifIndex` is
    provided, use that interface; if `allInterfaces` is true, sum across all
    interfaces for the device. If `device` not provided, returns empty list.
    """
    metrics = load_metrics()
    if not device:
        return []

    # collect matching interfaces
    matches = [it for it in metrics.get("interfaces", []) if it.get("host") == device]
    if not matches:
        return []

    if ifIndex is not None:
        matches = [it for it in matches if int(it.get("interface_index")) == int(ifIndex)]

    has_status_fields = any(
        it.get("ifAdminStatus") is not None or it.get("ifOperStatus") is not None
        for it in matches
    )

    if has_status_fields:
        matches = [it for it in matches if is_interface_up(it)]

    # base value
    if allInterfaces:
        base_value = sum(int(it.get("ciscoMacNotification", 0)) for it in matches)
    else:
        # pick first matching interface
        base_value = int(matches[0].get("ciscoMacNotification", 0)) if matches else 0

    # normalize to a reasonable number for charting
    # scale down large counters using log10
    if base_value <= 0:
        scaled = 0
    else:
        scaled = int( math.ceil( math.log10(base_value) * 10 ) )

    data = []
    now = datetime.now()
    # Build a baseline series over the last 24 hours: 13 points at 2-hour
    # intervals (including the current time).
    for i in range(12, -1, -1):
        target_time = now - timedelta(hours=i * 2)
        formatted_time = target_time.strftime("%H:%M")
        # create small variation
        noise = int((i % 3) * 2)
        value = max(0, scaled + noise)
        data.append(TrafficDataPoint(time=formatted_time, traffic=value))

    return data


@router.get("/telemetry-hosts")
async def get_telemetry_hosts():
    """Return the translated SNMP telemetry grouped by host and interface."""
    metrics = load_metrics()
    host_aliases = load_host_aliases()
    grouped_hosts = {}

    for item in metrics.get("interfaces", []):
        host = item.get("host")
        if not host:
            continue

        host_entry = grouped_hosts.setdefault(
            host,
            {
                "host": host,
                "name": host_aliases.get(host, {}).get("name", host),
                "rank": host_aliases.get(host, {}).get("rank", 99),
                "total_interfaces_tracked": 0,
                "interfaces": [],
            },
        )
        host_entry["interfaces"].append(
            {
                "ifIndex": int(item.get("interface_index", 0)),
                "name": item.get("interface_name") or f"if{item.get('interface_index')}",
                "ciscoMacNotification": int(item.get("ciscoMacNotification", 0)),
                "uniqueKey": item.get("unique_key"),
            }
        )

    telemetry_hosts = []
    for host in sorted(grouped_hosts, key=lambda item: get_host_sort_key(item, host_aliases)):
        host_entry = grouped_hosts[host]
        host_entry["total_interfaces_tracked"] = len(host_entry["interfaces"])
        telemetry_hosts.append(host_entry)

    return telemetry_hosts


@router.get("/devices", response_model=List[NetworkDevice])
async def get_network_devices():
    stored_devices = await devices_collection.find({}).to_list(length=100)
    devices_by_id = {device["id"]: dict(device) for device in DEFAULT_DEVICES}

    for device in stored_devices:
        serialized = serialize_device(device)
        devices_by_id[serialized["id"]] = serialized

    return [NetworkDevice(**device) for device in devices_by_id.values()]


@router.get("/active-devices")
async def get_active_devices():
    """Load active devices from nmap_output/active_devices.json"""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    active_devices_path = os.path.join(repo_root, "nmap_output", "active_devices.json")
    
    try:
        if os.path.exists(active_devices_path):
            with open(active_devices_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
                return data.get("devices", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load active devices: {str(e)}"
        )
    
    return []


@router.post("/active-devices/scan")
async def trigger_nmap_scan():
    """Trigger nmap scan to discover active devices"""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    nmap_script = os.path.join(repo_root, "watchman", "scripts", "nmap_scan.py")
    
    if not os.path.exists(nmap_script):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="nmap_scan.py script not found"
        )
    
    try:
        # Run the nmap scan script
        result = await asyncio.create_task(asyncio.to_thread(
            subprocess.run,
            [sys.executable, nmap_script],
            capture_output=True,
            text=True,
            timeout=180
        ))
        
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Nmap scan failed: {result.stderr}"
            )
        
        # Return updated devices
        active_devices_path = os.path.join(repo_root, "nmap_output", "active_devices.json")
        with open(active_devices_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        
        return {
            "status": "success",
            "message": result.stdout,
            "devices_count": len(data.get("devices", []))
        }
        
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nmap scan timed out (exceeded 3 minutes)"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run nmap scan: {str(e)}"
        )


@router.post("/devices", response_model=NetworkDevice, status_code=status.HTTP_201_CREATED)
async def add_network_device(device: NetworkDeviceCreate):
    name = device.name.strip()
    ip = device.ip.strip()

    if not name or not ip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hostname and IP address are required.",
        )

    existing_default = next(
        (
            default_device
            for default_device in DEFAULT_DEVICES
            if default_device["name"].lower() == name.lower() or default_device["ip"] == ip
        ),
        None,
    )
    existing_device = await devices_collection.find_one({
        "$or": [
            {"name": {"$regex": f"^{escape_regex(name)}$", "$options": "i"}},
            {"ip": ip},
        ]
    })

    if existing_default or existing_device:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A device with that hostname or IP already exists.",
        )

    new_device = {
        "id": slugify(name),
        "name": name,
        "ip": ip,
        "type": device.type.strip() or "switch",
        "model": device.model or "Pending discovery",
        "version": device.version or "Unknown",
        "uptime": "Just added",
        "cpu": 0,
        "memory": 0,
        "online": False,
        "created_at": datetime.utcnow(),
    }

    await devices_collection.insert_one(new_device)
    return NetworkDevice(**new_device)


@router.post("/devices/{device_id}/configure", response_model=DeviceConfigurationResponse)
async def configure_network_device(device_id: str, request: DeviceConfigurationRequest):
    device = await find_device(device_id)

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found.",
        )

    configuration = {
        "device_id": device["id"],
        "device_name": device["name"],
        "ssh_port": request.ssh_port,
        "username": request.username.strip(),
        "auth_method": request.auth_method,
        "interface_name": request.interface_name.strip(),
        "vlan_id": request.vlan_id.strip(),
        "management_ip": request.management_ip or device["ip"],
        "subnet_mask": request.subnet_mask.strip(),
        "gateway": request.gateway,
        "snmp_community": request.snmp_community,
        "syslog_server": request.syslog_server,
        "ntp_server": request.ntp_server,
        "notes": request.notes,
        "saved_at": datetime.utcnow(),
    }
    stored_configuration = dict(configuration)

    if request.password:
        stored_configuration["ssh_password"] = request.password

    if request.enable_password:
        stored_configuration["enable_password"] = request.enable_password

    await device_configurations_collection.update_one(
        {"device_id": device["id"]},
        {"$set": stored_configuration},
        upsert=True,
    )

    return DeviceConfigurationResponse(
        status="success",
        message=f"Configuration saved for {device['name']}.",
        configuration=DeviceConfiguration(**configuration),
    )


@router.websocket("/devices/{device_id}/terminal/ws")
async def network_terminal_ws(websocket: WebSocket, device_id: str):
    await websocket.accept()

    try:
        import asyncssh
    except ImportError:
        await websocket.send_text(
            "SSH support is not installed on the backend. Install asyncssh from requirements.txt and restart Watchman.\r\n"
        )
        await websocket.close(code=1011)
        return

    device = await find_device(device_id)

    if not device:
        await websocket.send_text("Device not found.\r\n")
        await websocket.close(code=1008)
        return

    if not device.get("online", False):
        await websocket.send_text("Device is offline. SSH session cannot be established.\r\n")
        await websocket.close(code=1008)
        return

    saved_config = await device_configurations_collection.find_one({"device_id": device["id"]}) or {}
    username = saved_config.get("username") or "admin"
    password = saved_config.get("ssh_password")
    ssh_port = int(saved_config.get("ssh_port") or 22)

    if not password:
        await websocket.send_text(
            "Missing SSH password. Open Edit, save SSH credentials, then configure again.\r\n"
        )
        await websocket.close(code=1008)
        return

    await websocket.send_text(f"Opening SSH session to {username}@{device['ip']}:{ssh_port}...\r\n")

    conn = None
    process = None
    reader_task = None
    receiver_task = None

    async def stream_reader(reader):
        try:
            while True:
                chunk = await reader.read(4096)
                if not chunk:
                    break
                await websocket.send_text(chunk)
        except Exception:
            with contextlib.suppress(Exception):
                await websocket.close()

    async def socket_receiver():
        try:
            while True:
                message = await websocket.receive_text()
                if process and process.stdin:
                    process.stdin.write(message)
                    drain = getattr(process.stdin, "drain", None)
                    if drain:
                        await drain()
        except WebSocketDisconnect:
            pass

    try:
        conn = await asyncssh.connect(
            device["ip"],
            port=ssh_port,
            username=username,
            password=password,
            known_hosts=None,
        )
        process = await conn.create_process(term_type="xterm", term_size=(120, 34))
        await websocket.send_text("SSH authenticated. Interactive shell ready.\r\n")

        reader_task = asyncio.create_task(stream_reader(process.stdout))
        receiver_task = asyncio.create_task(socket_receiver())
        await asyncio.wait(
            {reader_task, receiver_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
    except Exception as exc:
        await websocket.send_text(f"SSH session failed: {exc}\r\n")
    finally:
        for task in (reader_task, receiver_task):
            if task:
                task.cancel()

        if process:
            with contextlib.suppress(Exception):
                process.stdin.write("exit\n")
                process.stdin.write_eof()

        if conn:
            conn.close()
            with contextlib.suppress(Exception):
                await conn.wait_closed()

        with contextlib.suppress(Exception):
            await websocket.close()


@router.get("/devices/{device_id}/configuration", response_model=DeviceConfiguration)
async def get_network_device_configuration(device_id: str):
    configuration = await device_configurations_collection.find_one({"device_id": device_id})

    if not configuration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No saved configuration found for this device.",
        )

    configuration.pop("_id", None)
    return DeviceConfiguration(**configuration)


@router.post("/devices/{device_id}/terminal-command", response_model=NetworkTerminalResponse)
async def run_network_terminal_command(device_id: str, request: NetworkTerminalCommand):
    device = await find_device(device_id)

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found.",
        )

    if not device.get("online", False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Device is offline. SSH session cannot be established.",
        )

    command = request.command.strip()
    prompt = build_prompt(device)

    if not command:
        output = ""
    else:
        output = build_terminal_output(device, command)

    return NetworkTerminalResponse(
        device_id=device["id"],
        prompt=prompt,
        command=command,
        output=output,
    )


async def find_device(device_id: str):
    device = await devices_collection.find_one({
        "$or": [
            {"id": device_id},
            {"name": device_id},
        ]
    })

    if device:
        return serialize_device(device)

    return next((device for device in DEFAULT_DEVICES if device["id"] == device_id or device["name"] == device_id), None)


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
            "Building configuration...",
            "",
            "Current configuration : 1248 bytes",
            "!",
            f"hostname {build_prompt(device).rstrip('#')}",
            "!",
            "interface GigabitEthernet0/0",
            f" ip address {device['ip']} 255.255.255.0",
            " no shutdown",
            "!",
            "line vty 0 4",
            " login local",
            " transport input ssh",
            "!",
            "end",
        ])

    if normalized.startswith("ping "):
        target = command.split(maxsplit=1)[1]
        return "\n".join([
            f"Type escape sequence to abort.",
            f"Sending 5, 100-byte ICMP Echos to {target}, timeout is 2 seconds:",
            "!!!!!",
            f"Success rate is 100 percent (5/5), round-trip min/avg/max = 1/3/8 ms",
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
