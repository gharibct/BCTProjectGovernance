from sqlalchemy import JSON, String
from sqlalchemy.dialects.postgresql import INET, JSONB

# Native JSONB/INET on Postgres; generic JSON (TEXT-backed)/String fallback
# elsewhere (e.g. SQLite local dev) so model files stay dialect-agnostic.
PortableJSON = JSON().with_variant(JSONB, "postgresql")
PortableINET = String(45).with_variant(INET, "postgresql")
