"""One background thread that runs queued jobs through the ensheet pipeline."""
import logging
import queue
import subprocess
import threading
from pathlib import Path

from api import db
from ensheet import pipeline

log = logging.getLogger(__name__)

# README difficulty table: level 1 quarter notes, 2-3 eighths, 4-5 sixteenths
GRID_FOR_LEVEL = {1: 4, 2: 8, 3: 8, 4: 16, 5: 16}

_queue: queue.Queue[str] = queue.Queue()


class JobError(Exception):
    """A failure whose message is safe and meant to be shown to the user."""


def enqueue(job_id: str) -> None:
    _queue.put(job_id)


def start() -> None:
    for job_id in db.requeue_unfinished():
        enqueue(job_id)
    threading.Thread(target=_loop, name="ensheet-worker", daemon=True).start()


def _loop() -> None:
    while True:
        process(_queue.get())


def process(job_id: str) -> None:
    job = db.get_job(job_id)
    if job is None or job["status"] != "queued":
        return
    db.update_job(job_id, status="arranging", error=None)
    out_dir = db.job_dir(job_id)
    try:
        if job["source_kind"] == "youtube":
            source, title = download_youtube(job["source_url"], out_dir)
            db.update_job(job_id, title=title)
        else:
            source, title = next(out_dir.glob("source*")), Path(job["title"]).stem
        pipeline.run(source, out_dir, GRID_FOR_LEVEL[job["level"]], title=title)
    except Exception as error:  # any failure must end the job, never kill the worker thread
        log.exception("job %s failed", job_id)
        db.update_job(job_id, status="failed", error=user_message(error))
    else:
        db.update_job(job_id, status="ready")


def download_youtube(url: str, out_dir: Path) -> tuple[Path, str]:
    import yt_dlp

    options = {
        "format": "bestaudio/best",
        "noplaylist": True,
        "outtmpl": str(out_dir / "source.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(options) as downloader:
        info = downloader.extract_info(url, download=False)
        if info.get("is_live"):
            raise JobError("Live streams can't be arranged.")
        if (info.get("duration") or 0) > pipeline.MAX_DURATION_SECONDS:
            raise JobError(f"Songs can be at most {pipeline.MAX_DURATION_SECONDS // 60} minutes long.")
        info = downloader.process_ie_result(info, download=True)
        return Path(downloader.prepare_filename(info)), info.get("title") or url


def user_message(error: Exception) -> str:
    """Short, user-facing reason a job failed."""
    if isinstance(error, subprocess.CalledProcessError):
        return "This file couldn't be read as audio."
    if isinstance(error, JobError):
        return str(error)
    if isinstance(error, ValueError) and str(error).startswith("audio longer than"):  # raised by pipeline.decode
        return f"Songs can be at most {pipeline.MAX_DURATION_SECONDS // 60} minutes long."
    if type(error).__name__ == "DownloadError":  # yt_dlp.utils.DownloadError, without importing yt_dlp here
        return "This YouTube video couldn't be downloaded."
    return "Something went wrong while arranging this song."
