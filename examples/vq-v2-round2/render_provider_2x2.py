#!/usr/bin/env python3
"""Render a source-art × renderer matrix using one frozen M1 cover.

The current AES compositor and the Round 2 repaired HTML/CSS layout consume the
same source art, text plan, palette, and canvas. Outputs are local only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline")
ARCHIVE = Path("/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/out-base-r0")
SOURCE = BASE / "m1-source/source-evidence.json"
PROFILE_PLAN = ARCHIVE / "series.json"
CANVAS = (1080, 1350)
MOBILE = (390, 488)

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(ROOT / "examples/visual-html-poc"))
import render_b_variants as improved  # noqa: E402
import render_m1_cover as current  # noqa: E402


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--openai-photo", type=Path, required=True)
    ap.add_argument("--openai-metadata", type=Path, required=True)
    ap.add_argument("--openai-cost-usd", type=float, required=True)
    args = ap.parse_args()
    openai_metadata = json.loads(args.openai_metadata.read_text(encoding="utf-8"))
    if (openai_metadata.get("provider") != "OpenAI" or openai_metadata.get("status") != "OK"
            or openai_metadata.get("http_status") != 200 or openai_metadata.get("returned_image_count") != 1):
        raise SystemExit("OpenAI metadata must describe a successful OpenAI image response")
    if openai_metadata.get("sha256") != sha(args.openai_photo.resolve()):
        raise SystemExit("OpenAI metadata hash does not match the supplied generated image")
    if not all(isinstance(openai_metadata.get(k), str) and openai_metadata[k].strip() for k in ("model", "quality", "prompt")):
        raise SystemExit("OpenAI response metadata must include model, quality, and prompt")
    response_metadata_hash = sha(args.openai_metadata.resolve())
    prompt_hash = hashlib.sha256(openai_metadata["prompt"].encode("utf-8")).hexdigest()
    local_attempt_id = f"local-attempt-{response_metadata_hash[:16]}"
    out = args.out.resolve()
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"refuse to overwrite evidence: {out}")
    photos = [
        ("existing-generation", BASE / "m1-source/cover.png", "openai-codex-native-image", "gpt-6-luna", None, None),
        ("openai-image-api", args.openai_photo.resolve(), "OpenAI Images API", openai_metadata["model"], openai_metadata["quality"], args.openai_cost_usd),
    ]
    inputs = [SOURCE, PROFILE_PLAN, ARCHIVE / "render/cover.plan.json", BASE / "m1-source/cover-generation.log", *current.FONT_FILES.values()]
    if not all(p.is_file() for p in inputs) or not all(p.is_file() for _, p, *_ in photos):
        raise SystemExit("frozen inputs/fonts/API image missing")
    out.mkdir(parents=True, exist_ok=True)
    run_started = time.perf_counter()
    rows = []

    for row, photo, provider, model, quality, cost in photos:
        row_dir = out / row
        row_dir.mkdir()
        cur = row_dir / "current"
        cur.mkdir()
        plan = current.build_plan(photo, SOURCE)
        generation = next(x for x in plan["layers"] if x.get("id") == "cover-art")["generation"]
        generation.update({"provider": provider, "model": model, "mode": "native" if quality is None else "api"})
        if quality is not None:
            generation.update({
                # The provider exposes no request ID; derive a traceable local ID from the response receipt.
                "invocation_id": local_attempt_id,
                "asset_sha256": f"sha256:{openai_metadata['sha256']}",
                "response_ref": str(args.openai_metadata.resolve()),
                "response_sha256": f"sha256:{response_metadata_hash}",
            })
        plan_path = cur / "aes-plan.json"
        profile_path = cur / "profile-receipt.json"
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        profile = subprocess.run([
            "node", str(ROOT / "scripts/resolve-editorial.mjs"), "--plan", str(PROFILE_PLAN),
            "--target", "signalytics-news", "--task-kind", "visual", "--out", str(profile_path),
        ], cwd=ROOT, capture_output=True, text=True)
        if profile.returncode:
            raise SystemExit(f"current profile resolution failed: {profile.stderr[-1000:]}")
        started = time.perf_counter()
        result = subprocess.run([
            "node", str(ROOT / "scripts/render-visual.mjs"), "--plan", str(plan_path),
            "--out", str(cur / "aes"), "--profile-receipt", str(profile_path), "--rasterizer", "rsvg",
        ], cwd=ROOT, capture_output=True, text=True)
        if result.returncode:
            raise SystemExit(f"current AES compositor failed: stderr={result.stderr[-1200:]} stdout={result.stdout[-1200:]}")
        a_candidates = [cur / "aes/master.png", cur / "aes/image.png"]
        a_source = next((p for p in a_candidates if p.is_file()), None)
        if a_source is None:
            raise SystemExit("current AES render output missing")
        a = cur / "current-1080x1350.png"
        Image.open(a_source).convert("RGB").save(a, format="PNG", optimize=False, compress_level=9)
        if Image.open(a).size != CANVAS:
            raise SystemExit(f"current render dimensions invalid: {Image.open(a).size}")
        a_wall = time.perf_counter() - started

        better = row_dir / "improved"
        better.mkdir()
        texts = improved.data()
        document = improved.html_doc("cover", "B", texts, cover_photo=photo)
        b = better / "improved-1080x1350.png"
        mobile = better / "improved-390x488.png"
        started = time.perf_counter()
        with sync_playwright() as p:
            executable = os.environ.get("CHROMIUM_EXECUTABLE") or "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            browser = p.chromium.launch(headless=True, executable_path=executable)
            page = browser.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
            page.route("**/*", lambda route: route.abort())
            page.set_content(document, wait_until="load")
            page.evaluate("document.fonts.ready")
            if not page.evaluate("document.fonts.check('800 36px AES')"):
                raise SystemExit("improved renderer AES font load failed")
            desktop_metrics = improved.validate_card(page, *CANVAS)
            page.screenshot(path=str(b), animations="disabled")
            page.set_viewport_size({"width": 390, "height": 488})
            mobile_metrics = improved.validate_card(page, *MOBILE)
            page.screenshot(path=str(mobile), animations="disabled")
            browser_version = browser.version
            browser.close()
        b_wall = time.perf_counter() - started
        for img_path, size in ((b, CANVAS), (mobile, MOBILE)):
            if Image.open(img_path).size != size:
                raise SystemExit(f"bad improved render dimensions: {img_path}")
        a_mobile = cur / "current-390x488.png"
        Image.open(a).convert("RGB").resize(MOBILE, Image.Resampling.LANCZOS).save(a_mobile)
        rows.append({
            "source": row, "photo": str(photo), "provider": provider, "model": model,
            "generation_quality": quality, "generation_cost_usd": cost,
            "generation_prompt_sha256": prompt_hash if quality is not None else None,
            "generation_response_metadata": str(args.openai_metadata.resolve()) if quality is not None else None,
            "generation_response_metadata_sha256": sha(args.openai_metadata.resolve()) if quality is not None else None,
            "photo_sha256": sha(photo), "current": str(a), "current_sha256": sha(a),
            "current_wall_s": round(a_wall, 3), "improved": str(b), "improved_sha256": sha(b),
            "improved_mobile": str(mobile), "improved_mobile_sha256": sha(mobile),
            "current_mobile": str(a_mobile), "current_mobile_sha256": sha(a_mobile),
            "improved_wall_s": round(b_wall, 3), "mobile_metrics": mobile_metrics,
            "desktop_metrics": desktop_metrics,
            "browser_version": browser_version, "provider_calls_during_render": 0,
        })

    labels = ["Current · AES compositor", "Improved · repaired HTML/CSS"]
    row_h = CANVAS[1] + 48
    board = Image.new("RGB", (CANVAS[0] * 2, row_h * 2), "white")
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default(size=20)
    for i, item in enumerate(rows):
        y = i * row_h
        draw.text((18, y + 14), f"{item['source']} · {labels[0]}", fill="#14213d", font=font)
        draw.text((CANVAS[0] + 18, y + 14), f"{item['source']} · {labels[1]}", fill="#14213d", font=font)
        board.paste(Image.open(item["current"]).convert("RGB"), (0, y + 48))
        board.paste(Image.open(item["improved"]).convert("RGB"), (CANVAS[0], y + 48))
    matrix = out / "current-improved-2x2.png"
    board.save(matrix)
    receipt = {
        "status": "PARTIAL_MATRIX_RENDERED; GOOGLE_GENERATION_BLOCKED_NO_BILLING_SETUP; OWNER_AESTHETIC_REVIEW_PENDING",
        "canvas": list(CANVAS), "mobile_canvas": list(MOBILE), "copy_plan_sha256": sha(ARCHIVE / "render/cover.plan.json"),
        "source_evidence_sha256": sha(SOURCE), "profile_plan_sha256": sha(PROFILE_PLAN),
        "matrix": rows, "matrix_path": str(matrix), "matrix_sha256": sha(matrix),
        "matrix_bytes": matrix.stat().st_size, "wall_s": round(time.perf_counter() - run_started, 3),
        "limits": ["Google image absent: HTTP 402 depleted prepayment credits; no billing setup per owner constraint", "one sample per source is illustrative, not a provider benchmark", "no asset or renderer promoted"],
    }
    (out / "matrix-receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": receipt["status"], "matrix": str(matrix), "sha256": receipt["matrix_sha256"], "rows": rows, "wall_s": receipt["wall_s"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
