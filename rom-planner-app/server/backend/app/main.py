# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import sync_engine, get_session, get_async_session, async_engine
from app.config import FRONTEND_CORS_ORIGINS

# Import auth components
from app.auth import fastapi_users, auth_backend, current_active_user, current_superuser
from app.schemas import UserRead, UserCreate, UserUpdate
from app.models import User

# Import routers
from app.routers import (
    projects,
    rates,
    tasks,
    material_items,
    global_materials,
    export
)

# Explicitly import models in dependency order
from app.models import Rate, GlobalMaterial, Project, Task, MaterialItem

app = FastAPI(
    title="ROM Planner API",
    description="Backend API for ROM Planner application",
    version="0.0.1",
)

# CORS configuration - MUST be before route definitions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Temporarily allow all origins for debugging
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

@app.on_event("startup")
async def on_startup():
    SQLModel.metadata.create_all(sync_engine)
    print("Database tables created/verified successfully")

@app.get("/")
def read_root():
    return {"message": "ROM Planner API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Test protected route
@app.get("/test-auth")
async def test_auth(user: User = Depends(current_active_user)):
    return {"message": f"Authenticated as {user.email}", "user_id": str(user.id)}