from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, Asset, AssetHolding, AssetPriceHistory, Deposit, OutboxEvent
from app.models.enums import AccountType, AssetType
from app.schemas.portfolio import (
    AssetChartPoint,
    AssetChartResponse,
    AssetCreate,
    AssetInstrumentOption,
    AssetPosition,
    AssetPriceUpdate,
    DepositCreate,
    DepositUpdate,
    DepositSummary,
    AssetUpdate,
)
from app.services.ledger import write_audit
from app.services.market_data import fetch_chart, fetch_latest_price, provider_for_asset_type, search_instruments


def create_asset(db: Session, owner_id: str, payload: AssetCreate, base_currency: str) -> Asset:
    tracking_provider = payload.tracking_provider or provider_for_asset_type(payload.type)
    current_price = payload.current_price
    current_price_in_base = payload.current_price_in_base
    if payload.tracking_enabled and tracking_provider:
        asset_stub = Asset(
            owner_id=owner_id,
            name=payload.name,
            symbol=payload.symbol,
            type=payload.type,
            currency=payload.currency.upper(),
            tracking_enabled=payload.tracking_enabled,
            tracking_provider=tracking_provider,
            tracking_external_id=payload.tracking_external_id,
            tracking_symbol=(payload.tracking_symbol or payload.symbol),
        )
        snapshot = fetch_latest_price(asset_stub, base_currency.upper())
        current_price = snapshot.price
        current_price_in_base = snapshot.price_in_base
    current_value = payload.quantity * current_price_in_base
    linked_account = _create_linked_asset_account(db, owner_id, payload)
    asset = Asset(
        owner_id=owner_id,
        name=payload.name,
        symbol=payload.symbol,
        linked_account_id=linked_account.id,
        type=payload.type,
        currency=payload.currency.upper(),
        quantity=payload.quantity,
        average_buy_price=payload.average_buy_price,
        average_buy_price_in_base=payload.average_buy_price_in_base,
        current_price=current_price,
        current_price_in_base=current_price_in_base,
        current_value_in_base=current_value,
        invested_amount_in_base=payload.invested_amount_in_base,
        risk_label=payload.risk_label,
        liquidity_label=payload.liquidity_label,
        tracking_enabled=payload.tracking_enabled,
        tracking_provider=tracking_provider,
        tracking_external_id=payload.tracking_external_id,
        tracking_symbol=(payload.tracking_symbol or payload.symbol),
        valuation_source="market" if payload.tracking_enabled and tracking_provider else "manual",
        rental_enabled=payload.rental_enabled,
        rental_income_monthly=payload.rental_income_monthly,
        rental_payment_frequency=payload.rental_payment_frequency,
        rental_payment_day=payload.rental_payment_day,
        notes=payload.notes,
    )
    db.add(asset)
    db.flush()
    if payload.quantity:
        db.add(
            AssetHolding(
                owner_id=owner_id,
                asset_id=asset.id,
                acquired_on=date.today(),
                quantity=payload.quantity,
                unit_cost=payload.average_buy_price,
                unit_cost_in_base=payload.average_buy_price_in_base,
                notes="Initial position",
            )
        )
    if current_price_in_base:
        db.add(
            AssetPriceHistory(
                owner_id=owner_id,
                asset_id=asset.id,
                priced_at=date.today(),
                price=current_price,
                price_in_base=current_price_in_base,
                source="market" if payload.tracking_enabled and tracking_provider else "manual",
            )
        )
    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type="asset.created",
            entity_type="asset",
            entity_id=asset.id,
            payload={"current_value_in_base": current_value},
        )
    )
    linked_account.current_balance = round(payload.quantity * current_price, 2)
    linked_account.opening_balance = linked_account.current_balance
    db.add(linked_account)
    db.commit()
    db.refresh(asset)
    return asset


