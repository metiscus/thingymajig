# backend/app/routers/tasks.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func, col # Added col
from typing import List, Optional, Dict
from pydantic import BaseModel

from app.database import get_session
# Updated model imports: Task, TaskBase, Project, User, Requirement, TaskRequirementLink
from app.models import Task, TaskBase, Project, User, Requirement, TaskRequirementLink 
from app.auth import current_active_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# --- Existing Pydantic models for Task ---
class TaskSequenceUpdate(BaseModel):
    id: int
    sequence: int

class TaskSequenceUpdateRequest(BaseModel):
    tasks: List[TaskSequenceUpdate]

# TaskUpdate is for PUT /tasks/{task_id}
class TaskUpdate(TaskBase): # This schema is used for updating a task's own fields
    name: Optional[str] = None
    description: Optional[str] = None
    efforts: Optional[Dict[str, float]] = None
    travelCost: Optional[float] = None
    materialsCost: Optional[float] = None
    sequence: Optional[int] = None
    # projectId is not updatable via this model, it's part of TaskBase for creation

# --- NEW: Pydantic Schemas for Task with Requirements ---
# We need a RequirementRead schema to embed in TaskReadWithRequirements
# This would be duplicative of the one in requirements.py router.
# For now, let's define a simplified one here or import if structure allows.
# Let's assume a simplified RequirementRead for now or just IDs.
# To avoid circular dependencies with router files, we'll define a local light version.

class RequirementBasicRead(SQLModel): # Simplified for embedding
    id: int
    custom_id: Optional[str] = None
    requirement_text: str

class TaskReadWithRequirements(TaskBase): # Used for GET responses
    id: int
    createdAt: datetime # from TimeStampedModel
    # project: ProjectRead # If we had a ProjectRead schema
    requirements: List[RequirementBasicRead] = [] # List of linked requirements


# --- Helper: Get Task and check authorization ---
async def get_task_if_authorized(task_id: int, user: User, session: Session) -> Task:
    db_task = session.get(Task, task_id)
    if not db_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    project = session.get(Project, db_task.projectId) # projectId is int from TaskBase
    if not project:
        # This case should ideally not happen if DB is consistent
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated project not found for task")
    
    if not user.is_superuser and project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this task")
    return db_task

# --- Existing Endpoints (modified to return TaskReadWithRequirements) ---

