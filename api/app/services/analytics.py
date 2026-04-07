from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import (
    Account,
    Asset,
    Budget,
    Category,
    Goal,
    NetWorthSnapshot,
    Notification,
    RecurringTransaction,
    Transaction,
)
from app.models.enums import AccountType, GoalStatus, InsightSeverity, NotificationType, TransactionType
from app.schemas.common import NetWorthPoint
from app.schemas.planning import BudgetStatus, GoalForecast
from app.schemas.reports import CategoryDynamic, InsightCard, OverviewReport
from app.schemas.users import AllocationPoint, MerchantSpend

ANALYTICS_EXPENSE_TYPES = {
    TransactionType.EXPENSE,
    TransactionType.FEE,
    TransactionType.TAX,
    TransactionType.DEBT_PAYMENT,
    TransactionType.ASSET_BUY,
}
ANALYTICS_INCOME_TYPES = {
    TransactionType.INCOME,
    TransactionType.INTEREST,
    TransactionType.DIVIDEND,
    TransactionType.ASSET_SELL,
}


def compute_budget_status(db: Session, owner_id: str) -> list[BudgetStatus]:
    budgets = db.scalars(select(Budget).where(Budget.owner_id == owner_id, Budget.is_active.is_(True))).all()
    statuses: list[BudgetStatus] = []
    for budget in budgets:
        spent_query = select(func.coalesce(func.sum(Transaction.amount_in_base_currency), 0)).where(
            Transaction.owner_id == owner_id,
            Transaction.transaction_date >= budget.start_date,
            Transaction.transaction_date <= budget.end_date,
            Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
        )
        if budget.category_id:
            spent_query = spent_query.where(Transaction.category_id == budget.category_id)
        spent = float(db.scalar(spent_query) or 0)
        elapsed_days = max((date.today() - budget.start_date).days + 1, 1)
        total_days = max((budget.end_date - budget.start_date).days + 1, 1)
        forecast = spent / elapsed_days * total_days
        utilization = spent / float(budget.amount_in_base_currency or budget.amount or 1) * 100
        statuses.append(
            BudgetStatus(
                id=budget.id,
                name=budget.name,
                amount=float(budget.amount_in_base_currency),
                spent=round(spent, 2),
                forecast_spent=round(forecast, 2),
                utilization_pct=round(utilization, 2),
                period_start=budget.start_date,
                period_end=budget.end_date,
            )
        )
    return statuses


def compute_goal_forecasts(db: Session, owner_id: str) -> list[GoalForecast]:
    goals = db.scalars(select(Goal).where(Goal.owner_id == owner_id, Goal.status != GoalStatus.ARCHIVED)).all()
    monthly_savings = compute_monthly_savings_capacity(db, owner_id)
    result: list[GoalForecast] = []
    for goal in goals:
        target = float(goal.target_amount_in_base_currency)
        progress = float(goal.progress_amount_in_base_currency)
        remaining = max(target - progress, 0)
        required = float(goal.monthly_contribution_target or 0)
        projected = None
        if required > 0:
            projected = int(remaining / required) + (1 if remaining % required else 0)
        elif monthly_savings > 0:
            projected = int(remaining / monthly_savings) + (1 if remaining % monthly_savings else 0)
        progress_pct = round((progress / target * 100) if target else 0, 2)
        result.append(
            GoalForecast(
                id=goal.id,
                title=goal.title,
                status=goal.status,
                currency=goal.currency,
                linked_account_id=goal.linked_account_id,
                linked_asset_id=goal.linked_asset_id,
                deadline=goal.deadline,
                priority=goal.priority,
                monthly_contribution_target=float(goal.monthly_contribution_target or 0),
                auto_funding_enabled=goal.auto_funding_enabled,
                progress_pct=progress_pct,
                saved_amount=round(progress, 2),
                target_amount=round(target, 2),
                remaining_amount=round(remaining, 2),
                required_monthly_contribution=round(required or monthly_savings, 2),
                projected_completion_months=projected,
            )
        )
    return result


