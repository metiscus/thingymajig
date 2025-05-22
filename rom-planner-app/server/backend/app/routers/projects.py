# backend/app/routers/projects.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from app.database import get_session
from app.models import Project, ProjectBase

router = APIRouter(prefix="/projects", tags=["Projects"])

# Pydantic model for updating a project (all fields optional)
class ProjectUpdate(ProjectBase):
    name: Optional[str] = None
    description: Optional[str] = None
    riskPercentage: Optional[float] = None

@router.get("/", response_model=List[Project])
def read_projects(*, session: Session = Depends(get_session)):
    """Fetches all projects, ordered by name."""
    projects = session.exec(select(Project).order_by(Project.name)).all()
    return projects

@router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(*, session: Session = Depends(get_session), project_in: ProjectBase):
    """Creates a new project."""
    # Check for unique name conflict
    existing_project = session.exec(select(Project).where(Project.name == project_in.name)).first()
    if existing_project:
        raise HTTPException(status_code=409, detail=f"Project with name '{project_in.name}' already exists.")
    
    db_project = Project.from_orm(project_in)
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@router.put("/{project_id}", response_model=Project)
def update_project(*, session: Session = Depends(get_session), project_id: int, project_in: ProjectUpdate):
    """Updates an existing project by ID."""
    db_project = session.get(Project, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check for unique name conflict if name is being changed
    if project_in.name and project_in.name != db_project.name:
        existing_project = session.exec(select(Project).where(Project.name == project_in.name)).first()
        if existing_project and existing_project.id != project_id:
            raise HTTPException(status_code=409, detail=f"Project with name '{project_in.name}' already exists.")

    project_data = project_in.dict(exclude_unset=True)
    for key, value in project_data.items():
        setattr(db_project, key, value)
    
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(*, session: Session = Depends(get_session), project_id: int):
    """Deletes a project by ID and cascades delete to associated tasks and material items."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Due to 'cascade="all, delete-orphan"' in models.py relationships,
    # deleting the project will automatically delete associated tasks and material items.
    session.delete(project)
    session.commit()
    return {"ok": True}