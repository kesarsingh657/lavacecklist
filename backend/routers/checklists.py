# =============================================================================
# ROUTERS/CHECKLISTS.PY
# =============================================================================
#
# ENDPOINTS:
#   GET    /api/checklists/           → list all checklists (with filters)
#   POST   /api/checklists/           → create new checklist
#   GET    /api/checklists/{id}       → get one checklist
#   PATCH  /api/checklists/{id}       → update checklist data (auto-save)
#   DELETE /api/checklists/{id}       → delete (admin only)
#
#   POST   /api/checklists/{id}/finalize         → finalize
#   POST   /api/checklists/{id}/submit           → submit for approval
#   POST   /api/checklists/{id}/approve          → approve
#   POST   /api/checklists/{id}/reject           → reject
#   POST   /api/checklists/{id}/rework           → send back for rework
#   POST   /api/checklists/{id}/cancel           → cancel submission
#
#   GET    /api/checklists/{id}/comments         → get comments
#   POST   /api/checklists/{id}/comments         → add comment
#   GET    /api/checklists/{id}/attachments      → get attachments
#   POST   /api/checklists/{id}/attachments      → add attachment
#   DELETE /api/checklists/{id}/attachments/{att_id} → remove attachment
#
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from database import get_db
import models, schemas
from auth import get_current_user, require_admin, require_operator_or_admin

router = APIRouter()

# =============================================================================
# HELPER: JSON CONVERSION
# We store JSON as text in SQLite. These helpers convert between dict and text.
# =============================================================================

def to_json(data: dict) -> str:
    """Convert Python dict to JSON string for storage"""
    return json.dumps(data) if data else "{}"

def from_json(text: str) -> dict:
    """Convert JSON string from DB back to Python dict"""
    try:
        return json.loads(text) if text else {}
    except:
        return {}

def checklist_to_out(cl: models.Checklist) -> dict:
    """Convert DB model to response dict (parse JSON fields)"""
    d = {c.name: getattr(cl, c.name) for c in cl.__table__.columns}
    d["table_data"]           = from_json(cl.table_data)
    d["horizontal_structure"] = from_json(cl.horizontal_structure)
    d["custom_options"]       = from_json(cl.custom_options) if cl.custom_options else []
    return d

