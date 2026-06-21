from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
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
import sys

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

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
app.include_router(console_routes.router)
app.include_router(topology_routes.router)
app.include_router(setup_routes.router)

if sys.platform != "win32":
    app.include_router(console_routes.router)

@app.get("/health")
async def health():
    db_ok = False
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        pass
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "sentry-pod",
        "version": settings.VERSION,
        "database": "connected" if db_ok else "disconnected"
    }

@app.get("/")
async def root():
    return {"message": "Sentry-Pod API is live"}
