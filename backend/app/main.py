from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, run_lightweight_migrations
from app.routers import sandboxes, sap, ai, git_ops, auth, activity, users, stats

Base.metadata.create_all(bind=engine)
run_lightweight_migrations()

app = FastAPI(title="ABAP Git and Versioning Middleware")

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
