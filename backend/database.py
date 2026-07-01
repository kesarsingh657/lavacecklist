# =============================================================================
# DATABASE.PY
# =============================================================================
#
# WHAT IS THIS?
#   This file sets up the database connection.
#   We use SQLite - a simple file-based database (no separate DB server needed).
#   The entire database is stored in ONE file: checklist.db
#   In production you can switch to PostgreSQL by changing DATABASE_URL.
#
# HOW SQLAlchemy WORKS:
#   SQLAlchemy is a Python library that lets you work with databases using
#   Python code instead of writing raw SQL. It's like a translator between
#   Python objects and database rows.
#
# =============================================================================

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# =============================================================================
# DATABASE URL
# SQLite stores everything in a single file called "checklist.db"
# When you run the server, this file is created automatically in the same folder.
#
# To switch to PostgreSQL later, change this to:
# DATABASE_URL = "postgresql://username:password@localhost/checklist_db"
# =============================================================================
DATABASE_URL = "sqlite:///./checklist.db"# CREATE ENGINE
# The engine is the connection to the database.
# check_same_thread=False is needed for SQLite with FastAPI (allows multiple requests)
# =============================================================================
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
# =============================================================================
# SESSION FACTORY
# A "session" is like a temporary workspace where you make database changes.
# Think of it like a shopping cart - you add/remove items, then "commit" to save.
# autocommit=False means you have to manually save (commit) changes - safer
# autoflush=False means don't auto-send queries before commit
# =============================================================================
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# =============================================================================
# BASE CLASS
# All our database models (tables) will inherit from this Base class.
# This is how SQLAlchemy knows which classes represent database tables.
# =============================================================================
Base = declarative_base()

# =============================================================================
# CREATE TABLES FUNCTION
# Called once on server startup to create all tables.
# Safe to call multiple times - SQLAlchemy only creates tables that don't exist.
# =============================================================================
def create_tables():
    # Import models here to register them with Base before creating tables
    import models  # noqa: F401 — this registers all model classes with Base
    Base.metadata.create_all(bind=engine)
    print("📦 Tables created: users, checklists, audit_logs, templates, comments, attachments")

# =============================================================================
# GET DB - DEPENDENCY INJECTION
# FastAPI endpoints use this function to get a database session.
# "yield" means: give the session to the endpoint, then close it when done.
# This ensures the database connection is always properly closed.
#
# Usage in endpoints:
#   def my_endpoint(db: Session = Depends(get_db)):
#       users = db.query(User).all()
# =============================================================================
def get_db():
    db = SessionLocal()
    try:
        yield db       # hand the session to whoever calls this
    finally:
        db.close()     # always close, even if there's an error