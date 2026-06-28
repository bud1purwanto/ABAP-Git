from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_lightweight_migrations():
    """Apply additive schema tweaks to tables that already existed before a model change.

    Base.metadata.create_all only creates missing tables — it never alters existing
    ones, so newly added columns need to be patched in here.
    """
    statements = [
        "ALTER TABLE sandboxes ADD COLUMN IF NOT EXISTS environment VARCHAR(20) NOT NULL DEFAULT 'SANDBOX'",
        "ALTER TABLE sandboxes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'developer'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
        # --- Re-classify servers into the new SANDBOX/DEV/QA/PROD scheme ---
        # The old "Live Development" server (is_live=true) becomes the single DEV server.
        "UPDATE sandboxes SET environment = 'DEV' WHERE is_live = TRUE",
        # Old "regular" servers that were tagged DEV become SANDBOX (unlimited).
        "UPDATE sandboxes SET environment = 'SANDBOX' WHERE is_live = FALSE AND environment = 'DEV'",
        # Keep is_live mirrored to the DEV environment for any leftover consumers.
        "UPDATE sandboxes SET is_live = (environment = 'DEV')",
        "ALTER TABLE program_versions ADD COLUMN IF NOT EXISTS sandbox_name VARCHAR(100)",
        "ALTER TABLE sandboxes ADD COLUMN IF NOT EXISTS allow_multiple_logon BOOLEAN NOT NULL DEFAULT FALSE",
    ]
    with engine.connect() as conn:
        for statement in statements:
            conn.execute(text(statement))
        conn.commit()
