from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.models.setup import (
    SetupPreviewRequest,
    SetupPreviewResponse,
    SetupApplyRequest,
    SetupApplyResponse,
    SetupStatusResponse,
    SetupDiff,
)
import app.services.setup_service as setup_service
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/setup", tags=["Setup"])


@router.get("/status", response_model=SetupStatusResponse)
async def get_setup_status():
    """Check whether the system has been configured or still uses demo data.
    Public endpoint — no auth required (used by login page and setup redirect).
    """
    try:
        return setup_service.detect_setup_status()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


def _build_summary(payload: SetupPreviewRequest) -> dict:
    total = (
        len(payload.edge_routers)
        + len(payload.core_switches)
        + len(payload.distribution_switches)
        + len(payload.access_switches)
    )
    return {
        "total_devices": total,
        "edge_routers": len(payload.edge_routers),
        "core_switches": len(payload.core_switches),
        "distribution_switches": len(payload.distribution_switches),
        "hsrp_pairs": len(payload.hsrp_pairs),
        "access_switches": len(payload.access_switches),
    }


async def _run_setup_pipeline(payload: SetupPreviewRequest):
    current_ini = setup_service.read_current_ini()
    generated_ini = setup_service.render_ini(payload)
    diff_data = setup_service.compute_diff(current_ini, generated_ini)
    warnings = setup_service._check_warnings(payload)
    flush_plan = setup_service.get_flush_plan()
    markdown = setup_service.generate_report_markdown(payload, diff_data, warnings, flush_plan)
    report_path = setup_service.write_report(markdown)
    return generated_ini, diff_data, warnings, flush_plan, markdown, report_path


@router.post("/preview", response_model=SetupPreviewResponse)
async def preview_setup(
    payload: SetupPreviewRequest,
):
    """Dry-run: generate hosts.ini and report without writing anything.
    Public endpoint — no auth required.
    """
    try:
        generated_ini, diff_data, warnings, flush_plan, markdown, report_path = await _run_setup_pipeline(payload)
        return SetupPreviewResponse(
            status="preview",
            summary=_build_summary(payload),
            generated_ini=generated_ini,
            diff=SetupDiff(**diff_data),
            warnings=warnings,
            flush_plan=flush_plan,
            report_path=str(report_path),
            report_markdown=markdown,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/apply", response_model=SetupApplyResponse)
async def apply_setup(
    payload: SetupApplyRequest,
    dry_run: bool = Query(False, description="Validate and generate report without writing anything"),
    current_user: dict = Depends(get_current_user),
):
    """Commit: write hosts.ini, flush demo artifacts, save report.
    Pass ?dry_run=true to validate without side effects.
    """
    try:
        generated_ini, diff_data, warnings, flush_plan, markdown, report_path = await _run_setup_pipeline(payload)

        flushed_collections = []
        flushed_files = []

        if not dry_run:
            setup_service.write_ini(generated_ini)
            if payload.flush_mongo:
                flushed_collections = await setup_service.flush_mongo_collections()
            if payload.flush_disk:
                flushed_files = setup_service.flush_disk_artifacts()

        total = _build_summary(payload)["total_devices"]

        status_str = "dry_run" if dry_run else "success"
        message = (
            f"Dry run — {total} devices validated, no changes written"
            if dry_run
            else f"Inventory written with {total} devices"
        )

        return SetupApplyResponse(
            status=status_str,
            message=message,
            report_path=str(report_path),
            flushed_collections=flushed_collections,
            flushed_files=flushed_files,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


class InitUserRequest(BaseModel):
    username: str
    password: str
    email: str
    full_name: str


@router.post("/init-user")
async def init_user(payload: InitUserRequest):
    """Create the first Super Admin user. No-op if users already exist."""
    try:
        result = await setup_service.init_super_admin(
            username=payload.username,
            password=payload.password,
            email=payload.email,
            full_name=payload.full_name,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/init-collections")
async def init_collections():
    """Ensure all required MongoDB collections and indexes exist."""
    try:
        result = await setup_service.init_collections_and_indexes()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/generate-secret")
async def generate_secret():
    """Generate a new random JWT secret and write it to .env."""
    try:
        result = setup_service.generate_jwt_secret()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
