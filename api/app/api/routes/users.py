from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import AuditLog, MerchantRule
from app.api.deps import get_current_user
from app.models import User
from app.schemas.auth import UserSummary, UserUpdateRequest
from app.schemas.common import AuditEntry, MessageResponse
from app.schemas.users import MerchantRuleCreate, MerchantRuleRead, MerchantRuleUpdate
from app.services.ledger import emit_event, write_audit

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserSummary)
def get_me(user: User = Depends(get_current_user)) -> UserSummary:
    return UserSummary.model_validate(user)


@router.patch("/me", response_model=UserSummary)
def patch_me(
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserSummary:
    before = {
        "full_name": user.full_name,
        "base_currency": user.base_currency,
        "timezone": user.timezone,
        "notification_preferences": user.notification_preferences or {},
        "import_preferences": user.import_preferences or {},
    }
    user.full_name = payload.full_name
    user.base_currency = payload.base_currency.upper()
    user.timezone = payload.timezone
    user.notification_preferences = payload.notification_preferences
    user.import_preferences = payload.import_preferences
    db.add(user)
    write_audit(
        db,
        user.id,
        user.id,
        "user",
        user.id,
        "updated",
        before,
        {
            "full_name": user.full_name,
            "base_currency": user.base_currency,
            "timezone": user.timezone,
            "notification_preferences": user.notification_preferences,
            "import_preferences": user.import_preferences,
        },
    )
    emit_event(db, user.id, "user.updated", "user", user.id, {"base_currency": user.base_currency, "timezone": user.timezone})
    db.commit()
    db.refresh(user)
    return UserSummary.model_validate(user)


@router.get("/me/merchant-rules", response_model=list[MerchantRuleRead])
def list_merchant_rules(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MerchantRuleRead]:
    rules = db.scalars(
        select(MerchantRule).where(MerchantRule.owner_id == user.id).order_by(MerchantRule.priority.asc(), MerchantRule.pattern.asc())
    ).all()
    return [MerchantRuleRead.model_validate(rule) for rule in rules]


@router.post("/me/merchant-rules", response_model=MerchantRuleRead)
def create_merchant_rule(
    payload: MerchantRuleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MerchantRuleRead:
    rule = MerchantRule(
        owner_id=user.id,
        pattern=payload.pattern.strip().lower(),
        category_id=payload.category_id,
        tag_names=payload.tag_names,
        priority=payload.priority,
        is_active=payload.is_active,
    )
    db.add(rule)
    db.flush()
    write_audit(
        db,
        user.id,
        user.id,
        "merchant_rule",
        rule.id,
        "created",
        None,
        {
            "pattern": rule.pattern,
            "category_id": rule.category_id,
            "tag_names": rule.tag_names or [],
            "priority": rule.priority,
            "is_active": rule.is_active,
        },
    )
    emit_event(db, user.id, "merchant_rule.created", "merchant_rule", rule.id, {"pattern": rule.pattern})
    db.commit()
    db.refresh(rule)
    return MerchantRuleRead.model_validate(rule)


@router.patch("/me/merchant-rules/{rule_id}", response_model=MerchantRuleRead)
def patch_merchant_rule(
    rule_id: str,
    payload: MerchantRuleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MerchantRuleRead:
    rule = db.scalar(select(MerchantRule).where(MerchantRule.id == rule_id, MerchantRule.owner_id == user.id))
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant rule not found")
    before = {
        "pattern": rule.pattern,
        "category_id": rule.category_id,
        "tag_names": rule.tag_names or [],
        "priority": rule.priority,
        "is_active": rule.is_active,
    }
    rule.pattern = payload.pattern.strip().lower()
    rule.category_id = payload.category_id
    rule.tag_names = payload.tag_names
    rule.priority = payload.priority
    rule.is_active = payload.is_active
    db.add(rule)
    write_audit(
        db,
        user.id,
        user.id,
        "merchant_rule",
        rule.id,
        "updated",
        before,
        {
            "pattern": rule.pattern,
            "category_id": rule.category_id,
            "tag_names": rule.tag_names or [],
            "priority": rule.priority,
            "is_active": rule.is_active,
        },
    )
    emit_event(db, user.id, "merchant_rule.updated", "merchant_rule", rule.id, {"pattern": rule.pattern})
    db.commit()
    db.refresh(rule)
    return MerchantRuleRead.model_validate(rule)


@router.delete("/me/merchant-rules/{rule_id}", response_model=MessageResponse)
def delete_merchant_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    rule = db.scalar(select(MerchantRule).where(MerchantRule.id == rule_id, MerchantRule.owner_id == user.id))
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant rule not found")
    before = {
        "pattern": rule.pattern,
        "category_id": rule.category_id,
        "tag_names": rule.tag_names or [],
        "priority": rule.priority,
        "is_active": rule.is_active,
    }
    db.delete(rule)
    write_audit(db, user.id, user.id, "merchant_rule", rule.id, "deleted", before, None)
    emit_event(db, user.id, "merchant_rule.deleted", "merchant_rule", rule.id, {"pattern": rule.pattern})
    db.commit()
    return MessageResponse(message="Merchant rule deleted")


@router.get("/me/audit", response_model=list[AuditEntry])
def list_audit_entries(
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AuditEntry]:
    query = select(AuditLog).where(AuditLog.owner_id == user.id).order_by(AuditLog.occurred_at.desc()).limit(limit)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    entries = db.scalars(query).all()
    return [AuditEntry.model_validate(entry) for entry in entries]
