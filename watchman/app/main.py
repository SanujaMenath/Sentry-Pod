from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes import user_routes
from app.routes import auth_routes
from app.routes import playbook_routes
from app.routes import audit_routes
from app.routes import llm_routes
from app.routes import network_routes
from app.routes import syslog_routes
from app.routes import console_routes
from app.routes import audit_routes
from app.routes import auth_routes
from app.routes import llm_routes
from app.routes import network_routes
from app.routes import playbook_routes
from app.routes import syslog_routes
from app.routes import user_routes

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

app.include_router(user_routes.router)
app.include_router(auth_routes.router)
app.include_router(playbook_routes.router)
app.include_router(audit_routes.router)
app.include_router(llm_routes.router)
app.include_router(network_routes.router)
app.include_router(syslog_routes.router)
app.include_router(console_routes.router)

@app.get("/")
async def root():
    return {"message": "Sentry-Pod API is live"}
