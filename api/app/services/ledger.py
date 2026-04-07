from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Account,
    AuditLog,
    MerchantRule,
    OutboxEvent,
    Tag,
    Transaction,
    TransactionSplit,
    TransactionTag,
    TransferGroup,
)
from app.models.enums import AccountType, SourceType, TransactionType
from app.schemas.accounts import AccountCreate, AccountUpdate
from app.schemas.transactions import TransactionCreate, TransactionUpdate, TransferCreate

POSITIVE_ACCOUNT_TYPES = {
    AccountType.CASH,
    AccountType.DEBIT_CARD,
    AccountType.SAVINGS,
    AccountType.BROKERAGE,
    AccountType.CRYPTO_WALLET,
    AccountType.RESERVE,
    AccountType.FX,
}


def create_account(db: Session, owner_id: str, payload: AccountCreate) -> Account:
    account = Account(
        owner_id=owner_id,
        name=payload.name,
        type=payload.type,
        currency=payload.currency.upper(),
        institution_name=payload.institution_name,
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance,
        include_in_net_worth=payload.include_in_net_worth,
        include_in_liquid_balance=payload.include_in_liquid_balance,
        credit_limit=payload.credit_limit,
        interest_rate=payload.interest_rate,
        billing_day=payload.billing_day,
        grace_period_days=payload.grace_period_days,
    )
    db.add(account)
    db.flush()
    emit_event(db, owner_id, "account.created", "account", account.id, {"name": account.name})
    write_audit(db, owner_id, owner_id, "account", account.id, "created", None, {"name": account.name})
    db.commit()
    db.refresh(account)
    return account


def update_account(db: Session, owner_id: str, account_id: str, payload: AccountUpdate) -> Account:
    account = _get_owned_account(db, owner_id, account_id)
    before_json = {
        "name": account.name,
        "type": account.type.value,
        "currency": account.currency,
        "institution_name": account.institution_name,
        "include_in_net_worth": account.include_in_net_worth,
        "include_in_liquid_balance": account.include_in_liquid_balance,
        "credit_limit": float(account.credit_limit) if account.credit_limit is not None else None,
        "interest_rate": float(account.interest_rate) if account.interest_rate is not None else None,
        "billing_day": account.billing_day,
        "grace_period_days": account.grace_period_days,
    }
    account.name = payload.name
    account.type = payload.type
    account.currency = payload.currency.upper()
    account.institution_name = payload.institution_name
    account.include_in_net_worth = payload.include_in_net_worth
    account.include_in_liquid_balance = payload.include_in_liquid_balance
    account.credit_limit = payload.credit_limit
    account.interest_rate = payload.interest_rate
    account.billing_day = payload.billing_day
    account.grace_period_days = payload.grace_period_days
    emit_event(db, owner_id, "account.updated", "account", account.id, {"name": account.name})
    write_audit(
        db,
        owner_id,
        owner_id,
        "account",
        account.id,
        "updated",
        before_json,
        {
            "name": account.name,
            "type": account.type.value,
            "currency": account.currency,
            "institution_name": account.institution_name,
            "include_in_net_worth": account.include_in_net_worth,
            "include_in_liquid_balance": account.include_in_liquid_balance,
            "credit_limit": float(account.credit_limit) if account.credit_limit is not None else None,
            "interest_rate": float(account.interest_rate) if account.interest_rate is not None else None,
            "billing_day": account.billing_day,
            "grace_period_days": account.grace_period_days,
        },
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def archive_account(db: Session, owner_id: str, account_id: str) -> None:
    account = _get_owned_account(db, owner_id, account_id)
    if account.is_archived:
        return
    before_json = {
        "name": account.name,
        "type": account.type.value,
        "currency": account.currency,
        "current_balance": float(account.current_balance),
    }
    account.is_archived = True
    emit_event(db, owner_id, "account.archived", "account", account.id, {"name": account.name})
    write_audit(db, owner_id, owner_id, "account", account.id, "archived", before_json, {"is_archived": True})
    db.add(account)
    db.commit()


def create_transaction(db: Session, owner_id: str, payload: TransactionCreate) -> Transaction:
    account = _get_owned_account(db, owner_id, payload.account_id)
    amount_in_base = payload.amount_in_base_currency or round(payload.amount * payload.fx_rate, 2)
    category_id = payload.category_id or infer_category_id(db, owner_id, payload.merchant_name)

    transaction = Transaction(
        owner_id=owner_id,
        account_id=account.id,
        category_id=category_id,
        linked_asset_id=payload.linked_asset_id,
        type=payload.type,
        status="posted",
        source_type=payload.source_type,
        amount=payload.amount,
        currency=payload.currency.upper(),
        amount_in_base_currency=amount_in_base,
        fx_rate=payload.fx_rate,
        merchant_name=payload.merchant_name,
        description=payload.description,
        transaction_date=payload.transaction_date,
        posting_date=payload.posting_date or payload.transaction_date,
        notes=payload.notes,
    )
    apply_account_delta(account, payload.type, float(payload.amount))
    db.add(transaction)
    db.flush()

    for split in payload.splits:
        split_base = round(amount_in_base * (split.amount / payload.amount), 2) if payload.amount else 0
        db.add(
            TransactionSplit(
                owner_id=owner_id,
                transaction_id=transaction.id,
                category_id=split.category_id,
                amount=split.amount,
                amount_in_base_currency=split_base,
                note=split.note,
            )
        )

    for tag_id in payload.tag_ids:
        tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.owner_id == owner_id))
        if tag:
            db.add(TransactionTag(transaction_id=transaction.id, tag_id=tag.id))

    emit_event(
        db,
        owner_id,
        "transaction.created",
        "transaction",
        transaction.id,
        {
            "account_id": transaction.account_id,
            "amount_in_base_currency": float(transaction.amount_in_base_currency),
            "type": transaction.type.value,
        },
    )
    write_audit(
        db,
        owner_id,
        owner_id,
        "transaction",
        transaction.id,
        "created",
        None,
        {
            "type": transaction.type.value,
            "amount": float(transaction.amount),
            "account_id": transaction.account_id,
        },
    )
    remember_merchant_rule(db, owner_id, payload.merchant_name, category_id, payload.source_type)
    db.add(account)
    db.commit()
    db.refresh(transaction)
    return transaction


