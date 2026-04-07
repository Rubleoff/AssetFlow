from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.models.enums import AssetType


class AssetCreate(BaseModel):
    name: str
    type: AssetType
    currency: str
    symbol: Optional[str] = None
    quantity: float = 0
    average_buy_price: float = 0
    average_buy_price_in_base: float = 0
    current_price: float = 0
    current_price_in_base: float = 0
    invested_amount_in_base: float = 0
    risk_label: Optional[str] = None
    liquidity_label: Optional[str] = None
    tracking_enabled: bool = False
    tracking_provider: Optional[str] = None
    tracking_external_id: Optional[str] = None
    tracking_symbol: Optional[str] = None
    rental_enabled: bool = False
    rental_income_monthly: float = 0
    rental_payment_frequency: Optional[str] = None
    rental_payment_day: Optional[int] = None
    notes: Optional[str] = None


class AssetUpdate(AssetCreate):
    pass


class AssetPosition(BaseModel):
    id: str
    name: str
    symbol: Optional[str]
    type: AssetType
    currency: str
    quantity: float
    current_price: float
    current_price_in_base: float
    current_value_in_base: float
    invested_amount_in_base: float
    unrealized_pnl: float
    allocation_pct: float
    tracking_enabled: bool = False
    tracking_provider: Optional[str] = None
    tracking_external_id: Optional[str] = None
    tracking_symbol: Optional[str] = None
    linked_account_id: Optional[str] = None
    linked_account_name: Optional[str] = None
    valuation_source: Optional[str] = None
    rental_enabled: bool = False
    rental_income_monthly: float = 0
    rental_payment_frequency: Optional[str] = None
    rental_payment_day: Optional[int] = None


class AssetPriceUpdate(BaseModel):
    priced_at: date
    price: float
    price_in_base: float
    source: str = "manual"


class AssetChartPoint(BaseModel):
    date: date
    price: float
    price_in_base: float


class AssetChartResponse(BaseModel):
    asset_id: str
    name: str
    range_days: int
    points: list[AssetChartPoint]


class AssetInstrumentOption(BaseModel):
    provider: str
    asset_type: AssetType
    external_id: str
    symbol: str
    name: str
    currency: Optional[str] = None
    market: Optional[str] = None


class DepositCreate(BaseModel):
    name: str
    institution_name: Optional[str] = None
    currency: str
    principal_amount: float
    current_balance: float
    annual_interest_rate: float
    payout_frequency: str = "monthly"
    capitalization_enabled: bool = True
    opened_on: date
    maturity_date: Optional[date] = None
    next_payout_date: Optional[date] = None
    early_withdrawal_terms: Optional[str] = None
    funding_account_id: Optional[str] = None


class DepositUpdate(DepositCreate):
    status: str = "open"


class DepositSummary(BaseModel):
    id: str
    account_id: str
    account_name: str
    funding_account_id: Optional[str] = None
    funding_account_name: Optional[str] = None
    name: str
    institution_name: Optional[str] = None
    currency: str
    principal_amount: float
    current_balance: float
    annual_interest_rate: float
    payout_frequency: str
    capitalization_enabled: bool
    opened_on: date
    maturity_date: Optional[date] = None
    next_payout_date: Optional[date] = None
    early_withdrawal_terms: Optional[str] = None
    status: str
