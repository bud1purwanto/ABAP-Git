from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas import ResetPasswordRequest, UserCreate, UserOut
from app.services.security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_super_admin(db: Session, username: str) -> User:
    requester = db.query(User).filter(User.username == username).first()
    if not requester or requester.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only a super admin can perform this action.")
    return requester


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.username).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    _require_super_admin(db, payload.requested_by)

    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"User '{payload.username}' already exists")

    if payload.role not in ("developer", "super_admin"):
        raise HTTPException(status_code=400, detail="Role must be 'developer' or 'super_admin'")

    user = User(
        username=payload.username,
        password=hash_password(payload.password),
        git_author_name=payload.git_author_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, requested_by: str = Query(...), db: Session = Depends(get_db)):
    requester = _require_super_admin(db, requested_by)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == requester.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    db.delete(user)
    db.commit()
    return None


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_password(user_id: int, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Super admin resets another user's password. The user will be required to set a
    new password the next time they log in."""
    _require_super_admin(db, payload.requested_by)

    if len(payload.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password is too short")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(payload.new_password)
    user.must_change_password = True
    db.commit()
    db.refresh(user)
    return user
