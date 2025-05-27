# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import sync_engine, get_session, get_async_session, async_engine
from app.config import FRONTEND_CORS_ORIGINS, RFI_STORAGE_BASE_PATH # Import RFI_STORAGE_BASE_PATH
from pathlib import Path # For creating RFI storage path

# Import auth components
from app.auth import fastapi_users, auth_backend, current_active_user, current_superuser
from app.schemas import UserRead, UserCreate, UserUpdate
from app.models import User # Already here

# Import routers
from app.routers import (
    projects,
    rates,
    tasks,
    material_items,
    global_materials,
    export,
    rfi_documents,
    requirements 
)

# Explicitly import models in dependency order to assist SQLModel table creation
# Order: Base models, Link tables, then models with relationships.
# TaskRequirementLink is new and should come before Task and Requirement if they use it in link_model.
from app.models import (
    TimeStampedModel, # Base
    TaskRequirementLink, # Link table
    User, Rate, GlobalMaterial, # Models without FKs to other main entities yet
    Project, # Depends on User
    RFDocument, # Depends on Project
    Requirement, # Depends on Project, RFDocument
    Task, # Depends on Project, Requirement
    MaterialItem # Depends on Project
)


app = FastAPI(
    title="ROM Planner API",
    description="Backend API for ROM Planner application",
    version="0.0.1",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Temporarily allow all for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication routes
app.include_router(
    fastapi_users.get_auth_router(auth_backend), 
    prefix="/auth/jwt", 
    tags=["auth"]
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# API routes
app.include_router(projects.router)
app.include_router(rates.router)
app.include_router(tasks.router)
app.include_router(material_items.router)
app.include_router(global_materials.router)
app.include_router(export.router)
app.include_router(rfi_documents.router)
app.include_router(requirements.router)


@app.on_event("startup")
async def on_startup():
    # Create database tables
    SQLModel.metadata.create_all(sync_engine)
    print("Database tables created/verified successfully")

    # --- NEW: Create RFI base storage directory if it doesn't exist ---
    rfi_base_path = Path(RFI_STORAGE_BASE_PATH)
    try:
        rfi_base_path.mkdir(parents=True, exist_ok=True)
        print(f"RFI storage directory '{rfi_base_path}' ensured.")
    except Exception as e:
        print(f"Error creating RFI storage directory '{rfi_base_path}': {e}")
        # Depending on policy, you might want to raise an error and stop startup
        # For now, just printing a warning.

@app.get("/")
def read_root():
    return {"message": "ROM Planner API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/test-auth")
async def test_auth(user: User = Depends(current_active_user)):
    return {"message": f"Authenticated as {user.email}", "user_id": str(user.id)}