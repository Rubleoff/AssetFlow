from datetime import date, datetime, timezone

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import DailySnapshot, MonthlySnapshot, NetWorthSnapshot, Notification, OutboxEvent
from app.models.enums import InsightSeverity, NotificationType
from app.services.analytics import compute_overview, upsert_anomaly_notifications
from app.services.ledger import generate_due_recurring_transactions
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.jobs.generate_recurring_due")
def generate_recurring_due() -> int:
    with SessionLocal() as db:
        return generate_due_recurring_transactions(db)


@celery_app.task(name="app.tasks.jobs.process_outbox_events")
def process_outbox_events() -> int:
    settings = get_settings()
    with SessionLocal() as db:
        events = db.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.processed_at.is_(None))
            .order_by(OutboxEvent.created_at.asc())
            .limit(settings.outbox_batch_size)
        ).all()
        if not events:
            return 0

        now = datetime.now(tz=timezone.utc)
        refreshed_owners: set[str] = set()
        processed_count = 0
        for event in events:
            try:
                _handle_outbox_event(db, event, refreshed_owners)
                event.processed_at = now
                event.last_error = None
                processed_count += 1
            except Exception as exc:  # noqa: BLE001
                event.last_error = str(exc)
            event.attempts = int(event.attempts or 0) + 1
            event.last_attempt_at = now
            db.add(event)

        db.commit()
        return processed_count


@celery_app.task(name="app.tasks.jobs.refresh_snapshots")
def refresh_snapshots() -> int:
    with SessionLocal() as db:
        owner_ids = [row[0] for row in db.execute(select(OutboxEvent.owner_id).distinct()).all()]
        count = 0
        for owner_id in owner_ids:
            overview = compute_overview(db, owner_id)
            _upsert_snapshots(db, owner_id, overview)
            _upsert_digest_notifications(db, owner_id, overview)
            upsert_anomaly_notifications(db, owner_id)
            count += 1
        db.commit()
        return count


def _upsert_snapshots(db, owner_id: str, overview) -> None:
    today = date.today()
    daily = db.scalar(
        select(DailySnapshot).where(DailySnapshot.owner_id == owner_id, DailySnapshot.snapshot_date == today)
    )
    if not daily:
        daily = DailySnapshot(owner_id=owner_id, snapshot_date=today)
    daily.income = overview.monthly_income
    daily.expenses = overview.monthly_expenses
    daily.liquid_balance = overview.liquid_balance
    daily.net_worth = overview.net_worth
    db.add(daily)

    month_start = today.replace(day=1)
    monthly = db.scalar(
        select(MonthlySnapshot).where(MonthlySnapshot.owner_id == owner_id, MonthlySnapshot.month_start == month_start)
    )
    if not monthly:
        monthly = MonthlySnapshot(owner_id=owner_id, month_start=month_start)
    monthly.income = overview.monthly_income
    monthly.expenses = overview.monthly_expenses
    monthly.savings_rate = overview.savings_rate
    monthly.burn_rate = overview.burn_rate
    monthly.recurring_burden = overview.recurring_burden_pct
    monthly.net_worth = overview.net_worth
    db.add(monthly)

    net_worth = db.scalar(
        select(NetWorthSnapshot).where(
            NetWorthSnapshot.owner_id == owner_id,
            NetWorthSnapshot.snapshot_date == today,
        )
    )
    if not net_worth:
        net_worth = NetWorthSnapshot(owner_id=owner_id, snapshot_date=today)
    net_worth.asset_value = overview.total_assets
    net_worth.liability_value = overview.total_liabilities
    net_worth.net_worth = overview.net_worth
    db.add(net_worth)


def _upsert_digest_notifications(db, owner_id: str, overview) -> None:
    today_key = date.today().isoformat()
    for insight in overview.insights:
        event_key = f"digest:{today_key}:{owner_id}:{insight.title.lower()}"
        notification = db.scalar(
            select(Notification).where(
                Notification.owner_id == owner_id,
                Notification.event_key == event_key,
            )
        )
        if notification:
            notification.severity = InsightSeverity(insight.severity)
            notification.title = insight.title
            notification.body = insight.body
        else:
            notification = Notification(
                owner_id=owner_id,
                type=NotificationType.DIGEST,
                severity=InsightSeverity(insight.severity),
                title=insight.title,
                body=insight.body,
                event_key=event_key,
            )
        db.add(notification)


def _handle_outbox_event(db, event: OutboxEvent, refreshed_owners: set[str]) -> None:
    supported_prefixes = (
        "account.",
        "transaction.",
        "transfer.",
        "budget.",
        "goal.",
        "recurring.",
        "asset.",
        "import.",
        "seed.",
        "category.",
        "tag.",
    )
    if not event.event_type.startswith(supported_prefixes):
        raise ValueError(f"Unsupported outbox event type: {event.event_type}")
    if event.owner_id not in refreshed_owners:
        overview = compute_overview(db, event.owner_id)
        _upsert_snapshots(db, event.owner_id, overview)
        _upsert_digest_notifications(db, event.owner_id, overview)
        upsert_anomaly_notifications(db, event.owner_id)
        refreshed_owners.add(event.owner_id)
