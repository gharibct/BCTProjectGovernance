from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.schemas.enums import RoleCode

# Minimum local-password length for AUTH_TYPE=password (Admin set-password and
# the bootstrap script both enforce it).
PASSWORD_MIN_LENGTH = 8


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
    # Never expose the hash itself — only whether a local password is on file
    # (drives the "Password set / not set" hint on Admin -> Users & Roles).
    password_hash: str | None = Field(default=None, exclude=True, repr=False)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def password_set(self) -> bool:
        return self.password_hash is not None


class UserAccountsUpdate(BaseModel):
    account_ids: list[UUID] = []


class UserGeosUpdate(BaseModel):
    geo_ids: list[UUID] = []


class EntityHeadUpdate(BaseModel):
    """Set (or clear, with null) the single Account Head / Geo Head for an
    account / geo from the Admin creation screens. Single-owner: the write
    replaces any existing head link. See PUT /accounts/{id}/account-head."""

    user_id: UUID | None = None


class LoginRequest(BaseModel):
    identifier: str  # ldap_username or email, case-insensitive
    password: str = ""  # required only when AUTH_TYPE=password


class PasswordSet(BaseModel):
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)


class PasswordChange(BaseModel):
    """Self-service password rotation (POST /auth/change-password). Unlike the
    Admin reset route (PUT /users/{id}/password) the caller must prove they
    hold the current password."""

    current_password: str
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH)


class UserSessionRead(UserRead):
    """Login response — UserRead plus the nested role and the geo(s)/
    account(s) the user is mapped to (see user_geos/user_accounts), so the
    frontend has everything it needs to route/filter right after login."""

    role: RoleRead
    geo_ids: list[UUID] = []
    account_ids: list[UUID] = []
