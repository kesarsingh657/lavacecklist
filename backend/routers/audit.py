from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[schemas.AuditLogOut])
def get_audit_log(
    checklist_id: Optional[str] = Query(None),
    action:       Optional[str] = Query(None),
    skip:  int = Query(0,   ge=0),
    limit: int = Query(200, le=1000),
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.AuditLog)
    if current_user.role == models.UserRole.viewer:
        my_ids = [cl.id for cl in db.query(models.Checklist).filter(
            models.Checklist.created_by_id == current_user.id).all()]
        query = query.filter(models.AuditLog.checklist_id.in_(my_ids))
    if checklist_id: query = query.filter(models.AuditLog.checklist_id == checklist_id)
    if action:       query = query.filter(models.AuditLog.action == action)
    return query.order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.AuditLogOut, status_code=201)
def create_audit_entry(
    data: schemas.AuditLogCreate,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Save an audit log entry from the frontend."""
    existing = db.query(models.AuditLog).filter(models.AuditLog.id == data.id).first()
    if existing:
        return existing
    log = models.AuditLog(
        id             = data.id,
        checklist_id   = data.checklist_id,
        checklist_name = data.checklist_name,
        action         = data.action,
        user_id        = data.user_id or current_user.id,
        user_name      = data.user_name or current_user.name,
        details        = data.details,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log