def update_asset(db: Session, owner_id: str, asset_id: str, payload: AssetUpdate, base_currency: str) -> Asset:
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.owner_id == owner_id))
    if not asset:
        raise ValueError("Asset not found")
    before_json = {
        "name": asset.name,
        "symbol": asset.symbol,
        "type": asset.type.value,
        "currency": asset.currency,
        "quantity": float(asset.quantity or 0),
        "average_buy_price": float(asset.average_buy_price or 0),
        "current_price_in_base": float(asset.current_price_in_base or 0),
        "rental_enabled": asset.rental_enabled,
        "rental_income_monthly": float(asset.rental_income_monthly or 0),
    }
    tracking_provider = payload.tracking_provider or (provider_for_asset_type(payload.type) if payload.tracking_enabled else None)
    current_price = payload.current_price
    current_price_in_base = payload.current_price_in_base
    if payload.tracking_enabled and tracking_provider:
        asset_stub = Asset(
            owner_id=owner_id,
            name=payload.name,
            symbol=payload.symbol,
            type=payload.type,
            currency=payload.currency.upper(),
            tracking_enabled=True,
            tracking_provider=tracking_provider,
            tracking_external_id=payload.tracking_external_id,
            tracking_symbol=(payload.tracking_symbol or payload.symbol),
        )
        snapshot = fetch_latest_price(asset_stub, base_currency.upper())
        current_price = snapshot.price
        current_price_in_base = snapshot.price_in_base

    asset.name = payload.name
    asset.symbol = payload.symbol
    asset.type = payload.type
    asset.currency = payload.currency.upper()
    asset.quantity = payload.quantity
    asset.average_buy_price = payload.average_buy_price
    asset.average_buy_price_in_base = payload.average_buy_price_in_base
    asset.current_price = current_price
    asset.current_price_in_base = current_price_in_base
    asset.current_value_in_base = round(payload.quantity * current_price_in_base, 2)
    asset.invested_amount_in_base = payload.invested_amount_in_base
    asset.risk_label = payload.risk_label
    asset.liquidity_label = payload.liquidity_label
    asset.tracking_enabled = payload.tracking_enabled
    asset.tracking_provider = tracking_provider
    asset.tracking_external_id = payload.tracking_external_id
    asset.tracking_symbol = payload.tracking_symbol or payload.symbol
    asset.valuation_source = "market" if payload.tracking_enabled and tracking_provider else "manual"
    asset.rental_enabled = payload.rental_enabled
    asset.rental_income_monthly = payload.rental_income_monthly
    asset.rental_payment_frequency = payload.rental_payment_frequency
    asset.rental_payment_day = payload.rental_payment_day
    asset.notes = payload.notes
    db.add(asset)
    db.add(
        AssetPriceHistory(
            owner_id=owner_id,
            asset_id=asset.id,
            priced_at=date.today(),
            price=current_price,
            price_in_base=current_price_in_base,
            source="market" if payload.tracking_enabled and tracking_provider else "manual",
        )
    )
    initial_holding = db.scalar(
        select(AssetHolding).where(AssetHolding.asset_id == asset.id, AssetHolding.owner_id == owner_id).order_by(AssetHolding.created_at.asc())
    )
    if initial_holding:
        initial_holding.quantity = payload.quantity
        initial_holding.unit_cost = payload.average_buy_price
        initial_holding.unit_cost_in_base = payload.average_buy_price_in_base
        db.add(initial_holding)

    if asset.linked_account_id:
        linked_account = db.scalar(select(Account).where(Account.id == asset.linked_account_id, Account.owner_id == owner_id))
        if linked_account:
            linked_account.name = f"Актив · {asset.name}"
            linked_account.type = _asset_account_type_for(asset.type)
            linked_account.currency = asset.currency
            linked_account.institution_name = tracking_provider or "AssetFlow"
            linked_account.current_balance = round(float(asset.quantity) * float(asset.current_price), 2)
            linked_account.opening_balance = linked_account.current_balance
            db.add(linked_account)

    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type="asset.updated",
            entity_type="asset",
            entity_id=asset.id,
            payload={"current_value_in_base": float(asset.current_value_in_base)},
        )
    )
    write_audit(
        db,
        owner_id,
        owner_id,
        "asset",
        asset.id,
        "updated",
        before_json,
        {
            "name": asset.name,
            "symbol": asset.symbol,
            "type": asset.type.value,
            "currency": asset.currency,
            "quantity": float(asset.quantity or 0),
            "average_buy_price": float(asset.average_buy_price or 0),
            "current_price_in_base": float(asset.current_price_in_base or 0),
            "rental_enabled": asset.rental_enabled,
            "rental_income_monthly": float(asset.rental_income_monthly or 0),
        },
    )
    db.commit()
    db.refresh(asset)
    return asset


