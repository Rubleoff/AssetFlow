from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ScenarioInput(BaseModel):
    name: str = "Scenario"
    months: int = Field(default=12, ge=1, le=60)
    monthly_income_delta: float = 0
    discretionary_spend_delta: float = 0
    recurring_delta: float = 0
    monthly_contribution_delta: float = 0
    monthly_asset_growth_rate: float = 0


class ScenarioMonth(BaseModel):
    month_index: int
    balance: float
    net_worth: float
    goal_buffer: float
    risk_flag: bool


class ScenarioResult(BaseModel):
    name: str
    months: list[ScenarioMonth]
    projected_goal_date: Optional[int] = None
    deficit_months: int = 0
