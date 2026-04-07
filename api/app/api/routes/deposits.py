from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.common import MessageResponse
from app.schemas.portfolio import DepositCreate, DepositSummary, DepositUpdate
from app.services.portfolio import archive_deposit, create_deposit, list_deposits, update_deposit

router = APIRouter(prefix="/deposits", tags=["deposits"])


@router.get("", response_model=list[DepositSummary])
def get_deposits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DepositSummary]:
    return list_deposits(db, user.id)


@router.post("", response_model=DepositSummary)
def add_deposit(
    payload: DepositCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DepositSummary:
    deposit = create_deposit(db, user.id, payload)
    return next(item for item in list_deposits(db, user.id) if item.id == deposit.id)


@router.patch("/{deposit_id}", response_model=DepositSummary)
def patch_deposit(
    deposit_id: str,
    payload: DepositUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DepositSummary:
    try:
        deposit = update_deposit(db, user.id, deposit_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return next(item for item in list_deposits(db, user.id) if item.id == deposit.id)


@router.delete("/{deposit_id}", response_model=MessageResponse)
def delete_deposit(
    deposit_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    try:
        archive_deposit(db, user.id, deposit_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return MessageResponse(message="Deposit archived")
