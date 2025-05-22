# backend/app/models.py
from typing import Optional, Dict, List, Any
from sqlmodel import Field, SQLModel, Relationship, Column, JSON
from datetime import datetime

# Base class for models that have a createdAt timestamp
class TimeStampedModel(SQLModel):
    createdAt: datetime = Field(default_factory=datetime.utcnow, nullable=False)

# Rates Table
class RateBase(SQLModel):
    role: str = Field(index=True, unique=True, min_length=1)
    rate: float = Field(ge=0)
    unit: str = Field(default="day") # 'day' or 'hour'

class Rate(RateBase, TimeStampedModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

# Projects Table
class ProjectBase(SQLModel):
    name: str = Field(index=True, unique=True, min_length=1)
    description: Optional[str] = None
    riskPercentage: float = Field(default=0.0, ge=0, le=100)

class Project(ProjectBase, TimeStampedModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Relationships: one project has many tasks and many material items
    # back_populates ensures the reverse relationship is also defined (e.g., Task.project)
    tasks: List["Task"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    material_items: List["MaterialItem"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

# Tasks Table
class TaskBase(SQLModel):
    projectId: int = Field(foreign_key="projects.id") # Foreign key to projects table
    name: str = Field(min_length=1)
    description: Optional[str] = None
    # efforts is a JSON field (Python dict), use Column(JSON) for PostgreSQL
    efforts: Dict[str, float] = Field(default_factory=dict, sa_column=Column(JSON))
    travelCost: float = Field(default=0.0, ge=0)
    materialsCost: float = Field(default=0.0, ge=0)
    sequence: int = Field(default=0) # For ordering tasks

class Task(TaskBase, TimeStampedModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Relationship: many tasks belong to one project
    project: Project = Relationship(back_populates="tasks")

# Material Items Table (project-specific detailed materials)
class MaterialItemBase(SQLModel):
    projectId: int = Field(foreign_key="projects.id")
    lineItem: str = Field(min_length=1)
    vendor: Optional[str] = None
    category: Optional[str] = None
    unitPrice: float = Field(default=0.0, ge=0)
    quantity: int = Field(default=1, ge=0)
    comment: Optional[str] = None

class MaterialItem(MaterialItemBase, TimeStampedModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Relationship: many material items belong to one project
    project: Project = Relationship(back_populates="material_items")

# Global Materials Table (reusable materials for autofill)
class GlobalMaterialBase(SQLModel):
    name: str = Field(index=True, unique=True, min_length=1)
    category: Optional[str] = None
    unitPrice: float = Field(ge=0)

class GlobalMaterial(GlobalMaterialBase, SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

# Note: Relationships like List["Task"] handle forward references correctly when imported.