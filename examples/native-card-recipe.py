#!/usr/bin/env python3
"""Deterministic Pillow reference for the AES 1:1 and 4:5 native card grid."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

import PIL
from PIL import Image, ImageDraw, ImageFont


CANVAS = {"1:1": (1080, 1080), "4:5": (1080, 1350)}
PHOTO_SLOT = {"1:1": (196, 352, 688, 380), "4:5": (196, 390, 688, 480)}
COLORS = {"background": "#F7F5F0", "ink": "#14213D", "accent": "#2E5BFF", "muted": "#536078"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def same_path(left: Path, right: Path) -> bool:
    left = left.expanduser().resolve()
    right = right.expanduser().resolve()
    if left == right:
        return True
    return left.exists() and right.exists() and os.path.samefile(left, right)


def cover(source: Image.Image, size: tuple[int, int]) -> tuple[Image.Image, tuple[int, int, int, int]]:
    sw, sh = source.size
    tw, th = size
    scale = max(tw / sw, th / sh)
    rw, rh = round(sw * scale), round(sh * scale)
    resized = source.resize((rw, rh), Image.Resampling.LANCZOS)
    left, top = (rw - tw) // 2, (rh - th) // 2
    box = (round(left / scale), round(top / scale), round((left + tw) / scale), round((top + th) / scale))
    return resized.crop((left, top, left + tw, top + th)), box


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--aspect", choices=CANVAS, default="1:1")
    parser.add_argument("--fit", choices=("cover", "contain"), default="cover")
    parser.add_argument("--font-regular", type=Path, required=True)
    parser.add_argument("--font-semibold", type=Path, required=True)
    parser.add_argument("--font-extrabold", type=Path, required=True)
    args = parser.parse_args()
    fonts = (args.font_regular, args.font_semibold, args.font_extrabold)
    for font in fonts:
        if not font.is_file():
            raise SystemExit(f"font file missing: {font}")
    recipe_path = Path(__file__).resolve()
    protected_inputs = (args.source, *fonts, recipe_path)
    for input_path in protected_inputs:
        if same_path(args.out, input_path) or same_path(args.receipt, input_path):
            raise SystemExit(f"output paths must not overwrite input files: {input_path}")
    if same_path(args.out, args.receipt):
        raise SystemExit("--out and --receipt must use different paths")
    source_sha256 = sha256(args.source)
    font_files = {role: {"path": str(path), "sha256": sha256(path)} for role, path in {
        "regular": args.font_regular, "semibold": args.font_semibold, "extrabold": args.font_extrabold,
    }.items()}

    width, height = CANVAS[args.aspect]
    slot_x, slot_y, slot_w, slot_h = PHOTO_SLOT[args.aspect]
    regular = ImageFont.truetype(str(args.font_regular), 24)
    semibold = ImageFont.truetype(str(args.font_semibold), 72 if args.aspect == "1:1" else 76)
    bold = ImageFont.truetype(str(args.font_extrabold), 68 if args.aspect == "1:1" else 72)
    label = ImageFont.truetype(str(args.font_semibold), 28)

    canvas = Image.new("RGB", (width, height), COLORS["background"])
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((72, 64, 112, 72), radius=4, fill=COLORS["accent"])
    title_y = 120 if args.aspect == "1:1" else 130
    draw.text((72, title_y), "하루에 물은", font=semibold, fill=COLORS["ink"])
    draw.text((72, title_y + 90), "얼마나 마실까?", font=semibold, fill=COLORS["ink"])

    # Fixed fact columns: exact labels and values are rasterized by Pillow.
    rows = [(72, "여성", "2.7L"), (558, "남성", "3.7L")]
    fact_y = 790 if args.aspect == "1:1" else 930
    for x, person, amount in rows:
        draw.text((x, fact_y), person, font=label, fill=COLORS["muted"])
        draw.text((x, fact_y + 38), amount, font=bold, fill=COLORS["ink"])

    with Image.open(args.source) as opened:
        original = opened.convert("RGB")
        source_size = original.size
        if args.fit == "cover":
            photo, crop_box = cover(original, (slot_w, slot_h))
            photo_offset = (0, 0)
        else:
            scale = min(slot_w / source_size[0], slot_h / source_size[1])
            photo_size = (round(source_size[0] * scale), round(source_size[1] * scale))
            photo = original.resize(photo_size, Image.Resampling.LANCZOS)
            crop_box = None
            photo_offset = ((slot_w - photo_size[0]) // 2, (slot_h - photo_size[1]) // 2)
    slot = Image.new("RGB", (slot_w, slot_h), COLORS["background"])
    slot.paste(photo, photo_offset)
    photo = slot
    canvas.paste(photo, (slot_x, slot_y))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((slot_x, slot_y, slot_x + slot_w - 1, slot_y + slot_h - 1), radius=20, outline="#D8D6D0", width=2)

    source_font = ImageFont.truetype(str(args.font_regular), 23)
    caution_font = ImageFont.truetype(str(args.font_semibold), 27)
    draw.text((72, height - 154), "National Academies · DRI Water · 2005", font=source_font, fill=COLORS["muted"])
    draw.text((72, height - 104), "개인별 목표가 아닌 참고값", font=caution_font, fill=COLORS["ink"])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.out, format="PNG", optimize=False, compress_level=9)
    required_scale = (max if args.fit == "cover" else min)(
        slot_w / source_size[0], slot_h / source_size[1]
    )
    receipt = {
        "status": "GENERATED_UNVERIFIED",
        "method": "deterministic_pillow_composition",
        "image_model_generation": "NOT_USED",
        "canvas_px": {"width": width, "height": height},
        "photo": {
            "source": str(args.source), "source_sha256": source_sha256,
            "source_px": {"width": source_size[0], "height": source_size[1]},
            "operation": "cover_center_crop" if args.fit == "cover" else "contain_centered_on_card_background",
            "fit": args.fit, "crop_box_source_px": crop_box,
            "contain_offset_slot_px": list(photo_offset) if args.fit == "contain" else None,
            "slot_px": {"x": slot_x, "y": slot_y, "width": slot_w, "height": slot_h},
            "required_scale": round(required_scale, 4),
            "resolution_status": "UPSCALE_WARNING" if required_scale > 1 else "NATIVE_OR_DOWNSCALE",
        },
        "text_render_owner": "Pillow",
        "exact_strings": ["하루에 물은", "얼마나 마실까?", "여성", "2.7L", "남성", "3.7L", "National Academies · DRI Water · 2005", "개인별 목표가 아닌 참고값"],
        "recipe": {"path": str(recipe_path), "sha256": sha256(recipe_path),
                    "python_version": sys.version.split()[0], "pillow_version": PIL.__version__},
        "layout_px": {"title": {"x": 72, "line_y": [title_y, title_y + 90], "width": 936,
                                  "font_px": 72 if args.aspect == "1:1" else 76},
                      "fact_columns": [{"x": 72, "label_y": fact_y, "value_y": fact_y + 38, "width": 450},
                                       {"x": 558, "label_y": fact_y, "value_y": fact_y + 38, "width": 450}],
                      "label_font_px": 28, "value_font_px": 68 if args.aspect == "1:1" else 72,
                      "source_y": height - 154, "source_font_px": 23,
                      "caution_y": height - 104, "caution_font_px": 27,
                      "photo_slot": {"x": slot_x, "y": slot_y, "width": slot_w, "height": slot_h}},
        "fonts": font_files,
        "output": {"path": str(args.out), "sha256": sha256(args.out), "format": "PNG"},
    }
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