def compute_monthly_savings_capacity(db: Session, owner_id: str) -> float:
    today = date.today()
    month_start = today.replace(day=1)
    income = float(
        db.scalar(
            select(func.coalesce(func.sum(Transaction.amount_in_base_currency), 0)).where(
                Transaction.owner_id == owner_id,
                Transaction.transaction_date >= month_start,
                Transaction.type.in_(list(ANALYTICS_INCOME_TYPES)),
            )
        )
        or 0
    )
    fixed_expenses = float(
        db.scalar(
            select(func.coalesce(func.sum(Transaction.amount_in_base_currency), 0))
            .join(Category, Transaction.category_id == Category.id, isouter=True)
            .where(
                Transaction.owner_id == owner_id,
                Transaction.transaction_date >= month_start,
                Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
                or_(Category.is_essential.is_(True), Category.id.is_(None)),
            )
        )
        or 0
    )
    recurring = float(
        db.scalar(
            select(func.coalesce(func.sum(RecurringTransaction.amount_in_base_currency), 0)).where(
                RecurringTransaction.owner_id == owner_id,
                RecurringTransaction.is_active.is_(True),
            )
        )
        or 0
    )
    return round(max(income - fixed_expenses - recurring, 0), 2)


def compute_overview(db: Session, owner_id: str) -> OverviewReport:
    today = date.today()
    month_start = today.replace(day=1)
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    monthly_income = float(
        db.scalar(
            select(func.coalesce(func.sum(Transaction.amount_in_base_currency), 0)).where(
                Transaction.owner_id == owner_id,
                Transaction.transaction_date >= month_start,
                Transaction.type.in_(list(ANALYTICS_INCOME_TYPES)),
            )
        )
        or 0
    )
    monthly_expenses = float(
        db.scalar(
            select(func.coalesce(func.sum(Transaction.amount_in_base_currency), 0)).where(
                Transaction.owner_id == owner_id,
                Transaction.transaction_date >= month_start,
                Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
            )
        )
        or 0
    )
    liquid_balance = float(
        db.scalar(
            select(func.coalesce(func.sum(Account.current_balance), 0)).where(
                Account.owner_id == owner_id,
                Account.include_in_liquid_balance.is_(True),
                Account.is_archived.is_(False),
            )
        )
        or 0
    )
    total_assets = float(
        db.scalar(
            select(func.coalesce(func.sum(Asset.current_value_in_base), 0)).where(
                Asset.owner_id == owner_id, Asset.is_archived.is_(False)
            )
        )
        or 0
    )
    total_liabilities = float(
        db.scalar(
            select(func.coalesce(func.sum(func.abs(Account.current_balance)), 0)).where(
                Account.owner_id == owner_id,
                Account.type.in_([AccountType.CREDIT_CARD, AccountType.LOAN]),
            )
        )
        or 0
    )
    net_worth = liquid_balance + total_assets - total_liabilities
    savings_rate = round(((monthly_income - monthly_expenses) / monthly_income * 100), 2) if monthly_income else 0
    elapsed_days = max(today.day, 1)
    burn_rate = round(monthly_expenses / elapsed_days, 2)
    runway_months = round(liquid_balance / monthly_expenses, 2) if monthly_expenses else None
    essential_monthly = float(
        db.scalar(
            select(func.coalesce(func.sum(Transaction.amount_in_base_currency), 0))
            .join(Category, Transaction.category_id == Category.id, isouter=True)
            .where(
                Transaction.owner_id == owner_id,
                Transaction.transaction_date >= month_start,
                Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
                or_(Category.is_essential.is_(True), Category.id.is_(None)),
            )
        )
        or 0
    )
    emergency_fund_months = round(liquid_balance / essential_monthly, 2) if essential_monthly else None
    monthly_recurring = float(
        db.scalar(
            select(func.coalesce(func.sum(RecurringTransaction.amount_in_base_currency), 0)).where(
                RecurringTransaction.owner_id == owner_id,
                RecurringTransaction.is_active.is_(True),
            )
        )
        or 0
    )
    recurring_burden = round(monthly_recurring / monthly_income * 100, 2) if monthly_income else 0

    current_totals = _category_totals(db, owner_id, month_start, today)
    previous_totals = _category_totals(db, owner_id, prev_month_start, prev_month_end)
    top_categories: list[CategoryDynamic] = []
    for category, amount in sorted(current_totals.items(), key=lambda item: item[1], reverse=True)[:5]:
        previous = previous_totals.get(category, 0)
        growth = ((amount - previous) / previous * 100) if previous else 100.0 if amount else 0.0
        top_categories.append(
            CategoryDynamic(
                category=category,
                current_amount=round(amount, 2),
                previous_amount=round(previous, 2),
                growth_pct=round(growth, 2),
            )
        )

    insights = _build_insights(
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        recurring_burden=recurring_burden,
        emergency_fund_months=emergency_fund_months,
        top_categories=top_categories,
    )
    timeline = _net_worth_timeline(db, owner_id)

    return OverviewReport(
        liquid_balance=round(liquid_balance, 2),
        total_assets=round(total_assets, 2),
        total_liabilities=round(total_liabilities, 2),
        net_worth=round(net_worth, 2),
        monthly_income=round(monthly_income, 2),
        monthly_expenses=round(monthly_expenses, 2),
        savings_rate=savings_rate,
        burn_rate=burn_rate,
        runway_months=runway_months,
        emergency_fund_months=emergency_fund_months,
        recurring_burden_pct=recurring_burden,
        top_categories=top_categories,
        insights=insights,
        net_worth_timeline=timeline,
    )


