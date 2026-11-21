import argparse
from pathlib import Path

from ensheet.pipeline import run


def main() -> None:
    ap = argparse.ArgumentParser(prog="ensheet", description="Audio file -> piano MIDI, MusicXML and PDF.")
    ap.add_argument("audio", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=Path("out"))
    ap.add_argument("--grid", type=int, default=16, choices=[4, 8, 16], help="quantize grid (16 = sixteenths)")
    args = ap.parse_args()
    if not args.audio.is_file():
        ap.error(f"no such file: {args.audio}")
    for p in run(args.audio, args.out, args.grid):
        print(p)


if __name__ == "__main__":
    main()
