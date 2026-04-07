from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class OutboxEventRead(BaseModel):
    id: str
    event_type: str
    entity_type: str
    entity_id: str
    attempts: int
    last_attempt_at: Optional[datetime] = None
    last_error: Optional[str] = None
    processed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class JobStatus(BaseModel):
    recurring_processed: int
    notifications_queued: int
    pending_outbox: int = 0
    processed_outbox: int = 0
    failed_outbox: int = 0
    last_outbox_run_at: Optional[datetime] = None
    snapshot_rebuild_at: Optional[datetime] = None


class AdminActionResult(BaseModel):
    message: str
    processed_count: int = 0
    retried_count: int = 0
