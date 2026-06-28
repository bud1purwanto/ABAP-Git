from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, SessionLocal, engine, run_lightweight_migrations
from app.models.user import User
from app.routers import sandboxes, sap, ai, git_ops, auth, activity, users, stats
from app.services.security import hash_password

Base.metadata.create_all(bind=engine)
run_lightweight_migrations()


def seed_super_admin():
    """Ensure the initial super admin account exists. Safe to run on every startup —
    it only inserts the row if a user with this username doesn't already exist."""
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "TRSTDEV").first()
        if not existing:
            db.add(
                User(
                    username="TRSTDEV",
                    password=hash_password("ronin03"),
                    git_author_name="Super Admin",
                    role="super_admin",
                    must_change_password=False,
                )
            )
            db.commit()
    finally:
        db.close()


seed_super_admin()

app = FastAPI(title="ABAP Version Control System")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sandboxes.router)
app.include_router(sap.router)
app.include_router(ai.router)
app.include_router(git_ops.router)
app.include_router(activity.router)
app.include_router(users.router)
app.include_router(stats.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
