from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Notification, User
from app.schemas.notifications import NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_notifications(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[NotificationRead]:
    notifications = db.scalars(
        select(Notification).where(Notification.owner_id == user.id).order_by(Notification.created_at.desc())
    ).all()
    return [NotificationRead.model_validate(item) for item in notifications]


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationRead:
    notification = db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.owner_id == user.id)
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return NotificationRead.model_validate(notification)
