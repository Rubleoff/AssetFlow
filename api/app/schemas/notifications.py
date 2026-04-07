from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.enums import InsightSeverity, NotificationType


class NotificationRead(BaseModel):
    id: str
    type: NotificationType
    severity: InsightSeverity
    title: str
    body: str
    is_read: bool
    scheduled_for: Optional[datetime] = None

    model_config = {"from_attributes": True}
