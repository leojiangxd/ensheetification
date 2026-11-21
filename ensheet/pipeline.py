"""MVP pipeline: decode -> transcribe -> quantize -> export."""
import subprocess
import tempfile
from pathlib import Path

from music21 import chord, clef, metadata, meter, note, stream, tempo

MAX_SECONDS = 600  # README: 10-minute audio limit
SR = 22050
SPLIT_PITCH = 60  # middle C: >= goes to right hand


def decode(path: Path) -> Path:
    """Decode any ffmpeg-readable file to a mono WAV in a temp dir."""
    wav = Path(tempfile.mkdtemp()) / "audio.wav"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(path), "-ac", "1", "-ar", str(SR), str(wav)],
        check=True,
    )
    import soundfile as sf

    if sf.info(str(wav)).duration > MAX_SECONDS:
        raise ValueError(f"audio longer than {MAX_SECONDS // 60} minutes")
    return wav


def transcribe(wav: Path) -> list[tuple[float, float, int, float]]:
    """Return (start_s, end_s, midi_pitch, amplitude 0-1) note events."""
    from basic_pitch.inference import predict

    _, _, events = predict(str(wav))
    return [(s, e, int(p), float(a)) for s, e, p, a, _bends in events]


def estimate_beats(wav: Path) -> tuple[float, float]:
    """Return (bpm, first_beat_seconds)."""
    import librosa

    y, sr = librosa.load(str(wav), sr=SR)
    bpm, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
    bpm = float(bpm[0] if hasattr(bpm, "__len__") else bpm) or 120.0
    return bpm, float(beats[0]) if len(beats) else 0.0


def quantize(notes, bpm: float, offset: float = 0.0, grid: int = 16) -> stream.Score:
    """Snap notes to a grid (16 = sixteenths) and split into a two-staff piano score."""
    step = 4 / grid  # grid step in quarter lengths

    def snap(seconds: float) -> float:
        return round(max(seconds - offset, 0.0) * bpm / 60 / step) * step

    hands = {True: {}, False: {}}  # right_hand -> {onset_ql: [(end_ql, pitch, vel)]}
    for start, end, pitch, amp in notes:
        on = snap(start)
        off = max(snap(end), on + step)
        hands[pitch >= SPLIT_PITCH].setdefault(on, []).append((off, pitch, int(amp * 127)))

    score = stream.Score()
    score.insert(0, tempo.MetronomeMark(number=round(bpm)))
    for right in (True, False):
        part = stream.Part()
        part.insert(0, clef.TrebleClef() if right else clef.BassClef())
        part.insert(0, meter.TimeSignature("4/4"))
        onsets = sorted(hands[right])
        for i, on in enumerate(onsets):
            group = hands[right][on]
            # shortcut: one voice per hand, so a chord is cut off at the next onset; upgrade with voices in step 2
            nxt = onsets[i + 1] if i + 1 < len(onsets) else float("inf")
            dur = min(max(g[0] for g in group), nxt) - on
            pitches = sorted({g[1] for g in group})
            el = note.Note(pitches[0]) if len(pitches) == 1 else chord.Chord(pitches)
            el.quarterLength = dur
            el.volume.velocity = max(g[2] for g in group)
            part.insert(on, el)
        part.makeRests(fillGaps=True, inPlace=True)
        score.insert(0, part)
    return score


def export(score: stream.Score, out_dir: Path, stem: str) -> list[Path]:
    """Write .musicxml, .mid and .pdf; return their paths."""
    import verovio
    from reportlab.graphics import renderPDF
    from reportlab.pdfgen import canvas
    from svglib.svglib import svg2rlg

    out_dir.mkdir(parents=True, exist_ok=True)
    score.metadata = metadata.Metadata(title=stem, composer="")
    xml = Path(score.write("musicxml", fp=out_dir / f"{stem}.musicxml"))
    mid = Path(score.write("midi", fp=out_dir / f"{stem}.mid"))
    pdf = out_dir / f"{stem}.pdf"

    tk = verovio.toolkit()
    if not tk.loadFile(str(xml)):
        raise RuntimeError("verovio could not load the MusicXML")
    c = canvas.Canvas(str(pdf))
    with tempfile.TemporaryDirectory() as tmp:
        for page in range(1, tk.getPageCount() + 1):
            svg = Path(tmp) / f"{page}.svg"
            svg.write_text(tk.renderToSVG(page), encoding="utf-8")
            drawing = svg2rlg(str(svg))
            c.setPageSize((drawing.width, drawing.height))
            renderPDF.draw(drawing, c, 0, 0)
            c.showPage()
    c.save()
    return [mid, xml, pdf]


def run(path: Path, out_dir: Path, grid: int = 16) -> list[Path]:
    wav = decode(path)
    bpm, first_beat = estimate_beats(wav)
    score = quantize(transcribe(wav), bpm, first_beat, grid)
    return export(score, out_dir, path.stem)
