from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas import LoginRequest
from app.services.security import hash_password, is_hashed, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not is_hashed(user.password):
        user.password = hash_password(payload.password)
        db.commit()

    return {
        "status": "ok",
        "username": user.username,
        "git_author_name": user.git_author_name,
    }
