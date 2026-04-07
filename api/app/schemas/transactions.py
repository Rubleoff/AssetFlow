from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models.enums import SourceType, TransactionStatus, TransactionType


class SplitLine(BaseModel):
    category_id: str
    amount: float
    note: Optional[str] = None


class TransactionCreate(BaseModel):
    account_id: str
    type: TransactionType
    amount: float = Field(..., gt=0)
    currency: str = Field(..., min_length=3, max_length=3)
    category_id: Optional[str] = None
    merchant_name: Optional[str] = None
    description: Optional[str] = None
    transaction_date: date
    posting_date: Optional[date] = None
    notes: Optional[str] = None
    source_type: SourceType = SourceType.MANUAL
    fx_rate: float = 1
    amount_in_base_currency: Optional[float] = None
    splits: list[SplitLine] = Field(default_factory=list)
    tag_ids: list[str] = Field(default_factory=list)
    linked_asset_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_splits(self) -> "TransactionCreate":
        if self.splits:
            total_split = round(sum(split.amount for split in self.splits), 2)
            if round(self.amount, 2) != total_split:
                raise ValueError("Split amounts must equal transaction amount")
        return self


class TransactionUpdate(TransactionCreate):
    pass


class TransferCreate(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: float = Field(..., gt=0)
    currency: str = Field(..., min_length=3, max_length=3)
    fx_rate: float = 1
    amount_in_base_currency: Optional[float] = None
    transaction_date: date
    description: Optional[str] = None


class TransactionRead(BaseModel):
    id: str
    account_id: str
    category_id: Optional[str]
    type: TransactionType
    source_type: SourceType
    status: TransactionStatus
    amount: float
    currency: str
    amount_in_base_currency: float
    merchant_name: Optional[str] = None
    description: Optional[str] = None
    transaction_date: date
    posting_date: date
    notes: Optional[str] = None

    model_config = {"from_attributes": True}