def update_transaction(
    db: Session,
    owner_id: str,
    transaction_id: str,
    payload: TransactionUpdate,
) -> Transaction:
    transaction = _get_owned_transaction(db, owner_id, transaction_id)
    if transaction.transfer_group_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer rows must be changed through transfer flow",
        )

    before_json = _transaction_snapshot(transaction)
    previous_account = _get_owned_account(db, owner_id, transaction.account_id)
    next_account = _get_owned_account(db, owner_id, payload.account_id)

    reverse_account_delta(previous_account, transaction.type, float(transaction.amount))

    amount_in_base = payload.amount_in_base_currency or round(payload.amount * payload.fx_rate, 2)
    category_id = payload.category_id or infer_category_id(db, owner_id, payload.merchant_name)

    transaction.account_id = next_account.id
    transaction.category_id = category_id
    transaction.linked_asset_id = payload.linked_asset_id
    transaction.type = payload.type
    transaction.source_type = payload.source_type
    transaction.amount = payload.amount
    transaction.currency = payload.currency.upper()
    transaction.amount_in_base_currency = amount_in_base
    transaction.fx_rate = payload.fx_rate
    transaction.merchant_name = payload.merchant_name
    transaction.description = payload.description
    transaction.transaction_date = payload.transaction_date
    transaction.posting_date = payload.posting_date or payload.transaction_date
    transaction.notes = payload.notes

    apply_account_delta(next_account, payload.type, float(payload.amount))

    existing_splits = db.scalars(select(TransactionSplit).where(TransactionSplit.transaction_id == transaction.id)).all()
    for split in existing_splits:
        db.delete(split)

    existing_tags = db.scalars(select(TransactionTag).where(TransactionTag.transaction_id == transaction.id)).all()
    for tag in existing_tags:
        db.delete(tag)

    for split in payload.splits:
        split_base = round(amount_in_base * (split.amount / payload.amount), 2) if payload.amount else 0
        db.add(
            TransactionSplit(
                owner_id=owner_id,
                transaction_id=transaction.id,
                category_id=split.category_id,
                amount=split.amount,
                amount_in_base_currency=split_base,
                note=split.note,
            )
        )

    for tag_id in payload.tag_ids:
        tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.owner_id == owner_id))
        if tag:
            db.add(TransactionTag(transaction_id=transaction.id, tag_id=tag.id))

    emit_event(
        db,
        owner_id,
        "transaction.updated",
        "transaction",
        transaction.id,
        {
            "account_id": transaction.account_id,
            "amount_in_base_currency": float(transaction.amount_in_base_currency),
            "type": transaction.type.value,
        },
    )
    write_audit(
        db,
        owner_id,
        owner_id,
        "transaction",
        transaction.id,
        "updated",
        before_json,
        _transaction_snapshot(transaction),
    )
    remember_merchant_rule(db, owner_id, payload.merchant_name, category_id, payload.source_type)
    db.add(previous_account)
    if previous_account.id != next_account.id:
        db.add(next_account)
    db.commit()
    db.refresh(transaction)
    return transaction


