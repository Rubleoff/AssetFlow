from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import AssetType


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    symbol: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    linked_account_id: Mapped[Optional[str]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    type: Mapped[AssetType] = mapped_column(SAEnum(AssetType, native_enum=False))
    currency: Mapped[str] = mapped_column(String(3))
    quantity: Mapped[float] = mapped_column(Numeric(18, 6), default=0)
    average_buy_price: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    average_buy_price_in_base: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    current_price: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    current_price_in_base: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    current_value_in_base: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    invested_amount_in_base: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    risk_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    liquidity_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tracking_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    tracking_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tracking_external_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    tracking_symbol: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    valuation_source: Mapped[str] = mapped_column(String(50), default="manual")
    rental_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    rental_income_monthly: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    rental_payment_frequency: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    rental_payment_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)


class AssetHolding(TimestampMixin, Base):
    __tablename__ = "asset_holdings"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    acquired_on: Mapped[date] = mapped_column(Date)
    quantity: Mapped[float] = mapped_column(Numeric(18, 6))
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 4))
    unit_cost_in_base: Mapped[float] = mapped_column(Numeric(14, 4))
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class AssetPriceHistory(TimestampMixin, Base):
    __tablename__ = "asset_price_history"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    priced_at: Mapped[date] = mapped_column(Date, index=True)
    price: Mapped[float] = mapped_column(Numeric(14, 4))
    price_in_base: Mapped[float] = mapped_column(Numeric(14, 4))
    source: Mapped[str] = mapped_column(String(50), default="manual")


class ExchangeRate(TimestampMixin, Base):
    __tablename__ = "exchange_rates"

    base_currency: Mapped[str] = mapped_column(String(3), index=True)
    quote_currency: Mapped[str] = mapped_column(String(3), index=True)
    rate: Mapped[float] = mapped_column(Numeric(14, 6))
    effective_date: Mapped[date] = mapped_column(Date, index=True)
    source: Mapped[str] = mapped_column(String(50), default="manual")


class Deposit(TimestampMixin, Base):
    __tablename__ = "deposits"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    funding_account_id: Mapped[Optional[str]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    institution_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    currency: Mapped[str] = mapped_column(String(3))
    principal_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    current_balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    annual_interest_rate: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    payout_frequency: Mapped[str] = mapped_column(String(20), default="monthly")
    capitalization_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    opened_on: Mapped[date] = mapped_column(Date)
    maturity_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_payout_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    early_withdrawal_terms: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
