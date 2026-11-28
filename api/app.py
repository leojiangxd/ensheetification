"""HTTP API: accounts, job submission, job status and result downloads."""
import re
import shutil
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Cookie, Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from api import auth, db, worker

MAX_UPLOAD_BYTES = 100 * 1024 * 1024
CHUNK_BYTES = 1024 * 1024
FILE_KINDS = {"midi": ".mid", "musicxml": ".musicxml", "pdf": ".pdf"}
MAX_TITLE = 200  # keep in sync with maxLength in web/src


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    worker.start()
    yield


app = FastAPI(title="ensheetify", lifespan=lifespan)
router = APIRouter(prefix="/api")
CurrentUser = Annotated[dict, Depends(auth.current_user)]


class Registration(BaseModel):
    name: str
    email: str
    password: str


class Credentials(BaseModel):
    email: str
    password: str


class Rename(BaseModel):
    title: str


def _clean_title(title: str) -> str:
    title = " ".join(title.split())
    if not title:
        raise HTTPException(status_code=400, detail="Enter a name for this song.")
    if len(title) > MAX_TITLE:
        raise HTTPException(status_code=400, detail=f"Names can be at most {MAX_TITLE} characters.")
    return title


def _log_in(response: Response, user_id: str) -> None:
    # shortcut: secure=False so the cookie works on http://localhost, set secure=True once served over HTTPS
    response.set_cookie(
        auth.COOKIE, auth.create_session(user_id), max_age=auth.SESSION_DAYS * 86400, httponly=True, samesite="lax"
    )


@router.post("/auth/register", status_code=201)
def register(body: Registration, response: Response) -> dict:
    email = body.email.strip().lower()
    problem = auth.validate_registration(body.name, email, body.password)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    try:
        user = db.create_user(body.name.strip(), email, auth.hash_password(body.password))
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists. Log in instead.")
    _log_in(response, user["id"])
    return user


@router.post("/auth/login")
def login(body: Credentials, response: Response) -> dict:
    row = db.user_by_email(body.email.strip().lower())
    if row is None or not auth.verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is wrong.")
    _log_in(response, row["id"])
    return {"id": row["id"], "name": row["name"], "email": row["email"]}


@router.post("/auth/logout", status_code=204)
def logout(response: Response, session: str | None = Cookie(default=None)) -> None:
    if session:
        auth.delete_session(session)
    response.delete_cookie(auth.COOKIE)


@router.get("/auth/me")
def me(user: CurrentUser) -> dict:
    return user


def is_youtube_url(value: str) -> bool:
    """Same rule as isYouTubeUrl in web/src/components/SubmitForm.tsx."""
    parsed = urlparse(value)
    host = re.sub(r"^(www|m|music)\.", "", parsed.hostname or "")
    return parsed.scheme in ("http", "https") and host in ("youtube.com", "youtu.be")


def _save_upload(file: UploadFile, out_dir: Path) -> None:
    suffix = Path(file.filename or "").suffix.lower()
    if not re.fullmatch(r"\.[a-z0-9]{1,8}", suffix):
        suffix = ""  # never let the client's filename shape the path; ffmpeg sniffs the format anyway
    written = 0
    with open(out_dir / f"source{suffix}", "wb") as target:
        while chunk := file.file.read(CHUNK_BYTES):
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"Files can be at most {MAX_UPLOAD_BYTES // 1024 // 1024} MB.")
            target.write(chunk)
    if written == 0:
        raise HTTPException(status_code=400, detail="That file is empty.")


@router.post("/jobs", status_code=201)
def create_job(
    user: CurrentUser,
    level: Annotated[int, Form()],
    title: Annotated[str | None, Form()] = None,
    url: Annotated[str | None, Form()] = None,
    file: Annotated[UploadFile | None, File()] = None,
) -> dict:
    url = (url or "").strip() or None
    if file is None and url is None:
        raise HTTPException(status_code=400, detail="Choose an audio file or paste a YouTube link first.")
    if file is not None and url is not None:
        raise HTTPException(status_code=400, detail="Choose an audio file or paste a YouTube link, not both.")
    if not 1 <= level <= 5:
        raise HTTPException(status_code=400, detail="Pick a difficulty from 1 to 5.")
    if url and not is_youtube_url(url):
        raise HTTPException(status_code=400, detail="That is not a YouTube link. Paste one like https://www.youtube.com/watch?v=...")
    title = _clean_title(title) if title and title.strip() else None

    job_id = db.new_id()
    out_dir = db.job_dir(job_id)
    out_dir.mkdir(parents=True)
    try:
        if file is not None:
            _save_upload(file, out_dir)
    except BaseException:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise
    if file is not None:
        title, kind = title or Path(file.filename or "").stem or "Untitled", "file"
    else:
        title, kind = title or url, "youtube"  # a title still equal to the url gets replaced by the video title
    job = db.create_job(user["id"], title, kind, url, level, job_id)
    worker.enqueue(job_id)
    return job


@router.get("/jobs")
def list_jobs(user: CurrentUser) -> list[dict]:
    return db.list_jobs(user["id"])


def _own_job(job_id: str, user: dict) -> dict:
    job = db.get_job(job_id, user["id"])
    if job is None:
        raise HTTPException(status_code=404, detail="Song not found.")
    return job


@router.get("/jobs/{job_id}")
def get_job(job_id: str, user: CurrentUser) -> dict:
    return _own_job(job_id, user)


@router.patch("/jobs/{job_id}")
def rename_job(job_id: str, body: Rename, user: CurrentUser) -> dict:
    _own_job(job_id, user)
    db.update_job(job_id, title=_clean_title(body.title))
    return _own_job(job_id, user)


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, user: CurrentUser) -> None:
    # the pipeline recreates its output folder, so a running job can't be removed from under it
    if _own_job(job_id, user)["status"] == "arranging":
        raise HTTPException(status_code=409, detail="This song is being arranged. Delete it once it finishes.")
    db.delete_job(job_id)
    shutil.rmtree(db.job_dir(job_id), ignore_errors=True)


@router.post("/jobs/{job_id}/retry")
def retry_job(job_id: str, user: CurrentUser) -> dict:
    if _own_job(job_id, user)["status"] != "failed":
        raise HTTPException(status_code=409, detail="Only failed songs can be tried again.")
    db.update_job(job_id, status="queued", error=None)
    worker.enqueue(job_id)
    return _own_job(job_id, user)


@router.get("/jobs/{job_id}/files/{kind}")
def download(job_id: str, kind: str, user: CurrentUser) -> FileResponse:
    job = _own_job(job_id, user)
    path = db.job_dir(job_id) / f"source{FILE_KINDS.get(kind, '')}"
    if kind not in FILE_KINDS or job["status"] != "ready" or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    # inline so the PDF can be embedded on the song page; <a download> still saves it with this name
    return FileResponse(path, filename=f"{job['title']}{FILE_KINDS[kind]}", content_disposition_type="inline")


app.include_router(router)
