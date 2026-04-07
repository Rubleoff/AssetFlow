from app.models import OutboxEvent, User
from app.models.enums import RoleEnum


def test_register_seed_and_create_transaction(client) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "demo@example.com",
            "full_name": "Demo User",
            "password": "strong-pass-123",
            "base_currency": "USD",
            "timezone": "UTC",
        },
    )
    assert response.status_code == 200
    cookies = response.cookies

    me = client.get("/api/users/me", cookies=cookies)
    assert me.status_code == 200
    user = me.json()
    assert user["email"] == "demo@example.com"

    accounts = client.get("/api/accounts", cookies=cookies)
    assert accounts.status_code == 200
    account_id = accounts.json()[0]["id"]

    categories = client.get("/api/categories", cookies=cookies)
    assert categories.status_code == 200
    expense_category = next(item for item in categories.json() if item["direction"] == "expense")

    create_tx = client.post(
        "/api/transactions",
        cookies=cookies,
        json={
            "account_id": account_id,
            "type": "expense",
            "amount": 25,
            "currency": "USD",
            "category_id": expense_category["id"],
            "merchant_name": "Coffee Lab",
            "description": "Coffee",
            "transaction_date": "2026-04-07",
            "posting_date": "2026-04-07",
            "notes": "Test transaction",
            "source_type": "manual",
            "fx_rate": 1,
            "amount_in_base_currency": 25,
            "splits": [],
            "tag_ids": [],
        },
    )
    assert create_tx.status_code == 200

    overview = client.get("/api/reports/overview", cookies=cookies)
    assert overview.status_code == 200
    assert "monthly_expenses" in overview.json()


def test_preview_and_apply_import_flow(client, db_session) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "imports@example.com",
            "full_name": "Import User",
            "password": "strong-pass-123",
            "base_currency": "USD",
            "timezone": "UTC",
        },
    )
    cookies = response.cookies
    account_id = client.get("/api/accounts", cookies=cookies).json()[0]["id"]

    preview = client.post(
        "/api/imports/preview",
        cookies=cookies,
        json={
            "filename": "bank.csv",
            "rows": [
                {
                    "amount": 33.5,
                    "currency": "USD",
                    "merchant_name": "Paper & Bean",
                    "transaction_date": "2026-04-05",
                    "description": "Supplies",
                },
                {
                    "amount": 39,
                    "currency": "USD",
                    "merchant_name": "Streaming+",
                    "transaction_date": "2026-04-02",
                    "description": "Duplicate subscription",
                },
            ],
        },
    )
    assert preview.status_code == 200
    job_id = preview.json()["job_id"]

    detail = client.get(f"/api/imports/{job_id}", cookies=cookies)
    assert detail.status_code == 200
    rows = detail.json()["rows"]
    duplicate_row = next(row for row in rows if row["status"] == "duplicate")

    apply = client.post(
        f"/api/imports/{job_id}/apply",
        cookies=cookies,
        json={
            "account_id": account_id,
            "type": "expense",
            "source_type": "imported",
            "force_duplicate_row_ids": [duplicate_row["id"]],
        },
    )
    assert apply.status_code == 200
    assert apply.json()["imported_count"] == 2

    transactions = client.get("/api/transactions", cookies=cookies)
    assert transactions.status_code == 200
    assert len(transactions.json()) >= 3


def test_admin_failed_outbox_diagnostics_and_retry(client, db_session) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "admin@example.com",
            "full_name": "Admin User",
            "password": "strong-pass-123",
            "base_currency": "USD",
            "timezone": "UTC",
        },
    )
    cookies = response.cookies
    user = db_session.query(User).filter(User.email == "admin@example.com").one()
    user.role = RoleEnum.ADMIN
    db_session.add(user)
    db_session.add(
        OutboxEvent(
            owner_id=user.id,
            event_type="unknown.event",
            entity_type="test",
            entity_id="bad-event",
            payload={"bad": True},
        )
    )
    db_session.commit()

    for _ in range(3):
        process = client.post("/api/admin/outbox/process", cookies=cookies)
        assert process.status_code == 200

    jobs = client.get("/api/admin/jobs", cookies=cookies)
    assert jobs.status_code == 200
    assert jobs.json()["failed_outbox"] >= 1

    outbox = client.get("/api/admin/outbox", cookies=cookies)
    assert outbox.status_code == 200
    assert any(item["last_error"] for item in outbox.json())

    retry = client.post("/api/admin/outbox/retry-failed", cookies=cookies)
    assert retry.status_code == 200
    assert retry.json()["retried_count"] >= 1


