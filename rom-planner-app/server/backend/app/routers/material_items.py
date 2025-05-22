# backend/app/routers/material_items.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from app.database import get_session
from app.models import MaterialItem, MaterialItemBase

router = APIRouter(prefix="/material_items", tags=["Material Items"])

# Pydantic model for updating a material item (all fields optional)
class MaterialItemUpdate(MaterialItemBase):
    lineItem: Optional[str] = None
    vendor: Optional[str] = None
    category: Optional[str] = None
    unitPrice: Optional[float] = None
    quantity: Optional[int] = None
    comment: Optional[str] = None
    projectId: Optional[int] = None # Prevent updating project ID directly

@router.get("/", response_model=List[MaterialItem])
def read_material_items_for_project(*, session: Session = Depends(get_session), project_id: int):
    """Fetches all detailed material items for a specific project."""
    items = session.exec(
        select(MaterialItem)
        .where(MaterialItem.projectId == project_id)
        .order_by(MaterialItem.createdAt)
    ).all()
    return items

@router.post("/", response_model=MaterialItem, status_code=status.HTTP_201_CREATED)
def create_material_item(*, session: Session = Depends(get_session), item_in: MaterialItemBase):
    """Creates a new detailed material item for a project."""
    db_item = MaterialItem.from_orm(item_in)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.put("/{item_id}", response_model=MaterialItem)
def update_material_item(*, session: Session = Depends(get_session), item_id: int, item_in: MaterialItemUpdate):
    """Updates an existing detailed material item by ID."""
    db_item = session.get(MaterialItem, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Material item not found")
    
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
def delete_material_item(*, session: Session = Depends(get_session), item_id: int):
    """Deletes a detailed material item by ID."""
    item = session.get(MaterialItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Material item not found")
    session.delete(item)
    session.commit()
    return {"ok": True}