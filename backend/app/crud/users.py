from app.crud.base import CRUDBase
from app.models.users import Role, User
from app.schemas.users import UserCreate, UserUpdate

role_crud = CRUDBase(Role)  # read-only via the API; no create/update schema needed
user_crud = CRUDBase[User, UserCreate, UserUpdate](User)
