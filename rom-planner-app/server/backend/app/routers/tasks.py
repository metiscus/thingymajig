# backend/app/routers/tasks.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from typing import List, Optional, Dict
from pydantic import BaseModel

from app.database import get_session
from app.models import Task, TaskBase, Project, User
from app.auth import current_active_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# Add this Pydantic model for the sequence update
class TaskSequenceUpdate(BaseModel):
    id: int
    sequence: int

# Wrapper model for the list of task sequence updates
class TaskSequenceUpdateRequest(BaseModel):
    tasks: List[TaskSequenceUpdate]

# Pydantic model for updating a task (all fields optional)
class TaskUpdate(TaskBase):
    name: Optional[str] = None
    description: Optional[str] = None
    efforts: Optional[Dict[str, float]] = None
    travelCost: Optional[float] = None
    materialsCost: Optional[float] = None
    sequence: Optional[int] = None

@router.get("/", response_model=List[Task])
async def read_tasks_for_project(
    *,
    session: Session = Depends(get_session),
    project_id: int,
    current_user: User = Depends(current_active_user)
):
    """Fetches all tasks for a specific project, owned by current user or if superuser."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to view tasks for this project")

    tasks = session.exec(
        select(Task)
        .where(Task.projectId == project_id)
        .order_by(Task.sequence, Task.createdAt)
    ).all()
    return tasks

@router.put("/sequence", response_model=Dict[str, bool])
async def update_task_sequence(
    request_data: TaskSequenceUpdateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user)
):
    """
    Updates the sequence of multiple tasks.
    Tasks must belong to a project owned by the current user (or user is superuser).
    """
    print(f"DEBUG: Received request_data: {request_data}")  # Add this debug line
    print(f"DEBUG: request_data.tasks: {request_data.tasks}")  # Add this debug line
    
    tasks_sequence_update = request_data.tasks
    if not tasks_sequence_update:
        return {"success": True}

    # Get the project_id from one of the tasks to check ownership
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

@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(
    *,
    session: Session = Depends(get_session),
    task_in: TaskBase,
    current_user: User = Depends(current_active_user)
):
    """Creates a new task within a project, owned by current user or if superuser."""
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
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task

@router.put("/{task_id}", response_model=Task)
async def update_task(
    *,
    session: Session = Depends(get_session),
    task_id: int,
    task_in: TaskUpdate,
    current_user: User = Depends(current_active_user)
):
    """Updates an existing task by ID (only if owned by current user's project or superuser)."""
    db_task = session.get(Task, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    project = session.get(Project, db_task.projectId)
    if not project:
        raise HTTPException(status_code=404, detail="Associated project not found")
    
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to update this task")

    task_data = task_in.dict(exclude_unset=True)
    
    if "projectId" in task_data:
        del task_data["projectId"]

    for key, value in task_data.items():
        setattr(db_task, key, value)
    
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    *,
    session: Session = Depends(get_session),
    task_id: int,
    current_user: User = Depends(current_active_user)
):
    """Deletes a task by ID (only if owned by current user's project or superuser)."""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    project = session.get(Project, task.projectId)
    if not project:
        raise HTTPException(status_code=404, detail="Associated project not found")

    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to delete this task")

    session.delete(task)
    session.commit()
    return {"ok": True}

