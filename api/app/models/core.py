from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import InsightSeverity, NotificationType, RoleEnum


class User(TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[RoleEnum] = mapped_column(SAEnum(RoleEnum, native_enum=False), default=RoleEnum.USER)
    base_currency: Mapped[str] = mapped_column(String(3), default="USD")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    import_preferences: Mapped[dict] = mapped_column(JSON, default=dict)


class SessionToken(TimestampMixin, Base):
    __tablename__ = "sessions"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship()


class AuditLog(TimestampMixin, Base):
    __tablename__ = "audit_logs"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    actor_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(100))
    before_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    after_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OutboxEvent(TimestampMixin, Base):
    __tablename__ = "outbox_events"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(120))
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, native_enum=False), index=True
    )
    severity: Mapped[InsightSeverity] = mapped_column(
        SAEnum(InsightSeverity, native_enum=False), default=InsightSeverity.INFO
    )
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(String(1000))
    event_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)


class NotificationLog(TimestampMixin, Base):
    __tablename__ = "notification_logs"

    notification_id: Mapped[str] = mapped_column(ForeignKey("notifications.id"), index=True)
    channel: Mapped[str] = mapped_column(String(50), default="in_app")
    status: Mapped[str] = mapped_column(String(50), default="queued")
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class DailySnapshot(TimestampMixin, Base):
    __tablename__ = "daily_snapshots"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    income: Mapped[float] = mapped_column(default=0)
    expenses: Mapped[float] = mapped_column(default=0)
    liquid_balance: Mapped[float] = mapped_column(default=0)
    net_worth: Mapped[float] = mapped_column(default=0)


class MonthlySnapshot(TimestampMixin, Base):
    __tablename__ = "monthly_snapshots"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    month_start: Mapped[date] = mapped_column(Date, index=True)
    income: Mapped[float] = mapped_column(default=0)
    expenses: Mapped[float] = mapped_column(default=0)
    savings_rate: Mapped[float] = mapped_column(default=0)
    burn_rate: Mapped[float] = mapped_column(default=0)
    recurring_burden: Mapped[float] = mapped_column(default=0)
    net_worth: Mapped[float] = mapped_column(default=0)


class GoalSnapshot(TimestampMixin, Base):
    __tablename__ = "goal_snapshots"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    goal_id: Mapped[str] = mapped_column(ForeignKey("goals.id"), index=True)
    snapshot_date: Mapped[date] = mapped_column(Date)
    progress_pct: Mapped[float] = mapped_column(default=0)
    projected_completion_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class NetWorthSnapshot(TimestampMixin, Base):
    __tablename__ = "net_worth_snapshots"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    asset_value: Mapped[float] = mapped_column(default=0)
    liability_value: Mapped[float] = mapped_column(default=0)
    net_worth: Mapped[float] = mapped_column(default=0)
