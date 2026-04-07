from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Account, User
from app.schemas.accounts import AccountCreate, AccountSummary, AccountUpdate
from app.schemas.common import MessageResponse
from app.services.ledger import archive_account, create_account, update_account

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountSummary])
def list_accounts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AccountSummary]:
    accounts = db.scalars(
        select(Account).where(Account.owner_id == user.id, Account.is_archived.is_(False)).order_by(Account.name.asc())
    ).all()
    return [AccountSummary.model_validate(account) for account in accounts]


@router.post("", response_model=AccountSummary)
def add_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountSummary:
    account = create_account(db, user.id, payload)
    return AccountSummary.model_validate(account)


@router.patch("/{account_id}", response_model=AccountSummary)
def patch_account(
    account_id: str,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountSummary:
    try:
        account = update_account(db, user.id, account_id, payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return AccountSummary.model_validate(account)


@router.delete("/{account_id}", response_model=MessageResponse)
def delete_account(
    account_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    try:
        archive_account(db, user.id, account_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return MessageResponse(message="Account archived")
