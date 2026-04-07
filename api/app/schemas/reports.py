from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.models.enums import InsightSeverity

from app.schemas.common import NetWorthPoint
from app.schemas.users import AllocationPoint, MerchantSpend


class InsightCard(BaseModel):
    title: str
    body: str
    severity: InsightSeverity


class CategoryDynamic(BaseModel):
    category: str
    current_amount: float
    previous_amount: float
    growth_pct: float


class OverviewReport(BaseModel):
    liquid_balance: float
    total_assets: float
    total_liabilities: float
    net_worth: float
    monthly_income: float
    monthly_expenses: float
    savings_rate: float
    burn_rate: float
    runway_months: Optional[float]
    emergency_fund_months: Optional[float]
    recurring_burden_pct: float
    top_categories: list[CategoryDynamic]
    insights: list[InsightCard]
    net_worth_timeline: list[NetWorthPoint]


class CashFlowPoint(BaseModel):
    date: date
    income: float
    expenses: float
    net: float


class MerchantReport(BaseModel):
    merchants: list[MerchantSpend]


class AllocationReport(BaseModel):
    allocations: list[AllocationPoint]
