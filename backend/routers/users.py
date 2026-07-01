# =============================================================================
# ROUTERS/USERS.PY
# =============================================================================
#
# ENDPOINTS IN THIS FILE:
#   POST /api/users/login      → login, get JWT token
#   POST /api/users/register   → create new user (admin only)
#   GET  /api/users/me         → get your own profile
#   GET  /api/users/           → list all users (admin only)
#   PUT  /api/users/{id}       → update a user (admin only)
#
# WHAT IS A ROUTER?
#   A router is a group of related endpoints.
#   Instead of putting everything in main.py, we split by feature.
#
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm  # standard login form
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List

from database import get_db
import models, schemas
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin, ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter()

# =============================================================================
# LOGIN ENDPOINT
# POST /api/users/login
#
# How to call from React:
#   const response = await fetch('http://localhost:8000/api/users/login', {
#     method: 'POST',
#     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
#     body: new URLSearchParams({ username: 'admin', password: 'admin123' })
#   });
#   const data = await response.json();
#   localStorage.setItem('token', data.access_token);
# =============================================================================
@router.post("/login", response_model=schemas.TokenOut)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),  # reads username + password from form
    db: Session = Depends(get_db)
):
    """
    Login with username and password.
    Returns a JWT token to use in future requests.
    """
    # Find user by username
    user = db.query(models.User).filter(
        models.User.username == form_data.username
    ).first()

    # Check user exists and password is correct
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    # Create token with user info inside it
    token = create_access_token(
        data={
            "sub":     user.username,   # "sub" = subject (who is this token for)
            "user_id": user.id,
            "role":    user.role.value
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user":         user
    }

# =============================================================================
# REGISTER NEW USER
# POST /api/users/register
# Only admins can create new users
# =============================================================================
@router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(
    user_data: schemas.UserCreate,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(require_admin)  # only admins
):
    """Create a new user account. Admin only."""

    # Check username not already taken
    existing = db.query(models.User).filter(
        models.User.username == user_data.username
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create the user with hashed password
    new_user = models.User(
        username  = user_data.username,
        name      = user_data.name,
        email     = user_data.email,
        password  = hash_password(user_data.password),  # NEVER store plain text!
        role      = user_data.role,
    )
    db.add(new_user)     # add to session (staged)
    db.commit()          # save to database
    db.refresh(new_user) # reload from DB to get the auto-generated ID
    return new_user

# =============================================================================
# GET MY PROFILE
# GET /api/users/me
#
# How to call from React:
#   const response = await fetch('http://localhost:8000/api/users/me', {
#     headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
#   });
# =============================================================================
@router.get("/me", response_model=schemas.UserOut)
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    """Get the currently logged-in user's profile."""
    return current_user

# =============================================================================
# LIST ALL USERS (admin only)
# GET /api/users/
# =============================================================================
@router.get("/", response_model=List[schemas.UserOut])
def list_users(
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """Get all users. Admin only."""
    return db.query(models.User).all()

# =============================================================================
# UPDATE USER
# PUT /api/users/{user_id}
# =============================================================================
@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id:  int,
    updates:  dict,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """Update a user's details. Admin only."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update only provided fields
    if "name"      in updates: user.name      = updates["name"]
    if "email"     in updates: user.email     = updates["email"]
    if "role"      in updates: user.role      = updates["role"]
    if "is_active" in updates: user.is_active = updates["is_active"]
    if "password"  in updates: user.password  = hash_password(updates["password"])

    db.commit()
    db.refresh(user)
    return user

# =============================================================================
# SEED DEFAULT USERS
# GET /api/users/seed   (only call once to create initial users)
# Remove this endpoint in production after seeding!
# =============================================================================
@router.post("/seed", include_in_schema=False)  # hidden from /docs
def seed_users(db: Session = Depends(get_db)):
    """Create default demo users. Call once on fresh install."""

    default_users = [
        {"username": "admin",    "name": "Admin Supervisor", "password": "admin123",  "role": "admin"},
        {"username": "operator", "name": "Operator",         "password": "op123",     "role": "operator"},
        {"username": "qc",       "name": "QC Approver",      "password": "qc123",     "role": "approver"},
        {"username": "viewer",   "name": "Viewer",            "password": "view123",   "role": "viewer"},
    ]

    created = []
    for u in default_users:
        exists = db.query(models.User).filter(models.User.username == u["username"]).first()
        if not exists:
            new_user = models.User(
                username = u["username"],
                name     = u["name"],
                password = hash_password(u["password"]),
                role     = u["role"],
            )
            db.add(new_user)
            created.append(u["username"])

    db.commit()
    return {"created": created, "message": "Seed complete"}