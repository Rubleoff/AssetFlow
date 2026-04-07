from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserSummary
from app.schemas.common import MessageResponse
from app.services.auth import authenticate_user, refresh_auth_session, register_user, revoke_refresh_token
from app.services.bootstrap import ensure_seeded

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    user = register_user(db, payload)
    ensure_seeded(db, user.id, user.base_currency)
    _, access_token, refresh_token = authenticate_user(
        db,
        LoginRequest(email=payload.email, password=payload.password),
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(user=UserSummary.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    user, access_token, refresh_token = authenticate_user(
        db,
        payload,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(user=UserSummary.model_validate(user))


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    settings = get_settings()
    revoke_refresh_token(db, request.cookies.get(settings.refresh_cookie_name))
    _clear_auth_cookies(response)
    return MessageResponse(message="Logged out")


@router.post("/refresh", response_model=AuthResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    settings = get_settings()
    user, access_token, refresh_token = refresh_auth_session(
        db,
        request.cookies.get(settings.refresh_cookie_name),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(user=UserSummary.model_validate(user))


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    settings = get_settings()
    cookie_kwargs = {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.cookie_secure,
        "path": "/",
    }
    response.set_cookie(
        settings.access_cookie_name,
        access_token,
        max_age=settings.access_token_minutes * 60,
        **cookie_kwargs,
    )
    response.set_cookie(
        settings.refresh_cookie_name,
        refresh_token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        **cookie_kwargs,
    )


def _clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.access_cookie_name, path="/")
    response.delete_cookie(settings.refresh_cookie_name, path="/")
