from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Account,
    Asset,
    Budget,
    Category,
    Goal,
    MerchantRule,
    NetWorthSnapshot,
    Notification,
    OutboxEvent,
    RecurringTransaction,
    Transaction,
)
from app.models.enums import (
    AccountType,
    AssetType,
    BudgetPeriodType,
    GoalStatus,
    InsightSeverity,
    NotificationType,
    RecurringFrequency,
    SourceType,
    TransactionType,
)


def ensure_seeded(db: Session, owner_id: str, base_currency: str) -> None:
    if db.scalar(select(Account).where(Account.owner_id == owner_id).limit(1)):
        return

    checking = Account(
        owner_id=owner_id,
        name="Main Checking",
        type=AccountType.DEBIT_CARD,
        currency=base_currency,
        opening_balance=5200,
        current_balance=5200,
        institution_name="AssetFlow Bank",
        include_in_net_worth=True,
        include_in_liquid_balance=True,
    )
    reserve = Account(
        owner_id=owner_id,
        name="Emergency Reserve",
        type=AccountType.RESERVE,
        currency=base_currency,
        opening_balance=9800,
        current_balance=9800,
        institution_name="Reserve Vault",
        include_in_net_worth=True,
        include_in_liquid_balance=True,
    )
    groceries = Category(
        owner_id=owner_id,
        name="Groceries",
        slug="groceries",
        direction="expense",
        color="#0052ff",
        is_essential=True,
    )
    subscriptions = Category(
        owner_id=owner_id,
        name="Subscriptions",
        slug="subscriptions",
        direction="expense",
        color="#0a0b0d",
        is_essential=False,
    )
    salary = Category(
        owner_id=owner_id,
        name="Salary",
        slug="salary",
        direction="income",
        color="#0052ff",
        is_essential=False,
    )
    db.add_all([checking, reserve, groceries, subscriptions, salary])
    db.flush()

    today = date.today()
    txs = [
        Transaction(
            owner_id=owner_id,
            account_id=checking.id,
            category_id=salary.id,
            type=TransactionType.INCOME,
            source_type=SourceType.SYSTEM,
            amount=4200,
            currency=base_currency,
            amount_in_base_currency=4200,
            fx_rate=1,
            merchant_name="Employer",
            description="Monthly salary",
            transaction_date=today.replace(day=1),
            posting_date=today.replace(day=1),
        ),
        Transaction(
            owner_id=owner_id,
            account_id=checking.id,
            category_id=groceries.id,
            type=TransactionType.EXPENSE,
            source_type=SourceType.MANUAL,
            amount=460,
            currency=base_currency,
            amount_in_base_currency=460,
            fx_rate=1,
            merchant_name="Whole Market",
            description="Weekly groceries",
            transaction_date=today - timedelta(days=3),
            posting_date=today - timedelta(days=3),
        ),
        Transaction(
            owner_id=owner_id,
            account_id=checking.id,
            category_id=subscriptions.id,
            type=TransactionType.EXPENSE,
            source_type=SourceType.SYSTEM,
            amount=39,
            currency=base_currency,
            amount_in_base_currency=39,
            fx_rate=1,
            merchant_name="Streaming+",
            description="Subscription",
            transaction_date=today - timedelta(days=5),
            posting_date=today - timedelta(days=5),
        ),
    ]
    checking.current_balance = float(checking.current_balance) + 4200 - 460 - 39
    db.add_all(txs)
    db.add(
        Budget(
            owner_id=owner_id,
            category_id=groceries.id,
            name="Groceries budget",
            amount=600,
            currency=base_currency,
            amount_in_base_currency=600,
            period_type=BudgetPeriodType.MONTHLY,
            start_date=today.replace(day=1),
            end_date=(today.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1),
            is_active=True,
            fixed_only=False,
        )
    )
    db.add(
        Goal(
            owner_id=owner_id,
            title="Emergency fund",
            target_amount=12000,
            currency=base_currency,
            target_amount_in_base_currency=12000,
            progress_amount=9800,
            progress_amount_in_base_currency=9800,
            deadline=today + timedelta(days=180),
            monthly_contribution_target=400,
            priority=1,
            status=GoalStatus.ACTIVE,
            auto_funding_enabled=False,
        )
    )
    db.add(
        RecurringTransaction(
            owner_id=owner_id,
            account_id=checking.id,
            category_id=subscriptions.id,
            name="Streaming+",
            amount=39,
            currency=base_currency,
            amount_in_base_currency=39,
            frequency=RecurringFrequency.MONTHLY,
            interval_count=1,
            next_due_date=today + timedelta(days=25),
            reminder_days_before=3,
            merchant_name="Streaming+",
            fixed_or_variable="fixed",
        )
    )
    db.add(
        Asset(
            owner_id=owner_id,
            name="BTC position",
            symbol="BTC",
            type=AssetType.CRYPTO,
            currency=base_currency,
            quantity=0.06,
            average_buy_price=54000,
            average_buy_price_in_base=54000,
            current_price=61000,
            current_price_in_base=61000,
            current_value_in_base=3660,
            invested_amount_in_base=3240,
            risk_label="high",
            liquidity_label="high",
        )
    )
    db.add(
        MerchantRule(
            owner_id=owner_id,
            pattern="whole",
            category_id=groceries.id,
            tag_names=["essentials"],
            priority=10,
        )
    )
    db.add(
        Notification(
            owner_id=owner_id,
            type=NotificationType.BUDGET_THRESHOLD,
            severity=InsightSeverity.INFO,
            title="Groceries budget is 77% used",
            body="You are approaching your groceries budget for this month.",
        )
    )
    db.add(
        NetWorthSnapshot(
            owner_id=owner_id,
            snapshot_date=today,
            asset_value=3660,
            liability_value=0,
            net_worth=float(checking.current_balance) + float(reserve.current_balance) + 3660,
        )
    )
    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type="seed.completed",
            entity_type="user",
            entity_id=owner_id,
            payload={"created_demo_data": True},
        )
    )
    db.commit()
