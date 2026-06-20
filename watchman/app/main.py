from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.database import db, create_indexes
from app.routes import user_routes, auth_routes, playbook_routes
from app.routes import audit_routes, llm_routes, network_routes
from app.routes import syslog_routes, console_routes


MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024  # 10 MB


class RequestBodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large", "code": "PAYLOAD_TOO_LARGE"}
            )
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_indexes()
    yield


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

app.add_middleware(RequestBodySizeMiddleware)

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
app.include_router(network_routes.router)
app.include_router(syslog_routes.router)
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