# =============================================================================
# LIST CHECKLISTS
# GET /api/checklists/
# Supports filters: ?department=Production&status=draft&frequency=Daily
# =============================================================================
@router.get("/", response_model=List[schemas.ChecklistOut])
def list_checklists(
    department: Optional[str] = Query(None),
    status:     Optional[str] = Query(None),
    frequency:  Optional[str] = Query(None),
    shift:      Optional[str] = Query(None),
    search:     Optional[str] = Query(None),
    skip:       int           = Query(0,    ge=0),    # pagination: how many to skip
    limit:      int           = Query(100,  le=500),  # max 500 per request
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all checklists. Operators see only their own."""

    query = db.query(models.Checklist)

    # Operators can only see their own checklists
    if current_user.role == models.UserRole.operator:
        query = query.filter(models.Checklist.created_by_id == current_user.id)

    # Apply filters
    if department: query = query.filter(models.Checklist.department == department)
    if status:     query = query.filter(models.Checklist.status     == status)
    if frequency:  query = query.filter(models.Checklist.frequency  == frequency)
    if shift:      query = query.filter(models.Checklist.shift      == shift)
    if search:     query = query.filter(models.Checklist.name.ilike(f"%{search}%"))

    # Sort newest first, paginate
    checklists = query.order_by(models.Checklist.created_at.desc()).offset(skip).limit(limit).all()

    # Convert JSON fields before returning
    return [checklist_to_out(cl) for cl in checklists]

# =============================================================================
# GET SINGLE CHECKLIST
# GET /api/checklists/{checklist_id}
# =============================================================================
@router.get("/{checklist_id}", response_model=schemas.ChecklistOut)
def get_checklist(
    checklist_id: str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a single checklist by ID."""
    cl = db.query(models.Checklist).filter(models.Checklist.id == checklist_id).first()
    if not cl:
        raise HTTPException(status_code=404, detail=f"Checklist {checklist_id} not found")
    return checklist_to_out(cl)

# =============================================================================
# CREATE CHECKLIST
# POST /api/checklists/
# =============================================================================
@router.post("/", response_model=schemas.ChecklistOut, status_code=201)
def create_checklist(
    data:         schemas.ChecklistCreate,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_operator_or_admin)
):
    """Create a new checklist."""

    # Check ID not already taken
    existing = db.query(models.Checklist).filter(models.Checklist.id == data.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Checklist ID {data.id} already exists")

    cl = models.Checklist(
        id                   = data.id,
        name                 = data.name,
        department           = data.department,
        shift                = data.shift,
        frequency            = data.frequency,
        fill_type            = data.fill_type,
        custom_options       = json.dumps(data.custom_options),
        rows                 = data.rows,
        cols                 = data.cols,
        table_data           = to_json(data.table_data),
        horizontal_structure = to_json(data.horizontal_structure),
        created_by_id        = current_user.id,
        created_by_name      = current_user.name,
        cloned_from          = data.cloned_from,
        status               = models.ChecklistStatus.draft,
    )
    db.add(cl)
    db.commit()
    db.refresh(cl)

    _add_audit(db, cl.id, cl.name, "Created", current_user, f'"{cl.name}" created')
    return checklist_to_out(cl)

# =============================================================================
# UPDATE CHECKLIST (auto-save)
# PATCH /api/checklists/{id}
# Only sends changed fields
# =============================================================================
@router.patch("/{checklist_id}", response_model=schemas.ChecklistOut)
def update_checklist(
    checklist_id: str,
    updates:      schemas.ChecklistUpdate,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update checklist data. Used for auto-save."""
    cl = _get_or_404(db, checklist_id)

    # Only allow editing if status permits
    if cl.status in ["finalized","submitted","pending","approved","cancelled"]:
        if current_user.role not in ["admin"]:
            raise HTTPException(status_code=400, detail=f"Cannot edit checklist with status: {cl.status}")

    # Update only fields that were sent (not None)
    update_data = updates.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if field in ["table_data", "horizontal_structure"]:
            setattr(cl, field, to_json(value))  # convert dict to JSON string
        else:
            setattr(cl, field, value)

    cl.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cl)
    return checklist_to_out(cl)

# =============================================================================
# DELETE CHECKLIST (admin only)
# DELETE /api/checklists/{id}
# =============================================================================
@router.delete("/{checklist_id}", response_model=schemas.MessageResponse)
def delete_checklist(
    checklist_id: str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """Delete a checklist. Admin only."""
    cl = _get_or_404(db, checklist_id)
    name = cl.name
    _add_audit(db, checklist_id, name, "Deleted", current_user, f'"{name}" deleted')
    db.delete(cl)
    db.commit()
    return {"message": f"Checklist {checklist_id} deleted", "success": True}

# =============================================================================
# WORKFLOW ACTIONS
# These change the checklist status through the approval pipeline:
# draft → finalized → submitted → approved/rejected → rework → draft
# =============================================================================

@router.post("/{checklist_id}/finalize", response_model=schemas.ChecklistOut)
def finalize(
    checklist_id: str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_operator_or_admin)
):
    """Mark checklist as finalized (ready for submission)."""
    cl = _get_or_404(db, checklist_id)
    if cl.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft checklists can be finalized")

    cl.status       = models.ChecklistStatus.finalized
    cl.finalized_at = datetime.utcnow()
    cl.updated_at   = datetime.utcnow()
    db.commit()
    _add_audit(db, cl.id, cl.name, "Finalized", current_user, f'"{cl.name}" finalized')
    db.refresh(cl)
    return checklist_to_out(cl)

@router.post("/{checklist_id}/submit", response_model=schemas.ChecklistOut)
def submit(
    checklist_id: str,
    body: dict,            # expects: {"approverName": "...", "approverEmail": "...", "remarks": "..."}
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_operator_or_admin)
):
    """Submit checklist for approval."""
    cl = _get_or_404(db, checklist_id)
    if cl.status != "finalized":
        raise HTTPException(status_code=400, detail="Only finalized checklists can be submitted")

    cl.status             = models.ChecklistStatus.submitted
    cl.submitted_at       = datetime.utcnow()
    cl.updated_at         = datetime.utcnow()
    cl.approver_name      = body.get("approverName", "")
    cl.approver_email     = body.get("approverEmail", "")
    cl.submission_remarks = body.get("remarks", "")
    db.commit()
    _add_audit(db, cl.id, cl.name, "Submitted", current_user,
               f'"{cl.name}" submitted to {cl.approver_name}')
    db.refresh(cl)
    return checklist_to_out(cl)

@router.post("/{checklist_id}/approve", response_model=schemas.ChecklistOut)
def approve(
    checklist_id: str,
    body: dict,            # expects: {"remarks": "..."}
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Approve a submitted checklist. Approver/Admin only."""
    if current_user.role not in [models.UserRole.approver, models.UserRole.admin]:
        raise HTTPException(status_code=403, detail="Only approvers can approve checklists")

    cl = _get_or_404(db, checklist_id)
    if cl.status not in ["submitted", "pending"]:
        raise HTTPException(status_code=400, detail="Checklist is not pending approval")

    cl.status          = models.ChecklistStatus.approved
    cl.approved_at     = datetime.utcnow()
    cl.updated_at      = datetime.utcnow()
    cl.approved_by     = current_user.name  # DIGITAL SIGNATURE: locked to logged-in user
    cl.approval_remarks = body.get("remarks", "")
    db.commit()
    _add_audit(db, cl.id, cl.name, "Approved", current_user,
               f'Approved by {current_user.name}. Remarks: {body.get("remarks","")}')
    db.refresh(cl)
    return checklist_to_out(cl)

@router.post("/{checklist_id}/reject", response_model=schemas.ChecklistOut)
def reject(
    checklist_id: str,
    body: dict,            # expects: {"reason": "...", "remarks": "..."}
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Reject a submitted checklist."""
    if current_user.role not in [models.UserRole.approver, models.UserRole.admin]:
        raise HTTPException(status_code=403, detail="Only approvers can reject checklists")

    cl = _get_or_404(db, checklist_id)
    if cl.status not in ["submitted", "pending"]:
        raise HTTPException(status_code=400, detail="Checklist is not pending approval")

    cl.status           = models.ChecklistStatus.rejected
    cl.rejected_at      = datetime.utcnow()
    cl.updated_at       = datetime.utcnow()
    cl.rejected_by      = current_user.name
    cl.rejection_reason = body.get("reason", "")
    cl.approval_remarks = body.get("remarks", "")
    db.commit()
    _add_audit(db, cl.id, cl.name, "Rejected", current_user,
               f'Rejected by {current_user.name}. Reason: {body.get("reason","")}')
    db.refresh(cl)
    return checklist_to_out(cl)

@router.post("/{checklist_id}/rework", response_model=schemas.ChecklistOut)
def send_for_rework(
    checklist_id: str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_operator_or_admin)
):
    """Reset rejected checklist to draft so operator can fix and resubmit."""
    cl = _get_or_404(db, checklist_id)
    if cl.status != "rejected":
        raise HTTPException(status_code=400, detail="Only rejected checklists can be sent for rework")

    cl.status       = models.ChecklistStatus.draft
    cl.rework_at    = datetime.utcnow()
    cl.updated_at   = datetime.utcnow()
    cl.rework_count = (cl.rework_count or 0) + 1
    db.commit()
    _add_audit(db, cl.id, cl.name, "Rework Started", current_user,
               f'Sent for rework (attempt #{cl.rework_count})')
    db.refresh(cl)
    return checklist_to_out(cl)

@router.post("/{checklist_id}/cancel", response_model=schemas.ChecklistOut)
def cancel_submission(
    checklist_id: str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_operator_or_admin)
):
    """Cancel a submission (back to draft)."""
    cl = _get_or_404(db, checklist_id)
    if cl.status not in ["submitted", "pending"]:
        raise HTTPException(status_code=400, detail="No active submission to cancel")

    cl.status       = models.ChecklistStatus.draft
    cl.submitted_at = None
    cl.updated_at   = datetime.utcnow()
    db.commit()
    _add_audit(db, cl.id, cl.name, "Submission Cancelled", current_user,
               f'"{cl.name}" submission cancelled')
    db.refresh(cl)
    return checklist_to_out(cl)

# =============================================================================
# COMMENTS
# =============================================================================

@router.get("/{checklist_id}/comments", response_model=List[schemas.CommentOut])
def get_comments(
    checklist_id: str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all comments for a checklist."""
    _get_or_404(db, checklist_id)
    return db.query(models.Comment).filter(
        models.Comment.checklist_id == checklist_id
    ).order_by(models.Comment.timestamp.asc()).all()

@router.post("/{checklist_id}/comments", response_model=schemas.CommentOut, status_code=201)
def add_comment(
    checklist_id: str,
    data:         schemas.CommentCreate,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add a comment to a checklist."""
    _get_or_404(db, checklist_id)
    comment = models.Comment(
        id           = data.id,
        checklist_id = checklist_id,
        author_id    = current_user.id,
        author_name  = current_user.name,
        author_role  = current_user.role.value,
        text         = data.text,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment

# =============================================================================
# ATTACHMENTS
# =============================================================================

@router.get("/{checklist_id}/attachments", response_model=List[schemas.AttachmentOut])
def get_attachments(
    checklist_id: str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all attachments for a checklist."""
    _get_or_404(db, checklist_id)
    return db.query(models.Attachment).filter(
        models.Attachment.checklist_id == checklist_id
    ).all()

@router.post("/{checklist_id}/attachments", response_model=schemas.AttachmentOut, status_code=201)
def add_attachment(
    checklist_id: str,
    data:         schemas.AttachmentCreate,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add an attachment to a checklist."""
    _get_or_404(db, checklist_id)
    att = models.Attachment(
        id           = data.id,
        checklist_id = checklist_id,
        name         = data.name,
        data_url     = data.data_url,
        uploaded_by  = current_user.name,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att

@router.delete("/{checklist_id}/attachments/{att_id}", response_model=schemas.MessageResponse)
def remove_attachment(
    checklist_id: str,
    att_id:       str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Remove an attachment."""
    att = db.query(models.Attachment).filter(models.Attachment.id == att_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    db.delete(att)
    db.commit()
    return {"message": "Attachment removed", "success": True}

# =============================================================================
# PRIVATE HELPERS
# =============================================================================

def _get_or_404(db: Session, checklist_id: str) -> models.Checklist:
    """Get checklist or raise 404 if not found."""
    cl = db.query(models.Checklist).filter(models.Checklist.id == checklist_id).first()
    if not cl:
        raise HTTPException(status_code=404, detail=f"Checklist {checklist_id} not found")
    return cl

def _add_audit(db: Session, checklist_id: str, checklist_name: str,
               action: str, user: models.User, details: str):
    """Add an audit log entry. Called after every action."""
    import random, string
    audit_id = "AUD-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=7))
    log = models.AuditLog(
        id             = audit_id,
        checklist_id   = checklist_id,
        checklist_name = checklist_name,
        action         = action,
        user_id        = user.id,
        user_name      = user.name,
        details        = details,
    )
    db.add(log)
    db.commit()