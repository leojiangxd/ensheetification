"""Password hashing and cookie sessions."""
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, HTTPException

from api import db

COOKIE = "session"
SESSION_DAYS = 30
MIN_PASSWORD = 8  # keep in sync with web/src/auth.ts
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")  # same rule as web/src/auth.ts
SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    _scheme, salt, digest = stored.split("$")
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), **SCRYPT)
    return hmac.compare_digest(candidate.hex(), digest)


def validate_registration(name: str, email: str, password: str) -> str | None:
    """The first problem as a user-facing message, or None. Mirrors web/src/auth.ts."""
    if not name.strip():
        return "Enter your name."
    if not EMAIL.match(email.strip()):
        return "Enter an email address like name@example.com."
    if len(password) < MIN_PASSWORD:
        return f"Use at least {MIN_PASSWORD} characters."
    return None


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")
    with db.connect() as connection:
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (_token_hash(token), user_id, expires_at),
        )
    return token


def delete_session(token: str) -> None:
    with db.connect() as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def current_user(session: str | None = Cookie(default=None)) -> dict:
    """FastAPI dependency: the logged-in user, or 401."""
    if session:
        with db.connect() as connection:
            row = connection.execute(
                "SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id"
                " WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
                (_token_hash(session), db.now()),
            ).fetchone()
        if row is not None:
            return dict(row)
    raise HTTPException(status_code=401, detail="Log in first.")
