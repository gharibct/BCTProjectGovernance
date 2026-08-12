from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import RoleCode


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: RoleCode
    name: str
    description: str | None = None


class UserBase(BaseModel):
    ldap_username: str
    full_name: str
    email: str
    role_id: UUID
    is_active: bool = True
    mfa_enrolled: bool = False


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    role_id: UUID | None = None
    is_active: bool | None = None
    mfa_enrolled: bool | None = None
    mfa_enrolled_at: datetime | None = None
    last_login_at: datetime | None = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    mfa_enrolled_at: datetime | None = None
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class UserAccountsUpdate(BaseModel):
    account_ids: list[UUID] = []


class UserGeosUpdate(BaseModel):
    geo_ids: list[UUID] = []


class LoginRequest(BaseModel):
    identifier: str  # ldap_username or email, case-insensitive


class UserSessionRead(UserRead):
    """Login response — UserRead plus the nested role and the geo(s)/
    account(s) the user is mapped to (see user_geos/user_accounts), so the
    frontend has everything it needs to route/filter right after login."""

    role: RoleRead
    geo_ids: list[UUID] = []
    account_ids: list[UUID] = []
