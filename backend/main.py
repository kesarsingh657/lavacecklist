# =============================================================================
# SMART CHECKLIST - PYTHON BACKEND
# =============================================================================
#
# WHAT THIS FILE DOES:
#   This is the main file that starts your backend server.
#   It uses FastAPI - a modern Python web framework that is fast and easy to use.
#
# HOW TO RUN (step by step):
#   1. Open terminal / command prompt
#   2. Install Python 3.10+ from https://python.org if not installed
#   3. Run:  pip install -r requirements.txt
#   4. Run:  python main.py
#   5. Open browser: http://localhost:8000/docs   ← auto-generated API docs!
#
# FILE STRUCTURE:
#   backend/
#   ├── main.py           ← YOU ARE HERE (starts the server)
#   ├── database.py       ← connects to SQLite database
#   ├── models.py         ← defines database tables
#   ├── schemas.py        ← defines what data looks like going in/out
#   ├── auth.py           ← handles login, passwords, JWT tokens
#   ├── requirements.txt  ← list of libraries to install
#   └── routers/
#       ├── users.py      ← user login/register endpoints
#       ├── checklists.py ← checklist CRUD endpoints
#       ├── audit.py      ← audit log endpoints
#       └── templates.py  ← templates library endpoints
#
# =============================================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import database FIRST before routers
from database import create_tables, Base, engine

# Create tables immediately on import (not in startup event)
# This runs when main.py is loaded
create_tables()

# Now import routers (after tables exist)
from routers import users, checklists, audit, templates

# =============================================================================
# CREATE THE APP
# =============================================================================
app = FastAPI(
    title="Smart Checklist API",
    description="Manufacturing Execution System - Checklist Backend",
    version="1.0.0",
    # This adds a nice /docs page where you can test all endpoints in browser
)

# =============================================================================
# CORS SETUP - VERY IMPORTANT
# This allows your React frontend (localhost:5173) to send requests here.
# Without this, the browser will block all requests with a CORS error.
# =============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server (React)
        "http://localhost:3000",   # Create React App (if you use that)
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,        # allows cookies/auth headers
    allow_methods=["*"],           # allow GET, POST, PUT, DELETE etc
    allow_headers=["*"],           # allow all headers including Authorization
)

# =============================================================================
# REGISTER ROUTE FILES
# Each router handles a group of related endpoints.
# "prefix" is the URL prefix, "tags" groups them in /docs
# =============================================================================
app.include_router(users.router,       prefix="/api/users",       tags=["Users"])
app.include_router(checklists.router,  prefix="/api/checklists",  tags=["Checklists"])
app.include_router(audit.router,       prefix="/api/audit",       tags=["Audit Log"])
app.include_router(templates.router,   prefix="/api/templates",   tags=["Templates"])

# =============================================================================
# STARTUP EVENT - runs once when server starts
# Creates all database tables if they don't exist yet
# =============================================================================
@app.on_event("startup")
async def startup():
    print("🚀 Server starting...")
    print("✅ Database tables ready")
    print("📖 API docs at: http://localhost:8000/docs")

# =============================================================================
# ROOT ENDPOINT - health check
# Visit http://localhost:8000/ to confirm server is running
# =============================================================================
@app.get("/")
def root():
    return {
        "status": "running",
        "app": "Smart Checklist API",
        "version": "1.0.0",
        "docs": "http://localhost:8000/docs"
    }

# =============================================================================
# START THE SERVER
# This block only runs when you do: python main.py
# host="0.0.0.0" means anyone on the network can access it
# reload=True means server auto-restarts when you save a file (dev mode)
# =============================================================================
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # set to False in production
    )