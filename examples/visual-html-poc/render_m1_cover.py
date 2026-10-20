#!/usr/bin/env python3
"""Local-only SUE-1700 A/B for one frozen M1 cover input.

A is the existing AES render-visual compositor, invoked from this checkout.
B is a single static HTML/CSS page captured with Playwright. No external page,
JavaScript, network fetch, model, or provider call is used.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import mimetypes
import os
import platform
import resource
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = Path("/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/out-base-r0")
BASELINE = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline")
FONT_DIR = ROOT / "assets/fonts/aes-sans-kr"
FONT_FILES = {
    "regular": FONT_DIR / "AESSansKR-Regular.otf",
    "semibold": FONT_DIR / "AESSansKR-SemiBold.otf",
    "extrabold": FONT_DIR / "AESSansKR-ExtraBold.otf",
}
CANVAS = (1080, 1350)
MOBILE = (390, 488)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def build_plan(photo: Path, source: Path) -> dict:
    plan = json.loads((ARCHIVE / "render/cover.plan.json").read_text(encoding="utf-8"))
    photo_hash = digest(photo)
    plan["source"]["ref"] = str(source)
    plan["source"]["sha256"] = f"sha256:{digest(source)}"
    # Keep the archived copy, colors, slots, and text. Only point archived
    # byte-identical inputs at the local baseline and use the bundled font set.
    plan["task"]["theme"]["font_family"] = "'AES Sans KR', sans-serif"
    for layer in plan["layers"]:
        if layer.get("weight") == 500:
            layer["weight"] = 600
        elif layer.get("weight") == 700:
            layer["weight"] = 800
        if isinstance(layer.get("source_ref"), str) and layer["source_ref"].startswith("/Users/"):
            layer["source_ref"] = str(source)
    photo_layer = next(layer for layer in plan["layers"] if layer["id"] == "cover-art")
    photo_layer["ref"] = str(photo)
    photo_layer["sha256"] = f"sha256:{photo_hash}"
    generation = photo_layer["generation"]
    generation["asset_sha256"] = f"sha256:{photo_hash}"
    generation["response_ref"] = str((BASELINE / "m1-source/cover-generation.log").resolve())
    generation["response_sha256"] = f"sha256:{digest(BASELINE / 'm1-source/cover-generation.log')}"
    return plan


def make_html(photo: Path, plan: dict) -> str:
    photo_uri = data_uri(photo)
    regular, semibold, extrabold = (data_uri(FONT_FILES[key]) for key in ("regular", "semibold", "extrabold"))
    copy = {layer["id"]: layer.get("text", "") for layer in plan["layers"]}
    brand, title, body = copy["series-label"], copy["headline"], copy["cover-copy"]
    source, page = copy["source"], copy["pagination"]
    palette = plan["task"]["theme"]
    background, foreground, accent = palette["background"], palette["foreground"], palette["accent"]
    esc = html.escape
    return f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@font-face{{font-family:"AES Sans KR";src:url("{regular}") format("opentype");font-weight:400;font-style:normal;font-display:block}}
@font-face{{font-family:"AES Sans KR";src:url("{semibold}") format("opentype");font-weight:600;font-style:normal;font-display:block}}
@font-face{{font-family:"AES Sans KR";src:url("{extrabold}") format("opentype");font-weight:800;font-style:normal;font-display:block}}
*{{box-sizing:border-box}}
html,body{{margin:0;width:100%;height:100%;background:{background}}}
body{{font-family:"AES Sans KR",sans-serif;color:{foreground}}}
.card{{display:flex;flex-direction:column;width:100vw;height:100vh;overflow:hidden;background:{background}}}
header{{display:flex;align-items:center;padding:2.2% 6.5% 1.4%;font-size:clamp(15px,2.6vw,28px);font-weight:600;letter-spacing:.035em;color:{foreground}}}
.photo{{display:block;width:100%;height:54%;flex:0 0 54%;object-fit:cover;object-position:50% 50%}}
main{{display:flex;flex:1;min-height:0;flex-direction:column;justify-content:center;gap:clamp(10px,1.6vw,18px);padding:1.8% 6.5% 1%}}
h1{{margin:0;max-width:960px;font-size:clamp(42px,7.5vw,81px);font-weight:800;line-height:1.08;letter-spacing:-.04em;word-break:keep-all;overflow-wrap:anywhere;color:{foreground}}}
p{{margin:0;max-width:920px;font-size:clamp(17px,3.15vw,34px);font-weight:400;line-height:1.34;letter-spacing:-.018em;word-break:keep-all;overflow-wrap:anywhere;color:{foreground}}}
footer{{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:0 6.5% 2.2%;font-size:clamp(14px,2.25vw,24px);line-height:1.2;color:{accent}}}
.page{{font-weight:600;color:{foreground};white-space:nowrap}}
@media(max-width:600px){{
.card{{min-width:320px}}
header{{padding:12px 20px 8px;font-size:14px}}
.photo{{height:44%;flex-basis:44%}}
main{{gap:8px;padding:8px 20px 5px}}
h1{{font-size:28px;line-height:1.04;max-width:350px}}
p{{font-size:13px;line-height:1.28;max-width:350px}}
footer{{padding:0 20px 10px;font-size:11px}}
}}
</style></head><body><article class="card" aria-label="{esc(title)}">
<header><span>{esc(brand)}</span></header>
<img class="photo" src="{photo_uri}" alt="영국 주택가의 빈 진입로와 도로변 주차 차량">
<main><h1>{esc(title)}</h1><p>{esc(body)}</p></main>
<footer><span>{esc(source)}</span><span class="page">{esc(page)}</span></footer>
</article></body></html>'''


def downscale(src: Path, dest: Path) -> None:
    with Image.open(src) as opened:
        image = opened.convert("RGB")
        image.thumbnail(MOBILE, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", MOBILE, (11, 17, 32))
        canvas.paste(image, ((MOBILE[0] - image.width) // 2, (MOBILE[1] - image.height) // 2))
        canvas.save(dest, format="PNG", optimize=False, compress_level=9)


def compare(a: Path, b: Path, out: Path, labels: tuple[str, str]) -> None:
    with Image.open(a) as left, Image.open(b) as right:
        left = left.convert("RGB")
        right = right.convert("RGB")
        if left.size != right.size:
            raise ValueError(f"comparison size mismatch: {left.size} vs {right.size}")
        label_h = 48
        board = Image.new("RGB", (left.width + right.width, left.height + label_h), "white")
        draw = ImageDraw.Draw(board)
        font = ImageFont.load_default(size=20)
        draw.text((18, 14), labels[0], fill="#111827", font=font)
        draw.text((left.width + 18, 14), labels[1], fill="#111827", font=font)
        board.paste(left, (0, label_h))
        board.paste(right, (left.width, label_h))
        board.save(out, format="PNG", optimize=False, compress_level=9)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--photo", type=Path, required=True)
    parser.add_argument("--source-evidence", type=Path, required=True)
    parser.add_argument("--profile-plan", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    photo, source, profile_plan, out = (p.expanduser().resolve() for p in (args.photo, args.source_evidence, args.profile_plan, args.out))
    for path in [photo, source, profile_plan, ARCHIVE / "render/cover.plan.json", BASELINE / "m1-source/cover-generation.log", *FONT_FILES.values()]:
        if not path.is_file():
            raise SystemExit(f"required local input missing: {path}")
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"output directory must be empty to preserve existing evidence: {out}")
    out.mkdir(parents=True, exist_ok=True)
    plan = build_plan(photo, source)
    copy = {layer["id"]: layer.get("text", "") for layer in plan["layers"]}
    plan_path = out / "aes-plan.json"
    profile_path = out / "profile-receipt.json"
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    start = time.perf_counter()
    profile_run = subprocess.run([
        "node", str(ROOT / "scripts/resolve-editorial.mjs"), "--plan", str(profile_plan),
        "--target", "signalytics-news", "--task-kind", "visual", "--out", str(profile_path),
    ], cwd=ROOT, capture_output=True, text=True)
    if profile_run.returncode:
        raise SystemExit(f"profile resolution failed: {profile_run.stdout}\n{profile_run.stderr}")
    a_wall_start = time.perf_counter()
    a_run = subprocess.run([
        "node", str(ROOT / "scripts/render-visual.mjs"), "--plan", str(plan_path), "--out", str(out / "aes"),
        "--profile-receipt", str(profile_path), "--rasterizer", "rsvg",
    ], cwd=ROOT, capture_output=True, text=True)
    a_wall_s = time.perf_counter() - a_wall_start
    if a_run.returncode:
        raise SystemExit(f"AES compositor failed: {a_run.stdout}\n{a_run.stderr}")
    a_image = out / "aes/master.png"
    if not a_image.exists():
        a_image = out / "aes/image.png"
    if not a_image.exists():
        raise SystemExit(f"AES compositor PNG missing in {out / 'aes'}")
    a_copy = out / "aes-1080x1350.png"
    Image.open(a_image).convert("RGB").save(a_copy, format="PNG", optimize=False, compress_level=9)
    with Image.open(a_copy) as opened:
        if opened.size != CANVAS:
            raise SystemExit(f"AES compositor output dimensions {opened.size}, expected {CANVAS}")

    html_doc = make_html(photo, plan)
    b_wall_start = time.perf_counter()
    with sync_playwright() as p:
        launch_options = {"headless": True}
        if os.environ.get("CHROMIUM_EXECUTABLE"):
            launch_options["executable_path"] = os.environ["CHROMIUM_EXECUTABLE"]
        browser = p.chromium.launch(**launch_options)
        browser_version = browser.version
        context = browser.new_context(viewport={"width": CANVAS[0], "height": CANVAS[1]}, device_scale_factor=1, is_mobile=False)
        page = context.new_page()
        page.route("**/*", lambda route: route.abort())
        page.set_content(html_doc, wait_until="load", timeout=30000)
        page.evaluate("document.fonts.ready")
        font_ready = page.evaluate("document.fonts.check('800 48px \"AES Sans KR\"') && document.fonts.check('400 18px \"AES Sans KR\"')")
        if not font_ready:
            raise SystemExit("browser did not load the requested AES Sans KR font faces")
        overflow = page.evaluate("""() => ({
          card: document.querySelector('.card').getBoundingClientRect().toJSON(),
          header: document.querySelector('header').getBoundingClientRect().toJSON(),
          photo: document.querySelector('.photo').getBoundingClientRect().toJSON(),
          main: document.querySelector('main').getBoundingClientRect().toJSON(),
          footer: document.querySelector('footer').getBoundingClientRect().toJSON(),
          mainScrollHeight: document.querySelector('main').scrollHeight,
          mainClientHeight: document.querySelector('main').clientHeight,
          pageScrollWidth: document.documentElement.scrollWidth,
          titleText: document.querySelector('h1').innerText,
          bodyText: document.querySelector('main p').innerText,
          brandText: document.querySelector('header').innerText,
          sourceText: document.querySelector('footer span').innerText,
          pageText: document.querySelector('.page').innerText,
          fontFamily: getComputedStyle(document.querySelector('h1')).fontFamily,
          fontWeight: getComputedStyle(document.querySelector('h1')).fontWeight
        })""")
        b_desktop = out / "html-playwright-1080x1350.png"
        page.screenshot(path=str(b_desktop), full_page=True, animations="disabled")
        if overflow["mainScrollHeight"] > overflow["mainClientHeight"] or overflow["pageScrollWidth"] > CANVAS[0] or overflow["main"]["bottom"] > overflow["footer"]["top"] or overflow["photo"]["bottom"] > overflow["main"]["top"]:
            raise SystemExit(f"HTML layout overflow/collision at 1080x1350: {overflow}")
        if (overflow["brandText"], overflow["titleText"], overflow["bodyText"], overflow["sourceText"], overflow["pageText"]) != (copy["series-label"], copy["headline"], copy["cover-copy"], copy["source"], copy["pagination"]):
            raise SystemExit("HTML visible text does not match the frozen M1 copy")
        if Image.open(b_desktop).size != CANVAS:
            raise SystemExit(f"HTML desktop screenshot is not {CANVAS}")
        page.set_viewport_size({"width": MOBILE[0], "height": MOBILE[1]})
        b_responsive = out / "html-playwright-responsive-390x488.png"
        page.screenshot(path=str(b_responsive), full_page=True, animations="disabled")
        mobile_metrics = page.evaluate("""() => ({
          card: document.querySelector('.card').getBoundingClientRect().toJSON(),
          header: document.querySelector('header').getBoundingClientRect().toJSON(),
          photo: document.querySelector('.photo').getBoundingClientRect().toJSON(),
          main: document.querySelector('main').getBoundingClientRect().toJSON(),
          footer: document.querySelector('footer').getBoundingClientRect().toJSON(),
          mainScrollHeight: document.querySelector('main').scrollHeight,
          mainClientHeight: document.querySelector('main').clientHeight,
          pageScrollWidth: document.documentElement.scrollWidth,
          titleText: document.querySelector('h1').innerText,
          bodyText: document.querySelector('main p').innerText
        })""")
        if mobile_metrics["mainScrollHeight"] > mobile_metrics["mainClientHeight"] or mobile_metrics["pageScrollWidth"] > MOBILE[0] or mobile_metrics["header"]["bottom"] > mobile_metrics["photo"]["top"] or mobile_metrics["photo"]["bottom"] > mobile_metrics["main"]["top"] or mobile_metrics["main"]["bottom"] > mobile_metrics["footer"]["top"]:
            raise SystemExit(f"HTML layout overflow/collision at 390x488: {mobile_metrics}")
        if (mobile_metrics["titleText"], mobile_metrics["bodyText"]) != (copy["headline"], copy["cover-copy"]):
            raise SystemExit("HTML mobile text does not match the frozen M1 copy")
        if Image.open(b_responsive).size != MOBILE:
            raise SystemExit(f"HTML responsive screenshot is not {MOBILE}")
        context.close()
        browser.close()
    b_wall_s = time.perf_counter() - b_wall_start

    a_390 = out / "aes-downscaled-390x488.png"
    b_390 = out / "html-downscaled-390x488.png"
    downscale(a_copy, a_390)
    downscale(b_desktop, b_390)
    compare(a_copy, b_desktop, out / "comparison-1080x1350.png", ("A · current AES compositor", "B · HTML/CSS + Playwright"))
    compare(a_390, b_390, out / "comparison-390px-downscaled.png", ("A · AES, scaled from 1080", "B · HTML, scaled from 1080"))

    input_hashes = {"photo_sha256": digest(photo), "source_evidence_sha256": digest(source), "profile_plan_sha256": digest(profile_plan)}
    font_hashes = {role: digest(path) for role, path in FONT_FILES.items()}
    receipt = {
        "status": "LOCAL_STATIC_POC; OWNER_AESTHETIC_REVIEW_PENDING",
        "paid_api_calls": 0,
        "network_requests": "blocked; HTML uses inline data URIs and CSP",
        "inputs": {"photo": str(photo), **input_hashes, "copy": {"brand": copy["series-label"], "title": copy["headline"], "body": copy["cover-copy"], "source": copy["source"], "page": copy["pagination"]}, "canvas": {"width": 1080, "height": 1350}, "reference": {"path": "/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/hybrid/final/01-cover.png", "sha256": "69bdfd9ccdebf6b9bd98b400bd82c50a6c8d04f6e43439095c59099733be32f7", "authority": "same-series composition traits only"}},
        "fonts": {"family": "AES Sans KR", "sha256": font_hashes, "browser_font_faces_ready": font_ready},
        "runtime": {"os": platform.platform(), "python": platform.python_version(), "playwright": "1.60.0", "chromium": browser_version, "chromium_executable": os.environ.get("CHROMIUM_EXECUTABLE", "playwright-managed"), "node": subprocess.run(["node", "--version"], capture_output=True, text=True, check=True).stdout.strip(), "rasterizer": "rsvg-convert", "aes_main": subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()},
        "performance": {"aes_wall_s": round(a_wall_s, 3), "playwright_wall_s": round(b_wall_s, 3), "python_process_maxrss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, "python_user_cpu_s": round(resource.getrusage(resource.RUSAGE_SELF).ru_utime, 3), "python_system_cpu_s": round(resource.getrusage(resource.RUSAGE_SELF).ru_stime, 3)},
        "html_desktop_metrics": overflow,
        "html_mobile_metrics": mobile_metrics,
        "outputs": {},
    }
    for path in sorted(out.iterdir()):
        if path.is_file() and path.suffix == ".png":
            with Image.open(path) as image:
                receipt["outputs"][path.name] = {"sha256": digest(path), "width": image.width, "height": image.height, "bytes": path.stat().st_size}
    (out / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": receipt["status"], "out": str(out), "paid_api_calls": 0, "aes": a_run.stdout.strip(), "runtime": receipt["runtime"], "performance": receipt["performance"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
