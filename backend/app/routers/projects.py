from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.project import Project, ProjectProgram
from app.models.sandbox import Sandbox
from app.models.activity_log import ActivityLog
from app.schemas import ProjectCreate, ProjectUpdate, ProjectOut
from typing import List

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return projects

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("", response_model=ProjectOut)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    # Verify sandbox exists
    sandbox = db.query(Sandbox).filter(Sandbox.id == payload.sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    # Check for duplicate project name in the same sandbox
    existing = db.query(Project).filter(Project.name == payload.name, Project.sandbox_id == payload.sandbox_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A project with this name already exists in this sandbox")

    new_project = Project(
        name=payload.name,
        description=payload.description,
        sandbox_id=payload.sandbox_id,
        created_by=payload.created_by
    )
    db.add(new_project)
    db.flush() # flush to get ID

    # Add programs
    added_programs = set()
    for prog in payload.programs:
        if prog.program_name in added_programs:
            continue
        new_prog = ProjectProgram(
            project_id=new_project.id,
            program_name=prog.program_name,
            tcode=prog.tcode
        )
        db.add(new_prog)
        added_programs.add(prog.program_name)

    db.commit()
    db.refresh(new_project)

    # Log activity
    db.add(ActivityLog(
        action="Create Project",
        username=payload.created_by or "system",
        sandbox_name=sandbox.name,
        detail=f"Created project {new_project.name}"
    ))
    db.commit()

    return new_project

@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.name is not None and payload.name != project.name:
        existing = db.query(Project).filter(Project.name == payload.name, Project.sandbox_id == project.sandbox_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="A project with this name already exists in this sandbox")
        project.name = payload.name

    if payload.description is not None:
        project.description = payload.description

    if payload.created_by is not None:
        project.created_by = payload.created_by

    if payload.programs is not None:
        # Delete existing
        db.query(ProjectProgram).filter(ProjectProgram.project_id == project.id).delete()
        # Add new
        added_programs = set()
        for prog in payload.programs:
            if prog.program_name in added_programs:
                continue
            new_prog = ProjectProgram(
                project_id=project.id,
                program_name=prog.program_name,
                tcode=prog.tcode
            )
            db.add(new_prog)
            added_programs.add(prog.program_name)

    db.commit()
    db.refresh(project)

    sandbox = db.query(Sandbox).filter(Sandbox.id == project.sandbox_id).first()
    db.add(ActivityLog(
        action="Update Project",
        username=payload.created_by or "system",
        sandbox_name=sandbox.name if sandbox else None,
        detail=f"Updated project {project.name}"
    ))
    db.commit()

    return project

@router.delete("/{project_id}")
def delete_project(project_id: int, author: str | None = None, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    sandbox = db.query(Sandbox).filter(Sandbox.id == project.sandbox_id).first()
    db.delete(project)
    
    db.add(ActivityLog(
        action="Delete Project",
        username=author or "system",
        sandbox_name=sandbox.name if sandbox else None,
        detail=f"Deleted project {project.name}"
    ))
    
    db.commit()
    return {"status": "ok", "message": "Project deleted"}

@router.post("/{project_id}/copy")
def copy_project(project_id: int, target_sandbox_id: int, author: str | None = None, db: Session = Depends(get_db)):
    original_project = db.query(Project).filter(Project.id == project_id).first()
    if not original_project:
        raise HTTPException(status_code=404, detail="Original project not found")

    target_sandbox = db.query(Sandbox).filter(Sandbox.id == target_sandbox_id).first()
    if not target_sandbox:
        raise HTTPException(status_code=404, detail="Target sandbox not found")

    # Check if a project with the same name already exists in the target sandbox
    existing = db.query(Project).filter(Project.name == original_project.name, Project.sandbox_id == target_sandbox_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A project with the same name already exists in the target sandbox")

    new_project = Project(
        name=original_project.name,
        description=original_project.description,
        sandbox_id=target_sandbox_id,
        created_by=author
    )
    db.add(new_project)
    db.flush()

    for prog in original_project.programs:
        new_prog = ProjectProgram(
            project_id=new_project.id,
            program_name=prog.program_name,
            tcode=prog.tcode
        )
        db.add(new_prog)

    db.commit()
    db.refresh(new_project)

    db.add(ActivityLog(
        action="Copy Project",
        username=author or "system",
        sandbox_name=target_sandbox.name,
        detail=f"Copied project {original_project.name} to sandbox {target_sandbox.name}"
    ))
    db.commit()

    return {"status": "ok", "message": "Project copied successfully", "new_project_id": new_project.id}
