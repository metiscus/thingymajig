# backend/app/routers/rfi_documents.py
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.database import get_session
from app.models import RFDocument, Project, User # RFDocumentBase implicit
from app.auth import current_active_user
from app.config import RFI_STORAGE_BASE_PATH

router = APIRouter(prefix="/rfi", tags=["RFI Documents"]) # Prefix adjusted for clarity

# --- Schemas ---
# Base schema, used for creation input (project_id will be from path)
class RFDocumentCreateInternal(SQLModel): # Internal, not directly exposed
    filename: str
    stored_filename: str
    filepath: str
    content_type: str
    filesize: int
    project_id: int

class RFDocumentRead(SQLModel): # Exposed for reading
    id: int
    project_id: int
    filename: str
    # stored_filename: str # Not typically exposed to client
    # filepath: str # Not typically exposed to client
    content_type: str
    filesize: int
    uploaded_at: datetime
    last_processed_at: Optional[datetime] = None


# --- Helper Function to check project ownership ---
async def get_project_if_authorized(project_id: int, user: User, session: Session) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not user.is_superuser and project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this project's RFIs")
    return project

# --- API Endpoints ---

@router.post("/projects/{project_id}/documents", response_model=RFDocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_rfi_document(
    project_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Uploads an RFI document for a specific project.
    The user must be the owner of the project or a superuser.
    """
    project = await get_project_if_authorized(project_id, current_user, session)

    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type. Only PDF is allowed.")

    # Define storage path: RFI_STORAGE_BASE_PATH / project_id / unique_filename.pdf
    project_rfi_path = Path(RFI_STORAGE_BASE_PATH) / str(project.id)
    project_rfi_path.mkdir(parents=True, exist_ok=True) # Create directory if it doesn't exist

    # Generate a unique filename for storage to prevent conflicts and sanitize
    unique_suffix = uuid.uuid4().hex
    stored_filename_stem = Path(file.filename).stem # Original filename without extension
    stored_filename = f"{stored_filename_stem}_{unique_suffix}.pdf"
    
    file_path_on_disk = project_rfi_path / stored_filename
    relative_file_path = f"{project.id}/{stored_filename}" # Store path relative to RFI_STORAGE_BASE_PATH

    try:
        with open(file_path_on_disk, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        # Log e for server-side debugging
        print(f"Error saving file: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not save RFI file.")
    finally:
        file.file.close()

    # Get file size after saving
    try:
        filesize = file_path_on_disk.stat().st_size
    except FileNotFoundError:
        # This should not happen if saving was successful
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="File not found after saving.")


    rfi_doc_data = RFDocumentCreateInternal(
        project_id=project.id,
        filename=file.filename,
        stored_filename=stored_filename, # The unique name used on disk
        filepath=relative_file_path,     # Path relative to RFI_STORAGE_BASE_PATH
        content_type=file.content_type,
        filesize=filesize
    )
    
    db_rfi_document = RFDocument.from_orm(rfi_doc_data)
    session.add(db_rfi_document)
    session.commit()
    session.refresh(db_rfi_document)
    
    return db_rfi_document


@router.get("/projects/{project_id}/documents", response_model=List[RFDocumentRead])
async def list_rfi_documents_for_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Lists all RFI documents for a specific project.
    User must be owner or superuser.
    """
    project = await get_project_if_authorized(project_id, current_user, session)
    
    rfi_documents = session.exec(
        select(RFDocument).where(RFDocument.project_id == project.id).order_by(RFDocument.uploaded_at.desc())
    ).all()
    return rfi_documents

@router.get("/documents/{doc_id}/download", response_class=FileResponse)
async def download_rfi_document(
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Downloads a specific RFI document.
    User must have access to the project the document belongs to.
    """
    db_rfi_document = session.get(RFDocument, doc_id)
    if not db_rfi_document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFI Document not found.")

    # Authorize: Check if user can access the project this RFI belongs to
    await get_project_if_authorized(db_rfi_document.project_id, current_user, session)

    full_file_path = Path(RFI_STORAGE_BASE_PATH) / db_rfi_document.filepath
    if not full_file_path.is_file():
        # Log this error server-side
        print(f"File not found on disk: {full_file_path}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFI file not found on server storage.")

    return FileResponse(
        path=str(full_file_path),
        media_type=db_rfi_document.content_type,
        filename=db_rfi_document.filename # Original filename for download
    )


@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rfi_document(
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(current_active_user),
):
    """
    Deletes a specific RFI document and its associated file.
    User must have access to the project the document belongs to.
    """
    db_rfi_document = session.get(RFDocument, doc_id)
    if not db_rfi_document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFI Document not found.")

    # Authorize
    await get_project_if_authorized(db_rfi_document.project_id, current_user, session)

    full_file_path = Path(RFI_STORAGE_BASE_PATH) / db_rfi_document.filepath
    
    # Delete from DB first (or use a transaction)
    # If cascade delete for requirements from this RFI is set up, they will also be deleted.
    session.delete(db_rfi_document)
    session.commit()

    # Then delete file
    try:
        if full_file_path.is_file():
            full_file_path.unlink()
        # Optionally, try to remove the project's RFI directory if empty, but be careful
        # project_rfi_path = Path(RFI_STORAGE_BASE_PATH) / str(db_rfi_document.project_id)
        # if project_rfi_path.is_dir() and not any(project_rfi_path.iterdir()):
        #     project_rfi_path.rmdir()
    except Exception as e:
        # Log error, but don't fail request if DB entry already deleted
        print(f"Error deleting RFI file {full_file_path}: {e}")
        # Potentially raise an issue or log for admin attention if file deletion fails but DB entry is gone.
        # For now, we prioritize DB consistency.

    return None # FastAPI handles 204 No Content