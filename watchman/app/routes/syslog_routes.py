from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from app.models.syslog import SyslogAlert, SyslogAlertCreate
from app.database import db
import configparser
import os

router = APIRouter(prefix="/api/syslog", tags=["syslog"])

HOSTS_INI_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "playbooks", "hosts.ini")

def _load_ip_to_hostname():
    mapping = {}
    if not os.path.exists(HOSTS_INI_PATH):
        return mapping
    with open(HOSTS_INI_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("[") or line.startswith("#") or line.startswith(";"):
                continue
            if line.startswith("ansible_"):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            hostname = parts[0]
            for p in parts[1:]:
                if p.startswith("ansible_host="):
                    ip = p.split("=", 1)[1].strip()
                    mapping[ip] = hostname
                    break
    return mapping

def _load_hostname_to_ip():
    mapping = {}
    if not os.path.exists(HOSTS_INI_PATH):
        return mapping
    with open(HOSTS_INI_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("[") or line.startswith("#") or line.startswith(";"):
                continue
            if line.startswith("ansible_"):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            hostname = parts[0]
            for p in parts[1:]:
                if p.startswith("ansible_host="):
                    ip = p.split("=", 1)[1].strip()
                    mapping[hostname] = ip
                    break
    return mapping

@router.get("/alerts", response_model=list[SyslogAlert])
async def get_alerts(limit: int = 50):
    collection = db.get_collection("syslog_alerts")
    cursor = collection.find().sort("timestamp", -1).limit(limit)
    alerts = await cursor.to_list(length=limit)
    return alerts

@router.post("/alerts")
async def create_alert(alert: SyslogAlertCreate):
    collection = db.get_collection("syslog_alerts")
    ip_to_host = _load_ip_to_hostname()
    host_to_ip = _load_hostname_to_ip()
    now = alert.timestamp or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    effective_ip = alert.source_ip
    effective_hostname = None

    if alert.msg_hostname:
        resolved_ip = host_to_ip.get(alert.msg_hostname)
        if resolved_ip:
            effective_ip = resolved_ip
            effective_hostname = alert.msg_hostname
        else:
            effective_hostname = ip_to_host.get(alert.source_ip)

    if not effective_hostname:
        effective_hostname = ip_to_host.get(effective_ip)

    device = f"{effective_hostname} ({effective_ip})" if effective_hostname else effective_ip

    doc = SyslogAlert(
        device=device,
        severity=alert.severity,
        severity_name=alert.severity_name,
        facility=alert.facility,
        mnemonic=alert.mnemonic,
        message=alert.message,
        timestamp=now,
        source_ip=alert.source_ip,
    )
    await collection.insert_one(doc.model_dump(by_alias=False))
    return {"status": "ok"}

@router.delete("/alerts")
async def clear_alerts():
    collection = db.get_collection("syslog_alerts")
    result = await collection.delete_many({})
    return {"deleted_count": result.deleted_count}
