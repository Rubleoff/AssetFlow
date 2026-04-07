from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, Enum as SAEnum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import BudgetPeriodType, GoalStatus, RecurringFrequency


class Budget(TimestampMixin, Base):
    __tablename__ = "budgets"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    category_id: Mapped[Optional[str]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3))
    amount_in_base_currency: Mapped[float] = mapped_column(Numeric(14, 2))
    period_type: Mapped[BudgetPeriodType] = mapped_column(
        SAEnum(BudgetPeriodType, native_enum=False), default=BudgetPeriodType.MONTHLY
    )
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    fixed_only: Mapped[bool] = mapped_column(Boolean, default=False)


class BudgetPeriod(TimestampMixin, Base):
    __tablename__ = "budget_periods"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    budget_id: Mapped[str] = mapped_column(ForeignKey("budgets.id"), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    spent: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    forecast_spent: Mapped[float] = mapped_column(Numeric(14, 2), default=0)


class Goal(TimestampMixin, Base):
    __tablename__ = "goals"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    linked_account_id: Mapped[Optional[str]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    linked_asset_id: Mapped[Optional[str]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    target_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3))
    target_amount_in_base_currency: Mapped[float] = mapped_column(Numeric(14, 2))
    progress_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    progress_amount_in_base_currency: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    monthly_contribution_target: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[GoalStatus] = mapped_column(SAEnum(GoalStatus, native_enum=False), default=GoalStatus.ACTIVE)
    auto_funding_enabled: Mapped[bool] = mapped_column(Boolean, default=False)


class GoalContribution(TimestampMixin, Base):
    __tablename__ = "goal_contributions"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    goal_id: Mapped[str] = mapped_column(ForeignKey("goals.id"), index=True)
    transaction_id: Mapped[Optional[str]] = mapped_column(ForeignKey("transactions.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    amount_in_base_currency: Mapped[float] = mapped_column(Numeric(14, 2))
    contributed_on: Mapped[date] = mapped_column(Date)


class RecurringTransaction(TimestampMixin, Base):
    __tablename__ = "recurring_transactions"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    category_id: Mapped[Optional[str]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3))
    amount_in_base_currency: Mapped[float] = mapped_column(Numeric(14, 2))
    frequency: Mapped[RecurringFrequency] = mapped_column(
        SAEnum(RecurringFrequency, native_enum=False), default=RecurringFrequency.MONTHLY
    )
    interval_count: Mapped[int] = mapped_column(Integer, default=1)
    next_due_date: Mapped[date] = mapped_column(Date, index=True)
    reminder_days_before: Mapped[int] = mapped_column(Integer, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    fixed_or_variable: Mapped[str] = mapped_column(String(20), default="fixed")
    merchant_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
