from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.activity_log import ActivityLog
from app.schemas import ActivityLogOut

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("", response_model=list[ActivityLogOut])
def get_activity(limit: int = 50, author: str | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(ActivityLog)
    if author:
        query = query.filter(ActivityLog.username == author)
    return query.order_by(ActivityLog.created_at.desc()).limit(limit).all()
