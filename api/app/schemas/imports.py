from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import SourceType, TransactionType

from app.models.enums import ImportRowStatus


class ImportPreviewRow(BaseModel):
    amount: float
    currency: str
    merchant_name: Optional[str] = None
    transaction_date: date
    description: Optional[str] = None
    category_id: Optional[str] = None
    notes: Optional[str] = None


class ImportPreviewRequest(BaseModel):
    filename: str
    rows: list[ImportPreviewRow]


class ImportPreviewResult(BaseModel):
    job_id: str
    duplicates: int
    accepted: int
    statuses: list[ImportRowStatus]


class ImportJobSummary(BaseModel):
    id: str
    filename: str
    status: str
    summary: Optional[dict] = None

    model_config = {"from_attributes": True}


class ImportRowRead(BaseModel):
    id: str
    row_number: int
    raw_payload: dict
    normalized_payload: Optional[dict] = None
    status: ImportRowStatus
    duplicate_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class ImportConflictRead(BaseModel):
    id: str
    import_row_id: str
    conflict_type: str
    details: Optional[dict] = None

    model_config = {"from_attributes": True}


class ImportJobDetail(BaseModel):
    job: ImportJobSummary
    rows: list[ImportRowRead]
    conflicts: list[ImportConflictRead]


class ImportApplyRequest(BaseModel):
    account_id: str
    type: TransactionType = TransactionType.EXPENSE
    source_type: SourceType = SourceType.IMPORTED
    default_currency: Optional[str] = None
    row_ids: list[str] = Field(default_factory=list)
    force_duplicate_row_ids: list[str] = Field(default_factory=list)


class ImportApplyResult(BaseModel):
    job_id: str
    imported_count: int
    skipped_count: int
    duplicate_count: int
    error_count: int
