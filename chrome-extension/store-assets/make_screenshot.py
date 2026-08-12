"""Fit a screenshot into an exact Chrome Web Store screenshot size.

Usage:
    python3 make_screenshot.py input.png output.png [--size 1280x800] [--bg "#1e1e1e"]

Sizes accepted by the store: 1280x800 or 640x400. Output is always a
24-bit PNG with no alpha channel (RGB, not RGBA).
"""
import argparse
from PIL import Image


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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--size", default="1280x800", choices=["1280x800", "640x400"])
    parser.add_argument("--bg", default="#1e1e1e", help="hex background color for letterboxing")
    args = parser.parse_args()

    w, h = (int(x) for x in args.size.split("x"))
    fit_to_canvas(args.input, args.output, (w, h), args.bg)
