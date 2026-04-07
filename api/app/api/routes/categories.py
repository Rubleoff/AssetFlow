from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Category, User
from app.services.ledger import emit_event

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[dict])
def list_categories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    categories = db.scalars(select(Category).where(Category.owner_id == user.id).order_by(Category.name.asc())).all()
    return [
        {
            "id": category.id,
            "name": category.name,
            "slug": category.slug,
            "direction": category.direction,
            "color": category.color,
            "is_essential": category.is_essential,
        }
        for category in categories
    ]


@router.post("", response_model=dict)
def add_category(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    category = Category(
        owner_id=user.id,
        parent_id=payload.get("parent_id"),
        name=payload["name"],
        slug=payload.get("slug", payload["name"].lower().replace(" ", "-")),
        direction=payload.get("direction", "expense"),
        color=payload.get("color", "#0052ff"),
        is_essential=payload.get("is_essential", False),
    )
    db.add(category)
    db.flush()
    emit_event(
        db,
        user.id,
        "category.created",
        "category",
        category.id,
        {"name": category.name, "direction": category.direction},
    )
    db.commit()
    db.refresh(category)
    return {"id": category.id, "name": category.name}
