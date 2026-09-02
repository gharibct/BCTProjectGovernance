from sqlalchemy import JSON, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.types import TypeDecorator

# Native JSONB/INET on Postgres; generic JSON (TEXT-backed)/String fallback
# elsewhere (e.g. SQLite local dev) so model files stay dialect-agnostic.
PortableJSON = JSON().with_variant(JSONB, "postgresql")
PortableINET = String(45).with_variant(INET, "postgresql")


class CommaSeparatedList(TypeDecorator):
    """A ``list[str]`` stored in a plain ``TEXT`` column as a comma-joined
    string (``"Requirement,Testing"``), so a multi-select field can live in
    an existing single-value column with no array/JSON type and no DDL.

    - ``None`` / ``[]`` <-> SQL ``NULL``
    - a legacy single value (``"Testing"``) reads back as ``["Testing"]``
    - a bare string bind value (e.g. from the master-data Excel import) is
      passed straight through, already comma-joined
    """

    impl = Text
    cache_ok = True

    @property
    def python_type(self):
        return list

    def process_bind_param(self, value, dialect):
        if value is None or value == "":
            return None
        if isinstance(value, str):
            return value
        joined = ",".join(str(v).strip() for v in value if str(v).strip())
        return joined or None

    def process_result_value(self, value, dialect):
        if not value:
            return []
        return [part.strip() for part in value.split(",") if part.strip()]
