# backend/app/routers/requirements.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, col
from typing import List, Optional
from datetime import datetime, timezone # Import timezone for consistent timestamps

from app.database import get_session
from app.models import Requirement, Project, User, RFDocument # RequirementBase implicit
from app.auth import current_active_user

from sqlmodel import SQLModel
# Remove redundant datetime import if already above
# from datetime import datetime

router = APIRouter(prefix="/requirements", tags=["Requirements"])

# --- Schemas ---
class RequirementCreate(SQLModel): # For POST /projects/{project_id}/requirements
    # project_id will be from path
    rfi_document_id: Optional[int] = None
    custom_id: Optional[str] = None
    requirement_text: str

class RequirementUpdate(SQLModel): # For PUT /requirements/{requirement_id}
    rfi_document_id: Optional[int] = None # Allow changing link
    custom_id: Optional[str] = None
    requirement_text: Optional[str] = None # Allow partial updates

class RequirementRead(SQLModel): # For GET responses
    id: int
    project_id: int
    rfi_document_id: Optional[int] = None
    custom_id: Optional[str] = None
    requirement_text: str
    createdAt: datetime # CHANGED: from 'created_at' to 'createdAt'
    updatedAt: datetime # CHANGED: from 'updated_at' to 'updatedAt'
    # tasks: List["TaskRead"] = [] # If we want to include linked tasks directly, requires TaskRead schema

# --- Helper Function to check project ownership (similar to rfi_documents router) ---
# This could be moved to a shared utility if used in many places
async def get_project_if_authorized_for_requirement(project_id: int, user: User, session: Session) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not user.is_superuser and project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this project's requirements")
    return project

async def get_requirement_if_authorized(requirement_id: int, user: User, session: Session) -> Requirement:
    requirement = session.get(Requirement, requirement_id)
    if not requirement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")
    
    # Check project authorization for this requirement
    await get_project_if_authorized_for_requirement(requirement.project_id, user, session)
    return requirement


# --- Unique Custom ID Check ---
def check_custom_id_uniqueness(project_id: int, custom_id: Optional[str], session: Session, existing_req_id: Optional[int] = None):
    if custom_id is None: # Allow null custom_id
        return
    
    query = select(Requirement).where(Requirement.project_id == project_id).where(col(Requirement.custom_id) == custom_id)
    if existing_req_id:
        query = query.where(Requirement.id != existing_req_id)
    
    existing_with_custom_id = session.exec(query).first()
    if existing_with_custom_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Requirement with custom_id '{custom_id}' already exists for this project."
        )

# --- API Endpoints ---

@router.post("/projects/{project_id}/requirements", response_model=RequirementRead, status_code=status.HTTP_201_CREATED)
async def create_requirement(
    project_id: int,
    requirement_in: RequirementCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Manually creates a new requirement for a specific project.
    """
    project = await get_project_if_authorized_for_requirement(project_id, current_user, session)

    # Validate rfi_document_id if provided
    if requirement_in.rfi_document_id:
        rfi_doc = session.get(RFDocument, requirement_in.rfi_document_id)
        if not rfi_doc or rfi_doc.project_id != project.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFDocument not found or does not belong to this project.")

    check_custom_id_uniqueness(project.id, requirement_in.custom_id, session)

    db_requirement = Requirement.from_orm(requirement_in, update={"project_id": project.id})
    session.add(db_requirement)
    session.commit()
    session.refresh(db_requirement)
    return db_requirement

@router.get("/projects/{project_id}/requirements", response_model=List[RequirementRead])
async def list_requirements_for_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Lists all requirements for a specific project.
    """
    project = await get_project_if_authorized_for_requirement(project_id, current_user, session)
    
    requirements = session.exec(
        select(Requirement).where(Requirement.project_id == project.id).order_by(Requirement.custom_id, Requirement.createdAt) # CHANGED: from 'created_at' to 'createdAt'
    ).all()
    return requirements

@router.put("/{requirement_id}", response_model=RequirementRead)
async def update_requirement_details( # Renamed to avoid conflict if another update endpoint is added
    requirement_id: int,
    requirement_in: RequirementUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Updates an existing requirement.
    """
    db_requirement = await get_requirement_if_authorized(requirement_id, current_user, session)

    if requirement_in.rfi_document_id and requirement_in.rfi_document_id != db_requirement.rfi_document_id:
        rfi_doc = session.get(RFDocument, requirement_in.rfi_document_id)
        if not rfi_doc or rfi_doc.project_id != db_requirement.project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFDocument not found or does not belong to this project.")
    
    if requirement_in.custom_id is not None and requirement_in.custom_id != db_requirement.custom_id:
        check_custom_id_uniqueness(db_requirement.project_id, requirement_in.custom_id, session, existing_req_id=db_requirement.id)

    update_data = requirement_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_requirement, key, value)
    
    # Manually set updatedAt
    db_requirement.updatedAt = datetime.now(timezone.utc) # CHANGED: from 'updated_at' to 'updatedAt'

    session.add(db_requirement)
    session.commit()
    session.refresh(db_requirement)
    return db_requirement


@router.delete("/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_requirement_entry( # Renamed to avoid conflict
    requirement_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Deletes a requirement.
    This will also remove links to any tasks (due to TaskRequirementLink being an association table).
    """
    db_requirement = await get_requirement_if_authorized(requirement_id, current_user, session)
    
    # Links in TaskRequirementLink table will be deleted by cascade if DB is set up for it,
    # or implicitly because they refer to this requirement.
    # SQLModel's Relationship doesn't automatically cascade delete on the link table records
    # when the "many" side object (Requirement) is deleted without specific SA config.
    # It's often better to handle explicitly or ensure DB cascades are set if table created outside ORM.
    # For now, deleting the Requirement will leave orphaned task_id in Task.requirements list if not refreshed.
    # The design document said: "Delete a requirement. Response: 204 No Content."
    # It also said "Tasks: List["Requirement"] = Relationship(back_populates="requirements", link_model=TaskRequirementLink)"
    # This M2M link means deleting a Requirement should automatically make it disappear from any Task.requirements lists on next fetch.
    # The TaskRequirementLink rows associated with this requirement_id will be orphaned or deleted depending on DB FK constraints (ON DELETE CASCADE).
    # SQLModel does not define ON DELETE CASCADE by default on FKs in association tables.
    # So, the links in TaskRequirementLink might need to be manually deleted if not handled by DB.
    # Let's assume for now the DB relationship is sufficient or links are soft-deleted / ignored.
    # A better way: explicitly delete links.
    # However, the requirement model has `tasks: List["Task"] = Relationship(back_populates="requirements", link_model=TaskRequirementLink)`
    # When db_requirement is deleted, SQLAlchemy ORM should handle cleaning up the association table entries.

    session.delete(db_requirement)
    session.commit()
    return None