def test_settings_rules_audit_and_report_exports(client) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "settings@example.com",
            "full_name": "Settings User",
            "password": "strong-pass-123",
            "base_currency": "USD",
            "timezone": "UTC",
        },
    )
    assert response.status_code == 200
    cookies = response.cookies

    patch_me = client.patch(
        "/api/users/me",
        cookies=cookies,
        json={
            "full_name": "Settings User Updated",
            "base_currency": "EUR",
            "timezone": "Europe/Moscow",
            "notification_preferences": {"daily_digest": True, "anomaly_alerts": False},
            "import_preferences": {"csv_delimiter": ";", "default_import_type": "expense"},
        },
    )
    assert patch_me.status_code == 200
    assert patch_me.json()["base_currency"] == "EUR"
    assert patch_me.json()["notification_preferences"]["anomaly_alerts"] is False

    categories = client.get("/api/categories", cookies=cookies)
    category_id = next(item for item in categories.json() if item["direction"] == "expense")["id"]

    create_rule = client.post(
        "/api/users/me/merchant-rules",
        cookies=cookies,
        json={
            "pattern": "coffee lab",
            "category_id": category_id,
            "tag_names": [],
            "priority": 15,
            "is_active": True,
        },
    )
    assert create_rule.status_code == 200
    rule_id = create_rule.json()["id"]

    update_rule = client.patch(
        f"/api/users/me/merchant-rules/{rule_id}",
        cookies=cookies,
        json={
            "pattern": "coffee lab premium",
            "category_id": category_id,
            "tag_names": [],
            "priority": 20,
            "is_active": False,
        },
    )
    assert update_rule.status_code == 200
    assert update_rule.json()["is_active"] is False

    audit = client.get("/api/users/me/audit?limit=20", cookies=cookies)
    assert audit.status_code == 200
    assert any(entry["entity_type"] == "merchant_rule" for entry in audit.json())
    assert any(entry["entity_type"] == "user" for entry in audit.json())

    accounts = client.get("/api/accounts", cookies=cookies)
    account_id = accounts.json()[0]["id"]
    create_tx = client.post(
        "/api/transactions",
        cookies=cookies,
        json={
            "account_id": account_id,
            "type": "expense",
            "amount": 18,
            "currency": "EUR",
            "category_id": category_id,
            "merchant_name": "Coffee Lab Premium",
            "description": "Coffee",
            "transaction_date": "2026-04-07",
            "posting_date": "2026-04-07",
            "notes": "Report coverage",
            "source_type": "manual",
            "fx_rate": 1,
            "amount_in_base_currency": 18,
            "splits": [],
            "tag_ids": [],
        },
    )
    assert create_tx.status_code == 200

    categories_report = client.get("/api/reports/categories", cookies=cookies)
    assert categories_report.status_code == 200
    assert isinstance(categories_report.json(), list)

    merchants_report = client.get("/api/reports/merchants", cookies=cookies)
    assert merchants_report.status_code == 200
    assert "merchants" in merchants_report.json()

    net_worth_report = client.get("/api/reports/net-worth", cookies=cookies)
    assert net_worth_report.status_code == 200
    assert isinstance(net_worth_report.json(), list)

    allocation_report = client.get("/api/reports/allocation", cookies=cookies)
    assert allocation_report.status_code == 200
    assert "allocations" in allocation_report.json()

    export_csv = client.get("/api/reports/export/transactions.csv", cookies=cookies)
    assert export_csv.status_code == 200
    assert "transaction_date,posting_date,type" in export_csv.text

    delete_rule = client.delete(f"/api/users/me/merchant-rules/{rule_id}", cookies=cookies)
    assert delete_rule.status_code == 200


def test_goal_contribution_creates_system_transaction_and_updates_progress(client) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "goals@example.com",
            "full_name": "Goal User",
            "password": "strong-pass-123",
            "base_currency": "RUB",
            "timezone": "Europe/Moscow",
        },
    )
    assert response.status_code == 200
    cookies = response.cookies

    accounts = client.get("/api/accounts", cookies=cookies)
    assert accounts.status_code == 200
    account_id = accounts.json()[0]["id"]

    create_goal = client.post(
        "/api/goals",
        cookies=cookies,
        json={
            "title": "Подушка безопасности",
            "target_amount": 120000,
            "currency": "RUB",
            "deadline": "2026-12-31",
            "linked_account_id": account_id,
            "monthly_contribution_target": 10000,
            "priority": 1,
            "status": "active",
            "progress_amount": 0,
            "progress_amount_in_base_currency": 0,
            "target_amount_in_base_currency": 120000,
        },
    )
    assert create_goal.status_code == 200
    goal_id = create_goal.json()["id"]

    contribute = client.post(
        f"/api/goals/{goal_id}/contributions",
        cookies=cookies,
        json={
            "amount": 15000,
            "amount_in_base_currency": 15000,
            "account_id": account_id,
            "direction": "fund",
            "contributed_on": "2026-04-07",
        },
    )
    assert contribute.status_code == 200
    assert contribute.json()["saved_amount"] == 15000

    goals = client.get("/api/goals", cookies=cookies)
    assert goals.status_code == 200
    goal = next(item for item in goals.json() if item["id"] == goal_id)
    assert goal["saved_amount"] == 15000

    transactions = client.get("/api/transactions", cookies=cookies)
    assert transactions.status_code == 200
    assert any(
        item["description"] == "Пополнение цели: Подушка безопасности" and item["type"] == "adjustment"
        for item in transactions.json()
    )


