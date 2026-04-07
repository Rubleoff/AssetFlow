from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import InsightSeverity


class MerchantRuleCreate(BaseModel):
    pattern: str = Field(..., min_length=2, max_length=255)
    category_id: Optional[str] = None
    tag_names: list[str] = Field(default_factory=list)
    priority: int = Field(default=100, ge=1, le=1000)
    is_active: bool = True


class MerchantRuleUpdate(BaseModel):
    pattern: str = Field(..., min_length=2, max_length=255)
    category_id: Optional[str] = None
    tag_names: list[str] = Field(default_factory=list)
    priority: int = Field(default=100, ge=1, le=1000)
    is_active: bool = True


class MerchantRuleRead(BaseModel):
    id: str
    pattern: str
    category_id: Optional[str] = None
    tag_names: list[str] = Field(default_factory=list)
    priority: int
    is_active: bool

    model_config = {"from_attributes": True}


class MerchantSpend(BaseModel):
    merchant_name: str
    current_amount: float
    previous_amount: float
    growth_pct: float
    transaction_count: int


class AllocationPoint(BaseModel):
    label: str
    value: float
    allocation_pct: float


class InsightFeedEntry(BaseModel):
    title: str
    body: str
    severity: InsightSeverity
