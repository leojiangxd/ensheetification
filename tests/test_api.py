import subprocess

import pytest
from fastapi.testclient import TestClient

from api import db, worker
from api.app import app
from ensheet import pipeline

USER = {"name": "Ada", "email": "ada@example.com", "password": "correct horse"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATA_DIR", tmp_path)
    queued: list[str] = []
    monkeypatch.setattr(worker, "enqueue", queued.append)
    db.init()
    client = TestClient(app)  # no `with`: skips the lifespan, so no real worker thread starts
    client.queued = queued
    return client


def register(client, **overrides):
    return client.post("/api/auth/register", json={**USER, **overrides})


def submit(client, data=None, files=None):
    return client.post("/api/jobs", data={"level": "3", **(data or {})}, files=files)


def test_register_login_logout(client):
    response = register(client)
    assert response.status_code == 201 and response.json()["email"] == USER["email"]
    assert client.get("/api/auth/me").json()["name"] == "Ada"

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401

    assert client.post("/api/auth/login", json={"email": "ADA@example.com ", "password": "nope"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "ADA@example.com ", "password": USER["password"]}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_register_rejects_bad_input_and_duplicates(client):
    assert register(client, name=" ").json()["detail"] == "Enter your name."
    assert register(client, email="not-an-email").status_code == 400
    assert register(client, password="short").json()["detail"] == "Use at least 8 characters."
    assert register(client).status_code == 201
    assert register(client, email="Ada@Example.com").status_code == 409


def test_jobs_require_login(client):
    assert client.get("/api/jobs").status_code == 401
    assert submit(client, {"url": "https://youtu.be/abc"}).status_code == 401


def test_job_validation(client):
    register(client)
    audio = {"file": ("song.mp3", b"ID3data", "audio/mpeg")}
    assert submit(client).json()["detail"].startswith("Choose an audio file")
    assert "not both" in submit(client, {"url": "https://youtu.be/abc"}, audio).json()["detail"]
    assert submit(client, {"level": "6", "url": "https://youtu.be/abc"}).status_code == 400
    assert submit(client, {"url": "https://example.com/watch?v=abc"}).status_code == 400
    assert submit(client, files={"file": ("empty.mp3", b"", "audio/mpeg")}).json()["detail"] == "That file is empty."
    assert client.queued == []


def test_upload_is_stored_safely_and_queued(client):
    register(client)
    response = submit(client, files={"file": ("../../evil name.MP3", b"ID3data", "audio/mpeg")})
    assert response.status_code == 201
    job = response.json()
    assert (job["title"], job["status"], job["source_kind"], job["level"]) == ("evil name.MP3", "queued", "file", 3)
    assert [p.name for p in db.job_dir(job["id"]).iterdir()] == ["source.mp3"]
    assert client.queued == [job["id"]]
    assert [j["id"] for j in client.get("/api/jobs").json()] == [job["id"]]


def test_other_users_cannot_see_jobs(client):
    register(client)
    job_id = submit(client, {"url": "https://www.youtube.com/watch?v=abc"}).json()["id"]
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get(f"/api/jobs/{job_id}").status_code == 404
    assert client.get(f"/api/jobs/{job_id}/files/pdf").status_code == 404
    assert client.get("/api/jobs").json() == []


def test_worker_success_then_download(client, monkeypatch):
    def fake_run(source, out_dir, grid, title):
        assert (source.name, grid, title) == ("source.wav", 8, "My Song")
        for ext in (".mid", ".musicxml", ".pdf"):
            (out_dir / f"source{ext}").write_bytes(b"%PDF" if ext == ".pdf" else b"x")

    monkeypatch.setattr(pipeline, "run", fake_run)
    register(client)
    job_id = submit(client, files={"file": ("My Song.wav", b"RIFF", "audio/wav")}).json()["id"]
    assert client.get(f"/api/jobs/{job_id}/files/pdf").status_code == 404  # not ready yet

    worker.process(job_id)
    assert client.get(f"/api/jobs/{job_id}").json()["status"] == "ready"
    response = client.get(f"/api/jobs/{job_id}/files/pdf")
    assert response.status_code == 200 and response.content == b"%PDF"
    assert response.headers["content-disposition"] == "inline; filename*=utf-8''My%20Song.pdf"
    assert client.get(f"/api/jobs/{job_id}/files/exe").status_code == 404


def test_worker_failure_is_reported_and_retryable(client, monkeypatch):
    def broken_run(source, out_dir, grid, title):
        raise subprocess.CalledProcessError(1, ["ffmpeg"])

    monkeypatch.setattr(pipeline, "run", broken_run)
    register(client)
    job_id = submit(client, files={"file": ("notes.txt", b"hello", "text/plain")}).json()["id"]
    worker.process(job_id)
    job = client.get(f"/api/jobs/{job_id}").json()
    assert (job["status"], job["error"]) == ("failed", "This file couldn't be read as audio.")

    assert client.post(f"/api/jobs/{job_id}/retry").json()["status"] == "queued"
    assert client.queued[-1] == job_id
    assert client.post(f"/api/jobs/{job_id}/retry").status_code == 409  # only failed jobs


def test_unexpected_errors_stay_generic():
    assert worker.user_message(ValueError("internal detail")) == "Something went wrong while arranging this song."
    assert worker.user_message(ValueError("audio longer than 10 minutes")) == "Songs can be at most 10 minutes long."
