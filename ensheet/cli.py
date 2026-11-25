import argparse
from pathlib import Path

from ensheet.pipeline import run


def main() -> None:
    parser = argparse.ArgumentParser(prog="ensheet", description="Audio file -> piano MIDI, MusicXML and PDF.")
    parser.add_argument("audio", type=Path)
    parser.add_argument("-o", "--out", type=Path, default=Path("out"))
    parser.add_argument("--grid", type=int, default=16, choices=[4, 8, 16], help="quantize grid (16 = sixteenths)")
    args = parser.parse_args()
    if not args.audio.is_file():
        parser.error(f"no such file: {args.audio}")
    for output_path in run(args.audio, args.out, args.grid):
        print(output_path)


if __name__ == "__main__":
    main()