def compute_category_dynamics(db: Session, owner_id: str) -> list[CategoryDynamic]:
    today = date.today()
    month_start = today.replace(day=1)
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)
    current_totals = _category_totals(db, owner_id, month_start, today)
    previous_totals = _category_totals(db, owner_id, prev_month_start, prev_month_end)
    category_names = sorted(set(current_totals) | set(previous_totals))
    rows: list[CategoryDynamic] = []
    for category in category_names:
        current = current_totals.get(category, 0.0)
        previous = previous_totals.get(category, 0.0)
        growth = ((current - previous) / previous * 100) if previous else 100.0 if current else 0.0
        rows.append(
            CategoryDynamic(
                category=category,
                current_amount=round(current, 2),
                previous_amount=round(previous, 2),
                growth_pct=round(growth, 2),
            )
        )
    return sorted(rows, key=lambda item: item.current_amount, reverse=True)


def compute_merchant_spend(db: Session, owner_id: str) -> list[MerchantSpend]:
    today = date.today()
    month_start = today.replace(day=1)
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    current_rows = db.execute(
        select(
            func.coalesce(Transaction.merchant_name, "Manual"),
            func.coalesce(func.sum(Transaction.amount_in_base_currency), 0),
            func.count(Transaction.id),
        ).where(
            Transaction.owner_id == owner_id,
            Transaction.transaction_date >= month_start,
            Transaction.transaction_date <= today,
            Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
        ).group_by(Transaction.merchant_name)
    ).all()
    previous_rows = db.execute(
        select(
            func.coalesce(Transaction.merchant_name, "Manual"),
            func.coalesce(func.sum(Transaction.amount_in_base_currency), 0),
        ).where(
            Transaction.owner_id == owner_id,
            Transaction.transaction_date >= prev_month_start,
            Transaction.transaction_date <= prev_month_end,
            Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
        ).group_by(Transaction.merchant_name)
    ).all()

    previous_totals = {str(name or "Manual"): float(amount or 0) for name, amount in previous_rows}
    merchants: list[MerchantSpend] = []
    for merchant_name, current_amount, transaction_count in current_rows:
        merchant = str(merchant_name or "Manual")
        current = float(current_amount or 0)
        previous = previous_totals.get(merchant, 0.0)
        growth = ((current - previous) / previous * 100) if previous else 100.0 if current else 0.0
        merchants.append(
            MerchantSpend(
                merchant_name=merchant,
                current_amount=round(current, 2),
                previous_amount=round(previous, 2),
                growth_pct=round(growth, 2),
                transaction_count=int(transaction_count or 0),
            )
        )
    return sorted(merchants, key=lambda item: item.current_amount, reverse=True)


