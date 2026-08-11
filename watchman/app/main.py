from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from app.core.config import settings
from app.routes import user_routes
from app.routes import auth_routes
from app.routes import playbook_routes
from app.routes import audit_routes
from app.routes import llm_routes
from app.routes import telemetry_routes, device_routes, terminal_routes
from app.routes import syslog_routes
from app.routes import console_routes
from app.routes import topology_routes
from app.routes import setup_routes
from app.routes import notification_routes

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.database import db
        from app.services.catalog_service import sync_catalog_from_db
        count = await sync_catalog_from_db(db.get_collection("playbooks"))
        logger.info(f"Catalog reconciled with MongoDB on startup: {count} playbooks")
    except Exception as e:
        logger.warning(f"Could not reconcile catalog on startup: {str(e)}")
    yield


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "code": "INTERNAL_ERROR"}
    )

app.include_router(user_routes.router)
app.include_router(auth_routes.router)
app.include_router(playbook_routes.router)
app.include_router(audit_routes.router)
app.include_router(llm_routes.router)
app.include_router(telemetry_routes.router)
app.include_router(device_routes.router)
app.include_router(terminal_routes.router)
app.include_router(syslog_routes.router)
app.include_router(topology_routes.router)
app.include_router(setup_routes.router)
app.include_router(notification_routes.router)

app.include_router(console_routes.router)

@app.get("/")
async def root():
    return {"message": "Sentry-Pod API is live"}
