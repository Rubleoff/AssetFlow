from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Tag, User
from app.services.ledger import emit_event

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[dict])
def list_tags(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    tags = db.scalars(select(Tag).where(Tag.owner_id == user.id).order_by(Tag.name.asc())).all()
    return [{"id": tag.id, "name": tag.name, "color": tag.color} for tag in tags]


@router.post("", response_model=dict)
def add_tag(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    tag = Tag(owner_id=user.id, name=payload["name"], color=payload.get("color", "#0a0b0d"))
    db.add(tag)
    db.flush()
    emit_event(db, user.id, "tag.created", "tag", tag.id, {"name": tag.name})
    db.commit()
    db.refresh(tag)
    return {"id": tag.id, "name": tag.name}
