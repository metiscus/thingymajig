# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
from app.database import engine
from app.config import FRONTEND_CORS_ORIGINS

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
# This ensures that 'Project' is fully registered with metadata before 'Task' or 'MaterialItem' are.
from app.models import Rate # Independent
from app.models import GlobalMaterial # Independent
from app.models import Project # Parent
from app.models import Task # Child of Project
from app.models import MaterialItem # Child of Project

app = FastAPI(
    title="ROM Planner API",
    description="Backend API for ROM Planner application",
    version="0.0.1",
)

# Configure CORS (Cross-Origin Resource Sharing)
# This is crucial for your frontend (running on a different port/domain) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_CORS_ORIGINS, # List of allowed origins from config
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Include all API routers
app.include_router(projects.router)
app.include_router(rates.router)
app.include_router(tasks.router)
app.include_router(material_items.router)
app.include_router(global_materials.router)
app.include_router(export.router)


@app.on_event("startup")
def on_startup():
    """
    Event handler that runs when the FastAPI application starts up.
    It creates all defined database tables if they don't already exist.
    """
    # In a production environment, you would typically use a dedicated database migration tool
    # like Alembic for schema management rather than create_all() on every startup.
    # create_all() is fine for initial development and testing.
    SQLModel.metadata.create_all(engine)
    print("Database tables checked/created.")

@app.get("/")
def read_root():
    """Root endpoint to check if the API is running."""
    return {"message": "Welcome to ROM Planner API!"}