# backend/app/routers/rates.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from app.database import get_session
from app.models import Rate, RateBase, User # NEW: Import User
from app.auth import current_active_user, current_superuser # NEW: Import auth dependencies

router = APIRouter(prefix="/rates", tags=["Rates"])

@router.get("/", response_model=List[Rate])
async def read_rates(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user) # Requires authentication to read rates
):
    """Fetches all defined rates (requires authentication)."""
    rates = session.exec(select(Rate).order_by(Rate.role)).all()
    return rates

@router.post("/", response_model=Rate, status_code=status.HTTP_201_CREATED)
async def create_or_update_rate(
    *,
    session: Session = Depends(get_session),
    rate_in: RateBase,
    current_user: User = Depends(current_active_user) 
):
    """
    Creates a new rate or updates an existing one if the role already exists (superuser only).
    Behaves like an UPSERT based on 'role'.
    """
    existing_rate = session.exec(select(Rate).where(Rate.role == rate_in.role)).first()
    if existing_rate:
        for key, value in rate_in.dict(exclude_unset=True).items():
            setattr(existing_rate, key, value)
        session.add(existing_rate)
        session.commit()
        session.refresh(existing_rate)
        return existing_rate
    
    db_rate = Rate.from_orm(rate_in)
    session.add(db_rate)
    session.commit()
    session.refresh(db_rate)
    return db_rate

@router.put("/{rate_id}", response_model=Rate)
async def update_rate(
    *,
    session: Session = Depends(get_session),
    rate_id: int,
    rate_in: RateBase,
    current_user: User = Depends(current_active_user)
):
    """Updates an existing rate by ID (superuser only)."""
    db_rate = session.get(Rate, rate_id)
    if not db_rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    
    if rate_in.role and rate_in.role != db_rate.role:
        existing_by_new_role = session.exec(select(Rate).where(Rate.role == rate_in.role)).first()
        if existing_by_new_role and existing_by_new_role.id != rate_id:
            raise HTTPException(status_code=409, detail=f"Role '{rate_in.role}' already exists for another rate.")

    rate_data = rate_in.dict(exclude_unset=True)
    for key, value in rate_data.items():
        setattr(db_rate, key, value)
    
    session.add(db_rate)
    session.commit()
    session.refresh(db_rate)
    return db_rate

@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rate(
    *,
    session: Session = Depends(get_session),
    rate_id: int,
    current_user: User = Depends(current_active_user)
):
    """Deletes a rate by ID (superuser only)."""
    rate = session.get(Rate, rate_id)
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    session.delete(rate)
    session.commit()
    return {"ok": True}