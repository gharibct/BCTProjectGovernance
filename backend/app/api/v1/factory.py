"""Generic CRUD router factory. Used directly for simple reference-data-style
resources, and as a building block for the RAID log and Measurement routers
(which add their own filters on top).
"""

from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, pagination_params
from app.core.db import get_db
from app.crud.base import CRUDBase
from app.schemas.common import Page


def build_crud_router(
    *,
    prefix: str,
    tags: list[str],
    crud: CRUDBase,
    read_schema: type,
    create_schema: type,
    update_schema: type | None = None,
    allow_delete: bool = True,
    write_dependencies: Sequence[Depends] | None = None,
) -> APIRouter:
    """`write_dependencies` (e.g. `[Depends(require_role(RoleCode.ADMIN))]`)
    gates create/update/delete only — list/get stay open to every
    authenticated caller, matching this router's existing read behavior."""

    router = APIRouter(prefix=prefix, tags=tags)
    write_dependencies = list(write_dependencies) if write_dependencies else []

    @router.get("", response_model=Page[read_schema])
    async def list_items(
        pagination: PaginationParams = Depends(pagination_params),
        db: AsyncSession = Depends(get_db),
    ):
        items, total = await crud.list(db, skip=pagination.skip, limit=pagination.limit)
        return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)

    @router.post("", response_model=read_schema, status_code=status.HTTP_201_CREATED, dependencies=write_dependencies)
    async def create_item(payload: create_schema, db: AsyncSession = Depends(get_db)):
        return await crud.create(db, payload)

    @router.get("/{item_id}", response_model=read_schema)
    async def get_item(item_id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await crud.get(db, item_id)
        if obj is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        return obj

    if update_schema is not None:

        @router.put("/{item_id}", response_model=read_schema, dependencies=write_dependencies)
        async def update_item(item_id: UUID, payload: update_schema, db: AsyncSession = Depends(get_db)):
            obj = await crud.get(db, item_id)
            if obj is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
            return await crud.update(db, obj, payload)

    if allow_delete:

        @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=write_dependencies)
        async def delete_item(item_id: UUID, db: AsyncSession = Depends(get_db)):
            obj = await crud.get(db, item_id)
            if obj is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
            try:
                await crud.delete(db, obj)
            except IntegrityError as exc:
                await db.rollback()
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "Cannot delete — still referenced by other records. Mark it inactive instead.",
                ) from exc

    return router
