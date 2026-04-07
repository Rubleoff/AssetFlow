from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import AccountType, SourceType, TransactionStatus, TransactionType


class Account(TimestampMixin, Base):
    __tablename__ = "accounts"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[AccountType] = mapped_column(SAEnum(AccountType, native_enum=False))
    currency: Mapped[str] = mapped_column(String(3))
    institution_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    opening_balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    current_balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    include_in_net_worth: Mapped[bool] = mapped_column(Boolean, default=True)
    include_in_liquid_balance: Mapped[bool] = mapped_column(Boolean, default=True)
    credit_limit: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    interest_rate: Mapped[Optional[float]] = mapped_column(Numeric(8, 4), nullable=True)
    billing_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    grace_period_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    parent_id: Mapped[Optional[str]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), index=True)
    direction: Mapped[str] = mapped_column(String(20), default="expense")
    color: Mapped[str] = mapped_column(String(20), default="#0052ff")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_essential: Mapped[bool] = mapped_column(Boolean, default=False)

    parent: Mapped[Optional["Category"]] = relationship(remote_side="Category.id")


class Tag(TimestampMixin, Base):
    __tablename__ = "tags"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    color: Mapped[str] = mapped_column(String(20), default="#0a0b0d")


class TransferGroup(TimestampMixin, Base):
    __tablename__ = "transfer_groups"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Transaction(TimestampMixin, Base):
    __tablename__ = "transactions"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    category_id: Mapped[Optional[str]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    transfer_group_id: Mapped[Optional[str]] = mapped_column(ForeignKey("transfer_groups.id"), nullable=True)
    linked_account_id: Mapped[Optional[str]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    linked_asset_id: Mapped[Optional[str]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    recurrence_instance_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("recurring_transactions.id"), nullable=True
    )
    type: Mapped[TransactionType] = mapped_column(SAEnum(TransactionType, native_enum=False), index=True)
    status: Mapped[TransactionStatus] = mapped_column(
        SAEnum(TransactionStatus, native_enum=False), default=TransactionStatus.POSTED
    )
    source_type: Mapped[SourceType] = mapped_column(
        SAEnum(SourceType, native_enum=False), default=SourceType.MANUAL
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3))
    amount_in_base_currency: Mapped[float] = mapped_column(Numeric(14, 2))
    fx_rate: Mapped[float] = mapped_column(Numeric(14, 6), default=1)
    merchant_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, index=True)
    posting_date: Mapped[date] = mapped_column(Date, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class TransactionSplit(TimestampMixin, Base):
    __tablename__ = "transaction_splits"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), index=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    amount_in_base_currency: Mapped[float] = mapped_column(Numeric(14, 2))
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class TransactionTag(TimestampMixin, Base):
    __tablename__ = "transaction_tags"

    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), index=True)
    tag_id: Mapped[str] = mapped_column(ForeignKey("tags.id"), index=True)


class MerchantRule(TimestampMixin, Base):
    __tablename__ = "merchant_rules"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    pattern: Mapped[str] = mapped_column(String(255), index=True)
    category_id: Mapped[Optional[str]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    tag_names: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
