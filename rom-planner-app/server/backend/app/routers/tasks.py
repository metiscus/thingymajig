# backend/app/routers/tasks.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from typing import List, Optional, Dict

from app.database import get_session
from app.models import Task, TaskBase

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# Pydantic model for updating a task (all fields optional)
class TaskUpdate(TaskBase):
    name: Optional[str] = None
    description: Optional[str] = None
    efforts: Optional[Dict[str, float]] = None
    travelCost: Optional[float] = None
    materialsCost: Optional[float] = None
    sequence: Optional[int] = None
    projectId: Optional[int] = None # Prevent updating project ID directly via task update

@router.get("/", response_model=List[Task])
def read_tasks_for_project(*, session: Session = Depends(get_session), project_id: int):
    """Fetches all tasks for a specific project, ordered by sequence."""
    tasks = session.exec(
        select(Task)
        .where(Task.projectId == project_id)
        .order_by(Task.sequence, Task.createdAt)
    ).all()
    return tasks

@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(*, session: Session = Depends(get_session), task_in: TaskBase):
    """Creates a new task within a project."""
    # Determine the next sequence number for the new task
    max_sequence = session.exec(
        select(func.max(Task.sequence)).where(Task.projectId == task_in.projectId)
    ).first()
    task_in.sequence = (max_sequence or -1) + 1 # Assigns 0 if no tasks, otherwise max_sequence + 1

    db_task = Task.from_orm(task_in)
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task

@router.put("/{task_id}", response_model=Task)
def update_task(*, session: Session = Depends(get_session), task_id: int, task_in: TaskUpdate):
    """Updates an existing task by ID."""
    db_task = session.get(Task, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task_data = task_in.dict(exclude_unset=True)
    
    # Ensure projectId cannot be changed here
    if "projectId" in task_data:
        del task_data["projectId"]

    for key, value in task_data.items():
        setattr(db_task, key, value)
    
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(*, session: Session = Depends(get_session), task_id: int):
    """Deletes a task by ID."""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    session.delete(task)
    session.commit()
    return {"ok": True}

@router.put("/sequence", response_model=Dict[str, bool])
def update_task_sequence(*, session: Session = Depends(get_session), tasks_sequence_update: List[Dict[str, int]]):
    """
    Updates the sequence of multiple tasks.
    tasks_sequence_update: List of dictionaries, each with 'id' and 'sequence'.
    """
    # Using a transaction to ensure all updates succeed or fail together
    try:
        for task_data in tasks_sequence_update:
            task_id = task_data.get("id")
            new_sequence = task_data.get("sequence")
            if task_id is None or new_sequence is None:
                raise HTTPException(status_code=400, detail="Invalid task sequence data: missing 'id' or 'sequence'")
            
            db_task = session.get(Task, task_id)
            if db_task:
                db_task.sequence = new_sequence
                session.add(db_task)
        
        session.commit()
        return {"success": True}
    except Exception as e:
        session.rollback() # Rollback in case of error
        raise HTTPException(status_code=500, detail=f"Failed to update task sequence: {e}")