def compute_asset_allocation(db: Session, owner_id: str) -> list[AllocationPoint]:
    assets = db.scalars(
        select(Asset).where(Asset.owner_id == owner_id, Asset.is_archived.is_(False)).order_by(Asset.name.asc())
    ).all()
    total_value = sum(float(asset.current_value_in_base or 0) for asset in assets)
    if total_value <= 0:
        return []
    return [
        AllocationPoint(
            label=asset.symbol or asset.name,
            value=round(float(asset.current_value_in_base or 0), 2),
            allocation_pct=round(float(asset.current_value_in_base or 0) / total_value * 100, 2),
        )
        for asset in assets
    ]


def upsert_anomaly_notifications(db: Session, owner_id: str) -> int:
    anomalies = detect_anomalies(db, owner_id)
    count = 0
    for anomaly in anomalies:
        notification = db.scalar(
            select(Notification).where(
                Notification.owner_id == owner_id,
                Notification.event_key == anomaly["event_key"],
            )
        )
        if notification:
            notification.severity = anomaly["severity"]
            notification.title = anomaly["title"]
            notification.body = anomaly["body"]
        else:
            notification = Notification(
                owner_id=owner_id,
                type=NotificationType.ANOMALY,
                severity=anomaly["severity"],
                title=anomaly["title"],
                body=anomaly["body"],
                event_key=anomaly["event_key"],
            )
        db.add(notification)
        count += 1
    return count


def detect_anomalies(db: Session, owner_id: str) -> list[dict]:
    today = date.today()
    recent_start = today - timedelta(days=7)
    recent_transactions = db.scalars(
        select(Transaction)
        .where(
            Transaction.owner_id == owner_id,
            Transaction.transaction_date >= recent_start,
            Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
        )
        .order_by(Transaction.transaction_date.desc())
    ).all()
    anomalies: list[dict] = []
    for transaction in recent_transactions:
        merchant_baseline = _baseline_stats(
            db,
            owner_id,
            transaction,
            merchant_name=transaction.merchant_name,
        )
        if merchant_baseline and _is_anomalous(float(transaction.amount_in_base_currency), merchant_baseline["average"]):
            anomalies.append(
                {
                    "event_key": f"anomaly:merchant:{transaction.id}",
                    "severity": InsightSeverity.WARNING,
                    "title": f"Merchant spike detected for {transaction.merchant_name}",
                    "body": (
                        f"Spend of {float(transaction.amount_in_base_currency):.2f} is above the 90-day "
                        f"merchant baseline of {merchant_baseline['average']:.2f} across "
                        f"{merchant_baseline['count']} prior transactions."
                    ),
                }
            )
            continue

        category_baseline = _baseline_stats(
            db,
            owner_id,
            transaction,
            category_id=transaction.category_id,
        )
        if category_baseline and _is_anomalous(
            float(transaction.amount_in_base_currency),
            category_baseline["average"],
            multiplier=1.6,
            absolute_delta=75,
        ):
            category_name = db.scalar(select(Category.name).where(Category.id == transaction.category_id)) or "Category"
            anomalies.append(
                {
                    "event_key": f"anomaly:category:{transaction.id}",
                    "severity": InsightSeverity.INFO,
                    "title": f"{category_name} spend is above baseline",
                    "body": (
                        f"This entry landed at {float(transaction.amount_in_base_currency):.2f} versus a 90-day "
                        f"category average of {category_baseline['average']:.2f} over "
                        f"{category_baseline['count']} prior entries."
                    ),
                }
            )
    return anomalies


