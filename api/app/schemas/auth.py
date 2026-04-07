from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import RoleEnum


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8)
    base_currency: str = "USD"
    timezone: str = "UTC"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserSummary(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: RoleEnum
    base_currency: str
    timezone: str
    notification_preferences: dict[str, Any] = Field(default_factory=dict)
    import_preferences: dict[str, Any] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    base_currency: str = Field(..., min_length=3, max_length=3)
    timezone: str = Field(..., min_length=2, max_length=64)
    notification_preferences: dict[str, Any] = Field(default_factory=dict)
    import_preferences: dict[str, Any] = Field(default_factory=dict)


class AuthResponse(BaseModel):
    user: UserSummary
