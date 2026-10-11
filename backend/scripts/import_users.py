"""Bulk-create (or update) users from a CSV.

CSV header (exact column names, any order):
    email,full_name,ldap_username,role,password

- role         a roles.code, e.g. PROJECT_MANAGER, TEAM_MEMBER, DELIVERY_EXCELLENCE
- password     optional. Blank -> new users get no local password; existing users
               keep theirs. Each password is scrypt-hashed with its own salt.
- Re-runnable: rows are matched on lower-cased email. By DEFAULT (--skip-existing)
  a row whose email already exists is skipped untouched and reported; only new
  users are created. Pass --no-skip-existing to instead update existing users'
  full_name / ldap_username / role (and password, if one is given).
- Duplicates never stop the run: a repeated email in the file, an email already
  in the database (skip mode), or an ldap_username already used by another user
  is skipped, listed with its line number and reason, and the rest are imported.
- Other bad rows (missing field, invalid email, unknown role, short password)
  abort the run with nothing written; the import is one transaction.

Run from backend/:
    python -m scripts.import_users users.csv
    python -m scripts.import_users users.csv --dry-run
    python -m scripts.import_users users.csv --no-skip-existing   # update mode

Geo / account / project assignments are not handled here; use Assign Role.
"""

import argparse
import asyncio
import csv
import os
import sys
import uuid
from datetime import UTC, datetime

# ---------------------------------------------------------------------------
# Target database: edit this line. It is NOT read from .env — the environment
# variable is set here, before any app module loads, so it overrides .env.
# Must be an async driver URL, e.g.
#   postgresql+asyncpg://user:password@host:5432/dbname
#   sqlite+aiosqlite:///./dev.db
# ---------------------------------------------------------------------------
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@13.126.15.148:5432/project_governance"

os.environ["DATABASE_URL"] = DATABASE_URL

from sqlalchemy import select  # noqa: E402

from app.core.db import AsyncSessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.users import Role, User  # noqa: E402
from app.schemas.users import PASSWORD_MIN_LENGTH  # noqa: E402

COLUMNS = ["email", "full_name", "ldap_username", "role", "password"]
REQUIRED = ["email", "full_name", "ldap_username", "role"]


def _read_rows(path: str) -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        reader.fieldnames = [(h or "").strip().lower() for h in (reader.fieldnames or [])]
        missing = [c for c in REQUIRED if c not in reader.fieldnames]
        if missing:
            raise SystemExit(f"CSV is missing column(s): {', '.join(missing)}. Expected: {','.join(COLUMNS)}")
        rows = []
        for raw in reader:
            row = {c: (raw.get(c) or "").strip() for c in COLUMNS}
            if any(row.values()):  # skip blank lines
                rows.append(row)
        return rows


async def _run(path: str, dry_run: bool, skip_existing: bool) -> int:
    rows = _read_rows(path)
    if not rows:
        print("No data rows found.", file=sys.stderr)
        return 1

    async with AsyncSessionLocal() as db:
        roles = {r.code.upper(): r.id for r in (await db.execute(select(Role))).scalars()}
        existing = {u.email.lower(): u for u in (await db.execute(select(User))).scalars()}
        by_ldap = {u.ldap_username.lower(): u for u in existing.values()}

        errors: list[str] = []
        seen_email: set[str] = set()
        seen_ldap: dict[str, str] = {}
        plan: list[tuple[dict[str, str], User | None]] = []
        # Duplicates are never fatal: the row is skipped, reported, and the rest go on.
        skipped: list[str] = []

        for i, row in enumerate(rows, start=2):  # line 1 is the header
            def err(msg: str, i: int = i) -> None:
                errors.append(f"line {i}: {msg}")

            def skip(reason: str, i: int = i, email: str = row["email"]) -> None:
                skipped.append(f"line {i}: {email} - {reason}")

            blank = [c for c in REQUIRED if not row[c]]
            if blank:
                err(f"missing {', '.join(blank)}")
                continue
            email = row["email"].lower()
            ldap = row["ldap_username"].lower()
            if "@" not in email:
                err(f"invalid email '{row['email']}'")
                continue

            user = existing.get(email)
            if email in seen_email:
                skip("duplicate of an earlier row in the file")
                continue
            if user is not None and skip_existing:
                seen_email.add(email)
                skip("already exists in the database")
                continue
            if ldap in seen_ldap and seen_ldap[ldap] != email:
                skip(f"ldap_username '{row['ldap_username']}' already used by {seen_ldap[ldap]} earlier in the file")
                continue
            clash = by_ldap.get(ldap)
            if clash is not None and (user is None or clash.id != user.id):
                skip(f"ldap_username '{row['ldap_username']}' already belongs to {clash.email}")
                continue

            seen_email.add(email)
            seen_ldap[ldap] = email
            if row["role"].upper() not in roles:
                err(f"unknown role '{row['role']}' (valid: {', '.join(sorted(roles))})")
            if row["password"] and len(row["password"]) < PASSWORD_MIN_LENGTH:
                err(f"password shorter than {PASSWORD_MIN_LENGTH} characters")
            plan.append((row, user))

        if errors:
            print("Nothing written. Fix these and re-run:", file=sys.stderr)
            for e in errors:
                print(f"  {e}", file=sys.stderr)
            return 1

        now = datetime.now(UTC)
        created = updated = 0
        for row, user in plan:
            role_id = roles[row["role"].upper()]
            if user is None:
                db.add(
                    User(
                        id=uuid.uuid4(),
                        ldap_username=row["ldap_username"],
                        full_name=row["full_name"],
                        email=row["email"].lower(),
                        role_id=role_id,
                        is_active=True,
                        password_hash=hash_password(row["password"]) if row["password"] else None,
                        mfa_enrolled=False,
                        created_at=now,
                        updated_at=now,
                    )
                )
                created += 1
            else:
                user.full_name = row["full_name"]
                user.ldap_username = row["ldap_username"]
                user.role_id = role_id
                if row["password"]:
                    user.password_hash = hash_password(row["password"])
                user.updated_at = now
                updated += 1

        if skipped:
            print(f"Skipped {len(skipped)} duplicate row(s) (not imported):")
            for s in skipped:
                print(f"  {s}")

        if dry_run:
            await db.rollback()
            print(f"[dry-run] would create {created}, update {updated}, skip {len(skipped)}. Nothing written.")
            return 0

        await db.commit()
        print(f"Created {created}, updated {updated}, skipped {len(skipped)}.")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk-create/update users from a CSV.")
    parser.add_argument("csv_path", help=f"CSV with header: {','.join(COLUMNS)}")
    parser.add_argument("--dry-run", action="store_true", help="validate and report, write nothing")
    parser.add_argument(
        "--skip-existing",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="skip rows whose email already exists, leaving them untouched (default); "
        "use --no-skip-existing to update them instead",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args.csv_path, args.dry_run, args.skip_existing)))


if __name__ == "__main__":
    main()