@router.get("/", response_model=List[TaskReadWithRequirements]) # Modified response_model
async def read_tasks_for_project(
    *,
    session: Session = Depends(get_session),
    project_id: int,
    current_user: User = Depends(current_active_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to view tasks for this project")

    # Fetch tasks and their linked requirements
    # SQLModel should automatically populate task.requirements due to the Relationship definition
    tasks_db = session.exec(
        select(Task)
        .where(Task.projectId == project_id)
        .order_by(Task.sequence, Task.createdAt)
    ).all()
    
    # Convert to TaskReadWithRequirements. This happens automatically if response_model is set
    # and Task model has the 'requirements' field correctly typed.
    # SQLModel's Relationship should populate task.requirements directly.
    return tasks_db


@router.post("/", response_model=TaskReadWithRequirements, status_code=status.HTTP_201_CREATED) # Modified response_model
async def create_task(
    *,
    session: Session = Depends(get_session),
    task_in: TaskBase, # TaskBase does not include requirements
    current_user: User = Depends(current_active_user)
):
    project = session.get(Project, task_in.projectId)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to create tasks for this project")

    max_sequence = session.exec(
        select(func.max(Task.sequence)).where(Task.projectId == task_in.projectId)
    ).first()
    task_in.sequence = (max_sequence or -1) + 1 

    db_task = Task.from_orm(task_in)
    db_task.requirements = [] # Initialize with empty list, linking is separate
    session.add(db_task)
    session.commit()
    session.refresh(db_task) # refresh to get ID and populate relationships if any default
    return db_task


@router.put("/{task_id}", response_model=TaskReadWithRequirements) # Modified response_model
async def update_task(
    *,
    session: Session = Depends(get_session),
    task_id: int,
    task_in: TaskUpdate, # TaskUpdate does not include requirements list directly
    current_user: User = Depends(current_active_user)
):
    db_task = await get_task_if_authorized(task_id, current_user, session)
    # Project auth is handled by get_task_if_authorized

    task_data = task_in.dict(exclude_unset=True)
    if "projectId" in task_data: # Should not be changed here
        del task_data["projectId"]

    for key, value in task_data.items():
        setattr(db_task, key, value)
    
    session.add(db_task)
    session.commit()
    session.refresh(db_task) # Refresh to get updated relationships if any change through other means
    return db_task

# update_task_sequence remains the same as it only deals with sequence numbers.
# delete_task also remains largely the same.

# --- NEW Endpoints for Task-Requirement Linking ---

@router.post("/{task_id}/requirements/{requirement_id}", response_model=TaskReadWithRequirements)
async def link_requirement_to_task(
    task_id: int,
    requirement_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """Links a requirement to a task."""
    db_task = await get_task_if_authorized(task_id, current_user, session)
    
    db_requirement = session.get(Requirement, requirement_id)
    if not db_requirement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found.")
    
    if db_requirement.project_id != db_task.projectId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task and Requirement do not belong to the same project.")

    # Check if link already exists
    if db_requirement not in db_task.requirements:
        db_task.requirements.append(db_requirement)
        session.add(db_task) # Adding db_task should handle the M2M link via SQLModel's magic
        session.commit()
        session.refresh(db_task) # Refresh to ensure the requirements list is up-to-date
    
    return db_task


@router.delete("/{task_id}/requirements/{requirement_id}", response_model=TaskReadWithRequirements)
async def unlink_requirement_from_task(
    task_id: int,
    requirement_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """Unlinks a requirement from a task."""
    db_task = await get_task_if_authorized(task_id, current_user, session)
    
    db_requirement = session.get(Requirement, requirement_id)
    if not db_requirement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found.")

    if db_requirement in db_task.requirements:
        db_task.requirements.remove(db_requirement)
        session.add(db_task)
        session.commit()
        session.refresh(db_task)
    else:
        # If not found, it might be okay, or raise 404 for "link not found"
        pass # Idempotent delete, link doesn't exist, so it's "deleted"
        
    return db_task

# Existing delete_task and update_task_sequence endpoints... (no change needed for them in Phase 1 linking)
# Make sure they are still at the end of the file or defined before being used.
# ... (pasting existing delete_task and update_task_sequence)
@router.put("/sequence", response_model=Dict[str, bool])
async def update_task_sequence(
    request_data: TaskSequenceUpdateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user)
):
    tasks_sequence_update = request_data.tasks
    if not tasks_sequence_update:
        return {"success": True}

    first_task_id = tasks_sequence_update[0].id
    first_task = session.get(Task, first_task_id)
    if not first_task:
        raise HTTPException(status_code=404, detail="First task in sequence list not found")
    
    project = session.get(Project, first_task.projectId)
    if not project:
        raise HTTPException(status_code=404, detail="Associated project for tasks not found")

    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to update tasks sequence for this project")

    try:
        for task_data in tasks_sequence_update:
            db_task = session.get(Task, task_data.id)
            if db_task:
                if db_task.projectId != project.id:
                    raise HTTPException(status_code=403, detail="Task in sequence update does not belong to the authorized project")
                db_task.sequence = task_data.sequence
                session.add(db_task)
        session.commit()
        return {"success": True}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update task sequence: {e}")

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    *,
    session: Session = Depends(get_session),
    task_id: int,
    current_user: User = Depends(current_active_user)
):
    task = await get_task_if_authorized(task_id, current_user, session) # Use helper
    # Task.requirements list will be automatically handled by SQLAlchemy's M2M when task is deleted.
    # The entries in TaskRequirementLink for this task_id will be removed.
    session.delete(task)
    session.commit()
    return {"ok": True} # Or None for 204