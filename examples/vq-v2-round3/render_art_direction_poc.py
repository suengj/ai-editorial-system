#!/usr/bin/env python3
"""Render the free, local VQ-V2 Round 3 cover and 5-second opening PoC."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright


M1_SOURCE = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline/m1-source/cover.png")
WATER_SOURCE = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round2/sue-1702/hyperframes_project/assets/scene-01.png")
WATER_CHART_SOURCE = Path("/private/tmp/visual-quality-20261019-r1/evidence/sue-1639/engine-import-27s/assets/mt_81bec4347577460db717.png")
ROUND1_B = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase1/run5/html-playwright-1080x1350.png")
ROUND2_WATER_MP4 = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round2/sue-1702/ffmpeg-measured/9x16/video.mp4")

M1_TITLE = "놀고 있는 주차면, 돈이 되는 자리로"
M1_BODY = "집 앞 진입로와 상가 주차장의 빈 시간을 운전자와 연결하는 사업. 영국의 두 플랫폼은 같은 아이디어에 다르게 과금한다."
VIDEO_COPY = ["하루에 물은\n얼마나 마실까?", "필요한 양은\n사람마다 달라요"]
VIDEO_FACTS = ["총수분 참고값", "19-30세 · 총수분(음료+음식)", "2.7L 여성", "3.7L 남성", "개인별 목표가 아닌 참고값"]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_html(out: Path, cover_photo: Path, water_photo: Path) -> Path:
    html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{{box-sizing:border-box}}html,body{{margin:0;background:#071421;font-family:Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}}#cover{{width:1080px;height:1350px;position:relative;overflow:hidden;color:white;background:#071421}}#cover .photo{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}}#cover .shade{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,13,24,.05) 17%,rgba(4,13,24,.08) 37%,rgba(4,13,24,.40) 59%,rgba(4,13,24,.90) 100%)}}#cover .eyebrow{{position:absolute;left:72px;top:63px;font-size:29px;font-weight:800;letter-spacing:.08em;color:white;text-shadow:0 2px 18px #102033}}#cover .content{{position:absolute;left:72px;right:72px;bottom:62px}}#cover h1{{margin:0 0 30px;font-size:92px;line-height:1.13;letter-spacing:-.055em;font-weight:900;text-wrap:balance}}#cover h1 .accent{{color:#FFD43B}}#cover p{{margin:0;max-width:900px;font-size:39px;line-height:1.42;letter-spacing:-.025em;font-weight:600;color:#fff}}#cover .meta{{display:flex;justify-content:space-between;align-items:center;margin-top:41px;padding-top:22px;border-top:2px solid rgba(255,255,255,.56);font-size:26px;font-weight:700;color:#fff}}#opening{{width:1080px;height:1920px;position:relative;overflow:hidden;background:#edf4f5;color:#0b1c2d}}#opening img{{position:absolute;top:0;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;transform:scale(var(--zoom,1));transform-origin:50% 50%}}#opening .wash{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(247,250,250,.48) 0%,rgba(247,250,250,.20) 24%,rgba(2,20,37,0) 47%,rgba(2,20,37,.76) 100%)}}#opening .copy{{position:absolute;left:80px;right:62px;top:170px;display:none;opacity:0;transform:translateY(26px);clip-path:inset(0 0 100% 0);transition:none}}#opening[data-scene="1"] .copy.s1,#opening[data-scene="2"] .copy.s2{{display:block;opacity:1;transform:translateY(0);clip-path:inset(0 0 0 0)}}#opening .copy h2{{margin:0;font-size:118px;line-height:1.1;letter-spacing:-.065em;font-weight:900;text-wrap:balance;color:#071b2b}}#opening .copy .accent{{color:#075BFF}}#opening .copy .line{{display:block;white-space:nowrap}}#opening .rule{{height:12px;width:158px;margin-top:34px;border-radius:12px;background:#FFD43B}}#opening .copy.s2{{top:112px}}#opening .copy.s2 h2{{font-size:91px;line-height:1.08}}#opening .fact-title{{margin-top:64px;font-size:38px;line-height:1.1;font-weight:800;letter-spacing:-.025em;color:#fff}}#opening .fact-context{{margin-top:12px;font-size:28px;line-height:1.25;font-weight:650;color:rgba(255,255,255,.92)}}#opening .metrics{{display:flex;gap:62px;margin-top:32px;color:#fff}}#opening .metric{{display:flex;align-items:baseline;gap:14px}}#opening .metric strong{{font-size:118px;line-height:1;font-weight:900;letter-spacing:-.06em}}#opening .metric:first-child strong{{color:#FFD43B}}#opening .metric span{{font-size:32px;font-weight:750}}#opening .fact-note{{margin-top:28px;font-size:27px;line-height:1.2;font-weight:700;color:#fff}}#opening .copy{{transition:opacity .18s linear,transform .30s cubic-bezier(.2,.8,.2,1),clip-path .28s cubic-bezier(.2,.8,.2,1)}}
#opening .fact-title{{color:#071b2b}}#opening .fact-context{{color:#26394a}}#opening .metrics{{color:#071b2b}}#opening .metric:first-child strong{{color:#075BFF}}#opening .fact-note{{color:#071b2b}}
</style></head><body>
<main id="cover"><img class="photo" src="{cover_photo.as_uri()}"><div class="shade"></div><div class="eyebrow">BUSINESS IDEA / M1</div><section class="content"><h1>놀고 있는 주차면,<br><span class="accent">돈이 되는 자리로</span></h1><p>{M1_BODY}</p><div class="meta"><span>사업 아이디어 · 해석</span><span>1 / 5</span></div></section></main>
<main id="opening" data-scene="1"><img src="{water_photo.as_uri()}"><div class="wash"></div><section class="copy s1"><h2><span class="line">하루에 물은</span><span class="line accent">얼마나 마실까?</span></h2><div class="rule"></div></section><section class="copy s2"><h2><span class="line">필요한 양은</span><span class="line accent">사람마다 달라요</span></h2><div class="fact-title">총수분 참고값</div><div class="fact-context">19-30세 · 총수분(음료+음식)</div><div class="metrics"><div class="metric"><strong>2.7L</strong><span>여성</span></div><div class="metric"><strong>3.7L</strong><span>남성</span></div></div><div class="fact-note">개인별 목표가 아닌 참고값</div></section></main>
</body></html>'''
    path = out / "art-direction-poc.html"
    path.write_text(html, encoding="utf-8")
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    out = args.out.resolve()
    frames = out / "opening-frames"
    frames.mkdir(parents=True, exist_ok=True)
    local_assets = out / "assets"
    local_assets.mkdir(exist_ok=True)
    cover_photo = local_assets / "m1-cover-source.png"
    water_original = local_assets / "water-opening-original.png"
    water_photo = local_assets / "water-opening-photo-crop.png"
    chart_copy = local_assets / "water-data-source.png"
    shutil.copyfile(M1_SOURCE, cover_photo)
    shutil.copyfile(WATER_SOURCE, water_original)
    # Preserve the supplied bytes above; crop only its empty tail below the actual photo.
    Image.open(water_original).crop((0, 0, 1080, 1140)).save(water_photo)
    shutil.copyfile(WATER_CHART_SOURCE, chart_copy)
    html = write_html(out, cover_photo, water_photo)
    start = time.perf_counter()
    with sync_playwright() as p:
        chrome = os.environ.get("VQ_CHROMIUM", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        page = browser.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1, reduced_motion="reduce")
        page.goto(html.as_uri(), wait_until="load")
        page.locator("#cover").screenshot(path=str(out / "m1-cover-r3-1080x1350.png"), animations="disabled")
        page.set_viewport_size({"width": 390, "height": 488})
        cover_mobile = out / "m1-cover-r3-390x488.png"
        Image.open(out / "m1-cover-r3-1080x1350.png").resize((390, 488), Image.Resampling.LANCZOS).save(cover_mobile)

        page.set_viewport_size({"width": 1080, "height": 1920})
        root = page.locator("#opening")
        for frame in range(150):
            seconds = frame / 30
            scene = 1 if seconds < 2.5 else 2
            progress = seconds / 5
            page.evaluate("([s,z]) => { const e=document.querySelector('#opening'); e.dataset.scene=String(s); e.style.setProperty('--zoom',String(1 + z*.024)); }", [scene, progress])
            root.screenshot(path=str(frames / f"frame-{frame:04d}.jpg"), type="jpeg", quality=91, animations="disabled")
        for label, frame in [("t000", 0), ("t125", 37), ("t250", 75), ("t375", 112), ("t500", 149)]:
            shutil.copyfile(frames / f"frame-{frame:04d}.jpg", out / f"opening-r3-{label}.jpg")
        browser.close()
    render_wall = time.perf_counter() - start
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", "30", "-i", str(frames / "frame-%04d.jpg"), "-frames:v", "150", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out / "water-opening-r3-5s.mp4")]
    subprocess.run(cmd, check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "0.5", "-i", str(ROUND2_WATER_MP4), "-frames:v", "1", str(out / "water-opening-round2-t050.png")], check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "3.0", "-i", str(ROUND2_WATER_MP4), "-frames:v", "1", str(out / "water-opening-round2-t300.png")], check=True)
    receipt = {
        "schema_version": "vq-v2-round3-art-direction-poc/1",
        "status": "LOCAL_RENDERED; OWNER_AESTHETIC_REVIEW_PENDING",
        "scope": {"cover": "M1 cover, one 1080x1350 HTML/CSS + Playwright screenshot", "video": "water educational opening, 5.0 seconds, 9:16, 30 fps, HTML/CSS frame render + H.264 MP4"},
        "renderer": {"name": "HTML/CSS + Playwright Chromium screenshot + FFmpeg assembly", "provider_calls": 0, "measured_browser_render_wall_seconds": round(render_wall, 2)},
        "assets": {
            "cover": {"source": str(M1_SOURCE), "source_sha256": f"sha256:{sha(M1_SOURCE)}", "copied": str(cover_photo), "copied_sha256": f"sha256:{sha(cover_photo)}"},
            "water": {"source": str(WATER_SOURCE), "source_sha256": f"sha256:{sha(WATER_SOURCE)}", "copied_original": str(water_original), "copied_original_sha256": f"sha256:{sha(water_original)}", "render_crop": str(water_photo), "render_crop_sha256": f"sha256:{sha(water_photo)}", "render_crop_box_px": [0, 0, 1080, 1140]},
            "water_data_reference": {"source": str(WATER_CHART_SOURCE), "source_sha256": f"sha256:{sha(WATER_CHART_SOURCE)}", "copied": str(chart_copy), "copied_sha256": f"sha256:{sha(chart_copy)}", "usage": "source facts were re-typeset; source image retained for audit, not pasted into render"},
        },
        "copy": {"cover_title": M1_TITLE, "cover_body": M1_BODY, "video": VIDEO_COPY, "facts_added": [], "facts_preserved": VIDEO_FACTS},
        "outputs": {},
        "inputs_same_as": {"round1_cover_b": str(ROUND1_B), "round2_water_opening": str(ROUND2_WATER_MP4)},
        "disclaimer": "One-off art-direction hypothesis; no reference selected by Owner; no production, renderer default, or publication change.",
    }
    for name in ["m1-cover-r3-1080x1350.png", "m1-cover-r3-390x488.png", "water-opening-r3-5s.mp4", *[f"opening-r3-{x}.jpg" for x in ("t000", "t125", "t250", "t375", "t500")]]:
        pth = out / name
        receipt["outputs"][name] = {"sha256": f"sha256:{sha(pth)}", "bytes": pth.stat().st_size}
    (out / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"out": str(out), "cover": str(out / "m1-cover-r3-1080x1350.png"), "video": str(out / "water-opening-r3-5s.mp4"), "receipt": str(out / "receipt.json"), "render_wall_seconds": round(render_wall, 2)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
