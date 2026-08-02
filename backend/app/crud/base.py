from datetime import UTC, datetime
from typing import Any, Generic, TypeVar
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Generic get/list/create/update/delete for a single SQLAlchemy model.

    The schema has no DB-side id/timestamp defaults (see db/tables), so
    create() fills id/created_at/updated_at here — the one place that
    matters, instead of in every endpoint.
    """

    def __init__(self, model: type[ModelType]) -> None:
        self.model = model

    async def get(self, db: AsyncSession, id: UUID) -> ModelType | None:
        return await db.get(self.model, id)

    async def list(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 50,
        filters: dict[Any, Any] | None = None,
        order_by: Any = None,
    ) -> tuple[list[ModelType], int]:
        stmt: Select = select(self.model)
        count_stmt = select(func.count()).select_from(self.model)
        for column, value in (filters or {}).items():
            if value is None:
                continue
            stmt = stmt.where(column == value)
            count_stmt = count_stmt.where(column == value)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        stmt = stmt.offset(skip).limit(limit)

        total = (await db.execute(count_stmt)).scalar_one()
        items = (await db.execute(stmt)).scalars().all()
        return list(items), total

    async def create(self, db: AsyncSession, obj_in: CreateSchemaType, **extra: Any) -> ModelType:
        now = datetime.now(UTC)
        data = obj_in.model_dump()
        data.update(extra)
        data.setdefault("id", uuid4())
        if hasattr(self.model, "created_at") and data.get("created_at") is None:
            data["created_at"] = now
        if hasattr(self.model, "updated_at") and data.get("updated_at") is None:
            data["updated_at"] = now
        obj = self.model(**data)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj

    async def update(self, db: AsyncSession, db_obj: ModelType, obj_in: UpdateSchemaType) -> ModelType:
        data = obj_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(db_obj, field, value)
        if hasattr(db_obj, "updated_at"):
            db_obj.updated_at = datetime.now(UTC)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, db_obj: ModelType) -> None:
        await db.delete(db_obj)
        await db.flush()
