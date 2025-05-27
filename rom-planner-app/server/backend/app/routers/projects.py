# backend/app/routers/projects.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from app.database import get_session
from app.models import Project, ProjectBase, User # NEW: Import User model
from app.auth import current_active_user, current_superuser # NEW: Import auth dependencies

router = APIRouter(prefix="/projects", tags=["Projects"])

class ProjectUpdate(ProjectBase):
    name: Optional[str] = None
    description: Optional[str] = None
    riskPercentage: Optional[float] = None

# Authorization Rules:
# - Anyone authenticated can read projects.
# - Only the owner can create/update/delete their projects.
# - Superusers can create/update/delete any project (optional).

@router.get("/", response_model=List[Project])
async def read_projects(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user) # NEW: Project list requires authentication
):
    """Fetches all projects owned by the current user, or all if superuser."""
    if current_user.is_superuser:
        projects = session.exec(select(Project).order_by(Project.name)).all()
    else:
        projects = session.exec(select(Project).where(Project.owner_id == current_user.id).order_by(Project.name)).all()
    return projects

@router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(
    *,
    session: Session = Depends(get_session),
    project_in: ProjectBase,
    current_user: User = Depends(current_active_user) # NEW: Creation requires authentication
):
    """Creates a new project owned by the current user."""
    existing_project = session.exec(select(Project).where(Project.name == project_in.name)).first()
    if existing_project:
        raise HTTPException(status_code=409, detail=f"Project with name '{project_in.name}' already exists.")
    
    db_project = Project.from_orm(project_in, update={'owner_id': current_user.id}) # NEW: Assign owner
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@router.put("/{project_id}", response_model=Project)
async def update_project(
    *,
    session: Session = Depends(get_session),
    project_id: int,
    project_in: ProjectUpdate,
    current_user: User = Depends(current_active_user) # NEW: Update requires authentication
):
    """Updates an existing project by ID (only if owned by current user or superuser)."""
    db_project = session.get(Project, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # NEW: Authorization check - only owner or superuser can update
    if db_project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")

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
async def delete_project(
    *,
    session: Session = Depends(get_session),
    project_id: int,
    current_user: User = Depends(current_active_user) # NEW: Delete requires authentication
):
    """Deletes a project by ID (only if owned by current user or superuser)."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # NEW: Authorization check - only owner or superuser can delete
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")

    session.delete(project)
    session.commit()
    return {"ok": True}