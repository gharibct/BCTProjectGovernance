from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field

from app.schemas.enums import ActionHistoryEventType, ActionLevel, ActionPriority, ActionStatus


class ActionCreate(BaseModel):
    title: str
    description: str | None = None
    priority: ActionPriority
    action_by_id: UUID | None = None
    due_date: date


class ActionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: ActionPriority | None = None
    action_by_id: UUID | None = None
    due_date: date | None = None


class ActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    action_code: str
    level: ActionLevel
    level_value: str
    title: str
    description: str | None = None
    action_by_id: UUID
    priority: ActionPriority
    status: ActionStatus
    due_date: date
    raised_by: UUID
    raised_at: datetime
    completed_at: datetime | None = None
    closed_at: datetime | None = None
    closed_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    # Derived, not stored — see db/tables/44_actions.sql.
    @computed_field  # type: ignore[prop-decorator]
    @property
    def overdue(self) -> bool:
        return self.due_date < date.today() and self.status not in (
            ActionStatus.COMPLETED,
            ActionStatus.CLOSED,
            ActionStatus.CANCELLED,
        )


class ActionCommentCreate(BaseModel):
    text: str


class ActionHistoryCreate(BaseModel):
    action_id: UUID
    event_type: ActionHistoryEventType
    comment: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    created_by: UUID


class ActionHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    action_id: UUID
    event_type: ActionHistoryEventType
    comment: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    created_by: UUID
    created_at: datetime
