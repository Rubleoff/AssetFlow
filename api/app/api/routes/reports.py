from datetime import date, timedelta
from io import StringIO

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Transaction, User
from app.models.enums import TransactionType
from app.schemas.common import NetWorthPoint
from app.schemas.reports import AllocationReport, CashFlowPoint, MerchantReport, OverviewReport, CategoryDynamic
from app.services.analytics import (
    compute_asset_allocation,
    compute_category_dynamics,
    compute_merchant_spend,
    compute_overview,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/overview", response_model=OverviewReport)
def overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> OverviewReport:
    return compute_overview(db, user.id)


@router.get("/cash-flow", response_model=list[CashFlowPoint])
def cash_flow(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[CashFlowPoint]:
    start = date.today() - timedelta(days=29)
    transactions = db.scalars(
        select(Transaction)
        .where(Transaction.owner_id == user.id, Transaction.transaction_date >= start)
        .order_by(Transaction.transaction_date.asc())
    ).all()
    points: dict[date, dict[str, float]] = {}
    for transaction in transactions:
        bucket = points.setdefault(transaction.transaction_date, {"income": 0.0, "expenses": 0.0})
        if transaction.type in {TransactionType.INCOME, TransactionType.INTEREST, TransactionType.DIVIDEND}:
            bucket["income"] += float(transaction.amount_in_base_currency)
        elif transaction.type not in {TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT}:
            bucket["expenses"] += float(transaction.amount_in_base_currency)
    return [
        CashFlowPoint(date=day, income=values["income"], expenses=values["expenses"], net=values["income"] - values["expenses"])
        for day, values in points.items()
    ]


@router.get("/categories", response_model=list[CategoryDynamic])
def category_dynamics(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[CategoryDynamic]:
    return compute_category_dynamics(db, user.id)


@router.get("/merchants", response_model=MerchantReport)
def merchant_report(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MerchantReport:
    return MerchantReport(merchants=compute_merchant_spend(db, user.id))


@router.get("/net-worth", response_model=list[NetWorthPoint])
def net_worth_report(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[NetWorthPoint]:
    return compute_overview(db, user.id).net_worth_timeline


@router.get("/allocation", response_model=AllocationReport)
def allocation_report(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> AllocationReport:
    return AllocationReport(allocations=compute_asset_allocation(db, user.id))


@router.get("/export/transactions.csv", response_class=PlainTextResponse)
def export_transactions_csv(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> str:
    transactions = db.scalars(
        select(Transaction).where(Transaction.owner_id == user.id).order_by(Transaction.transaction_date.desc())
    ).all()
    buffer = StringIO()
    buffer.write("transaction_date,posting_date,type,account_id,category_id,merchant_name,amount,currency,amount_in_base_currency,description\n")
    for transaction in transactions:
        buffer.write(
            ",".join(
                [
                    transaction.transaction_date.isoformat(),
                    transaction.posting_date.isoformat(),
                    transaction.type.value,
                    transaction.account_id,
                    transaction.category_id or "",
                    (transaction.merchant_name or "").replace(",", " "),
                    str(float(transaction.amount)),
                    transaction.currency,
                    str(float(transaction.amount_in_base_currency)),
                    (transaction.description or "").replace(",", " "),
                ]
            )
        )
        buffer.write("\n")
    return buffer.getvalue()
