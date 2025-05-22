# backend/app/routers/export.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from app.database import get_session
from app.models import Project, Rate, Task, MaterialItem
from app.services.excel_export import generate_project_excel

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/project/{project_id}/excel")
async def export_project_to_excel(*, session: Session = Depends(get_session), project_id: int):
    """
    Exports a project's data (summary, labor, rates, material items) to an Excel spreadsheet.
    """
    project = session.exec(select(Project).where(Project.id == project_id)).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    rates = session.exec(select(Rate).order_by(Rate.role)).all()
    tasks = session.exec(select(Task).where(Task.projectId == project_id).order_by(Task.sequence, Task.createdAt)).all()
    material_items = session.exec(select(MaterialItem).where(MaterialItem.projectId == project_id).order_by(MaterialItem.createdAt)).all()

    excel_buffer = generate_project_excel(project, rates, tasks, material_items)

    # Return the Excel file as a streaming response
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=Project_Export_{project.name.replace(' ', '_')}.xlsx"}
    )