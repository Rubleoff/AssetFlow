from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ImportConflict, ImportJob, ImportRow, Transaction
from app.models.enums import ImportRowStatus
from app.schemas.imports import ImportApplyRequest, ImportApplyResult, ImportJobDetail, ImportJobSummary
from app.schemas.transactions import TransactionCreate
from app.services.ledger import create_transaction, emit_event


def get_import_job_detail(db: Session, owner_id: str, job_id: str) -> ImportJobDetail | None:
    job = db.scalar(select(ImportJob).where(ImportJob.id == job_id, ImportJob.owner_id == owner_id))
    if not job:
        return None
    rows = db.scalars(
        select(ImportRow).where(ImportRow.owner_id == owner_id, ImportRow.import_job_id == job_id).order_by(ImportRow.row_number.asc())
    ).all()
    conflicts = db.scalars(
        select(ImportConflict)
        .where(ImportConflict.owner_id == owner_id, ImportConflict.import_job_id == job_id)
        .order_by(ImportConflict.created_at.asc())
    ).all()
    return ImportJobDetail(
        job=ImportJobSummary.model_validate(job),
        rows=rows,
        conflicts=conflicts,
    )


def apply_import_job(db: Session, owner_id: str, job_id: str, payload: ImportApplyRequest) -> ImportApplyResult | None:
    job = db.scalar(select(ImportJob).where(ImportJob.id == job_id, ImportJob.owner_id == owner_id))
    if not job:
        return None

    rows = db.scalars(
        select(ImportRow).where(ImportRow.owner_id == owner_id, ImportRow.import_job_id == job_id).order_by(ImportRow.row_number.asc())
    ).all()
    selected_row_ids = set(payload.row_ids) if payload.row_ids else {row.id for row in rows}
    forced_duplicates = set(payload.force_duplicate_row_ids)

    imported_count = 0
    skipped_count = 0
    duplicate_count = 0
    error_count = 0

    for row in rows:
        if row.id not in selected_row_ids:
            continue

        normalized = row.normalized_payload or row.raw_payload or {}
        row_currency = str(normalized.get("currency") or payload.default_currency or "").upper()
        if row.status == ImportRowStatus.DUPLICATE and row.id not in forced_duplicates:
            row.status = ImportRowStatus.MATCHED
            skipped_count += 1
            duplicate_count += 1
            db.add(row)
            continue

        try:
            existing = db.scalar(
                select(Transaction).where(
                    Transaction.owner_id == owner_id,
                    Transaction.transaction_date == normalized["transaction_date"],
                    Transaction.amount == normalized["amount"],
                    Transaction.merchant_name == normalized.get("merchant_name"),
                )
            )
            if existing and row.id not in forced_duplicates:
                row.status = ImportRowStatus.MATCHED
                row.duplicate_reason = "Matching transaction exists"
                skipped_count += 1
                duplicate_count += 1
                db.add(row)
                continue

            create_transaction(
                db,
                owner_id,
                TransactionCreate(
                    account_id=payload.account_id,
                    type=payload.type,
                    amount=float(normalized["amount"]),
                    currency=row_currency,
                    category_id=normalized.get("category_id"),
                    merchant_name=normalized.get("merchant_name"),
                    description=normalized.get("description"),
                    transaction_date=normalized["transaction_date"],
                    posting_date=normalized["transaction_date"],
                    notes=normalized.get("notes"),
                    source_type=payload.source_type,
                    fx_rate=1,
                    amount_in_base_currency=float(normalized["amount"]),
                    splits=[],
                    tag_ids=[],
                ),
            )
            row.status = ImportRowStatus.ACCEPTED
            row.duplicate_reason = None
            imported_count += 1
        except Exception as exc:  # noqa: BLE001
            row.status = ImportRowStatus.ERROR
            row.duplicate_reason = str(exc)
            error_count += 1
        db.add(row)

    job.status = "applied" if error_count == 0 else "applied_with_errors"
    job.summary = {
        **(job.summary or {}),
        "imported": imported_count,
        "skipped": skipped_count,
        "duplicates": duplicate_count,
        "errors": error_count,
    }
    db.add(job)
    emit_event(
        db,
        owner_id,
        "import.applied",
        "import",
        job.id,
        {
            "imported": imported_count,
            "skipped": skipped_count,
            "duplicates": duplicate_count,
            "errors": error_count,
        },
    )
    db.commit()
    return ImportApplyResult(
        job_id=job.id,
        imported_count=imported_count,
        skipped_count=skipped_count,
        duplicate_count=duplicate_count,
        error_count=error_count,
    )
