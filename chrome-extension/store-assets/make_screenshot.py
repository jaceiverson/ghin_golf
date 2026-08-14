"""Fit a screenshot into an exact Chrome Web Store screenshot size.

Usage:
    python3 make_screenshot.py input.png output.png [--size 1280x800] [--bg "#1e1e1e"]

    # batch mode: converts every *.png in --dir that isn't already named
    # shot<N>.png, writing each as the next free shot<N>.png in that
    # directory (oldest file first, by modification time).
    python3 make_screenshot.py [--dir .] [--size 1280x800] [--bg "#1e1e1e"]

Sizes accepted by the store: 1280x800 or 640x400. Output is always a
24-bit PNG with no alpha channel (RGB, not RGBA).
"""
import argparse
import re
from pathlib import Path

from PIL import Image

SHOT_NAME_RE = re.compile(r"^shot(\d+)\.png$", re.IGNORECASE)


def fit_to_canvas(src_path, dst_path, size, bg):
    target_w, target_h = size
    img = Image.open(src_path).convert("RGB")

    scale = min(target_w / img.width, target_h / img.height)
    new_w, new_h = int(img.width * scale), int(img.height * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (target_w, target_h), bg)
    offset = ((target_w - new_w) // 2, (target_h - new_h) // 2)
    canvas.paste(resized, offset)
    canvas.save(dst_path, "PNG")
    print(f"wrote {dst_path} ({target_w}x{target_h})")


def next_shot_number(directory):
    existing = [SHOT_NAME_RE.match(p.name) for p in directory.glob("*.png")]
    numbers = [int(m.group(1)) for m in existing if m]
    return max(numbers, default=0) + 1


def batch_convert(directory, size, bg):
    candidates = [p for p in directory.glob("*.png") if not SHOT_NAME_RE.match(p.name)]
    candidates.sort(key=lambda p: p.stat().st_mtime)

    if not candidates:
        print(f"no un-converted PNGs found in {directory}")
        return

    number = next_shot_number(directory)
    for src in candidates:
        dst = directory / f"shot{number}.png"
        fit_to_canvas(src, dst, size, bg)
        number += 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?", help="omit (with --dir) to batch-convert a whole folder instead")
    parser.add_argument("output", nargs="?")
    parser.add_argument("--dir", default=".", help="batch mode: folder to scan for PNGs to convert")
    parser.add_argument("--size", default="1280x800", choices=["1280x800", "640x400"])
    parser.add_argument("--bg", default="#1e1e1e", help="hex background color for letterboxing")
    args = parser.parse_args()

    w, h = (int(x) for x in args.size.split("x"))

    if args.input:
        if not args.output:
            parser.error("output is required when input is given")
        fit_to_canvas(args.input, args.output, (w, h), args.bg)
    else:
        batch_convert(Path(args.dir), (w, h), args.bg)