def archive_asset(db: Session, owner_id: str, asset_id: str) -> None:
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.owner_id == owner_id))
    if not asset:
        raise ValueError("Asset not found")
    if asset.is_archived:
        return
    asset.is_archived = True
    if asset.linked_account_id:
        linked_account = db.scalar(select(Account).where(Account.id == asset.linked_account_id, Account.owner_id == owner_id))
        if linked_account:
            linked_account.is_archived = True
            db.add(linked_account)
    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type="asset.archived",
            entity_type="asset",
            entity_id=asset.id,
            payload={"name": asset.name},
        )
    )
    write_audit(
        db,
        owner_id,
        owner_id,
        "asset",
        asset.id,
        "archived",
        {"name": asset.name, "current_value_in_base": float(asset.current_value_in_base or 0)},
        {"is_archived": True},
    )
    db.add(asset)
    db.commit()


def update_asset_price(db: Session, owner_id: str, asset_id: str, payload: AssetPriceUpdate) -> Asset:
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.owner_id == owner_id))
    if not asset:
        raise ValueError("Asset not found")
    asset.current_price = payload.price
    asset.current_price_in_base = payload.price_in_base
    asset.current_value_in_base = round(float(asset.quantity) * payload.price_in_base, 2)
    asset.valuation_source = payload.source
    db.add(asset)
    db.add(
        AssetPriceHistory(
            owner_id=owner_id,
            asset_id=asset.id,
            priced_at=payload.priced_at,
            price=payload.price,
            price_in_base=payload.price_in_base,
            source=payload.source,
        )
    )
    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type="asset.price_updated",
            entity_type="asset",
            entity_id=asset.id,
            payload={"price_in_base": payload.price_in_base},
        )
    )
    if asset.linked_account_id:
        linked_account = db.scalar(
            select(Account).where(Account.id == asset.linked_account_id, Account.owner_id == owner_id)
        )
        if linked_account:
            linked_account.current_balance = round(float(asset.quantity) * payload.price, 2)
            db.add(linked_account)
    db.commit()
    db.refresh(asset)
    return asset


def list_positions(db: Session, owner_id: str) -> list[AssetPosition]:
    assets = db.scalars(select(Asset).where(Asset.owner_id == owner_id, Asset.is_archived.is_(False))).all()
    linked_accounts = {
        account.id: account
        for account in db.scalars(select(Account).where(Account.owner_id == owner_id, Account.is_archived.is_(False))).all()
    }
    total_value = sum(float(asset.current_value_in_base or 0) for asset in assets) or 1
    positions = []
    for asset in assets:
        current_value = float(asset.current_value_in_base or 0)
        invested = float(asset.invested_amount_in_base or 0)
        linked_account = linked_accounts.get(asset.linked_account_id) if asset.linked_account_id else None
        positions.append(
            AssetPosition(
                id=asset.id,
                name=asset.name,
                symbol=asset.symbol,
                type=asset.type,
                currency=asset.currency,
                quantity=float(asset.quantity or 0),
                current_price=float(asset.current_price or 0),
                current_price_in_base=float(asset.current_price_in_base or 0),
                current_value_in_base=current_value,
                invested_amount_in_base=invested,
                unrealized_pnl=round(current_value - invested, 2),
                allocation_pct=round(current_value / total_value * 100, 2),
                tracking_enabled=asset.tracking_enabled,
                tracking_provider=asset.tracking_provider,
                tracking_external_id=asset.tracking_external_id,
                tracking_symbol=asset.tracking_symbol,
                linked_account_id=asset.linked_account_id,
                linked_account_name=linked_account.name if linked_account else None,
                valuation_source=asset.valuation_source,
                rental_enabled=asset.rental_enabled,
                rental_income_monthly=float(asset.rental_income_monthly or 0),
                rental_payment_frequency=asset.rental_payment_frequency,
                rental_payment_day=asset.rental_payment_day,
            )
        )
    return positions


def sync_asset_market_price(db: Session, owner_id: str, asset_id: str, base_currency: str) -> Asset:
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.owner_id == owner_id))
    if not asset:
        raise ValueError("Asset not found")
    snapshot = fetch_latest_price(asset, base_currency)
    return update_asset_price(
        db,
        owner_id,
        asset_id,
        AssetPriceUpdate(
            priced_at=snapshot.priced_at,
            price=snapshot.price,
            price_in_base=snapshot.price_in_base,
            source=snapshot.source,
        ),
    )


