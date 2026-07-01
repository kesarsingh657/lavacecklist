# =============================================================================
# ROUTERS/TEMPLATES.PY
# =============================================================================
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from database import get_db
import models, schemas
from auth import get_current_user, require_admin, require_operator_or_admin

router = APIRouter()

def to_json(data): return json.dumps(data) if data else "{}"
def from_json(text):
    try: return json.loads(text) if text else {}
    except: return {}

@router.get("/", response_model=List[schemas.TemplateOut])
def list_templates(
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all templates."""
    templates = db.query(models.ChecklistTemplate).order_by(
        models.ChecklistTemplate.created_at.desc()
    ).all()
    result = []
    for t in templates:
        d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        d["table_data"]           = from_json(t.table_data)
        d["horizontal_structure"] = from_json(t.horizontal_structure)
        d["custom_options"]       = from_json(t.custom_options) if t.custom_options else []
        result.append(d)
    return result

@router.post("/", response_model=schemas.TemplateOut, status_code=201)
def create_template(
    data:         schemas.TemplateCreate,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_operator_or_admin)
):
    """Save a new template."""
    tpl = models.ChecklistTemplate(
        id                   = data.id,
        name                 = data.name,
        description          = data.description,
        department           = data.department,
        shift                = data.shift,
        frequency            = data.frequency,
        fill_type            = data.fill_type,
        custom_options       = to_json(data.custom_options),
        rows                 = data.rows,
        cols                 = data.cols,
        source_id            = data.source_id,
        table_data           = to_json(data.table_data),
        horizontal_structure = to_json(data.horizontal_structure),
        created_by           = current_user.name,
        usage_count          = 0,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    d = {c.name: getattr(tpl, c.name) for c in tpl.__table__.columns}
    d["table_data"]           = from_json(tpl.table_data)
    d["horizontal_structure"] = from_json(tpl.horizontal_structure)
    d["custom_options"]       = from_json(tpl.custom_options) if tpl.custom_options else []
    return d

@router.delete("/{template_id}", response_model=schemas.MessageResponse)
def delete_template(
    template_id:  str,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """Delete a template. Admin only."""
    tpl = db.query(models.ChecklistTemplate).filter(
        models.ChecklistTemplate.id == template_id
    ).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(tpl)
    db.commit()
    return {"message": "Template deleted", "success": True}

@router.post("/{template_id}/increment-usage")
def increment_usage(
    template_id: str,
    db:          Session     = Depends(get_db),
    current_user:models.User = Depends(get_current_user)
):
    """Increment usage count when a template is used."""
    tpl = db.query(models.ChecklistTemplate).filter(
        models.ChecklistTemplate.id == template_id
    ).first()
    if tpl:
        tpl.usage_count = (tpl.usage_count or 0) + 1
        db.commit()
    return {"success": True}