def delete_transaction(db: Session, owner_id: str, transaction_id: str) -> None:
    transaction = _get_owned_transaction(db, owner_id, transaction_id)
    if transaction.transfer_group_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer rows must be changed through transfer flow",
        )

    account = _get_owned_account(db, owner_id, transaction.account_id)
    before_json = _transaction_snapshot(transaction)
    reverse_account_delta(account, transaction.type, float(transaction.amount))

    existing_splits = db.scalars(select(TransactionSplit).where(TransactionSplit.transaction_id == transaction.id)).all()
    for split in existing_splits:
        db.delete(split)

    existing_tags = db.scalars(select(TransactionTag).where(TransactionTag.transaction_id == transaction.id)).all()
    for tag in existing_tags:
        db.delete(tag)

    emit_event(
        db,
        owner_id,
        "transaction.deleted",
        "transaction",
        transaction.id,
        {
            "account_id": transaction.account_id,
            "amount_in_base_currency": float(transaction.amount_in_base_currency),
            "type": transaction.type.value,
        },
    )
    write_audit(
        db,
        owner_id,
        owner_id,
        "transaction",
        transaction.id,
        "deleted",
        before_json,
        None,
    )
    db.delete(transaction)
    db.add(account)
    db.commit()


def create_transfer(db: Session, owner_id: str, payload: TransferCreate) -> list[Transaction]:
    if payload.from_account_id == payload.to_account_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Accounts must differ")
    from_account = _get_owned_account(db, owner_id, payload.from_account_id)
    to_account = _get_owned_account(db, owner_id, payload.to_account_id)
    amount_in_base = payload.amount_in_base_currency or round(payload.amount * payload.fx_rate, 2)

    group = TransferGroup(owner_id=owner_id, notes=payload.description)
    db.add(group)
    db.flush()

    outbound = Transaction(
        owner_id=owner_id,
        account_id=from_account.id,
        linked_account_id=to_account.id,
        transfer_group_id=group.id,
        type=TransactionType.TRANSFER_OUT,
        source_type=SourceType.MANUAL,
        amount=payload.amount,
        currency=payload.currency.upper(),
        amount_in_base_currency=amount_in_base,
        fx_rate=payload.fx_rate,
        description=payload.description,
        transaction_date=payload.transaction_date,
        posting_date=payload.transaction_date,
    )
    inbound = Transaction(
        owner_id=owner_id,
        account_id=to_account.id,
        linked_account_id=from_account.id,
        transfer_group_id=group.id,
        type=TransactionType.TRANSFER_IN,
        source_type=SourceType.MANUAL,
        amount=payload.amount,
        currency=payload.currency.upper(),
        amount_in_base_currency=amount_in_base,
        fx_rate=payload.fx_rate,
        description=payload.description,
        transaction_date=payload.transaction_date,
        posting_date=payload.transaction_date,
    )
    apply_account_delta(from_account, TransactionType.TRANSFER_OUT, float(payload.amount))
    apply_account_delta(to_account, TransactionType.TRANSFER_IN, float(payload.amount))
    db.add_all([outbound, inbound, from_account, to_account])
    db.flush()
    emit_event(db, owner_id, "transfer.created", "transfer_group", group.id, {"amount": amount_in_base})
    write_audit(
        db,
        owner_id,
        owner_id,
        "transfer_group",
        group.id,
        "created",
        None,
        {"from_account_id": from_account.id, "to_account_id": to_account.id, "amount": payload.amount},
    )
    db.commit()
    return [outbound, inbound]


def generate_due_recurring_transactions(db: Session, owner_id: str | None = None) -> int:
    from app.models import RecurringTransaction

    today = date.today()
    query = select(RecurringTransaction).where(
        RecurringTransaction.is_active.is_(True),
        RecurringTransaction.next_due_date <= today,
    )
    if owner_id:
        query = query.where(RecurringTransaction.owner_id == owner_id)
    recurring_items = db.scalars(query).all()
    count = 0
    for item in recurring_items:
        create_transaction(
            db,
            item.owner_id,
            TransactionCreate(
                account_id=item.account_id,
                type=TransactionType.EXPENSE,
                amount=float(item.amount),
                currency=item.currency,
                category_id=item.category_id,
                merchant_name=item.merchant_name,
                description=item.name,
                transaction_date=item.next_due_date,
                posting_date=item.next_due_date,
                notes=item.notes,
                source_type=SourceType.SYSTEM,
                amount_in_base_currency=float(item.amount_in_base_currency),
            ),
        )
        item.next_due_date = _advance_due_date(item.next_due_date, item.frequency.value, item.interval_count)
        db.add(item)
        count += 1
    db.commit()
    return count


