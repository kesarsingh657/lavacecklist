# =============================================================================
# MODELS.PY
# =============================================================================
#
# WHAT ARE MODELS?
#   Models define the STRUCTURE of your database tables.
#   Each Python class = one database table.
#   Each class attribute = one column in that table.
#
# Think of it like Excel:
#   Class User = a sheet called "users"
#   Column id, name, email = the column headers in that sheet
#   Each User object = one row of data
#
# =============================================================================

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum

# =============================================================================
# ENUMS - predefined allowed values (like dropdown options)
# Using enums prevents typos and invalid data in the database
# =============================================================================

class UserRole(str, enum.Enum):
    admin    = "admin"
    operator = "operator"
    approver = "approver"
    viewer   = "viewer"

class ChecklistStatus(str, enum.Enum):
    draft     = "draft"
    finalized = "finalized"
    submitted = "submitted"
    pending   = "pending"
    approved  = "approved"
    rejected  = "rejected"
    cancelled = "cancelled"
    rework    = "rework"

class Frequency(str, enum.Enum):
    one_time = "One Time"
    daily    = "Daily"
    weekly   = "Weekly"
    monthly  = "Monthly"

class Department(str, enum.Enum):
    production  = "Production"
    quality     = "Quality"
    warehouse   = "Warehouse"
    maintenance = "Maintenance"

class Shift(str, enum.Enum):
    morning   = "Morning"
    afternoon = "Afternoon"
    night     = "Night"

# =============================================================================
# USER TABLE
# Stores all user accounts.
# =============================================================================
class User(Base):
    __tablename__ = "users"                         # actual table name in database

    id         = Column(Integer, primary_key=True, index=True)  # auto-incrementing ID
    username   = Column(String(50),  unique=True, nullable=False, index=True)  # login username
    name       = Column(String(100), nullable=False)             # display name
    email      = Column(String(150), unique=True, nullable=True)
    password   = Column(String(200), nullable=False)             # stored as hashed value
    role       = Column(Enum(UserRole), default=UserRole.operator)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # RELATIONSHIPS: tell SQLAlchemy how tables connect to each other
    # "back_populates" creates a two-way link
    checklists = relationship("Checklist", back_populates="creator")
    comments   = relationship("Comment",   back_populates="author")

# =============================================================================
# CHECKLIST TABLE
# The main table - stores all checklists.
# The actual grid data (rows/columns/values) is stored as JSON text
# because it's flexible and varies per checklist type.
# =============================================================================
class Checklist(Base):
    __tablename__ = "checklists"

    id             = Column(String(20),  primary_key=True)      # e.g. "CHK-12345"
    name           = Column(String(200), nullable=False)
    department     = Column(Enum(Department), nullable=False)
    shift          = Column(Enum(Shift),      nullable=False)
    frequency      = Column(Enum(Frequency),  default=Frequency.one_time)
    fill_type      = Column(String(50),  default="Text Input")
    custom_options = Column(Text, default="[]")                 # JSON array stored as text
    status         = Column(Enum(ChecklistStatus), default=ChecklistStatus.draft)
    rows           = Column(Integer, default=5)
    cols           = Column(Integer, default=1)

    # Grid data stored as JSON text
    # For One-Time: {"headers": [...], "rows": [[...]]}
    # For Recurring: {"checkpointColumns": [...], "rows": [...], "dates": [...], "matrixData": {}, "remarksData": {}}
    table_data            = Column(Text, default="{}")
    horizontal_structure  = Column(Text, default="{}")

    # Approval workflow fields
    approver_name      = Column(String(100), nullable=True)
    approver_email     = Column(String(150), nullable=True)
    approval_required  = Column(String(5),   default="yes")
    submission_remarks = Column(Text,        nullable=True)
    rejection_reason   = Column(Text,        nullable=True)
    approval_remarks   = Column(Text,        nullable=True)

    # Who approved/rejected
    approved_by = Column(String(100), nullable=True)
    rejected_by = Column(String(100), nullable=True)

    # Rework tracking
    rework_count = Column(Integer, default=0)

    # Timestamps
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    finalized_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    approved_at  = Column(DateTime, nullable=True)
    rejected_at  = Column(DateTime, nullable=True)
    rework_at    = Column(DateTime, nullable=True)

    # Foreign key: links to the User who created this checklist
    # ForeignKey("users.id") means: this value must exist in users.id column
    created_by_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_name = Column(String(100), nullable=True)   # stored for display even if user deleted
    cloned_from     = Column(String(20),  nullable=True)   # ID of source if this was cloned

    # Relationships
    creator     = relationship("User",       back_populates="checklists")
    audit_logs  = relationship("AuditLog",   back_populates="checklist")
    comments    = relationship("Comment",    back_populates="checklist", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="checklist", cascade="all, delete-orphan")

