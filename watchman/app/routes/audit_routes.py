from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import List
from ..database import db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

audit_logs_collection = db.get_collection("audit_logs")


def verify_role_clearance(allowed_roles: List[str]):
    def dependency(current_user: dict = Depends(get_current_user)):
        role = current_user.get("role", "")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied. Role '{role}' lacks necessary systemic permissions."
            )
        return current_user
    return dependency

class AuditLogEntry(BaseModel):
    action_name: str
    playbook_name: str
    status: str
    output: str
    username: str = "Anonymous User"

@router.post("/log-action", response_model=dict)
async def log_action(entry: AuditLogEntry, current_user: dict = Depends(get_current_user)):
    """Log a playbook action execution to audit trail"""
    try:
        audit_entry = {
            "action_name": entry.action_name,
            "playbook_name": entry.playbook_name,
            "status": entry.status,
            "output": entry.output,
            "username": entry.username,
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }
        
        result = await audit_logs_collection.insert_one(audit_entry)
        
        return {
            "status": "success",
            "message": f"Action '{entry.action_name}' logged successfully",
            "log_id": str(result.inserted_id),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ADDED DEPENDENCY HERE -> Only Admin and Auditor allowed
@router.get("/all")
async def get_all_audit_logs(
    limit: int = 50,
    current_user: dict = Depends(verify_role_clearance(["Super Admin", "System Administrator", "Auditor"]))
):
    """Retrieve all audit logs"""
    try:
        logs = await audit_logs_collection.find().sort("timestamp", -1).limit(limit).to_list(limit)
        
        for log in logs:
            log["_id"] = str(log["_id"])
        
        return {
            "status": "success",
            "count": len(logs),
            "logs": logs,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ADDED DEPENDENCY HERE -> Only Admin and Auditor allowed
@router.get("/by-user/{username}")
async def get_logs_by_user(
    username: str, 
    limit: int = 50,
    current_user: dict = Depends(verify_role_clearance(["Super Admin", "System Administrator", "Auditor"]))
):
    """Retrieve audit logs for a specific user"""
    try:
        logs = await audit_logs_collection.find({"username": username}).sort("timestamp", -1).limit(limit).to_list(limit)
        
        for log in logs:
            log["_id"] = str(log["_id"])
        
        return {
            "status": "success",
            "username": username,
            "count": len(logs),
            "logs": logs,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ADDED DEPENDENCY HERE -> Only Admin and Auditor allowed
@router.get("/{log_id}")
async def get_audit_log(
    log_id: str,
    current_user: dict = Depends(verify_role_clearance(["Super Admin", "System Administrator", "Auditor"]))
):
    """Retrieve a specific audit log by ID"""
    try:
        from bson import ObjectId
        log = await audit_logs_collection.find_one({"_id": ObjectId(log_id)})
        
        if not log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Log with ID '{log_id}' not found"
            )
        
        log["_id"] = str(log["_id"])
        return {
            "status": "success",
            "log": log,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ADDED DEPENDENCY HERE -> Only Admin and Auditor allowed
@router.get("/by-action/{action_name}")
async def get_logs_by_action(
    action_name: str, 
    limit: int = 50,
    current_user: dict = Depends(verify_role_clearance(["Super Admin", "System Administrator", "Auditor"]))
):
    """Retrieve audit logs for a specific action"""
    try:
        logs = await audit_logs_collection.find({"action_name": action_name}).sort("timestamp", -1).limit(limit).to_list(limit)
        
        for log in logs:
            log["_id"] = str(log["_id"])
        
        return {
            "status": "success",
            "action_name": action_name,
            "count": len(logs),
            "logs": logs,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
