# =============================================================================
# AUTH.PY
# =============================================================================
#
# WHAT IS THIS?
#   This handles security - proving who you are and what you're allowed to do.
#
# HOW LOGIN WORKS (step by step):
#   1. User sends username + password to POST /api/users/login
#   2. We look up the user in the database
#   3. We verify the password (we compare against a hashed/encrypted version)
#   4. If correct, we create a JWT token (a special signed string)
#   5. We send the token back to the frontend
#   6. Frontend stores the token and sends it with every future request
#   7. Backend verifies the token on every protected endpoint
#
# WHAT IS JWT?
#   JSON Web Token - a compact, signed string that proves who you are.
#   Example: "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxfQ.abc123"
#   It contains: who you are + when it expires + a signature
#   The backend can verify it without checking the database every time.
#
# WHAT IS HASHING?
#   We NEVER store passwords as plain text.
#   We store a "hash" - a one-way transformation.
#   Example: "admin123" → "$2b$12$xyz..." (impossible to reverse)
#   When user logs in, we hash their input and compare to stored hash.
#
# =============================================================================

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt                      # JWT library
from passlib.context import CryptContext            # password hashing
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models

# =============================================================================
# CONFIGURATION
# SECRET_KEY: a random string used to sign JWT tokens
# NEVER put this in code for production - use environment variables!
# ALGORITHM: HS256 is standard and secure
# =============================================================================
SECRET_KEY = "your-super-secret-key-change-this-in-production-use-random-string"
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours - user stays logged in this long

# =============================================================================
# PASSWORD HASHING SETUP
# bcrypt is the gold standard for password hashing
# It's intentionally slow (prevents brute force attacks)
# =============================================================================
# bcrypt can have version detection issues with newer Python.
# Using sha256_crypt as primary with bcrypt as fallback for compatibility.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# =============================================================================
# OAUTH2 SCHEME
# This tells FastAPI where to find the token in the request.
# The token should be in the Authorization header: "Bearer eyJ..."
# tokenUrl is the endpoint where users get their token (login endpoint)
# =============================================================================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")

# =============================================================================
# PASSWORD FUNCTIONS
# =============================================================================

def hash_password(plain_password: str) -> str:
    """
    Converts plain text password to a secure hash.
    Example: "admin123" → "$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p"
    """
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Checks if a plain password matches the stored hash.
    Returns True if correct, False if wrong.
    """
    return pwd_context.verify(plain_password, hashed_password)

# =============================================================================
# JWT TOKEN FUNCTIONS
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a JWT token containing user data.
    
    data: dict with user info, e.g. {"sub": "admin", "user_id": 1, "role": "admin"}
    returns: signed JWT string
    """
    to_encode = data.copy()

    # Set expiry time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})  # add expiry to the token payload

    # Create and sign the token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    """
    Verifies and decodes a JWT token.
    Returns the payload dict, or raises HTTPException if invalid.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

# =============================================================================
# DEPENDENCY: GET CURRENT USER
# This is used in endpoints to require authentication.
# Usage:
#   @router.get("/protected")
#   def protected_endpoint(current_user: models.User = Depends(get_current_user)):
#       return {"message": f"Hello {current_user.name}"}
# =============================================================================

def get_current_user(
    token: str         = Depends(oauth2_scheme),
    db:    Session     = Depends(get_db)
) -> models.User:
    """
    Extracts and verifies the user from the JWT token.
    Called automatically by FastAPI when an endpoint uses Depends(get_current_user).
    """
    payload  = decode_token(token)
    username = payload.get("sub")  # "sub" is standard JWT field for subject (username)

    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Look up the user in the database
    user = db.query(models.User).filter(models.User.username == username).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    return user

# =============================================================================
# ROLE-BASED ACCESS HELPERS
# Use these to restrict endpoints to certain roles.
#
# Usage:
#   @router.delete("/{id}")
#   def delete_checklist(current_user = Depends(require_admin)):
#       ...
# =============================================================================

def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Only admin users can access this endpoint"""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def require_operator_or_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Only operators and admins can access this endpoint"""
    if current_user.role not in [models.UserRole.admin, models.UserRole.operator]:
        raise HTTPException(status_code=403, detail="Operator or Admin access required")
    return current_user

def require_approver(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Only approvers can access this endpoint"""
    if current_user.role not in [models.UserRole.approver, models.UserRole.admin]:
        raise HTTPException(status_code=403, detail="Approver access required")
    return current_user