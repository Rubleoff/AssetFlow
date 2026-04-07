from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Transaction, User
from app.schemas.common import MessageResponse
from app.schemas.transactions import TransactionCreate, TransactionRead, TransactionUpdate
from app.services.ledger import create_transaction, delete_transaction, update_transaction

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TransactionRead]:
    transactions = db.scalars(
        select(Transaction).where(Transaction.owner_id == user.id).order_by(Transaction.transaction_date.desc())
    ).all()
    return [TransactionRead.model_validate(tx) for tx in transactions]


@router.post("", response_model=TransactionRead)
def add_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TransactionRead:
    transaction = create_transaction(db, user.id, payload)
    return TransactionRead.model_validate(transaction)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def patch_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TransactionRead:
    transaction = update_transaction(db, user.id, transaction_id, payload)
    return TransactionRead.model_validate(transaction)


@router.delete("/{transaction_id}", response_model=MessageResponse)
def remove_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    delete_transaction(db, user.id, transaction_id)
    return MessageResponse(message="Transaction deleted")
