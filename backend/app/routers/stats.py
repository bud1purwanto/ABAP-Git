from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sandbox import Sandbox
from app.models.program_version import ProgramVersion
from app.models.activity_log import ActivityLog
from app.schemas import OverviewStats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview", response_model=OverviewStats)
def overview(db: Session = Depends(get_db)):
    total_sandboxes = db.query(func.count(Sandbox.id)).scalar() or 0

    env_counts = dict(
        db.query(Sandbox.environment, func.count(Sandbox.id)).group_by(Sandbox.environment).all()
    )
    servers_by_environment = {env: env_counts.get(env, 0) for env in ("SANDBOX", "DEV", "QA", "PROD")}

    total_programs = db.query(func.count(func.distinct(ProgramVersion.program_name))).scalar() or 0
    total_commits = db.query(func.count(ProgramVersion.id)).scalar() or 0

    # Calculate 'today' starting at midnight local time, converted to UTC for DB comparison
    today_start = datetime.combine(datetime.now().date(), time.min).astimezone(timezone.utc)
    commits_today = (
        db.query(func.count(ProgramVersion.id)).filter(ProgramVersion.created_at >= today_start).scalar() or 0
    )

    recent_activity = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(15).all()
    recent_commits = db.query(ProgramVersion).order_by(ProgramVersion.created_at.desc()).limit(15).all()

    return OverviewStats(
        total_sandboxes=total_sandboxes,
        servers_by_environment=servers_by_environment,
        total_programs=total_programs,
        total_commits=total_commits,
        commits_today=commits_today,
        recent_activity=recent_activity,
        recent_commits=recent_commits,
    )
