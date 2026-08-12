import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

from app.models.playbook import PlaybookRequest, PlaybookResponse, AddPlaybookRequest, UpdatePlaybookRequest, UpdatePlaybookStatusRequest, ModifyProposeRequest, ModifyApproveRequest
import app.services.catalog_service as catalog_service
import app.services.execution_service as execution_service
import app.services.drift_service as drift_service
import app.services.playbook_service as modification_service
from app.database import db
from app.core.dependencies import get_current_user
from app.services.notification_service import publish_notification

router = APIRouter(prefix="/playbooks", tags=["Playbooks"])

def get_database_session(request: Request):
    return request.app.state.db

@router.post("/execute", response_model=PlaybookResponse)
async def execute_playbook(request: PlaybookRequest):
    """Execute an Ansible playbook by name"""
    try:
        returncode, output = execution_service.run_playbook(request.playbook_name, request.extra_vars)
        
        # Record audit log entry for this playbook execution
        try:
            audit_col = db.get_collection("audit_logs")
            audit_entry = {
                "action_name": "playbook_execute",
                "playbook_name": request.playbook_name,
                "status": "success" if returncode == 0 else "failed",
                "output": output,
                "username": getattr(request, 'username', 'ChatConsole'),
                "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
            }
            await audit_col.insert_one(audit_entry)
        except Exception:
            # Don't fail the playbook response if audit logging fails
            pass

        await publish_notification(
            title=f"Playbook {'completed' if returncode == 0 else 'failed'}",
            message=f"{request.playbook_name} {'completed successfully' if returncode == 0 else 'finished with errors'}.",
            category="completion",
            severity="success" if returncode == 0 else "critical",
            link="/playbooks",
        )
        
        return PlaybookResponse(
            status="success" if returncode == 0 else "failed",
            playbook_name=request.playbook_name,
            message=f"Playbook execution {'completed' if returncode == 0 else 'failed'}",
            output=output
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/execute-stream/{playbook_name}")
async def execute_playbook_stream(playbook_name: str):
    """Execute an Ansible playbook and stream output in real-time using Server-Sent Events"""
    try:
        # Initial validation before entering async stream generator
        execution_service.validate_playbook_path(playbook_name)
        
        return StreamingResponse(
            execution_service.run_playbook_stream_generator(playbook_name),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/list")
async def list_playbooks():
    """List all available playbooks"""
    try:
        playbooks = catalog_service.get_playbook_files()
        return {
            "status": "success",
            "playbooks": playbooks,
            "count": len(playbooks)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/catalog")
async def get_playbook_catalog():
    """Get the complete playbook catalog with metadata"""
    try:
        catalog = catalog_service.load_catalog()
        return {
            "status": "success",
            "catalog": catalog,
            "count": len(catalog)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/reconcile")
async def reconcile_catalog():
    """Rebuild catalog.json from MongoDB (MongoDB is the source of truth)."""
    try:
        playbooks_col = db.get_collection("playbooks")
        count = await catalog_service.sync_catalog_from_db(playbooks_col)
        return {
            "status": "success",
            "message": f"Catalog synchronized with MongoDB: {count} entries",
            "count": count,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Catalog reconciliation failed: {str(e)}"
        )


@router.get("/drift")
async def get_config_drift_reports():
    """Return parsed configuration drift reports generated by playbooks"""
    try:
        reports = drift_service.parse_config_drift_reports()
        return {"status": "success", "count": len(reports), "reports": reports}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/drift/{hostname}")
async def get_config_drift_file(hostname: str):
    """Return raw diff report for a specific hostname"""
    try:
        content = drift_service.read_config_drift_file(hostname)
        return {"status": "success", "hostname": hostname, "content": content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/drift/refresh")
async def refresh_config_drift():
    """Run drift analysis in container and return updated drift count and reports"""
    import re
    try:
        returncode, output = execution_service.run_drift_analysis()
        
        # Parse the drift count from output (e.g. "Total Devices with Drift: 16")
        match = re.search(r"Total Devices with Drift:\s*(\d+)", output)
        drift_count = int(match.group(1)) if match else 0
        
        # Fetch updated reports
        reports = drift_service.parse_config_drift_reports()
        
        # Record audit log entry
        try:
            audit_col = db.get_collection("audit_logs")
            audit_entry = {
                "action_name": "drift_analysis_refresh",
                "status": "success" if returncode == 0 else "failed",
                "output": output,
                "username": "System",
                "drift_count": drift_count,
                "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
            }
            await audit_col.insert_one(audit_entry)
        except Exception:
            pass
            
        return {
            "status": "success" if returncode == 0 else "failed",
            "drift_count": drift_count,
            "output": output,
            "reports": reports
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/baseline")
async def get_network_baselines():
    """Return list of baselined devices"""
    try:
        devices = drift_service.get_baselined_devices()
        return {"status": "success", "count": len(devices), "devices": devices}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/baseline/refresh")
async def refresh_network_baselines():
    """Run baseline collection in container and return updated baselined devices count"""
    import re
    try:
        returncode, output = execution_service.run_baseline_collection()
        
        # Parse the baselined devices count from output (e.g. "Total Devices Baselined: 16")
        match = re.search(r"Total Devices Baselined:\s*(\d+)", output)
        baseline_count = int(match.group(1)) if match else 0
        
        # Get list of baselined devices
        devices = drift_service.get_baselined_devices()
        
        # Record audit log entry
        try:
            audit_col = db.get_collection("audit_logs")
            audit_entry = {
                "action_name": "baseline_collection_refresh",
                "status": "success" if returncode == 0 else "failed",
                "output": output,
                "username": "System",
                "baseline_count": len(devices),
                "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
            }
            await audit_col.insert_one(audit_entry)
        except Exception:
            pass
            
        return {
            "status": "success" if returncode == 0 else "failed",
            "baseline_count": len(devices),
            "devices": devices,
            "output": output
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/baseline-graph/refresh")
async def refresh_baseline_graph(current_user: dict = Depends(get_current_user)):
    """Run SNMP collection + parsing in container and return the refreshed host count.

    Drives the Network Baseline graph card on the dashboard.
    """
    import json
    try:
        returncode, output = execution_service.run_baseline_refresh()

        # Count unique telemetried hosts from per_interface_metrics.json
        host_count = 0
        metrics_path = execution_service.PLAYBOOKS_DIR / "snmp_output" / "per_interface_metrics.json"
        if metrics_path.exists():
            try:
                data = json.loads(metrics_path.read_text(encoding='utf-8'))
                host_count = len({i.get("host") for i in data.get("interfaces", []) if i.get("host")})
            except Exception:
                host_count = 0

        # Record audit log entry
        try:
            audit_col = db.get_collection("audit_logs")
            audit_entry = {
                "action_name": "baseline_graph_refresh",
                "status": "success" if returncode == 0 else "failed",
                "output": output,
                "username": current_user["username"],
                "host_count": host_count,
                "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
            }
            await audit_col.insert_one(audit_entry)
        except Exception:
            pass

        return {
            "status": "success" if returncode == 0 else "failed",
            "host_count": host_count,
            "output": output,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/suggest")
async def suggest_playbooks(request: PlaybookRequest):
    """Find playbook suggestions matching a user prompt"""
    try:
        if not request.playbook_name or not request.playbook_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt cannot be empty"
            )
        
        suggestions = catalog_service.find_playbook_suggestions(request.playbook_name, top_k=3)
        return {
            "status": "success",
            "prompt": request.playbook_name,
            "suggestions": suggestions,
            "count": len(suggestions)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/inventory/all-hosts-count")
async def get_all_hosts_count():
    """Return the number of devices listed under [allHosts] in hosts.ini."""
    try:
        hostnames = catalog_service.get_all_hosts_from_inventory()
        return {
            "status": "success",
            "group": "allHosts",
            "count": len(hostnames),
            "hosts": hostnames,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    
@router.post("/add", status_code=status.HTTP_201_CREATED)
async def add_new_playbook(
    name: str = Form(...),
    description: str = Form(""),
    engine_type: str = Form("Ansible"),
    subnet_scope: str = Form(""),
    pipeline_status: str = Form("Draft"),
    tags: str = Form(""),
    target_devices: str = Form(""),
    example_intents: str = Form(""),
    destructive: bool = Form(False),
    severity: str = Form("medium"),
    file: Optional[UploadFile] = File(None)
):
    """Save a new playbook: YAML file + catalog.json + MongoDB updated in one flow."""
    if not name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")

    filename = name
    file_content = None

    if file and file.filename:
        if not file.filename.endswith(('.yml', '.yaml')):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .yml and .yaml files are supported")
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
        filename = file.filename

    tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    target_devices_list = [d.strip() for d in target_devices.split(",") if d.strip()] if target_devices else []
    intents_list = [i.strip() for i in example_intents.split("\n") if i.strip()] if example_intents else []

    try:
        inserted_id, saved_filename = await modification_service.persist_playbook(
            name=name,
            filename=filename,
            description=description,
            engine_type=engine_type,
            subnet_scope=subnet_scope,
            pipeline_status=pipeline_status,
            tags=tags_list,
            target_devices=target_devices_list,
            example_intents=intents_list,
            destructive=destructive,
            severity=severity,
            file_content=file_content,
        )

        return {
            "status": "success",
            "message": f"Successfully committed blueprint: {name}",
            "id": inserted_id,
            "filename": saved_filename
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create playbook: {str(e)}"
        )


@router.put("/{playbook_id}")
async def update_playbook(playbook_id: str, request: UpdatePlaybookRequest):
    """Update a playbook blueprint and sync catalog.json."""
    try:
        playbooks_col = db.get_collection("playbooks")

        try:
            mongo_id = ObjectId(playbook_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid playbook ID format")

        existing = await playbooks_col.find_one({"_id": mongo_id})
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")

        update_fields = {k: v for k, v in request.model_dump(exclude_unset=True).items() if v is not None}
        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

        old_filename = existing.get("filename")
        new_filename = update_fields.get("filename") or old_filename

        if new_filename and old_filename and new_filename != old_filename:
            catalog_updated = catalog_service.update_catalog_entry(old_filename, {"filename": new_filename, **{k: v for k, v in update_fields.items() if k != "filename"}})
            old_filepath = execution_service.PLAYBOOKS_DIR / old_filename
            new_filepath = execution_service.PLAYBOOKS_DIR / new_filename
            if old_filepath.exists() and not new_filepath.exists():
                old_filepath.rename(new_filepath)
        else:
            catalog_updates = {k: v for k, v in update_fields.items() if k in ("name", "description", "tags", "target_devices", "example_intents", "destructive", "severity")}
            if catalog_updates and old_filename:
                catalog_service.update_catalog_entry(old_filename, catalog_updates)

        update_fields.pop("filename", None)
        update_fields["last_modified"] = datetime.now(timezone.utc).isoformat() + "Z"

        await playbooks_col.update_one({"_id": mongo_id}, {"$set": update_fields})

        updated = await playbooks_col.find_one({"_id": mongo_id})
        updated["id"] = str(updated["_id"])
        del updated["_id"]

        return {"status": "success", "blueprint": updated}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Update failed: {str(e)}"
        )


@router.patch("/{playbook_id}/status")
async def update_playbook_status(playbook_id: str, request: UpdatePlaybookStatusRequest):
    """Update only the pipeline_status of a playbook blueprint."""
    try:
        playbooks_col = db.get_collection("playbooks")

        try:
            mongo_id = ObjectId(playbook_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid playbook ID format")

        valid_statuses = ["Draft", "Verified", "Failed"]
        if request.pipeline_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )

        result = await playbooks_col.update_one(
            {"_id": mongo_id},
            {"$set": {"pipeline_status": request.pipeline_status}}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")

        updated = await playbooks_col.find_one({"_id": mongo_id})
        updated["id"] = str(updated["_id"])
        del updated["_id"]

        return {"status": "success", "blueprint": updated}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Status update failed: {str(e)}"
        )
    
@router.get("/dashboard")
async def get_playbook_dashboard_data():
    """Return unified playbook metrics and active blueprints directly from MongoDB"""
    try:
        # 1. Connect directly to your live MongoDB playbooks collection
        playbooks_col = db.get_collection("playbooks")
        cursor = playbooks_col.find({})
        
        catalog = []
        async for doc in cursor:
            
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            catalog.append(doc)
        
        total = len(catalog)
        
        #Dynamically calculate your metric cards using your live database documents
        verified = sum(1 for p in catalog if str(p.get("pipeline_status", "")).strip().lower() in ["verified", "production ready"])
        failed = sum(1 for p in catalog if str(p.get("pipeline_status", "")).strip().lower() in ["failed", "error state"])
        draft = sum(1 for p in catalog if str(p.get("pipeline_status", "")).strip().lower() in ["draft", "restricted execution"])

        return {
            "status": "success",
            "total_playbooks": total,
            "verified_pipeline": verified,
            "failed_run_alerts": failed,
            "draft_tasks": draft,
            "blueprints": catalog  
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dashboard database fetch failed: {str(e)}"
        )
    
    

@router.post("/modify/propose")
async def propose_modification(request: ModifyProposeRequest):
    """Propose a modification to a playbook using the LLM.

    Reads the original playbook, calls HuggingFace API to generate
    a modified version, and returns the diff + metadata for user approval.
    """
    try:
        import os
        from app.routes.llm_routes import SUPPORTED_MODELS

        hf_api_key = os.getenv("HUGGINGFACE_API_KEY")

        # Check for stored API key in MongoDB
        try:
            from app.database import api_keys_collection
            stored = await api_keys_collection.find_one({"_id": "huggingface"})
            if stored and stored.get("key"):
                hf_api_key = stored["key"]
        except Exception:
            pass

        if not hf_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Hugging Face API key not configured",
            )

        model = request.model or "Qwen/Qwen3.5-4B:featherless-ai"

        result = await modification_service.generate_playbook_modification(
            playbook_name=request.playbook_name,
            modification=request.modification,
            hf_api_key=hf_api_key,
            model=model,
        )

        diff = modification_service.compute_yaml_diff(
            result["original_content"],
            result["modified_content"],
        )

        proposed_name = modification_service.derive_modified_filename(request.playbook_name)

        return {
            "status": "success",
            "original_name": request.playbook_name,
            "proposed_name": proposed_name,
            "original_content": result["original_content"],
            "modified_content": result["modified_content"],
            "diff": diff,
            "metadata": {
                "name": result["name"],
                "description": result["description"],
                "tags": result["tags"],
                "severity": result["severity"],
                "destructive": result["destructive"],
                "target_devices": result["target_devices"],
                "example_intents": result["example_intents"],
            },
            "plain_explanation": result["plain_explanation"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Modification proposal failed: {str(e)}",
        )


@router.post("/modify/approve")
async def approve_modification(request: ModifyApproveRequest):
    """Approve and save a playbook modification.

    Writes the modified YAML, updates catalog.json, and persists to MongoDB
    in a single atomic flow so the two stores never drift.
    """
    try:
        filename, catalog_entry = modification_service.save_modified_playbook(
            original_name=request.original_name,
            proposed_name=request.proposed_name,
            modified_content=request.modified_content,
            metadata=request.metadata,
        )

        inserted_id, saved_filename = await modification_service.persist_playbook(
            name=catalog_entry["name"],
            filename=filename,
            description=catalog_entry["description"],
            engine_type="Ansible",
            subnet_scope=", ".join(catalog_entry["target_devices"]),
            pipeline_status="Draft",
            tags=catalog_entry["tags"],
            target_devices=catalog_entry["target_devices"],
            example_intents=catalog_entry["example_intents"],
            destructive=catalog_entry["destructive"],
            severity=catalog_entry["severity"],
            file_content=request.modified_content.encode("utf-8"),
        )

        return {
            "status": "success",
            "filename": saved_filename,
            "id": inserted_id,
            "message": f"Modified playbook saved as {saved_filename}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save modified playbook: {str(e)}",
        )


@router.delete("/delete/{playbook_id}")
async def delete_playbook_entry(playbook_id: str):
    """Permanently delete a playbook: MongoDB document, catalog.json entry, and YAML file."""
    try:
        return await modification_service.remove_playbook(playbook_id)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database deletion transaction failure: {str(e)}"
        )
