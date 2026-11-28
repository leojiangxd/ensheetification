"""SQLite storage for users, sessions and jobs, plus the on-disk job folders."""
import os
import sqlite3
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

# shortcut: SQLite + local files in one process, move to Postgres + object storage per README when scaling out
DATA_DIR = Path(os.environ.get("ENSHEET_DATA_DIR", "data"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('file', 'youtube')),
    source_url TEXT,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
    status TEXT NOT NULL CHECK (status IN ('queued', 'arranging', 'ready', 'failed')),
    error TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_by_user ON jobs (user_id, created_at);
"""

JOB_FIELDS = "id, title, source_kind, source_url, level, status, error, created_at"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return uuid.uuid4().hex


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATA_DIR / "app.db")
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:  # commits on success, rolls back on error
            yield connection
    finally:
        connection.close()


def init() -> None:
    with connect() as connection:
        connection.executescript(SCHEMA)


def job_dir(job_id: str) -> Path:
    return DATA_DIR / "jobs" / job_id


def create_user(name: str, email: str, password_hash: str) -> dict:
    user = {"id": new_id(), "name": name, "email": email}
    with connect() as connection:
        connection.execute(
            "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (user["id"], name, email, password_hash, now()),
        )
    return user


def user_by_email(email: str) -> sqlite3.Row | None:
    with connect() as connection:
        return connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def create_job(user_id: str, title: str, source_kind: str, source_url: str | None, level: int, job_id: str) -> dict:
    with connect() as connection:
        connection.execute(
            "INSERT INTO jobs (id, user_id, title, source_kind, source_url, level, status, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)",
            (job_id, user_id, title, source_kind, source_url, level, now()),
        )
    return get_job(job_id)


def get_job(job_id: str, user_id: str | None = None) -> dict | None:
    """The job, or None if it doesn't exist or (when user_id is given) belongs to someone else."""
    query = f"SELECT {JOB_FIELDS}, user_id FROM jobs WHERE id = ?"
    with connect() as connection:
        row = connection.execute(query, (job_id,)).fetchone()
    if row is None or (user_id is not None and row["user_id"] != user_id):
        return None
    job = dict(row)
    del job["user_id"]
    return job


def list_jobs(user_id: str) -> list[dict]:
    with connect() as connection:
        rows = connection.execute(
            f"SELECT {JOB_FIELDS} FROM jobs WHERE user_id = ? ORDER BY created_at DESC, rowid DESC", (user_id,)
        ).fetchall()
    return [dict(row) for row in rows]


def update_job(job_id: str, **fields: object) -> None:
    allowed = {"status", "error", "title"}
    if not fields or not set(fields) <= allowed:
        raise ValueError(f"can only update {allowed}")
    assignments = ", ".join(f"{name} = ?" for name in fields)
    with connect() as connection:
        connection.execute(f"UPDATE jobs SET {assignments} WHERE id = ?", (*fields.values(), job_id))


def set_video_title(job_id: str, title: str) -> None:
    """Replaces the placeholder title (the url) only, so a name the user gave or renamed to is kept."""
    with connect() as connection:
        connection.execute("UPDATE jobs SET title = ? WHERE id = ? AND title = source_url", (title, job_id))


def delete_job(job_id: str) -> None:
    with connect() as connection:
        connection.execute("DELETE FROM jobs WHERE id = ?", (job_id,))


def requeue_unfinished() -> list[str]:
    """After a restart, jobs that were queued or mid-run go back to queued; returns their ids, oldest first."""
    with connect() as connection:
        connection.execute("UPDATE jobs SET status = 'queued' WHERE status = 'arranging'")
        rows = connection.execute("SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at, rowid").fetchall()
    return [row["id"] for row in rows]
