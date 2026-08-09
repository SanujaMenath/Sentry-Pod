import math
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter

from app.models.telemetry import TrafficDataPoint
from app.routes.network_utils import load_metrics, load_host_aliases, get_host_sort_key, is_interface_up

router = APIRouter(prefix="/api/network", tags=["Network Telemetry"])


@router.get("/traffic-history", response_model=List[TrafficDataPoint])
async def get_traffic_history(device: Optional[str] = None, ifIndex: Optional[int] = None, allInterfaces: Optional[bool] = False):
    metrics = load_metrics()
    if not device:
        return []
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
    if allInterfaces:
        base_value = sum(int(it.get("ciscoMacNotification", 0)) for it in matches)
    else:
        base_value = int(matches[0].get("ciscoMacNotification", 0)) if matches else 0
    if base_value <= 0:
        scaled = 0
    else:
        scaled = int(math.ceil(math.log10(base_value) * 10))
    data = []
    now = datetime.now()
    for i in range(12, -1, -1):
        target_time = now - timedelta(hours=i * 2)
        noise = int((i % 3) * 2)
        value = max(0, scaled + noise)
        data.append(TrafficDataPoint(time=target_time.strftime("%H:%M"), traffic=value))
    return data


@router.get("/telemetry-hosts")
async def get_telemetry_hosts():
    metrics = load_metrics()
    host_aliases = load_host_aliases()
    grouped_hosts = {}
    for item in metrics.get("interfaces", []):
        host = item.get("host")
        if not host:
            continue
        host_entry = grouped_hosts.setdefault(host, {
            "host": host, "name": host_aliases.get(host, {}).get("name", host),
            "rank": host_aliases.get(host, {}).get("rank", 99),
            "total_interfaces_tracked": 0, "interfaces": [],
        })
        host_entry["interfaces"].append({
            "ifIndex": int(item.get("interface_index", 0)),
            "name": item.get("interface_name") or f"if{item.get('interface_index')}",
            "ciscoMacNotification": int(item.get("ciscoMacNotification", 0)),
            "uniqueKey": item.get("unique_key"),
        })
    telemetry_hosts = []
    for host in sorted(grouped_hosts, key=lambda item: get_host_sort_key(item, host_aliases)):
        host_entry = grouped_hosts[host]
        host_entry["total_interfaces_tracked"] = len(host_entry["interfaces"])
        telemetry_hosts.append(host_entry)
    return telemetry_hosts
