from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_token, decode_token, hash_password, hash_token, verify_password
from app.models import SessionToken, User
from app.schemas.auth import LoginRequest, RegisterRequest


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def register_user(db: Session, payload: RegisterRequest) -> User:
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        base_currency=payload.base_currency.upper(),
        timezone=payload.timezone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(
    db: Session,
    payload: LoginRequest,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[User, str, str]:
    user = get_user_by_email(db, payload.email.lower())
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token, refresh_token = _issue_token_pair(user)
    _create_session(
        db,
        user_id=user.id,
        refresh_token=refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.commit()
    return user, access_token, refresh_token


def refresh_auth_session(
    db: Session,
    refresh_token: str | None,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[User, str, str]:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    now = datetime.now(tz=timezone.utc)
    session = db.scalar(
        select(SessionToken).where(
            SessionToken.refresh_token_hash == hash_token(refresh_token),
            SessionToken.revoked_at.is_(None),
        )
    )
    if not session or session.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session expired")
    user = db.scalar(select(User).where(User.id == session.user_id, User.is_active.is_(True)))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    session.revoked_at = now
    access_token, next_refresh_token = _issue_token_pair(user)
    _create_session(
        db,
        user_id=user.id,
        refresh_token=next_refresh_token,
        user_agent=user_agent or session.user_agent,
        ip_address=ip_address or session.ip_address,
    )
    db.add(session)
    db.commit()
    return user, access_token, next_refresh_token


def revoke_refresh_token(db: Session, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    token_hash = hash_token(refresh_token)
    session = db.scalar(select(SessionToken).where(SessionToken.refresh_token_hash == token_hash))
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(tz=timezone.utc)
        db.add(session)
        db.commit()


def _issue_token_pair(user: User) -> tuple[str, str]:
    settings = get_settings()
    access_token = create_token(
        user.id,
        "access",
        timedelta(minutes=settings.access_token_minutes),
        {"role": user.role.value},
    )
    refresh_token = create_token(
        user.id,
        "refresh",
        timedelta(days=settings.refresh_token_days),
        {"role": user.role.value},
    )
    return access_token, refresh_token


def _create_session(
    db: Session,
    *,
    user_id: str,
    refresh_token: str,
    user_agent: str | None,
    ip_address: str | None,
) -> SessionToken:
    settings = get_settings()
    session = SessionToken(
        user_id=user_id,
        refresh_token_hash=hash_token(refresh_token),
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=datetime.now(tz=timezone.utc) + timedelta(days=settings.refresh_token_days),
    )
    db.add(session)
    return session