def test_assets_chart_and_deposit_flow(client) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "portfolio@example.com",
            "full_name": "Portfolio User",
            "password": "strong-pass-123",
            "base_currency": "RUB",
            "timezone": "Europe/Moscow",
        },
    )
    assert response.status_code == 200
    cookies = response.cookies

    accounts = client.get("/api/accounts", cookies=cookies)
    funding_account_id = accounts.json()[0]["id"]

    create_asset = client.post(
        "/api/assets",
        cookies=cookies,
        json={
            "name": "Bitcoin",
            "type": "crypto",
            "currency": "USD",
            "symbol": "BTC",
            "quantity": 0.2,
            "average_buy_price": 60000,
            "average_buy_price_in_base": 60000,
            "current_price": 65000,
            "current_price_in_base": 65000,
            "invested_amount_in_base": 12000,
            "tracking_enabled": False,
            "rental_enabled": False,
        },
    )
    assert create_asset.status_code == 200
    asset_id = create_asset.json()["id"]

    chart = client.get(f"/api/assets/{asset_id}/chart?range_days=30", cookies=cookies)
    assert chart.status_code == 200
    assert chart.json()["asset_id"] == asset_id
    assert len(chart.json()["points"]) >= 1

    create_deposit = client.post(
        "/api/deposits",
        cookies=cookies,
        json={
            "name": "Вклад на 6 месяцев",
            "institution_name": "Т-Банк",
            "currency": "RUB",
            "principal_amount": 300000,
            "current_balance": 300000,
            "annual_interest_rate": 16,
            "payout_frequency": "monthly",
            "capitalization_enabled": True,
            "opened_on": "2026-04-07",
            "maturity_date": "2026-10-07",
            "next_payout_date": "2026-05-07",
            "funding_account_id": funding_account_id,
        },
    )
    assert create_deposit.status_code == 200

    deposits = client.get("/api/deposits", cookies=cookies)
    assert deposits.status_code == 200
    assert len(deposits.json()) == 1
    assert deposits.json()[0]["funding_account_id"] == funding_account_id

    linked_accounts = client.get("/api/accounts", cookies=cookies)
    assert linked_accounts.status_code == 200
    assert any(item["name"] == "Вклад на 6 месяцев" for item in linked_accounts.json())


