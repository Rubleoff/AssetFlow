from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime


class MessageResponse(BaseModel):
    message: str


class Money(BaseModel):
    amount: float = Field(..., description="Amount in the original currency")
    currency: str = Field(..., min_length=3, max_length=3)
    base_amount: float
    base_currency: str
    fx_rate: float = 1


class AuditEntry(ORMModel):
    id: str
    entity_type: str
    entity_id: str
    action: str
    occurred_at: datetime
    actor_user_id: Optional[str] = None
    before_json: Optional[Dict[str, Any]] = None
    after_json: Optional[Dict[str, Any]] = None


class NetWorthPoint(BaseModel):
    date: date
    net_worth: float
    assets: float
    liabilities: float
