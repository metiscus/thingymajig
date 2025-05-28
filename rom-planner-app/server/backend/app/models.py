# backend/app/models.py
from typing import Optional, Dict, List, Any
from sqlmodel import Field, SQLModel, Relationship, Column, JSON, String
from sqlalchemy import Column as SAColumn
from sqlalchemy.sql.sqltypes import DateTime # For onupdate
from datetime import datetime, timezone # Ensure timezone awareness
import uuid

# Import the correct base class for SQLModel FastAPI Users
from fastapi_users_db_sqlmodel import SQLModelBaseUserDB

# 1. Base class for models that have a createdAt timestamp
class TimeStampedModel(SQLModel):
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

# --- NEW: TaskRequirementLink Association Table ---
class TaskRequirementLink(SQLModel, table=True):
    __tablename__ = "task_requirement_link" # Explicit tablename
    task_id: Optional[int] = Field(default=None, primary_key=True, foreign_key="tasks.id")
    requirement_id: Optional[int] = Field(default=None, primary_key=True, foreign_key="requirements.id")

# User Model - Fixed to handle EmailStr type properly
class User(SQLModelBaseUserDB, table=True):
    __tablename__ = "users"
    
    email: str = Field(
        sa_column=SAColumn(String, unique=True, index=True, nullable=False)
    )
    
    projects: List["Project"] = Relationship(back_populates="owner")

# Rates Table
class RateBase(SQLModel):
    role: str = Field(index=True, unique=True, min_length=1)
    rate: float = Field(ge=0)
    unit: str = Field(default="day")

class Rate(RateBase, TimeStampedModel, table=True):
    __tablename__ = "rates"
    id: Optional[int] = Field(default=None, primary_key=True)

# Global Materials Table
class GlobalMaterialBase(SQLModel):
    name: str = Field(index=True, unique=True, min_length=1)
    category: Optional[str] = None
    unitPrice: float = Field(ge=0)

class GlobalMaterial(GlobalMaterialBase, table=True):
    __tablename__ = "global_materials"
    id: Optional[int] = Field(default=None, primary_key=True)

# --- NEW: RFDocument Model ---
class RFDocumentBase(SQLModel):
    project_id: int = Field(foreign_key="projects.id")
    filename: str
    stored_filename: str = Field(unique=True) # To ensure no collisions
    filepath: str # Relative to a base storage directory
    content_type: str
    filesize: int # in bytes

class RFDocument(RFDocumentBase, TimeStampedModel, table=True):
    __tablename__ = "rfi_documents"
    id: Optional[int] = Field(default=None, primary_key=True)
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    last_processed_at: Optional[datetime] = Field(default=None)
    
    project: Optional["Project"] = Relationship(back_populates="rfi_documents")
    requirements: List["Requirement"] = Relationship(back_populates="rfi_document", sa_relationship_kwargs={"cascade": "all, delete-orphan"}) # If RFIdoc deleted, its requirements are deleted


# --- NEW: Requirement Model ---
class RequirementBase(SQLModel):
    project_id: int = Field(foreign_key="projects.id")
    rfi_document_id: Optional[int] = Field(default=None, foreign_key="rfi_documents.id")
    custom_id: Optional[str] = Field(default=None, index=True) # User-defined or LLM-suggested ID, unique per project (validation in router)
    requirement_text: str

class Requirement(RequirementBase, TimeStampedModel, table=True):
    __tablename__ = "requirements"
    id: Optional[int] = Field(default=None, primary_key=True)
    # Use SAColumn for onupdate, default_factory for creation
    # Renamed to updatedAt for consistency with createdAt
    updatedAt: datetime = Field( # CHANGED: Renamed from 'updated_at' to 'updatedAt'
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=SAColumn(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    )
    
    project: Optional["Project"] = Relationship(back_populates="requirements")
    rfi_document: Optional["RFDocument"] = Relationship(back_populates="requirements")
    
    # Relationship to Task via TaskRequirementLink
    tasks: List["Task"] = Relationship(back_populates="requirements", link_model=TaskRequirementLink)


# Projects Table
class ProjectBase(SQLModel):
    name: str = Field(index=True, unique=True, min_length=1)
    description: Optional[str] = None
    riskPercentage: float = Field(default=0.0, ge=0, le=100)

class Project(ProjectBase, TimeStampedModel, table=True):
    __tablename__ = "projects"
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    
    owner: Optional[User] = Relationship(back_populates="projects")
    
    tasks: List["Task"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    material_items: List["MaterialItem"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    
    # --- NEW RELATIONSHIPS FOR PROJECT ---
    rfi_documents: List["RFDocument"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    requirements: List["Requirement"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


# Tasks Table
class TaskBase(SQLModel):
    projectId: int = Field(foreign_key="projects.id")
    name: str = Field(min_length=1)
    description: Optional[str] = None
    efforts: Dict[str, float] = Field(default_factory=dict, sa_column=Column(JSON))
    travelCost: float = Field(default=0.0, ge=0)
    materialsCost: float = Field(default=0.0, ge=0)
    sequence: int = Field(default=0)

class Task(TaskBase, TimeStampedModel, table=True):
    __tablename__ = "tasks"
    id: Optional[int] = Field(default=None, primary_key=True)
    
    project: "Project" = Relationship(back_populates="tasks") # Made type hint a string to avoid forward ref issues if Project defined later
    
    # --- NEW RELATIONSHIP FOR TASK ---
    requirements: List["Requirement"] = Relationship(back_populates="tasks", link_model=TaskRequirementLink)

# Material Items Table
class MaterialItemBase(SQLModel):
    projectId: int = Field(foreign_key="projects.id")
    lineItem: str = Field(min_length=1)
    vendor: Optional[str] = None
    category: Optional[str] = None
    unitPrice: float = Field(default=0.0, ge=0)
    quantity: int = Field(default=1, ge=0)
    comment: Optional[str] = None

class MaterialItem(MaterialItemBase, TimeStampedModel, table=True):
    __tablename__ = "material_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    project: "Project" = Relationship(back_populates="material_items") # Made type hint a string