def test_edit_and_archive_core_entities(client) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "manage@example.com",
            "full_name": "Manage User",
            "password": "strong-pass-123",
            "base_currency": "RUB",
            "timezone": "Europe/Moscow",
        },
    )
    assert response.status_code == 200
    cookies = response.cookies

    accounts = client.get("/api/accounts", cookies=cookies)
    assert accounts.status_code == 200
    primary_account_id = accounts.json()[0]["id"]

    create_account = client.post(
        "/api/accounts",
        cookies=cookies,
        json={
            "name": "Счёт для правки",
            "type": "debit_card",
            "currency": "RUB",
            "institution_name": "Тест Банк",
            "opening_balance": 1000,
            "include_in_net_worth": True,
            "include_in_liquid_balance": True,
        },
    )
    assert create_account.status_code == 200
    editable_account_id = create_account.json()["id"]

    patch_account = client.patch(
        f"/api/accounts/{editable_account_id}",
        cookies=cookies,
        json={
            "name": "Счёт обновлён",
            "type": "savings",
            "currency": "RUB",
            "institution_name": "Новый Банк",
            "include_in_net_worth": True,
            "include_in_liquid_balance": False,
            "credit_limit": None,
            "interest_rate": 12.5,
            "billing_day": None,
            "grace_period_days": None,
        },
    )
    assert patch_account.status_code == 200
    assert patch_account.json()["name"] == "Счёт обновлён"

    create_asset = client.post(
        "/api/assets",
        cookies=cookies,
        json={
            "name": "Гараж",
            "type": "custom",
            "currency": "RUB",
            "symbol": "GARAGE",
            "quantity": 1,
            "average_buy_price": 500000,
            "average_buy_price_in_base": 500000,
            "current_price": 550000,
            "current_price_in_base": 550000,
            "invested_amount_in_base": 500000,
            "tracking_enabled": False,
            "rental_enabled": False,
            "rental_income_monthly": 0,
        },
    )
    assert create_asset.status_code == 200
    asset_id = create_asset.json()["id"]

    patch_asset = client.patch(
        f"/api/assets/{asset_id}",
        cookies=cookies,
        json={
            "name": "Гараж у дома",
            "type": "custom",
            "currency": "RUB",
            "symbol": "GARAGE",
            "quantity": 1,
            "average_buy_price": 500000,
            "average_buy_price_in_base": 500000,
            "current_price": 600000,
            "current_price_in_base": 600000,
            "invested_amount_in_base": 500000,
            "tracking_enabled": False,
            "tracking_provider": None,
            "tracking_external_id": None,
            "tracking_symbol": None,
            "rental_enabled": False,
            "rental_income_monthly": 0,
            "rental_payment_frequency": None,
            "rental_payment_day": None,
            "notes": "Обновили оценку",
        },
    )
    assert patch_asset.status_code == 200
    assert patch_asset.json()["name"] == "Гараж у дома"

    create_deposit = client.post(
        "/api/deposits",
        cookies=cookies,
        json={
            "name": "Весенний вклад",
            "institution_name": "Тест Банк",
            "currency": "RUB",
            "principal_amount": 100000,
            "current_balance": 100000,
            "annual_interest_rate": 18.0,
            "payout_frequency": "monthly",
            "capitalization_enabled": True,
            "opened_on": "2026-04-01",
            "maturity_date": "2026-10-01",
            "next_payout_date": "2026-05-01",
            "early_withdrawal_terms": "Пересчёт процентов",
            "funding_account_id": primary_account_id,
        },
    )
    assert create_deposit.status_code == 200
    deposit_id = create_deposit.json()["id"]

    patch_deposit = client.patch(
        f"/api/deposits/{deposit_id}",
        cookies=cookies,
        json={
            "name": "Весенний вклад плюс",
            "institution_name": "Тест Банк 2",
            "currency": "RUB",
            "principal_amount": 100000,
            "current_balance": 103000,
            "annual_interest_rate": 19.0,
            "payout_frequency": "monthly",
            "capitalization_enabled": True,
            "opened_on": "2026-04-01",
            "maturity_date": "2026-10-01",
            "next_payout_date": "2026-05-01",
            "early_withdrawal_terms": "Без потери при досрочном закрытии",
            "funding_account_id": primary_account_id,
            "status": "open",
        },
    )
    assert patch_deposit.status_code == 200
    assert patch_deposit.json()["current_balance"] == 103000

    create_goal = client.post(
        "/api/goals",
        cookies=cookies,
        json={
            "title": "Новый ноутбук",
            "target_amount": 120000,
            "currency": "RUB",
            "target_amount_in_base_currency": 120000,
            "deadline": "2026-12-31",
            "linked_account_id": primary_account_id,
            "linked_asset_id": None,
            "monthly_contribution_target": 10000,
            "priority": 2,
            "auto_funding_enabled": False,
        },
    )
    assert create_goal.status_code == 200
    goal_id = create_goal.json()["id"]

    patch_goal = client.patch(
        f"/api/goals/{goal_id}",
        cookies=cookies,
        json={
            "title": "Новый ноутбук Pro",
            "target_amount": 150000,
            "currency": "RUB",
            "target_amount_in_base_currency": 150000,
            "deadline": "2027-01-31",
            "linked_account_id": primary_account_id,
            "linked_asset_id": None,
            "monthly_contribution_target": 12000,
            "priority": 1,
            "auto_funding_enabled": False,
            "status": "active",
        },
    )
    assert patch_goal.status_code == 200
    assert patch_goal.json()["title"] == "Новый ноутбук Pro"

    archive_asset = client.delete(f"/api/assets/{asset_id}", cookies=cookies)
    assert archive_asset.status_code == 200
    assert all(item["id"] != asset_id for item in client.get("/api/assets", cookies=cookies).json())

    archive_deposit = client.delete(f"/api/deposits/{deposit_id}", cookies=cookies)
    assert archive_deposit.status_code == 200
    assert all(item["id"] != deposit_id for item in client.get("/api/deposits", cookies=cookies).json())

    archive_goal = client.delete(f"/api/goals/{goal_id}", cookies=cookies)
    assert archive_goal.status_code == 200
    assert all(item["id"] != goal_id for item in client.get("/api/goals", cookies=cookies).json())

    archive_account = client.delete(f"/api/accounts/{editable_account_id}", cookies=cookies)
    assert archive_account.status_code == 200
    assert all(item["id"] != editable_account_id for item in client.get("/api/accounts", cookies=cookies).json())
