from datetime import date, timedelta

from app.models import Account, Category, MerchantRule, Notification, User
from app.models.enums import AccountType, NotificationType, SourceType, TransactionType
from app.models.enums import InsightSeverity
from app.core.security import hash_password
from app.schemas.reports import CategoryDynamic, OverviewReport
from app.schemas.transactions import TransactionCreate
from app.schemas.scenarios import ScenarioInput
from app.services.ledger import create_transaction
from app.services.scenarios import project_scenario
from app.tasks.jobs import process_outbox_events


def test_project_scenario_tracks_deficit_months() -> None:
    overview = OverviewReport(
        liquid_balance=1000,
        total_assets=500,
        total_liabilities=0,
        net_worth=1500,
        monthly_income=2000,
        monthly_expenses=1800,
        savings_rate=10,
        burn_rate=60,
        runway_months=0.5,
        emergency_fund_months=1,
        recurring_burden_pct=5,
        top_categories=[
            CategoryDynamic(category="Groceries", current_amount=300, previous_amount=250, growth_pct=20)
        ],
        insights=[
            {
                "title": "Coverage is thin",
                "body": "Reserves are low",
                "severity": InsightSeverity.WARNING,
            }
        ],
        net_worth_timeline=[],
    )
    result = project_scenario(
        overview,
        ScenarioInput(
            name="Stress",
            months=6,
            monthly_income_delta=-500,
            discretionary_spend_delta=400,
        ),
    )

    assert result.name == "Stress"
    assert len(result.months) == 6
    assert result.deficit_months > 0


def test_manual_transaction_remembers_merchant_category(db_session) -> None:
    user = User(
        email="merchant@example.com",
        full_name="Merchant Memory",
        password_hash=hash_password("test-password-123"),
        base_currency="USD",
        timezone="UTC",
    )
    db_session.add(user)
    db_session.flush()
    account = Account(
        owner_id=user.id,
        name="Checking",
        type=AccountType.DEBIT_CARD,
        currency="USD",
        opening_balance=1000,
        current_balance=1000,
        include_in_net_worth=True,
        include_in_liquid_balance=True,
    )
    category = Category(
        owner_id=user.id,
        name="Coffee",
        slug="coffee",
        direction="expense",
        color="#0052ff",
        is_essential=False,
    )
    db_session.add_all([account, category])
    db_session.commit()

    create_transaction(
        db_session,
        user.id,
        TransactionCreate(
            account_id=account.id,
            type=TransactionType.EXPENSE,
            amount=12,
            currency="USD",
            category_id=category.id,
            merchant_name="Coffee Lab",
            description="Latte",
            transaction_date=date(2026, 4, 1),
            posting_date=date(2026, 4, 1),
            notes=None,
            source_type=SourceType.MANUAL,
            fx_rate=1,
            amount_in_base_currency=12,
            splits=[],
            tag_ids=[],
        ),
    )

    rule = db_session.query(MerchantRule).filter(MerchantRule.owner_id == user.id).one()
    assert rule.pattern == "coffee lab"
    assert rule.category_id == category.id

    follow_up = create_transaction(
        db_session,
        user.id,
        TransactionCreate(
            account_id=account.id,
            type=TransactionType.EXPENSE,
            amount=8,
            currency="USD",
            merchant_name="Coffee Lab",
            description="Espresso",
            transaction_date=date(2026, 4, 2),
            posting_date=date(2026, 4, 2),
            notes=None,
            source_type=SourceType.MANUAL,
            fx_rate=1,
            amount_in_base_currency=8,
            splits=[],
            tag_ids=[],
        ),
    )

    assert follow_up.category_id == category.id


def test_outbox_processing_creates_anomaly_notification_once(db_session) -> None:
    user = User(
        email="anomaly@example.com",
        full_name="Anomaly User",
        password_hash=hash_password("test-password-123"),
        base_currency="USD",
        timezone="UTC",
    )
    db_session.add(user)
    db_session.flush()
    account = Account(
        owner_id=user.id,
        name="Checking",
        type=AccountType.DEBIT_CARD,
        currency="USD",
        opening_balance=2000,
        current_balance=2000,
        include_in_net_worth=True,
        include_in_liquid_balance=True,
    )
    category = Category(
        owner_id=user.id,
        name="Dining",
        slug="dining",
        direction="expense",
        color="#0052ff",
        is_essential=False,
    )
    db_session.add_all([account, category])
    db_session.commit()

    for index, amount in enumerate([10, 11, 9, 12], start=1):
        create_transaction(
            db_session,
            user.id,
            TransactionCreate(
                account_id=account.id,
                type=TransactionType.EXPENSE,
                amount=amount,
                currency="USD",
                category_id=category.id,
                merchant_name="Coffee Lab",
                description="Baseline coffee",
                transaction_date=date.today() - timedelta(days=30 + index),
                posting_date=date.today() - timedelta(days=30 + index),
                notes=None,
                source_type=SourceType.MANUAL,
                fx_rate=1,
                amount_in_base_currency=amount,
                splits=[],
                tag_ids=[],
            ),
        )

    create_transaction(
        db_session,
        user.id,
        TransactionCreate(
            account_id=account.id,
            type=TransactionType.EXPENSE,
            amount=80,
            currency="USD",
            category_id=category.id,
            merchant_name="Coffee Lab",
            description="Outlier coffee",
            transaction_date=date.today(),
            posting_date=date.today(),
            notes=None,
            source_type=SourceType.MANUAL,
            fx_rate=1,
            amount_in_base_currency=80,
            splits=[],
            tag_ids=[],
        ),
    )

    processed_first = process_outbox_events()
    processed_second = process_outbox_events()
    anomaly_notifications = (
        db_session.query(Notification)
        .filter(Notification.owner_id == user.id, Notification.type == NotificationType.ANOMALY)
        .all()
    )

    assert processed_first > 0
    assert processed_second == 0
    assert len(anomaly_notifications) == 1
    assert "baseline" in anomaly_notifications[0].body.lower()
