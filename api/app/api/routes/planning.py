from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Budget, Goal, GoalContribution, RecurringTransaction, Transaction, User
from app.models.enums import GoalStatus, SourceType, TransactionStatus, TransactionType
from app.schemas.common import MessageResponse
from app.schemas.planning import (
    BudgetCreate,
    BudgetStatus,
    GoalCreate,
    GoalContributionCreate,
    GoalForecast,
    GoalUpdate,
    RecurringCreate,
    RecurringSchedule,
    RecurringUpdate,
)
from app.services.analytics import compute_budget_status, compute_goal_forecasts
from app.services.ledger import _get_owned_account, apply_account_delta, emit_event, write_audit

router = APIRouter(tags=["planning"])


@router.get("/budgets", response_model=list[BudgetStatus])
def list_budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[BudgetStatus]:
    return compute_budget_status(db, user.id)


@router.post("/budgets", response_model=dict)
def add_budget(payload: BudgetCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    budget = Budget(owner_id=user.id, **payload.model_dump())
    db.add(budget)
    db.flush()
    emit_event(
        db,
        user.id,
        "budget.created",
        "budget",
        budget.id,
        {"name": budget.name, "amount_in_base_currency": budget.amount_in_base_currency},
    )
    db.commit()
    db.refresh(budget)
    return {"id": budget.id, "name": budget.name}


@router.get("/goals", response_model=list[GoalForecast])
def list_goals(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[GoalForecast]:
    return compute_goal_forecasts(db, user.id)


@router.post("/goals", response_model=dict)
def add_goal(payload: GoalCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    goal = Goal(owner_id=user.id, **payload.model_dump())
    db.add(goal)
    db.flush()
    emit_event(
        db,
        user.id,
        "goal.created",
        "goal",
        goal.id,
        {"title": goal.title, "target_amount_in_base_currency": goal.target_amount_in_base_currency},
    )
    db.commit()
    db.refresh(goal)
    return {"id": goal.id, "title": goal.title}


@router.patch("/goals/{goal_id}", response_model=GoalForecast)
def patch_goal(
    goal_id: str,
    payload: GoalUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GoalForecast:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.owner_id == user.id))
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    before_json = {
        "title": goal.title,
        "target_amount": float(goal.target_amount),
        "target_amount_in_base_currency": float(goal.target_amount_in_base_currency),
        "currency": goal.currency,
        "deadline": goal.deadline.isoformat() if goal.deadline else None,
        "monthly_contribution_target": float(goal.monthly_contribution_target or 0),
        "priority": goal.priority,
        "status": goal.status.value,
    }
    for field, value in payload.model_dump().items():
        setattr(goal, field, value)
    emit_event(
        db,
        user.id,
        "goal.updated",
        "goal",
        goal.id,
        {"title": goal.title, "target_amount_in_base_currency": float(goal.target_amount_in_base_currency)},
    )
    write_audit(
        db,
        user.id,
        user.id,
        "goal",
        goal.id,
        "updated",
        before_json,
        {
            "title": goal.title,
            "target_amount": float(goal.target_amount),
            "target_amount_in_base_currency": float(goal.target_amount_in_base_currency),
            "currency": goal.currency,
            "deadline": goal.deadline.isoformat() if goal.deadline else None,
            "monthly_contribution_target": float(goal.monthly_contribution_target or 0),
            "priority": goal.priority,
            "status": goal.status.value,
        },
    )
    db.add(goal)
    db.commit()
    goal_forecasts = compute_goal_forecasts(db, user.id)
    return next(item for item in goal_forecasts if item.id == goal.id)


@router.delete("/goals/{goal_id}", response_model=MessageResponse)
def remove_goal(
    goal_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.owner_id == user.id))
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    before_json = {
        "title": goal.title,
        "status": goal.status.value,
        "progress_amount_in_base_currency": float(goal.progress_amount_in_base_currency or 0),
    }
    goal.status = GoalStatus.ARCHIVED
    emit_event(
        db,
        user.id,
        "goal.archived",
        "goal",
        goal.id,
        {"title": goal.title, "target_amount_in_base_currency": float(goal.target_amount_in_base_currency)},
    )
    write_audit(
        db,
        user.id,
        user.id,
        "goal",
        goal.id,
        "archived",
        before_json,
        {"status": "archived"},
    )
    db.add(goal)
    db.commit()
    return MessageResponse(message="Goal archived")


@router.post("/goals/{goal_id}/contributions", response_model=GoalForecast)
def add_goal_contribution(
    goal_id: str,
    payload: GoalContributionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GoalForecast:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.owner_id == user.id))
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    if payload.direction not in {"fund", "withdraw"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported goal contribution direction")

    account = _get_owned_account(db, user.id, payload.account_id)
    signed_goal_amount = abs(payload.amount) if payload.direction == "fund" else -abs(payload.amount)
    signed_goal_delta_base = (
        abs(payload.amount_in_base_currency) if payload.direction == "fund" else -abs(payload.amount_in_base_currency)
    )
    if float(goal.progress_amount_in_base_currency) + signed_goal_delta_base < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Goal progress cannot go below zero")

    signed_account_delta = -abs(payload.amount) if payload.direction == "fund" else abs(payload.amount)
    signed_account_delta_base = -abs(payload.amount_in_base_currency) if payload.direction == "fund" else abs(payload.amount_in_base_currency)

    transaction = Transaction(
        owner_id=user.id,
        account_id=account.id,
        category_id=None,
        type=TransactionType.ADJUSTMENT,
        status=TransactionStatus.POSTED,
        source_type=SourceType.SYSTEM,
        amount=signed_account_delta,
        currency=account.currency,
        amount_in_base_currency=signed_account_delta_base,
        fx_rate=1,
        merchant_name="Цель",
        description=f'{"Пополнение" if payload.direction == "fund" else "Изъятие"} цели: {goal.title}',
        transaction_date=payload.contributed_on,
        posting_date=payload.contributed_on,
        notes=f"goal:{goal.id}",
        meta={"goal_id": goal.id, "goal_direction": payload.direction},
    )
    apply_account_delta(account, TransactionType.ADJUSTMENT, signed_account_delta)
    db.add(transaction)
    db.flush()

    contribution = GoalContribution(
        owner_id=user.id,
        goal_id=goal.id,
        transaction_id=transaction.id,
        amount=signed_goal_amount,
        amount_in_base_currency=signed_goal_delta_base,
        contributed_on=payload.contributed_on,
    )
    db.add(contribution)
    db.flush()

    before_json = {
        "progress_amount": float(goal.progress_amount),
        "progress_amount_in_base_currency": float(goal.progress_amount_in_base_currency),
    }
    goal.progress_amount = float(goal.progress_amount) + signed_goal_amount
    goal.progress_amount_in_base_currency = (
        float(goal.progress_amount_in_base_currency) + signed_goal_delta_base
    )
    db.add(goal)
    db.add(account)

    emit_event(
        db,
        user.id,
        "goal.contribution.created",
        "goal_contribution",
        contribution.id,
        {
            "goal_id": goal.id,
            "amount_in_base_currency": signed_goal_delta_base,
            "direction": payload.direction,
        },
    )
    emit_event(
        db,
        user.id,
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
        user.id,
        user.id,
        "goal",
        goal.id,
        "contribution_added",
        before_json,
        {
            "progress_amount": float(goal.progress_amount),
            "progress_amount_in_base_currency": float(goal.progress_amount_in_base_currency),
        },
    )
    write_audit(
        db,
        user.id,
        user.id,
        "transaction",
        transaction.id,
        "created",
        None,
        {
            "type": transaction.type.value,
            "amount": float(transaction.amount),
            "account_id": transaction.account_id,
            "goal_id": goal.id,
        },
    )
    db.commit()

    goal_forecasts = compute_goal_forecasts(db, user.id)
    return next(item for item in goal_forecasts if item.id == goal.id)


@router.get("/recurring", response_model=list[RecurringSchedule])
def list_recurring(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[RecurringSchedule]:
    recurring = db.scalars(
        select(RecurringTransaction).where(RecurringTransaction.owner_id == user.id).order_by(
            RecurringTransaction.next_due_date.asc()
        )
    ).all()
    return [RecurringSchedule.model_validate(item) for item in recurring]


@router.post("/recurring", response_model=dict)
def add_recurring(
    payload: RecurringCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    recurring = RecurringTransaction(owner_id=user.id, **payload.model_dump())
    db.add(recurring)
    db.flush()
    emit_event(
        db,
        user.id,
        "recurring.created",
        "recurring_transaction",
        recurring.id,
        {"name": recurring.name, "amount_in_base_currency": recurring.amount_in_base_currency},
    )
    db.commit()
    db.refresh(recurring)
    return {"id": recurring.id, "name": recurring.name}


@router.patch("/recurring/{recurring_id}", response_model=RecurringSchedule)
def patch_recurring(
    recurring_id: str,
    payload: RecurringUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecurringSchedule:
    recurring = db.scalar(
        select(RecurringTransaction).where(
            RecurringTransaction.id == recurring_id,
            RecurringTransaction.owner_id == user.id,
        )
    )
    if not recurring:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring payment not found")

    before_json = {
        "account_id": recurring.account_id,
        "name": recurring.name,
        "amount": float(recurring.amount),
        "amount_in_base_currency": float(recurring.amount_in_base_currency),
        "currency": recurring.currency,
        "frequency": recurring.frequency.value,
        "next_due_date": recurring.next_due_date.isoformat(),
        "reminder_days_before": recurring.reminder_days_before,
        "is_active": recurring.is_active,
    }

    for field, value in payload.model_dump().items():
        setattr(recurring, field, value)

    emit_event(
        db,
        user.id,
        "recurring.updated",
        "recurring_transaction",
        recurring.id,
        {"name": recurring.name, "amount_in_base_currency": float(recurring.amount_in_base_currency)},
    )
    write_audit(
        db,
        user.id,
        user.id,
        "recurring_transaction",
        recurring.id,
        "updated",
        before_json,
        {
            "account_id": recurring.account_id,
            "name": recurring.name,
            "amount": float(recurring.amount),
            "amount_in_base_currency": float(recurring.amount_in_base_currency),
            "currency": recurring.currency,
            "frequency": recurring.frequency.value,
            "next_due_date": recurring.next_due_date.isoformat(),
            "reminder_days_before": recurring.reminder_days_before,
            "is_active": recurring.is_active,
        },
    )
    db.add(recurring)
    db.commit()
    db.refresh(recurring)
    return RecurringSchedule.model_validate(recurring)


@router.delete("/recurring/{recurring_id}", response_model=MessageResponse)
def remove_recurring(
    recurring_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    recurring = db.scalar(
        select(RecurringTransaction).where(
            RecurringTransaction.id == recurring_id,
            RecurringTransaction.owner_id == user.id,
        )
    )
    if not recurring:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring payment not found")

    write_audit(
        db,
        user.id,
        user.id,
        "recurring_transaction",
        recurring.id,
        "deleted",
        {
            "account_id": recurring.account_id,
            "name": recurring.name,
            "amount": float(recurring.amount),
            "amount_in_base_currency": float(recurring.amount_in_base_currency),
            "currency": recurring.currency,
            "frequency": recurring.frequency.value,
            "next_due_date": recurring.next_due_date.isoformat(),
            "reminder_days_before": recurring.reminder_days_before,
            "is_active": recurring.is_active,
        },
        None,
    )
    emit_event(
        db,
        user.id,
        "recurring.deleted",
        "recurring_transaction",
        recurring.id,
        {"name": recurring.name, "amount_in_base_currency": float(recurring.amount_in_base_currency)},
    )
    db.delete(recurring)
    db.commit()
    return MessageResponse(message="Recurring payment deleted")
