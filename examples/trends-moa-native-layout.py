#!/usr/bin/env python3
"""Deterministic Trends.moa typography fixture for the AES native Pillow path.

The before mode reproduces the reported coordinate/measurement failure class.
It is not the owner's original PNG or a claim about its exact renderer.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

import PIL
from PIL import Image, ImageDraw, ImageFont


W, H = 1080, 1350
GRID_X = 64
BG, PANEL, INK, MUTED, ACCENT, STROKE = "#101326", "#0A0D1D", "#F6F2FA", "#B9B5C5", "#D99CFF", "#C789E8"
TEXT = {
    "brand": "TRENDS.MOA",
    "date": "10.20 TREND",
    "headline_1": "회사에선 못 만들겠는데",
    "headline_2": "게임에선 공장 짓는다고?",
    "subtitle": "AI 시대 개발자의 묘한 퇴근 루틴",
    "fact_label": "팩트 체크",
    "body_1": "r/pcgaming 익명 이용자 한 명은",
    "body_2": "승진과 AI 변화 이후 줄어든 ‘만드는 재미’를",
    "body_3": "게임 팩토리오에서 찾았다고 했어.",
    "question": "퇴근하고 또 생산하는 게임, 이해됨?",
    "source": "익명 1건 자기보고 · 2026.10.19",
    "footer": "연출 이미지",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def same_path(left: Path, right: Path) -> bool:
    left = left.expanduser().resolve()
    right = right.expanduser().resolve()
    if left == right:
        return True
    return left.exists() and right.exists() and os.path.samefile(left, right)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    if not path.is_file():
        raise SystemExit(f"FONT_LOAD_ERROR: font file not found: {path}")
    try:
        return ImageFont.truetype(str(path), size)
    except (OSError, ValueError) as exc:
        raise SystemExit(f"FONT_LOAD_ERROR: cannot load {path}: {exc}") from exc


def ink_bbox(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
             anchor: str, point: tuple[int, int]) -> tuple[int, int, int, int]:
    raw = draw.textbbox((0, 0), text, font=face, anchor=anchor)
    return (point[0] + raw[0], point[1] + raw[1], point[0] + raw[2], point[1] + raw[3])


def draw_centered(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
                  box: tuple[int, int, int, int], fill: str, anchor: str = "mm") -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    point = ((x0 + x1) // 2, (y0 + y1) // 2)
    draw.text(point, text, font=face, fill=fill, anchor=anchor)
    return ink_bbox(draw, text, face, anchor, point)


def draw_left_mid(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
                  x: int, center_y: int, fill: str) -> tuple[int, int, int, int]:
    raw = draw.textbbox((0, 0), text, font=face, anchor="lm")
    point = (x - raw[0], center_y)
    draw.text(point, text, font=face, fill=fill, anchor="lm")
    return ink_bbox(draw, text, face, "lm", point)


def pill(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont,
         center: tuple[int, int], pad_x: int, pad_y: int, *, align: str = "left") -> dict:
    if align not in {"left", "right", "center"}:
        raise ValueError(f"unsupported pill alignment: {align}")
    measured = draw.textbbox((0, 0), text, font=face, anchor="mm")
    text_w, text_h = measured[2] - measured[0], measured[3] - measured[1]
    if align == "left":
        x0 = center[0]
    elif align == "right":
        x0 = center[0] - text_w - 2 * pad_x
    else:
        x0 = center[0] - (text_w + 2 * pad_x) // 2
    y0 = center[1] - (text_h + 2 * pad_y) // 2
    box = (x0, y0, x0 + text_w + 2 * pad_x, y0 + text_h + 2 * pad_y)
    draw.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=PANEL, outline=STROKE, width=2)
    text_box = draw_centered(draw, text, face, box, ACCENT)
    lpad, rpad = text_box[0] - box[0], box[2] - text_box[2]
    tpad, bpad = text_box[1] - box[1], box[3] - text_box[3]
    return {"text": text, "box": box, "text_bbox": text_box,
            "padding": {"left": lpad, "right": rpad, "top": tpad, "bottom": bpad},
            "padding_asymmetry_px": max(abs(lpad-rpad), abs(tpad-bpad))}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--font-regular", type=Path, required=True)
    parser.add_argument("--font-bold", type=Path, required=True)
    parser.add_argument("--mode", choices=("before", "after"), default="after")
    args = parser.parse_args()
    protected_inputs = (args.font_regular, args.font_bold, Path(__file__).resolve())
    for input_path in protected_inputs:
        if same_path(args.out, input_path) or same_path(args.receipt, input_path):
            raise SystemExit(f"OUTPUT_PATH_COLLISION: output/receipt must not overwrite input: {input_path}")
    if same_path(args.out, args.receipt):
        raise SystemExit("OUTPUT_PATH_COLLISION: --out and --receipt must be different paths")
    # Fail closed before creating any output. Never use Pillow's default font.
    regular = font(args.font_regular, 27)
    brand_font = font(args.font_bold, 27)
    date_font = font(args.font_bold, 22)
    title_font = font(args.font_bold, 59)
    subtitle_font = font(args.font_bold, 28)
    label_font = font(args.font_bold, 24)
    body_font = font(args.font_regular, 31)
    question_font = font(args.font_bold, 30)
    footer_font = font(args.font_regular, 20)

    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    rows: list[dict] = []

    if args.mode == "before":
        # Failure-class fixture: guessed text width, top-left baseline placement,
        # and unrelated x positions as seen in the owner's screenshot.
        d.rounded_rectangle((58, 64, 345, 116), radius=26, fill=PANEL, outline=STROKE, width=2)
        d.text((81, 87), TEXT["brand"], font=brand_font, fill=INK)
        d.rounded_rectangle((850, 68, 1009, 116), radius=24, fill=PANEL, outline=STROKE, width=2)
        d.text((869, 87), TEXT["date"], font=date_font, fill=ACCENT)
        d.text((58, 184), TEXT["headline_1"], font=title_font, fill=INK, stroke_width=2, stroke_fill="#05060C")
        d.text((58, 279), TEXT["headline_2"], font=title_font, fill=INK, stroke_width=2, stroke_fill="#05060C")
        d.rounded_rectangle((58, 369, 994, 423), radius=24, fill=PANEL, outline=STROKE, width=2)
        d.text((82, 391), TEXT["subtitle"], font=subtitle_font, fill=ACCENT)
        d.rounded_rectangle((56, 905, 1024, 1185), radius=32, fill=PANEL, outline=STROKE, width=2)
        d.rounded_rectangle((89, 929, 268, 980), radius=24, fill=ACCENT)
        d.text((106, 950), TEXT["fact_label"], font=label_font, fill=PANEL)
        for i, key in enumerate(("body_1", "body_2", "body_3")):
            d.text((96, 1017 + i * 47), TEXT[key], font=body_font, fill=INK)
        d.rounded_rectangle((64, 1202, 1016, 1270), radius=20, fill=PANEL)
        d.text((91, 1225), TEXT["question"], font=question_font, fill=ACCENT)
        d.text((66, 1293), TEXT["source"], font=footer_font, fill=MUTED)
        d.text((829, 1293), TEXT["footer"], font=footer_font, fill=MUTED)
        report = {"mode": "before", "status": "REPRODUCTION_ONLY", "checks": [],
                  "note": "Failure-class recreation, not the owner's original image or renderer readback."}
    else:
        brand = pill(d, TEXT["brand"], brand_font, (GRID_X, 90), 24, 11, align="left")
        date = pill(d, TEXT["date"], date_font, (1016, 90), 22, 10, align="right")
        title1 = draw_left_mid(d, TEXT["headline_1"], title_font, GRID_X, 226, INK)
        title2 = draw_left_mid(d, TEXT["headline_2"], title_font, GRID_X, 312, INK)
        subtitle = pill(d, TEXT["subtitle"], subtitle_font, (GRID_X, 404), 22, 10, align="left")
        d.rounded_rectangle((GRID_X, 900, 1016, 1176), radius=30, fill=PANEL, outline=STROKE, width=2)
        fact = pill(d, TEXT["fact_label"], label_font, (GRID_X + 18, 944), 20, 10, align="left")
        body_boxes = []
        for i, key in enumerate(("body_1", "body_2", "body_3")):
            body_boxes.append(draw_left_mid(d, TEXT[key], body_font, GRID_X + 30, 1020 + 48 * i, INK))
        d.rounded_rectangle((GRID_X, 1193, 1016, 1271), radius=22, fill=PANEL)
        question = draw_left_mid(d, TEXT["question"], question_font, GRID_X + 28, 1232, ACCENT)
        source = draw_left_mid(d, TEXT["source"], footer_font, GRID_X, 1307, MUTED)
        footer = draw_left_mid(d, TEXT["footer"], footer_font, 860, 1307, MUTED)

        # The left edge of each content region shares one grid. Padded labels
        # align by their container; text itself is centered in the measured box.
        left_edges = {"brand_container": brand["box"][0], "title": title1[0],
                      "subtitle_container": subtitle["box"][0], "fact_panel": GRID_X,
                      "question_band": GRID_X, "source": source[0]}
        for name, x in left_edges.items():
            rows.append({"element": name, "check": "left_grid", "delta_px": x - GRID_X,
                         "status": "PASS" if abs(x-GRID_X) <= 2 else "FAIL"})
        for name, item in (("brand", brand), ("date", date), ("subtitle", subtitle), ("fact_label", fact)):
            x0, y0, x1, y1 = item["box"]
            bx0, by0, bx1, by1 = item["text_bbox"]
            inside = x0 <= bx0 and y0 <= by0 and bx1 <= x1 and by1 <= y1
            sym = item["padding_asymmetry_px"] <= 2
            rows.append({"element": name, "check": "bbox_inside_and_symmetric_padding",
                         "bbox_inside": inside, "padding_asymmetry_px": item["padding_asymmetry_px"],
                         "status": "PASS" if inside and sym else "FAIL"})
        content_boxes = {
            "headline_1": (title1, (GRID_X, 180, 1016, 266)),
            "headline_2": (title2, (GRID_X, 266, 1016, 352)),
            "body_1": (body_boxes[0], (GRID_X + 30, 990, 1010, 1050)),
            "body_2": (body_boxes[1], (GRID_X + 30, 1038, 1010, 1098)),
            "body_3": (body_boxes[2], (GRID_X + 30, 1086, 1010, 1146)),
            "question": (question, (GRID_X + 20, 1193, 1016, 1271)),
            "source": (source, (GRID_X, 1282, 760, 1334)),
            "footer": (footer, (760, 1282, 1016, 1334)),
        }
        for name, (bbox, container) in content_boxes.items():
            inside = (container[0] <= bbox[0] and container[1] <= bbox[1]
                      and bbox[2] <= container[2] and bbox[3] <= container[3])
            rows.append({"element": name, "check": "text_bbox_inside_container",
                         "text_bbox": bbox, "container": container, "bbox_inside": inside,
                         "status": "PASS" if inside else "FAIL"})
        report = {"mode": "after", "status": "PASS" if all(r["status"] == "PASS" for r in rows) else "FAIL",
                  "grid_x": GRID_X, "checks": rows,
                  "text_bbox": {"headline_1": title1, "headline_2": title2,
                                "body": body_boxes, "question": question, "source": source, "footer": footer},
                  "pill_geometry": {"brand": brand, "date": date, "subtitle": subtitle, "fact_label": fact}}
        if report["status"] != "PASS":
            raise SystemExit("LAYOUT_SELFCHECK_FAILED: one or more text geometry checks failed")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.out, format="PNG", optimize=False, compress_level=9)
    report.update({"canvas_px": [W, H], "font_paths": {"regular": str(args.font_regular), "bold": str(args.font_bold)},
                   "font_sha256": {"regular": sha256(args.font_regular), "bold": sha256(args.font_bold)},
                   "output_sha256": sha256(args.out), "output": str(args.out), "pillow": PIL.__version__})
    args.receipt.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("element | check | bbox/padding/grid | result")
    for row in report["checks"]:
        print(f"{row['element']} | {row['check']} | {row.get('delta_px', row.get('padding_asymmetry_px', 'inside='+str(row.get('bbox_inside'))))} | {row['status']}")
    print(f"SELF_CHECK={report['status']} SHA256={report['output_sha256']}")


if __name__ == "__main__":
    main()
