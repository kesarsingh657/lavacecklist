# =============================================================================
# SCHEMAS.PY
# =============================================================================
#
# WHAT ARE SCHEMAS?
#   Schemas define what data LOOKS LIKE going in and out of your API.
#   They are different from Models (which define database structure).
#
#   Model  = what's stored in the DATABASE
#   Schema = what's sent over the NETWORK (JSON)
#
#   Pydantic (the library we use) automatically:
#   ✅ Validates incoming data (wrong type? missing field? → error)
#   ✅ Converts Python objects to JSON for responses
#   ✅ Shows example data in /docs
#
# NAMING CONVENTION:
#   XxxBase    = shared fields
#   XxxCreate  = fields needed to CREATE a record (POST request body)
#   XxxUpdate  = fields that can be UPDATED (PUT request body)
#   XxxOut     = fields returned in RESPONSE (what the client receives)
#
# =============================================================================

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Any, Dict, List
from datetime import datetime
from models import UserRole, ChecklistStatus, Frequency, Department, Shift

# =============================================================================
# USER SCHEMAS
# =============================================================================

class UserCreate(BaseModel):
    """Data needed to create a new user account"""
    username: str
    name:     str
    email:    Optional[str] = None
    password: str           # plain text here - we hash it in auth.py
    role:     UserRole = UserRole.operator

class UserLogin(BaseModel):
    """Data for logging in"""
    username: str
    password: str

class UserOut(BaseModel):
    """What we send back when returning user info - NEVER include password!"""
    id:         int
    username:   str
    name:       str
    email:      Optional[str]
    role:       UserRole
    is_active:  bool
    created_at: datetime

    class Config:
        from_attributes = True  # allows converting SQLAlchemy objects to this schema

class TokenOut(BaseModel):
    """Returned after successful login"""
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut

# =============================================================================
# CHECKLIST SCHEMAS
# =============================================================================

class ChecklistCreate(BaseModel):
    """Fields needed to create a new checklist"""
    id:             str
    name:           str
    department:     Department
    shift:          Shift
    frequency:      Frequency = Frequency.one_time
    fill_type:      str = "Text Input"
    custom_options: List[str] = []
    rows:           int = 5
    cols:           int = 1
    table_data:           Optional[Dict[str, Any]] = {}
    horizontal_structure: Optional[Dict[str, Any]] = {}
    created_by_name: Optional[str] = None
    cloned_from:     Optional[str] = None

class ChecklistUpdate(BaseModel):
    """
    All fields optional - only send what you want to change.
    PATCH request: send only the fields you want to update.
    """
    name:           Optional[str]         = None
    department:     Optional[Department]  = None
    shift:          Optional[Shift]       = None
    status:         Optional[ChecklistStatus] = None
    table_data:           Optional[Dict[str, Any]] = None
    horizontal_structure: Optional[Dict[str, Any]] = None
    approver_name:      Optional[str] = None
    approver_email:     Optional[str] = None
    approval_required:  Optional[str] = None
    submission_remarks: Optional[str] = None
    rejection_reason:   Optional[str] = None
    approval_remarks:   Optional[str] = None
    approved_by:        Optional[str] = None
    rejected_by:        Optional[str] = None
    rework_count:       Optional[int] = None
    finalized_at:       Optional[datetime] = None
    submitted_at:       Optional[datetime] = None
    approved_at:        Optional[datetime] = None
    rejected_at:        Optional[datetime] = None
    rework_at:          Optional[datetime] = None

class ChecklistOut(BaseModel):
    """Full checklist object returned by API"""
    id:             str
    name:           str
    department:     Department
    shift:          Shift
    frequency:      Frequency
    fill_type:      str
    custom_options: List[str] = []
    status:         ChecklistStatus
    rows:           int
    cols:           int
    table_data:           Dict[str, Any] = {}
    horizontal_structure: Dict[str, Any] = {}
    approver_name:      Optional[str]
    approver_email:     Optional[str]
    approval_required:  Optional[str]
    submission_remarks: Optional[str]
    rejection_reason:   Optional[str]
    approval_remarks:   Optional[str]
    approved_by:        Optional[str]
    rejected_by:        Optional[str]
    rework_count:       int = 0
    created_by_id:      Optional[int]
    created_by_name:    Optional[str]
    cloned_from:        Optional[str]
    created_at:   datetime
    updated_at:   datetime
    finalized_at: Optional[datetime]
    submitted_at: Optional[datetime]
    approved_at:  Optional[datetime]
    rejected_at:  Optional[datetime]
    rework_at:    Optional[datetime]

    class Config:
        from_attributes = True

# =============================================================================
# AUDIT LOG SCHEMAS
# =============================================================================

class AuditLogCreate(BaseModel):
    """Fields to create an audit log entry"""
    id:             str
    checklist_id:   Optional[str]
    checklist_name: Optional[str]
    action:         str
    user_id:        Optional[int]
    user_name:      str
    details:        Optional[str]

class AuditLogOut(BaseModel):
    id:             str
    checklist_id:   Optional[str]
    checklist_name: Optional[str]
    action:         str
    user_id:        Optional[int]
    user_name:      str
    details:        Optional[str]
    timestamp:      datetime

    class Config:
        from_attributes = True

# =============================================================================
# TEMPLATE SCHEMAS
# =============================================================================

class TemplateCreate(BaseModel):
    id:          str
    name:        str
    description: Optional[str] = ""
    department:  Optional[Department] = None
    shift:       Optional[Shift]      = None
    frequency:   Frequency = Frequency.one_time
    fill_type:   str = "Text Input"
    custom_options: List[str] = []
    rows:        int = 5
    cols:        int = 1
    source_id:   Optional[str] = None
    table_data:           Optional[Dict[str, Any]] = {}
    horizontal_structure: Optional[Dict[str, Any]] = {}
    created_by:  Optional[str] = None

class TemplateOut(BaseModel):
    id:          str
    name:        str
    description: Optional[str]
    department:  Optional[Department]
    shift:       Optional[Shift]
    frequency:   Frequency
    fill_type:   str
    custom_options: List[str] = []
    rows:        int
    cols:        int
    source_id:   Optional[str]
    table_data:           Dict[str, Any] = {}
    horizontal_structure: Dict[str, Any] = {}
    usage_count: int
    created_by:  Optional[str]
    created_at:  datetime

    class Config:
        from_attributes = True

# =============================================================================
# COMMENT SCHEMAS
# =============================================================================

class CommentCreate(BaseModel):
    id:          str
    text:        str
    author_name: str
    author_role: Optional[str] = None
    author_id:   Optional[int] = None

class CommentOut(BaseModel):
    id:          str
    checklist_id: str
    author_id:   Optional[int]
    author_name: str
    author_role: Optional[str]
    text:        str
    timestamp:   datetime

    class Config:
        from_attributes = True

# =============================================================================
# ATTACHMENT SCHEMAS
# =============================================================================

class AttachmentCreate(BaseModel):
    id:          str
    name:        str
    data_url:    str   # base64 encoded image
    uploaded_by: Optional[str] = None

class AttachmentOut(BaseModel):
    id:          str
    checklist_id: str
    name:        str
    data_url:    str
    uploaded_by: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True

# =============================================================================
# GENERIC RESPONSE
# =============================================================================

class MessageResponse(BaseModel):
    """Simple message response for delete operations etc."""
    message: str
    success: bool = True