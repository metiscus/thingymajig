# backend/app/routers/tasks.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func, col, SQLModel
from typing import List, Optional, Dict
from pydantic import BaseModel

from app.database import get_session
# Updated model imports: Task, TaskBase, Project, User, Requirement, TaskRequirementLink
from app.models import Task, TaskBase, Project, User, Requirement, TaskRequirementLink 
from app.auth import current_active_user
from datetime import datetime, timezone # Import timezone

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
    createdAt: datetime # ADDED: to match Requirement model
    updatedAt: datetime # ADDED: to match Requirement model


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

# This endpoint handles setting (creating/updating) all requirements for a task at once.
class TaskRequirementIdsUpdate(SQLModel):
    requirement_ids: List[int]

@router.put("/{task_id}/requirements", response_model=TaskReadWithRequirements)
async def set_task_requirements(
    task_id: int,
    req_ids_in: TaskRequirementIdsUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Sets the requirements linked to a task.
    Existing links not in the list are removed, new ones are added.
    """
    db_task = await get_task_if_authorized(task_id, current_user, session)
    
    # Fetch all requirements that should be linked
    new_requirements = session.exec(
        select(Requirement).where(col(Requirement.id).in_(req_ids_in.requirement_ids))
    ).all()

    # Filter out requirements not belonging to the same project
    valid_new_requirements = [
        req for req in new_requirements if req.project_id == db_task.projectId
    ]
    if len(valid_new_requirements) != len(req_ids_in.requirement_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some requirements specified are not valid or do not belong to this project."
        )

    db_task.requirements = valid_new_requirements # SQLModel handles the diffing and updates association table

    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task


# NOTE: The individual link/unlink endpoints are now redundant if `set_task_requirements` is used.
# If you want to keep them for granular control or different use cases, they should be defined as:
# @router.post("/{task_id}/requirements/{requirement_id}", ...)
# @router.delete("/{task_id}/requirements/{requirement_id}", ...)
# Ensure that frontend uses the correct `set_task_requirements` if these are removed.


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
    """Deletes a task. This will also delete its associations in `TaskRequirementLink`."""
    task = await get_task_if_authorized(task_id, current_user, session) # Use helper
    
    # SQLAlchemy's relationship `back_populates` with `link_model` ensures that
    # when `db_task` is deleted, entries in `TaskRequirementLink` table related to this task
    # are automatically cleaned up if foreign key constraints have ON DELETE CASCADE.
    # SQLModel itself does not define ON DELETE CASCADE by default on join table FKs.
    # It's good practice to ensure DB schema has ON DELETE CASCADE for association tables,
    # or handle explicit deletion of links if needed.
    session.delete(task)
    session.commit()
    return {"ok": True} # Or None for 204