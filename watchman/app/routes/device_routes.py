import asyncio
import json
import os
import sys
import subprocess
from typing import List

from fastapi import APIRouter, HTTPException, status
from datetime import datetime

from app.models.telemetry import NetworkDevice, NetworkDeviceCreate
from app.database import devices_collection
from app.routes.network_utils import (
    DEFAULT_DEVICES, load_devices_from_inventory, _build_device_status,
    slugify, escape_regex, serialize_device,
)

router = APIRouter(prefix="/api/network", tags=["Network Devices"])


@router.get("/devices", response_model=List[NetworkDevice])
async def get_network_devices():
    devices_by_id = {d["id"]: d for d in load_devices_from_inventory()}
    for device in DEFAULT_DEVICES:
        devices_by_id[device["id"]] = dict(device)
    stored_devices = await devices_collection.find({}).to_list(length=100)
    for device in stored_devices:
        serialized = serialize_device(device)
        devices_by_id[serialized["id"]] = serialized
    return [NetworkDevice(**device) for device in devices_by_id.values()]


@router.get("/active-devices")
async def get_active_devices():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    path = os.path.join(repo_root, "nmap_output", "active_devices.json")
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh).get("devices", [])
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    return []


@router.post("/active-devices/scan")
async def trigger_nmap_scan():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    nmap_script = os.path.join(repo_root, "scripts", "nmap_scan.py")
    if not os.path.exists(nmap_script):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="nmap_scan.py not found")
    try:
        result = await asyncio.create_task(asyncio.to_thread(
            subprocess.run, [sys.executable, nmap_script],
            capture_output=True, text=True, timeout=180
        ))
        if result.returncode != 0:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Nmap scan failed: {result.stderr}")
        active_devices_path = os.path.join(repo_root, "nmap_output", "active_devices.json")
        with open(active_devices_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return {"status": "success", "message": result.stdout, "devices_count": len(data.get("devices", []))}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Nmap scan timed out (exceeded 3 minutes)")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to run nmap scan: {str(e)}")


@router.get("/device-status")
async def get_device_status():
    return _build_device_status()


@router.post("/device-status/scan")
async def trigger_device_status_scan():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    nmap_script = os.path.join(repo_root, "scripts", "nmap_scan.py")
    if not os.path.exists(nmap_script):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="nmap_scan.py not found")
    try:
        result = await asyncio.create_task(asyncio.to_thread(
            subprocess.run, [sys.executable, nmap_script],
            capture_output=True, text=True, timeout=180,
        ))
        if result.returncode != 0:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Nmap scan failed: {result.stderr}")
        return _build_device_status()
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Nmap scan timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to run nmap scan: {str(e)}")


@router.post("/devices", response_model=NetworkDevice, status_code=status.HTTP_201_CREATED)
async def add_network_device(device: NetworkDeviceCreate):
    name = device.name.strip()
    ip = device.ip.strip()
    if not name or not ip:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hostname and IP address are required.")
    existing_default = next(
        (d for d in DEFAULT_DEVICES if d["name"].lower() == name.lower() or d["ip"] == ip), None,
    )
    existing_device = await devices_collection.find_one({
        "$or": [{"name": {"$regex": f"^{escape_regex(name)}$", "$options": "i"}}, {"ip": ip}]
    })
    if existing_default or existing_device:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A device with that hostname or IP already exists.")
    new_device = {
        "id": slugify(name), "name": name, "ip": ip,
        "type": device.type.strip() or "switch",
        "model": device.model or "Pending discovery", "version": device.version or "Unknown",
        "uptime": "Just added", "cpu": 0, "memory": 0, "online": False,
        "created_at": datetime.utcnow(),
    }
    await devices_collection.insert_one(new_device)
    return NetworkDevice(**new_device)