# =============================================================================
# AUDIT LOG TABLE
# Records every action taken on every checklist.
# Append-only - records are never deleted (important for compliance).
# =============================================================================
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id             = Column(String(20), primary_key=True)       # e.g. "AUD-ABC123"
    checklist_id   = Column(String(20), ForeignKey("checklists.id"), nullable=True)
    checklist_name = Column(String(200), nullable=True)
    action         = Column(String(50),  nullable=False)        # e.g. "Finalized", "Approved"
    user_id        = Column(Integer,     nullable=True)
    user_name      = Column(String(100), nullable=False)
    details        = Column(Text,        nullable=True)
    timestamp      = Column(DateTime,    default=datetime.utcnow)

    checklist = relationship("Checklist", back_populates="audit_logs")

# =============================================================================
# CHECKLIST TEMPLATE TABLE
# Saved checklist structures (skeleton - no fill data).
# =============================================================================
class ChecklistTemplate(Base):
    __tablename__ = "templates"

    id             = Column(String(20),  primary_key=True)      # e.g. "TPL-ABCDE"
    name           = Column(String(200), nullable=False)
    description    = Column(Text,        nullable=True)
    department     = Column(Enum(Department), nullable=True)
    shift          = Column(Enum(Shift),      nullable=True)
    frequency      = Column(Enum(Frequency),  default=Frequency.one_time)
    fill_type      = Column(String(50),  default="Text Input")
    custom_options = Column(Text,        default="[]")
    rows           = Column(Integer,     default=5)
    cols           = Column(Integer,     default=1)
    source_id      = Column(String(20),  nullable=True)         # original checklist ID

    # Grid structure (no fill data)
    table_data           = Column(Text, default="{}")
    horizontal_structure = Column(Text, default="{}")

    usage_count = Column(Integer, default=0)
    created_by  = Column(String(100), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

# =============================================================================
# COMMENT TABLE
# Stores the discussion thread for each checklist.
# =============================================================================
class Comment(Base):
    __tablename__ = "comments"

    id           = Column(String(20),  primary_key=True)       # e.g. "CMT-ABC123"
    checklist_id = Column(String(20),  ForeignKey("checklists.id"), nullable=False)
    author_id    = Column(Integer,     ForeignKey("users.id"),  nullable=True)
    author_name  = Column(String(100), nullable=False)
    author_role  = Column(String(20),  nullable=True)
    text         = Column(Text,        nullable=False)
    timestamp    = Column(DateTime,    default=datetime.utcnow)

    checklist = relationship("Checklist", back_populates="comments")
    author    = relationship("User",      back_populates="comments")

# =============================================================================
# ATTACHMENT TABLE
# Stores file attachments (images) as base64 text.
# For production, consider storing files on disk or S3 and saving only the path.
# =============================================================================
class Attachment(Base):
    __tablename__ = "attachments"

    id           = Column(String(20),  primary_key=True)       # e.g. "ATT-ABC123"
    checklist_id = Column(String(20),  ForeignKey("checklists.id"), nullable=False)
    name         = Column(String(200), nullable=False)          # original filename
    data_url     = Column(Text,        nullable=False)          # base64 image data
    uploaded_by  = Column(String(100), nullable=True)
    uploaded_at  = Column(DateTime,    default=datetime.utcnow)

    checklist = relationship("Checklist", back_populates="attachments")