"""MVP pipeline: decode -> estimate beats -> transcribe -> quantize -> export."""
import re
import subprocess
import tempfile
from pathlib import Path

from music21 import chord, clef, metadata, meter, note, stream, tempo

MAX_DURATION_SECONDS = 600  # README: 10-minute audio limit
SAMPLE_RATE = 22050
RIGHT_HAND_LOWEST_PITCH = 60  # middle C: >= goes to right hand


def run(audio_path: Path, out_dir: Path, grid_subdivision: int = 16, title: str | None = None) -> list[Path]:
    wav_path = decode(audio_path)
    bpm, first_beat_in_seconds = estimate_beats(wav_path)
    score = quantize(transcribe(wav_path), bpm, first_beat_in_seconds, grid_subdivision)
    return export(score, out_dir, audio_path.stem, title)


def decode(audio_path: Path) -> Path:
    """Decode any ffmpeg-readable file to a mono WAV in a temp dir."""
    wav_path = Path(tempfile.mkdtemp()) / "audio.wav"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(audio_path), "-ac", "1", "-ar", str(SAMPLE_RATE), str(wav_path)],
        check=True,
    )
    import soundfile

    if soundfile.info(str(wav_path)).duration > MAX_DURATION_SECONDS:
        raise ValueError(f"audio longer than {MAX_DURATION_SECONDS // 60} minutes")
    return wav_path


def estimate_beats(wav_path: Path) -> tuple[float, float]:
    """Return (bpm, first_beat_in_seconds)."""
    import librosa

    samples, sample_rate = librosa.load(str(wav_path), sr=SAMPLE_RATE)
    bpm, beat_times = librosa.beat.beat_track(y=samples, sr=sample_rate, units="time")
    bpm = float(bpm[0] if hasattr(bpm, "__len__") else bpm) or 120.0
    return bpm, float(beat_times[0]) if len(beat_times) else 0.0


def transcribe(wav_path: Path) -> list[tuple[float, float, int, float]]:
    """Return (start_s, end_s, midi_pitch, amplitude 0-1) note events."""
    from basic_pitch.inference import predict

    _model_output, _midi_data, note_events = predict(str(wav_path))
    return [
        (start, end, int(pitch), float(amplitude))
        for start, end, pitch, amplitude, _pitch_bends in note_events
    ]


def quantize(notes, bpm: float, first_beat_in_seconds: float = 0.0, grid_subdivision: int = 16) -> stream.Score:
    """Snap notes to a grid (16 = sixteenths) and split into a two-staff piano score."""
    step_quarters = 4 / grid_subdivision  # grid step in quarter lengths

    def seconds_to_grid(seconds: float) -> float:
        return round(max(seconds - first_beat_in_seconds, 0.0) * bpm / 60 / step_quarters) * step_quarters

    # is_right_hand -> {onset (quarters): [(release (quarters), pitch, velocity)]}
    onsets_by_hand = {True: {}, False: {}}
    for start, end, pitch, amplitude in notes:
        onset = seconds_to_grid(start)
        release = max(seconds_to_grid(end), onset + step_quarters)
        is_right_hand = pitch >= RIGHT_HAND_LOWEST_PITCH
        onsets_by_hand[is_right_hand].setdefault(onset, []).append((release, pitch, int(amplitude * 127)))

    score = stream.Score()
    score.insert(0, tempo.MetronomeMark(number=round(bpm)))
    for is_right_hand in (True, False):
        part = stream.Part()
        part.insert(0, clef.TrebleClef() if is_right_hand else clef.BassClef())
        part.insert(0, meter.TimeSignature("4/4"))
        hand_onsets = onsets_by_hand[is_right_hand]
        sorted_onsets = sorted(hand_onsets)
        for index, onset in enumerate(sorted_onsets):
            chord_notes = hand_onsets[onset]
            # shortcut: one voice per hand, so a chord is cut off at the next onset; upgrade with voices in step 2
            next_onset = sorted_onsets[index + 1] if index + 1 < len(sorted_onsets) else float("inf")
            duration = min(max(release for release, _, _ in chord_notes), next_onset) - onset
            pitches = sorted({pitch for _, pitch, _ in chord_notes})
            element = note.Note(pitches[0]) if len(pitches) == 1 else chord.Chord(pitches)
            element.quarterLength = duration
            element.volume.velocity = max(velocity for _, _, velocity in chord_notes)
            part.insert(onset, element)
        part.makeRests(fillGaps=True, inPlace=True)
        score.insert(0, part)
    return score


