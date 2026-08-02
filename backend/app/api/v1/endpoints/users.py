from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.factory import build_crud_router
from app.core.db import get_db
from app.crud.users import user_crud
from app.models.users import Role
from app.schemas.users import RoleRead, UserCreate, UserRead, UserUpdate

router = APIRouter()

router.include_router(
    build_crud_router(
        prefix="/users",
        tags=["Users"],
        crud=user_crud,
        read_schema=UserRead,
        create_schema=UserCreate,
        update_schema=UserUpdate,
    )
)


@router.get("/roles", response_model=list[RoleRead], tags=["Users"])
async def list_roles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Role))
    return result.scalars().all()