def _category_totals(db: Session, owner_id: str, start: date, end: date) -> dict[str, float]:
    rows = db.execute(
        select(Category.name, func.coalesce(func.sum(Transaction.amount_in_base_currency), 0))
        .join(Category, Transaction.category_id == Category.id, isouter=True)
        .where(
            Transaction.owner_id == owner_id,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
            Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
        )
        .group_by(Category.name)
    ).all()
    totals = defaultdict(float)
    for category_name, amount in rows:
        totals[category_name or "Uncategorized"] = float(amount or 0)
    return dict(totals)


def _build_insights(
    *,
    monthly_income: float,
    monthly_expenses: float,
    recurring_burden: float,
    emergency_fund_months: float | None,
    top_categories: list[CategoryDynamic],
) -> list[InsightCard]:
    insights: list[InsightCard] = []
    if recurring_burden >= 10:
        insights.append(
            InsightCard(
                title="Recurring burden is elevated",
                body=f"Recurring obligations consume {recurring_burden:.1f}% of current monthly income.",
                severity=InsightSeverity.WARNING,
            )
        )
    if emergency_fund_months is not None and emergency_fund_months < 3:
        insights.append(
            InsightCard(
                title="Emergency coverage is thin",
                body=f"Liquid reserves cover about {emergency_fund_months:.1f} months of essential spending.",
                severity=InsightSeverity.CRITICAL,
            )
        )
    if monthly_income and monthly_expenses > monthly_income:
        insights.append(
            InsightCard(
                title="Current month is cash-flow negative",
                body="Expenses are above income for the current month. Review discretionary categories.",
                severity=InsightSeverity.WARNING,
            )
        )
    if top_categories:
        top = top_categories[0]
        insights.append(
            InsightCard(
                title=f"{top.category} is the largest expense bucket",
                body=f"Spend is {top.current_amount:.2f} in base currency this month with {top.growth_pct:.1f}% change.",
                severity=InsightSeverity.INFO,
            )
        )
    return insights


def _net_worth_timeline(db: Session, owner_id: str) -> list[NetWorthPoint]:
    rows = db.scalars(
        select(NetWorthSnapshot)
        .where(NetWorthSnapshot.owner_id == owner_id)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(12)
    ).all()
    if rows:
        return [
            NetWorthPoint(
                date=row.snapshot_date,
                net_worth=float(row.net_worth),
                assets=float(row.asset_value),
                liabilities=float(row.liability_value),
            )
            for row in reversed(rows)
        ]
    return [
        NetWorthPoint(
            date=date.today(),
            net_worth=0,
            assets=0,
            liabilities=0,
        )
    ]


def _baseline_stats(
    db: Session,
    owner_id: str,
    transaction: Transaction,
    *,
    merchant_name: str | None = None,
    category_id: str | None = None,
) -> dict[str, int | float] | None:
    baseline_start = transaction.transaction_date - timedelta(days=90)
    query = select(
        func.count(Transaction.id),
        func.coalesce(func.avg(Transaction.amount_in_base_currency), 0),
    ).where(
        Transaction.owner_id == owner_id,
        Transaction.type.in_(list(ANALYTICS_EXPENSE_TYPES)),
        Transaction.transaction_date >= baseline_start,
        Transaction.transaction_date < transaction.transaction_date,
    )
    if merchant_name:
        query = query.where(func.lower(Transaction.merchant_name) == merchant_name.lower())
        min_count = 3
    elif category_id:
        query = query.where(Transaction.category_id == category_id)
        min_count = 5
    else:
        return None
    count, average = db.execute(query).one()
    if int(count or 0) < min_count or float(average or 0) <= 0:
        return None
    return {"count": int(count or 0), "average": float(average or 0)}


def _is_anomalous(amount: float, average: float, *, multiplier: float = 1.8, absolute_delta: float = 50) -> bool:
    return amount >= max(average * multiplier, average + absolute_delta)
