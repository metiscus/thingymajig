# backend/app/routers/material_items.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from app.database import get_session
from app.models import MaterialItem, MaterialItemBase, Project, User # NEW: Import Project and User
from app.auth import current_active_user # NEW: Import auth dependency

router = APIRouter(prefix="/material_items", tags=["Material Items"])

# Pydantic model for updating a material item (all fields optional)
class MaterialItemUpdate(MaterialItemBase):
    lineItem: Optional[str] = None
    vendor: Optional[str] = None
    category: Optional[str] = None
    unitPrice: Optional[float] = None
    quantity: Optional[int] = None
    comment: Optional[str] = None
    # projectId: Optional[int] = None # Prevent updating project ID directly

@router.get("/", response_model=List[MaterialItem])
async def read_material_items_for_project(
    *,
    session: Session = Depends(get_session),
    project_id: int,
    current_user: User = Depends(current_active_user) # Requires authentication
):
    """Fetches all detailed material items for a specific project, owned by current user or if superuser."""
    # First, verify the project exists and belongs to the current user (or user is superuser)
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to view material items for this project")

    items = session.exec(
        select(MaterialItem)
        .where(MaterialItem.projectId == project_id)
        .order_by(MaterialItem.createdAt)
    ).all()
    return items

@router.post("/", response_model=MaterialItem, status_code=status.HTTP_201_CREATED)
async def create_material_item(
    *,
    session: Session = Depends(get_session),
    item_in: MaterialItemBase,
    current_user: User = Depends(current_active_user) # Requires authentication
):
    """Creates a new detailed material item for a project, owned by current user or if superuser."""
    # Verify the project exists and belongs to the current user (or user is superuser)
    project = session.get(Project, item_in.projectId)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to create material items for this project")

    db_item = MaterialItem.from_orm(item_in)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.put("/{item_id}", response_model=MaterialItem)
async def update_material_item(
    *,
    session: Session = Depends(get_session),
    item_id: int,
    item_in: MaterialItemUpdate,
    current_user: User = Depends(current_active_user) # Requires authentication
):
    """Updates an existing detailed material item by ID (only if owned by current user's project or superuser)."""
    db_item = session.get(MaterialItem, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Material item not found")
    
    # Verify the project exists and belongs to the current user (or user is superuser)
    project = session.get(Project, db_item.projectId)
    if not project:
        raise HTTPException(status_code=404, detail="Associated project not found")

    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to update this material item")

    item_data = item_in.dict(exclude_unset=True)
    if "projectId" in item_data: # Prevent changing projectId
        del item_data["projectId"]

    for key, value in item_data.items():
        setattr(db_item, key, value)
    
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material_item(
    *,
    session: Session = Depends(get_session),
    item_id: int,
    current_user: User = Depends(current_active_user) # Requires authentication
):
    """Deletes a detailed material item by ID (only if owned by current user's project or superuser)."""
    item = session.get(MaterialItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Material item not found")
    
    # Verify the project exists and belongs to the current user (or user is superuser)
    project = session.get(Project, item.projectId)
    if not project:
        raise HTTPException(status_code=404, detail="Associated project not found")

    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to delete this material item")

    session.delete(item)
    session.commit()
    return {"ok": True}