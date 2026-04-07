from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.transactions import TransactionRead, TransferCreate
from app.services.ledger import create_transfer

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.post("", response_model=list[TransactionRead])
def add_transfer(
    payload: TransferCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TransactionRead]:
    transactions = create_transfer(db, user.id, payload)
    return [TransactionRead.model_validate(tx) for tx in transactions]
