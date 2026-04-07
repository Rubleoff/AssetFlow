from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import ImportConflict, ImportJob, ImportRow, Transaction, User
from app.models.enums import ImportRowStatus
from app.schemas.imports import (
    ImportApplyRequest,
    ImportApplyResult,
    ImportJobDetail,
    ImportJobSummary,
    ImportPreviewRequest,
    ImportPreviewResult,
)
from app.services.imports import apply_import_job, get_import_job_detail
from app.services.ledger import emit_event

router = APIRouter(prefix="/imports", tags=["imports"])


@router.get("", response_model=list[ImportJobSummary])
def list_imports(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ImportJobSummary]:
    jobs = db.scalars(select(ImportJob).where(ImportJob.owner_id == user.id).order_by(ImportJob.created_at.desc())).all()
    return [ImportJobSummary.model_validate(job) for job in jobs]


@router.get("/{job_id}", response_model=ImportJobDetail)
def get_import(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ImportJobDetail:
    detail = get_import_job_detail(db, user.id, job_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")
    return detail


@router.post("/preview", response_model=ImportPreviewResult)
def preview_import(
    payload: ImportPreviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ImportPreviewResult:
    job = ImportJob(owner_id=user.id, filename=payload.filename, status="preview")
    db.add(job)
    db.flush()
    statuses: list[ImportRowStatus] = []
    duplicates = 0
    accepted = 0
    for index, row in enumerate(payload.rows, start=1):
        existing = db.scalar(
            select(Transaction).where(
                Transaction.owner_id == user.id,
                Transaction.transaction_date == row.transaction_date,
                Transaction.amount == row.amount,
                Transaction.merchant_name == row.merchant_name,
            )
        )
        status = ImportRowStatus.DUPLICATE if existing else ImportRowStatus.ACCEPTED
        if existing:
            duplicates += 1
        else:
            accepted += 1
        import_row = ImportRow(
            owner_id=user.id,
            import_job_id=job.id,
            row_number=index,
            raw_payload=row.model_dump(mode="json"),
            normalized_payload=row.model_dump(mode="json"),
            status=status,
            duplicate_reason="Matching transaction exists" if existing else None,
        )
        db.add(import_row)
        db.flush()
        statuses.append(status)
        if existing:
            db.add(
                ImportConflict(
                    owner_id=user.id,
                    import_job_id=job.id,
                    import_row_id=import_row.id,
                    conflict_type="duplicate_transaction",
                    details={"merchant_name": row.merchant_name, "amount": row.amount},
                )
            )
    job.summary = {"duplicates": duplicates, "accepted": accepted}
    db.add(job)
    emit_event(
        db,
        user.id,
        "import.previewed",
        "import",
        job.id,
        {"duplicates": duplicates, "accepted": accepted},
    )
    db.commit()
    return ImportPreviewResult(job_id=job.id, duplicates=duplicates, accepted=accepted, statuses=statuses)


@router.post("/{job_id}/apply", response_model=ImportApplyResult)
def apply_import(
    job_id: str,
    payload: ImportApplyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ImportApplyResult:
    result = apply_import_job(db, user.id, job_id, payload)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")
    return result
