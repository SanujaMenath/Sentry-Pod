from fastapi import APIRouter
from typing import List, Optional
from app.models.telemetry import TrafficDataPoint
from datetime import datetime, timedelta
import json
import os
import math

router = APIRouter(prefix="/api/network", tags=["Network Telemetry"])

from pathlib import Path

# Resolve metrics path relative to project root (two levels up from this file)
BASE_DIR = Path(__file__).resolve().parents[2]
METRICS_PATH = str(BASE_DIR / "playbooks" / "snmp_output" / "per_interface_metrics.json")


def load_metrics():
    if not os.path.exists(METRICS_PATH):
        return {"interfaces": []}
    try:
        with open(METRICS_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {"interfaces": []}


@router.get("/devices")
async def list_devices():
    metrics = load_metrics()
    devices = {}
    for it in metrics.get("interfaces", []):
        host = it.get("host")
        idx = it.get("interface_index")
        name = it.get("interface_name")
        devices.setdefault(host, []).append({"ifIndex": idx, "name": name})

    # Return array of { device: host, interfaces: [...] }
    return [{"device": d, "interfaces": devices[d]} for d in devices]


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
    for i in range(12, -1, -1):
        target_time = now - timedelta(hours=i * 2)
        formatted_time = target_time.strftime("%H:%M")
        # create small variation
        noise = int((i % 3) * 2)
        value = max(0, scaled + noise)
        data.append(TrafficDataPoint(time=formatted_time, traffic=value))

    return data