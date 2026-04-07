from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user
from app.db.session import get_db
from app.models import Notification, OutboxEvent
from app.schemas.admin import AdminActionResult, JobStatus, OutboxEventRead
from app.schemas.common import HealthResponse
from app.tasks.jobs import process_outbox_events

router = APIRouter(prefix="/admin", tags=["admin"])

FAILED_OUTBOX_THRESHOLD = 3


@router.get("/health", response_model=HealthResponse)
def health(_: object = Depends(get_admin_user)) -> HealthResponse:
    return HealthResponse(status="ok", timestamp=datetime.now(tz=timezone.utc))


@router.get("/outbox", response_model=list[OutboxEventRead])
def outbox(db: Session = Depends(get_db), _: object = Depends(get_admin_user)) -> list[OutboxEventRead]:
    events = db.scalars(select(OutboxEvent).order_by(OutboxEvent.created_at.desc()).limit(50)).all()
    return [OutboxEventRead.model_validate(event) for event in events]


@router.post("/outbox/process", response_model=AdminActionResult)
def process_outbox(_: object = Depends(get_admin_user)) -> AdminActionResult:
    processed_count = process_outbox_events()
    return AdminActionResult(message="Processed pending outbox events", processed_count=processed_count)


@router.post("/outbox/retry-failed", response_model=AdminActionResult)
def retry_failed_outbox(db: Session = Depends(get_db), _: object = Depends(get_admin_user)) -> AdminActionResult:
    failed_events = db.scalars(
        select(OutboxEvent).where(
            OutboxEvent.processed_at.is_(None),
            OutboxEvent.attempts >= FAILED_OUTBOX_THRESHOLD,
        )
    ).all()
    for event in failed_events:
        event.attempts = 0
        db.add(event)
    db.commit()
    processed_count = process_outbox_events()
    return AdminActionResult(
        message="Reset failed outbox events and triggered processing",
        processed_count=processed_count,
        retried_count=len(failed_events),
    )


@router.get("/jobs", response_model=JobStatus)
def job_status(db: Session = Depends(get_db), _: object = Depends(get_admin_user)) -> JobStatus:
    pending_notifications = len(
        db.scalars(select(Notification).where(Notification.delivered_at.is_(None))).all()
    )
    processed = len(db.scalars(select(OutboxEvent).where(OutboxEvent.processed_at.is_not(None))).all())
    pending = len(db.scalars(select(OutboxEvent).where(OutboxEvent.processed_at.is_(None))).all())
    failed = len(
        db.scalars(
            select(OutboxEvent).where(
                OutboxEvent.processed_at.is_(None),
                OutboxEvent.attempts >= FAILED_OUTBOX_THRESHOLD,
            )
        ).all()
    )
    last_outbox_run_at = db.scalar(select(func.max(OutboxEvent.processed_at)))
    return JobStatus(
        recurring_processed=processed,
        notifications_queued=pending_notifications,
        pending_outbox=pending,
        processed_outbox=processed,
        failed_outbox=failed,
        last_outbox_run_at=last_outbox_run_at,
        snapshot_rebuild_at=datetime.now(tz=timezone.utc),
    )
