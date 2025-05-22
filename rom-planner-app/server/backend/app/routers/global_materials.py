# backend/app/routers/global_materials.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from app.database import get_session
from app.models import GlobalMaterial, GlobalMaterialBase

router = APIRouter(prefix="/global_materials", tags=["Global Materials"])

# Pydantic model for updating a global material (all fields optional)
class GlobalMaterialUpdate(GlobalMaterialBase):
    name: Optional[str] = None
    category: Optional[str] = None
    unitPrice: Optional[float] = None

@router.get("/", response_model=List[GlobalMaterial])
def read_global_materials(*, session: Session = Depends(get_session)):
    """Fetches all global material definitions."""
    materials = session.exec(select(GlobalMaterial).order_by(GlobalMaterial.name)).all()
    return materials

@router.post("/", response_model=GlobalMaterial, status_code=status.HTTP_201_CREATED)
def create_or_update_global_material(*, session: Session = Depends(get_session), material_in: GlobalMaterialBase):
    """
    Creates a new global material or updates an existing one if the name already exists.
    Behaves like an UPSERT based on 'name'.
    """
    existing_material = session.exec(select(GlobalMaterial).where(GlobalMaterial.name == material_in.name)).first()
    if existing_material:
        existing_material.category = material_in.category
        existing_material.unitPrice = material_in.unitPrice
        session.add(existing_material)
        session.commit()
        session.refresh(existing_material)
        return existing_material

    db_material = GlobalMaterial.from_orm(material_in)
    session.add(db_material)
    session.commit()
    session.refresh(db_material)
    return db_material

@router.put("/{material_id}", response_model=GlobalMaterial)
def update_global_material(*, session: Session = Depends(get_session), material_id: int, material_in: GlobalMaterialUpdate):
    """Updates an existing global material by ID."""
    db_material = session.get(GlobalMaterial, material_id)
    if not db_material:
        raise HTTPException(status_code=404, detail="Global material not found")
    
    # If name is being changed, check for conflict
    if material_in.name and material_in.name != db_material.name:
        existing_by_new_name = session.exec(select(GlobalMaterial).where(GlobalMaterial.name == material_in.name)).first()
        if existing_by_new_name and existing_by_new_name.id != material_id:
            raise HTTPException(status_code=409, detail=f"Global material with name '{material_in.name}' already exists.")

    material_data = material_in.dict(exclude_unset=True)
    for key, value in material_data.items():
        setattr(db_material, key, value)
    
    session.add(db_material)
    session.commit()
    session.refresh(db_material)
    return db_material

@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_global_material(*, session: Session = Depends(get_session), material_id: int):
    """Deletes a global material by ID."""
    material = session.get(GlobalMaterial, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Global material not found")
    session.delete(material)
    session.commit()
    return {"ok": True}