from sqlalchemy.orm import Mapped

from app.core.db import Base
from app.models.mixins import UUIDPrimaryKey


class IdSequence(Base, UUIDPrimaryKey):
    __tablename__ = "id_sequences"

    entity_code: Mapped[str]
    period_key: Mapped[str]
    last_number: Mapped[int]
