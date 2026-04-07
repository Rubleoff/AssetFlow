from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import AccountType


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    currency: str = Field(..., min_length=3, max_length=3)
    institution_name: Optional[str] = None
    opening_balance: float = 0
    include_in_net_worth: bool = True
    include_in_liquid_balance: bool = True
    credit_limit: Optional[float] = None
    interest_rate: Optional[float] = None
    billing_day: Optional[int] = None
    grace_period_days: Optional[int] = None


class AccountUpdate(BaseModel):
    name: str
    type: AccountType
    currency: str = Field(..., min_length=3, max_length=3)
    institution_name: Optional[str] = None
    include_in_net_worth: bool = True
    include_in_liquid_balance: bool = True
    credit_limit: Optional[float] = None
    interest_rate: Optional[float] = None
    billing_day: Optional[int] = None
    grace_period_days: Optional[int] = None


class AccountSummary(BaseModel):
    id: str
    name: str
    type: AccountType
    currency: str
    current_balance: float
    institution_name: Optional[str] = None
    include_in_net_worth: bool
    include_in_liquid_balance: bool

    model_config = {"from_attributes": True}