def export(score: stream.Score, out_dir: Path, stem: str, title: str | None = None) -> list[Path]:
    """Write .musicxml, .mid and .pdf named after `stem`; return their paths. `title` (default: stem) heads the score."""
    import verovio
    from reportlab.graphics import renderPDF
    from reportlab.pdfgen import canvas
    from svglib.svglib import svg2rlg

    out_dir.mkdir(parents=True, exist_ok=True)
    score.metadata = metadata.Metadata(title=title or stem, composer="")
    musicxml_path = Path(score.write("musicxml", fp=out_dir / f"{stem}.musicxml"))
    midi_path = Path(score.write("midi", fp=out_dir / f"{stem}.mid"))
    pdf_path = out_dir / f"{stem}.pdf"

    toolkit = verovio.toolkit()
    # 10 mm on every side of A4; Verovio's default is 5 mm
    toolkit.setOptions({f"pageMargin{side}": 100 for side in ("Top", "Bottom", "Left", "Right")})
    toolkit.setOptions({"footer": "none"})
    if not toolkit.loadFile(str(musicxml_path)):
        raise RuntimeError("verovio could not load the MusicXML")
    pdf_canvas = canvas.Canvas(str(pdf_path))
    pdf_canvas.setTitle(title or stem)
    with tempfile.TemporaryDirectory() as tmp_dir:
        for page_number in range(1, toolkit.getPageCount() + 1):
            svg_path = Path(tmp_dir) / f"{page_number}.svg"
            svg_text = re.sub(
                r"<text [^>]*>\s*<tspan [^>]*\bx=.*?</text>", _flatten_text, toolkit.renderToSVG(page_number), flags=re.S
            )
            # svglib applies px->pt twice to a nested <svg>, shrinking the score to 75%; merge the inner viewBox into the outer svg
            svg_text = re.sub(r'(<svg [^>]*?)>(\s*<desc>.*?</desc>.*?)<svg class="definition-scale"([^>]*?) (viewBox="[^"]*")>',
                              r'\1 \4>\2<g\3>', svg_text, count=1, flags=re.S)
            svg_text = svg_text[: svg_text.rindex("</svg>", 0, svg_text.rindex("</svg>"))] + "</g></svg>"
            # shortcut: Verovio's Windows build emits its page-number dash "–" as mojibake "â€“"; fix that one string,
            # upgrade if other Verovio-generated text shows up garbled
            svg_text = svg_text.replace("â€“", "–")
            svg_path.write_text(svg_text, encoding="utf-8")
            drawing = svg2rlg(str(svg_path))
            pdf_canvas.setPageSize((drawing.width, drawing.height))
            renderPDF.draw(drawing, pdf_canvas, 0, 0)
            pdf_canvas.showPage()
    pdf_canvas.save()
    return [midi_path, musicxml_path, pdf_path]


def _flatten_text(match: re.Match) -> str:
    """Collapse Verovio's positioned, nested <tspan>s into one <text>.

    svglib ignores x/y on <tspan> (title drawn at x=0, cut off) and centres each
    tspan on its own (page header "– 2 –" drawn on top of itself).
    """
    text_element = match.group(0)
    tspans = re.findall(  # [(font_size, content)]
        r'<tspan font-size="([^"]+)">([^<]*)</tspan>', re.sub(r"<title.*?</title>", "", text_element, flags=re.S)
    )
    if not tspans:
        return text_element
    attributes = {}
    for name, value in re.findall(r'\b(x|y|text-anchor)="([^"]*)"', text_element):
        attributes.setdefault(name, value)  # first occurrence wins
    attribute_str = " ".join(f'{name}="{value}"' for name, value in attributes.items())
    text = "".join(content for _, content in tspans).strip()  # already XML-escaped by Verovio
    return f'<text {attribute_str} font-size="{tspans[0][0]}">{text}</text>'
