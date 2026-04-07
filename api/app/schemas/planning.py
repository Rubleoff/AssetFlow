from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.models.enums import BudgetPeriodType, GoalStatus, RecurringFrequency


class BudgetCreate(BaseModel):
    name: str
    amount: float
    currency: str
    amount_in_base_currency: float
    period_type: BudgetPeriodType = BudgetPeriodType.MONTHLY
    start_date: date
    end_date: date
    category_id: Optional[str] = None
    fixed_only: bool = False


class BudgetStatus(BaseModel):
    id: str
    name: str
    amount: float
    spent: float
    forecast_spent: float
    utilization_pct: float
    period_start: date
    period_end: date


class GoalCreate(BaseModel):
    title: str
    target_amount: float
    currency: str
    target_amount_in_base_currency: float
    deadline: Optional[date] = None
    linked_account_id: Optional[str] = None
    linked_asset_id: Optional[str] = None
    monthly_contribution_target: Optional[float] = None
    priority: int = 1
    auto_funding_enabled: bool = False


class GoalUpdate(GoalCreate):
    status: GoalStatus = GoalStatus.ACTIVE


class GoalForecast(BaseModel):
    id: str
    title: str
    status: GoalStatus
    currency: str
    linked_account_id: Optional[str] = None
    linked_asset_id: Optional[str] = None
    deadline: Optional[date] = None
    priority: int = 1
    monthly_contribution_target: Optional[float] = None
    auto_funding_enabled: bool = False
    progress_pct: float
    saved_amount: float
    target_amount: float
    remaining_amount: float
    required_monthly_contribution: float
    projected_completion_months: Optional[int] = None


class GoalContributionCreate(BaseModel):
    amount: float
    amount_in_base_currency: float
    contributed_on: date
    account_id: str
    direction: str = "fund"
    transaction_id: Optional[str] = None


class RecurringCreate(BaseModel):
    account_id: str
    name: str
    amount: float
    currency: str
    amount_in_base_currency: float
    frequency: RecurringFrequency
    interval_count: int = 1
    next_due_date: date
    reminder_days_before: int = 3
    category_id: Optional[str] = None
    fixed_or_variable: str = "fixed"
    merchant_name: Optional[str] = None
    notes: Optional[str] = None


class RecurringUpdate(RecurringCreate):
    pass


class RecurringSchedule(BaseModel):
    id: str
    account_id: str
    category_id: Optional[str] = None
    name: str
    amount: float
    currency: str
    amount_in_base_currency: float
    next_due_date: date
    frequency: RecurringFrequency
    reminder_days_before: int
    is_active: bool
    fixed_or_variable: str
    merchant_name: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}
