from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User


def require_super_admin(db: Session, username: str) -> User:
    """Raise 403 unless `username` belongs to an existing super_admin user."""
    requester = db.query(User).filter(User.username == username).first()
    if not requester or requester.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only a super admin can perform this action.")
    return requester