def infer_category_id(db: Session, owner_id: str, merchant_name: str | None) -> str | None:
    if not merchant_name:
        return None
    rules = db.scalars(
        select(MerchantRule)
        .where(MerchantRule.owner_id == owner_id, MerchantRule.is_active.is_(True))
        .order_by(MerchantRule.priority.asc())
    ).all()
    merchant_lower = merchant_name.lower()
    for rule in rules:
        if rule.pattern.lower() in merchant_lower:
            return rule.category_id
    return None


def remember_merchant_rule(
    db: Session,
    owner_id: str,
    merchant_name: str | None,
    category_id: str | None,
    source_type: SourceType,
) -> None:
    if source_type != SourceType.MANUAL or not merchant_name or not category_id:
        return
    normalized_pattern = merchant_name.strip().lower()
    if not normalized_pattern:
        return
    rule = db.scalar(
        select(MerchantRule).where(
            MerchantRule.owner_id == owner_id,
            MerchantRule.pattern == normalized_pattern,
        )
    )
    if not rule:
        db.add(
            MerchantRule(
                owner_id=owner_id,
                pattern=normalized_pattern,
                category_id=category_id,
                priority=25,
                is_active=True,
            )
        )
        return
    rule.category_id = category_id
    rule.priority = 25
    rule.is_active = True
    db.add(rule)


def apply_account_delta(account: Account, transaction_type: TransactionType, amount: float) -> None:
    current = float(account.current_balance)
    if transaction_type in {
        TransactionType.INCOME,
        TransactionType.INTEREST,
        TransactionType.DIVIDEND,
        TransactionType.TRANSFER_IN,
        TransactionType.ASSET_SELL,
    }:
        account.current_balance = current + amount
    elif transaction_type in {
        TransactionType.EXPENSE,
        TransactionType.FEE,
        TransactionType.TAX,
        TransactionType.TRANSFER_OUT,
        TransactionType.DEBT_PAYMENT,
        TransactionType.ASSET_BUY,
    }:
        account.current_balance = current - amount
    elif transaction_type == TransactionType.ADJUSTMENT:
        account.current_balance = current + amount


def reverse_account_delta(account: Account, transaction_type: TransactionType, amount: float) -> None:
    current = float(account.current_balance)
    if transaction_type in {
        TransactionType.INCOME,
        TransactionType.INTEREST,
        TransactionType.DIVIDEND,
        TransactionType.TRANSFER_IN,
        TransactionType.ASSET_SELL,
    }:
        account.current_balance = current - amount
    elif transaction_type in {
        TransactionType.EXPENSE,
        TransactionType.FEE,
        TransactionType.TAX,
        TransactionType.TRANSFER_OUT,
        TransactionType.DEBT_PAYMENT,
        TransactionType.ASSET_BUY,
    }:
        account.current_balance = current + amount
    elif transaction_type == TransactionType.ADJUSTMENT:
        account.current_balance = current - amount


def emit_event(
    db: Session,
    owner_id: str,
    event_type: str,
    entity_type: str,
    entity_id: str,
    payload: dict,
) -> None:
    db.add(
        OutboxEvent(
            owner_id=owner_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
    )


def write_audit(
    db: Session,
    owner_id: str,
    actor_user_id: str | None,
    entity_type: str,
    entity_id: str,
    action: str,
    before_json: dict | None,
    after_json: dict | None,
) -> None:
    db.add(
        AuditLog(
            owner_id=owner_id,
            actor_user_id=actor_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            before_json=before_json,
            after_json=after_json,
            occurred_at=datetime.now(tz=timezone.utc),
        )
    )


def _advance_due_date(current: date, frequency: str, interval_count: int) -> date:
    if frequency == "weekly":
        return current + timedelta(weeks=interval_count)
    if frequency == "yearly":
        return current.replace(year=current.year + interval_count)
    month = current.month - 1 + interval_count
    year = current.year + month // 12
    month = month % 12 + 1
    return current.replace(year=year, month=month)


def _get_owned_account(db: Session, owner_id: str, account_id: str) -> Account:
    account = db.scalar(select(Account).where(Account.id == account_id, Account.owner_id == owner_id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def _get_owned_transaction(db: Session, owner_id: str, transaction_id: str) -> Transaction:
    transaction = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.owner_id == owner_id))
    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return transaction


def _transaction_snapshot(transaction: Transaction) -> dict:
    return {
        "account_id": transaction.account_id,
        "category_id": transaction.category_id,
        "type": transaction.type.value,
        "amount": float(transaction.amount),
        "currency": transaction.currency,
        "amount_in_base_currency": float(transaction.amount_in_base_currency),
        "merchant_name": transaction.merchant_name,
        "description": transaction.description,
        "transaction_date": transaction.transaction_date.isoformat(),
        "posting_date": transaction.posting_date.isoformat(),
        "notes": transaction.notes,
    }