def get_asset_chart(db: Session, owner_id: str, asset_id: str, base_currency: str, range_days: int) -> AssetChartResponse:
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.owner_id == owner_id))
    if not asset:
        raise ValueError("Asset not found")
    history = db.scalars(
        select(AssetPriceHistory)
        .where(AssetPriceHistory.asset_id == asset.id, AssetPriceHistory.owner_id == owner_id)
        .order_by(AssetPriceHistory.priced_at.asc())
    ).all()
    points: list[AssetChartPoint]
    if asset.tracking_enabled and asset.tracking_provider:
        remote_points = fetch_chart(asset, base_currency, range_days)
        points = [
            AssetChartPoint(date=item.date, price=round(item.price, 4), price_in_base=round(item.price_in_base, 4))
            for item in remote_points
        ]
    else:
        points = [
            AssetChartPoint(
                date=item.priced_at,
                price=float(item.price),
                price_in_base=float(item.price_in_base),
            )
            for item in history[-max(range_days, 1) :]
        ]
    return AssetChartResponse(asset_id=asset.id, name=asset.name, range_days=range_days, points=points)


def search_asset_instruments(asset_type: AssetType, query: str) -> list[AssetInstrumentOption]:
    if len(query.strip()) < 2:
        return []
    return search_instruments(asset_type, query.strip())


def create_deposit(db: Session, owner_id: str, payload: DepositCreate) -> Deposit:
    linked_account = Account(
        owner_id=owner_id,
        name=payload.name,
        type=AccountType.SAVINGS,
        currency=payload.currency.upper(),
        institution_name=payload.institution_name,
        opening_balance=payload.current_balance,
        current_balance=payload.current_balance,
        include_in_net_worth=True,
        include_in_liquid_balance=False,
        interest_rate=payload.annual_interest_rate,
    )
    db.add(linked_account)
    db.flush()

    deposit = Deposit(
        owner_id=owner_id,
        account_id=linked_account.id,
        funding_account_id=payload.funding_account_id,
        name=payload.name,
        institution_name=payload.institution_name,
        currency=payload.currency.upper(),
        principal_amount=payload.principal_amount,
        current_balance=payload.current_balance,
        annual_interest_rate=payload.annual_interest_rate,
        payout_frequency=payload.payout_frequency,
        capitalization_enabled=payload.capitalization_enabled,
        opened_on=payload.opened_on,
        maturity_date=payload.maturity_date,
        next_payout_date=payload.next_payout_date,
        early_withdrawal_terms=payload.early_withdrawal_terms,
        status="open",
    )
    db.add(deposit)
    db.flush()
    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type="deposit.created",
            entity_type="deposit",
            entity_id=deposit.id,
            payload={"current_balance": payload.current_balance},
        )
    )
    db.commit()
    db.refresh(deposit)
    return deposit


def update_deposit(db: Session, owner_id: str, deposit_id: str, payload: DepositUpdate) -> Deposit:
    deposit = db.scalar(select(Deposit).where(Deposit.id == deposit_id, Deposit.owner_id == owner_id))
    if not deposit:
        raise ValueError("Deposit not found")
    before_json = {
        "name": deposit.name,
        "institution_name": deposit.institution_name,
        "currency": deposit.currency,
        "current_balance": float(deposit.current_balance or 0),
        "annual_interest_rate": float(deposit.annual_interest_rate or 0),
        "status": deposit.status,
    }
    deposit.funding_account_id = payload.funding_account_id
    deposit.name = payload.name
    deposit.institution_name = payload.institution_name
    deposit.currency = payload.currency.upper()
    deposit.principal_amount = payload.principal_amount
    deposit.current_balance = payload.current_balance
    deposit.annual_interest_rate = payload.annual_interest_rate
    deposit.payout_frequency = payload.payout_frequency
    deposit.capitalization_enabled = payload.capitalization_enabled
    deposit.opened_on = payload.opened_on
    deposit.maturity_date = payload.maturity_date
    deposit.next_payout_date = payload.next_payout_date
    deposit.early_withdrawal_terms = payload.early_withdrawal_terms
    deposit.status = payload.status
    db.add(deposit)
    linked_account = db.scalar(select(Account).where(Account.id == deposit.account_id, Account.owner_id == owner_id))
    if linked_account:
        linked_account.name = payload.name
        linked_account.currency = payload.currency.upper()
        linked_account.institution_name = payload.institution_name
        linked_account.current_balance = payload.current_balance
        linked_account.opening_balance = payload.current_balance
        linked_account.interest_rate = payload.annual_interest_rate
        db.add(linked_account)
    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type="deposit.updated",
            entity_type="deposit",
            entity_id=deposit.id,
            payload={"current_balance": payload.current_balance},
        )
    )
    write_audit(
        db,
        owner_id,
        owner_id,
        "deposit",
        deposit.id,
        "updated",
        before_json,
        {
            "name": deposit.name,
            "institution_name": deposit.institution_name,
            "currency": deposit.currency,
            "current_balance": float(deposit.current_balance or 0),
            "annual_interest_rate": float(deposit.annual_interest_rate or 0),
            "status": deposit.status,
        },
    )
    db.commit()
    db.refresh(deposit)
    return deposit


