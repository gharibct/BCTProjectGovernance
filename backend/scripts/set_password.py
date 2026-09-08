"""Set (or clear) a user's local password for AUTH_TYPE=password.

Use this to bootstrap the first admin before the Admin -> Users & Roles screen
is reachable; afterwards passwords can be managed from there.

Run from backend/:
    python -m scripts.set_password <email-or-ldap-username>
    python -m scripts.set_password <email-or-ldap-username> --clear

Without --clear you are prompted for the password twice (no echo). The
plaintext is scrypt-hashed here and never written to disk or logged.
"""

import argparse
import asyncio
import getpass
import sys
from datetime import UTC, datetime

from sqlalchemy import func, select

from app.core.db import AsyncSessionLocal
from app.core.security import hash_password
from app.models.users import User
from app.schemas.users import PASSWORD_MIN_LENGTH


async def _run(identifier: str, clear: bool) -> int:
    ident = identifier.strip().lower()
    async with AsyncSessionLocal() as db:
        user = (
            await db.execute(
                select(User).where(
                    (func.lower(User.ldap_username) == ident) | (func.lower(User.email) == ident)
                )
            )
        ).scalar_one_or_none()
        if user is None:
            print(f"No user found for identifier: {identifier}", file=sys.stderr)
            return 1

        if clear:
            user.password_hash = None
            action = "cleared"
        else:
            pw = getpass.getpass("New password: ")
            if len(pw) < PASSWORD_MIN_LENGTH:
                print(f"Password must be at least {PASSWORD_MIN_LENGTH} characters.", file=sys.stderr)
                return 1
            if pw != getpass.getpass("Confirm password: "):
                print("Passwords did not match.", file=sys.stderr)
                return 1
            user.password_hash = hash_password(pw)
            action = "set"

        user.updated_at = datetime.now(UTC)
        await db.commit()
        print(f"Password {action} for {user.full_name} <{user.email}>.")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Set or clear a user's local password.")
    parser.add_argument("identifier", help="email or ldap_username")
    parser.add_argument("--clear", action="store_true", help="remove the local password instead of setting one")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args.identifier, args.clear)))


if __name__ == "__main__":
    main()