def archive_deposit(db: Session, owner_id: str, deposit_id: str) -> None:
    deposit = db.scalar(select(Deposit).where(Deposit.id == deposit_id, Deposit.owner_id == owner_id))
    if not deposit:
        raise ValueError("Deposit not found")
    if deposit.is_archived:
        return
    deposit.is_archived = True
    deposit.status = "archived"
    linked_account = db.scalar(select(Account).where(Account.id == deposit.account_id, Account.owner_id == owner_id))
    if linked_account:
        linked_account.is_archived = True
        db.add(linked_account)
    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type="deposit.archived",
            entity_type="deposit",
            entity_id=deposit.id,
            payload={"name": deposit.name},
        )
    )
    write_audit(
        db,
        owner_id,
        owner_id,
        "deposit",
        deposit.id,
        "archived",
        {"name": deposit.name, "current_balance": float(deposit.current_balance or 0)},
        {"is_archived": True},
    )
    db.add(deposit)
    db.commit()


def list_deposits(db: Session, owner_id: str) -> list[DepositSummary]:
    deposits = db.scalars(
        select(Deposit).where(Deposit.owner_id == owner_id, Deposit.is_archived.is_(False)).order_by(Deposit.name.asc())
    ).all()
    accounts = {
        account.id: account
        for account in db.scalars(select(Account).where(Account.owner_id == owner_id, Account.is_archived.is_(False))).all()
    }
    return [
        DepositSummary(
            id=deposit.id,
            account_id=deposit.account_id,
            account_name=accounts[deposit.account_id].name if deposit.account_id in accounts else deposit.name,
            funding_account_id=deposit.funding_account_id,
            funding_account_name=accounts[deposit.funding_account_id].name
            if deposit.funding_account_id and deposit.funding_account_id in accounts
            else None,
            name=deposit.name,
            institution_name=deposit.institution_name,
            currency=deposit.currency,
            principal_amount=float(deposit.principal_amount or 0),
            current_balance=float(deposit.current_balance or 0),
            annual_interest_rate=float(deposit.annual_interest_rate or 0),
            payout_frequency=deposit.payout_frequency,
            capitalization_enabled=deposit.capitalization_enabled,
            opened_on=deposit.opened_on,
            maturity_date=deposit.maturity_date,
            next_payout_date=deposit.next_payout_date,
            early_withdrawal_terms=deposit.early_withdrawal_terms,
            status=deposit.status,
        )
        for deposit in deposits
    ]


def _create_linked_asset_account(db: Session, owner_id: str, payload: AssetCreate) -> Account:
    account_type = _asset_account_type_for(payload.type)
    account = Account(
        owner_id=owner_id,
        name=f"Актив · {payload.name}",
        type=account_type,
        currency=payload.currency.upper(),
        institution_name=payload.tracking_provider or "AssetFlow",
        opening_balance=0,
        current_balance=0,
        include_in_net_worth=False,
        include_in_liquid_balance=False,
    )
    db.add(account)
    db.flush()
    return account


def _asset_account_type_for(asset_type: AssetType) -> AccountType:
    if asset_type == AssetType.CRYPTO:
        return AccountType.CRYPTO_WALLET
    if asset_type == AssetType.CASH:
        return AccountType.FX
    return AccountType.BROKERAGE
