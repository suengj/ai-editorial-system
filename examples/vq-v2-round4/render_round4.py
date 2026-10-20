#!/usr/bin/env python3
"""Opt-in VQ-V2 R3 grammar render for AES M1 and the full water Short.

This local proof uses only archived AES/Shorts Gen inputs and Playwright,
FFmpeg, and Pillow. Existing compositor and Shorts Gen defaults are untouched.
"""
from __future__ import annotations

import argparse
import base64
from collections import deque
import hashlib
import html
import json
import mimetypes
import os
import platform
import re
import resource
import shutil
import subprocess
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASELINE = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline/m1-source")
BASE_SERIES = BASELINE / "base-series.json"
M1_ORIGINAL = Path("/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/out-base-r0/final")
M1_R1B = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase1")
MONEY = Path("/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/out-base-r0/art-direction/money-money-flow.json")
V56_ROOT = Path("/private/tmp/visual-quality-20261019-r1/evidence/sue-1639/render-round5-v56-final/video-ct_d1192e1827d84a37ac63-r1/revision-1")
V56_VIDEO = V56_ROOT / "9x16/video.mp4"
V56_PLAN = V56_ROOT / "render_plan.json"
V56_SRT = V56_ROOT / "captions.srt"
V56_MANIFEST = V56_ROOT / "manifest.json"
V56_IMAGES = [
    Path("/private/tmp/visual-quality-20261019-r1/evidence/sue-1639/engine-import-27s/assets/mt_d35ec04a56f24189b55f.png"),
    Path("/private/tmp/visual-quality-20261019-r1/evidence/sue-1639/scene-02-beverage-cropped.png"),
    Path("/private/tmp/visual-quality-20261019-r1/evidence/sue-1639/round5/derived/scene-03-chart-fixed.png"),
    Path("/private/tmp/visual-quality-20261019-r1/evidence/sue-1639/scene-04-card-with-food-water-inset.png"),
    Path("/private/tmp/visual-quality-20261019-r1/evidence/sue-1639/scene-05-food-water-cropped.png"),
    Path("/private/tmp/visual-quality-20261019-r1/evidence/sue-1639/round5/derived/scene-06-outro-fullbleed.png"),
]
FONT_DIR = ROOT / "assets/fonts/aes-sans-kr"
FONTS = [("regular", 400, FONT_DIR / "AESSansKR-Regular.otf"), ("semibold", 600, FONT_DIR / "AESSansKR-SemiBold.otf"), ("extrabold", 800, FONT_DIR / "AESSansKR-ExtraBold.otf")]
CSS_FILE = Path(__file__).with_name("art-direction.css")
W = 1080
H_CARD = 1350
H_VIDEO = 1920
FPS = 30
OWNER_QUOTE = '두번째꺼가 \'훨씬\' 낫네'


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def large_neutral_panel_regions(image: Image.Image) -> list[dict]:
    """Find large, connected, near-uniform light panels in a source image."""
    sample=image.convert("RGB")
    sample.thumbnail((320,320),Image.Resampling.BILINEAR)
    width,height=sample.size; pixels=sample.load(); seen=bytearray(width*height); regions=[]
    def panel_pixel(x: int,y: int) -> bool:
        r,g,b=pixels[x,y]
        return min(r,g,b)>=220 and max(r,g,b)-min(r,g,b)<=32
    for y in range(height):
        for x in range(width):
            start=y*width+x
            if seen[start] or not panel_pixel(x,y): continue
            seen[start]=1; todo=deque([(x,y)]); area=0
            left=right=x; top=bottom=y
            while todo:
                px,py=todo.popleft(); area+=1
                left=min(left,px);right=max(right,px);top=min(top,py);bottom=max(bottom,py)
                for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                    if 0<=nx<width and 0<=ny<height:
                        idx=ny*width+nx
                        if not seen[idx] and panel_pixel(nx,ny):
                            seen[idx]=1;todo.append((nx,ny))
            fraction=area/(width*height)
            if fraction>=.15 and (right-left+1)/width>=.18 and (bottom-top+1)/height>=.12:
                regions.append({"area_fraction":round(fraction,4),"bounds_normalized":[left/width,top/height,(right+1)/width,(bottom+1)/height]})
    return sorted(regions,key=lambda region:region["area_fraction"],reverse=True)


def panel_guard_self_test() -> dict:
    """Prove a flat panel is rejected while its photo-only crop passes."""
    fixture=Image.new("RGB",(320,480),(70,120,150))
    draw=ImageDraw.Draw(fixture);draw.rectangle((0,315,319,479),fill=(247,245,237))
    detected=large_neutral_panel_regions(fixture)
    photo_only=fixture.crop((0,0,320,314))
    if not detected or large_neutral_panel_regions(photo_only):
        raise RuntimeError("panel guard synthetic negative fixture did not behave as expected")
    return {"synthetic_panel_rejected":True,"synthetic_photo_crop_passed":True,"detected_area_fraction":detected[0]["area_fraction"]}


def implementation_identity() -> dict:
    head = run(["git", "rev-parse", "HEAD"], capture=True).strip()
    dirty = run(["git", "status", "--porcelain"], capture=True).strip()
    if dirty:
        raise RuntimeError("render receipts require a clean committed worktree")
    return {
        "git_head": head,
        "renderer_sha256": sha(Path(__file__)),
        "stylesheet_sha256": sha(CSS_FILE),
    }


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(command, check=True, text=True, capture_output=capture)
    return result.stdout + result.stderr if capture else ""


def load_m1() -> tuple[dict, list[dict]]:
    series = json.loads(BASE_SERIES.read_text(encoding="utf-8"))
    frames = series["frames"]
    if [frame["id"] for frame in frames] != ["cover", "money", "case-a", "case-b", "opportunity"]:
        raise RuntimeError("unexpected source card order")
    return series, frames


def card_baseline(card_id: str) -> tuple[Path, str]:
    if card_id == "cover":
        return M1_R1B / "run5/html-playwright-1080x1350.png", "Round 1 B · archived HTML/Playwright"
    if card_id in {"money", "case-a"}:
        return M1_R1B / f"additional-final8/{card_id}/html-playwright-1080x1350.png", "Round 1 B · archived HTML/Playwright"
    return M1_ORIGINAL / f"{'04-case-b' if card_id == 'case-b' else '05-opportunity'}.png", "AES source baseline · Round 1 B absent for this card"


def card_art(card_id: str) -> Path | None:
    return {"cover": BASELINE / "cover.png", "case-a": BASELINE / "case-a.png", "case-b": BASELINE / "case-b.png"}.get(card_id)


def font_css() -> str:
    return "\n".join(
        f'@font-face{{font-family:"AES Sans KR";src:url("{data_uri(path)}") format("opentype");font-weight:{weight};font-display:block}}'
        for _name, weight, path in FONTS
    )


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def head_html(round6: bool = False) -> str:
    extra = (ROOT / "examples/vq-v2-round4/round6-variants.css").read_text(encoding="utf-8") if round6 else ""
    return f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'"><style>{font_css()}\n{CSS_FILE.read_text(encoding="utf-8")}\n{extra}</style></head><body style="margin:0;background:#101820">'


def highlighted(text: str, needles: tuple[str, ...]) -> str:
    for needle in needles:
        if needle in text:
            left, right = text.split(needle, 1)
            return f'{esc(left)}<span class="vq-r3-accent">{esc(needle)}</span>{esc(right)}'
    return esc(text)


def card_html(frame: dict, index: int, art: Path | None, flow: dict, round6: bool = False) -> str:
    cid = frame["id"]
    headline = frame["headline"]
    body_blocks = [block["text"] for block in frame["blocks"] if block.get("kind") == "text"]
    picture = f'<img class="vq-r3-photo" src="{data_uri(art)}" alt=""><div class="vq-r3-scrim"></div>' if art else '<div class="vq-r3-scrim" style="background:radial-gradient(ellipse at 50% 55%,#385366 0%,#101820 75%)"></div>'
    if round6 and cid == "cover":
        copy = f'<section class="vq-r6-copy"><h1 class="vq-r6-title copy-check">{esc(headline)}</h1><p class="vq-r6-body copy-check">{esc(body_blocks[0])}</p></section>'
        picture = f'<img class="vq-r6-photo" src="{data_uri(art)}" alt="">' if art else ""
        variant = "declaration"
        card_class = "vq-r6-declaration"
    elif round6 and cid == "case-a":
        rows = body_blocks[0].splitlines()
        row_html = ''.join(f'<div class="vq-r6-row copy-check"><span>{esc(row.split(":",1)[0])}: </span><strong>{esc(row.split(":",1)[1].strip())}</strong></div>' for row in rows)
        copy = f'<section class="vq-r6-explainer"><h1 class="vq-r6-title copy-check">{esc(headline)}</h1><div class="vq-r6-rows">{row_html}</div></section>'
        picture = f'<img class="vq-r6-photo" src="{data_uri(art)}" alt="">' if art else ""
        variant = "explainer"
        card_class = "vq-r6-explainer"
    elif round6 and cid == "opportunity":
        items = []
        labels = ["원칙", "장애물", "첫 실험"]
        for label, text in zip(labels, body_blocks):
            if cid == "opportunity" and "\n\n" in text:
                text = text.split("\n\n", 1)[0]
            pieces = text.split("：", 1) if "：" in text else text.split(":", 1)
            line = pieces[-1].strip() if len(pieces) == 2 else text.strip()
            items.append(f'<div class="vq-r6-story-row copy-check"><span class="vq-r6-story-label">{esc(label)}: </span><span>{esc(line)}</span></div>')
        ending = next((text.split("\n\n",1)[1].strip() for text in body_blocks if "\n\n" in text), "")
        copy = f'<section class="vq-r6-story"><h1 class="vq-r6-title copy-check">{esc(headline)}</h1><div class="vq-r6-story-rows">{"".join(items)}</div><p class="vq-r6-ending copy-check">{esc(ending)}</p></section>'
        variant = "story"
        card_class = "vq-r6-story"
    elif cid == "cover":
        copy = f'<section class="vq-r3-copy"><h1 class="vq-r3-title copy-check">{highlighted(headline, ("돈이 되는", "자리로"))}</h1><p class="vq-r3-body copy-check">{esc(body_blocks[0])}</p></section>'
        variant = "cover"
    elif cid == "money":
        nodes = flow["nodes"]
        flowline = f'<div class="vq-r3-flow-node copy-check">{esc(nodes[0]["label"])}<br>{esc(nodes[0]["text"])}</div><div class="vq-r3-flow-arrow" aria-hidden="true">→</div><div class="vq-r3-flow-node copy-check">{esc(nodes[1]["label"])}<br>{esc(nodes[1]["text"])}</div>'
        related = '<section class="vq-r3-flowline" aria-label="출처에 기록된 가치 흐름 관계">' + flowline + '</section>'
        independent = '<section class="vq-r3-flow-support">' + ''.join(f'<div class="vq-r3-flow-node copy-check">{esc(node["label"])}<br>{esc(node["text"])}</div>' for node in nodes[2:]) + '</section>'
        diag = related + independent
        # Only the single edge present in the frozen source diagram is drawn.
        copy = f'<section class="vq-r3-copy"><h1 class="vq-r3-title vq-r3-title-secondary copy-check">{highlighted(headline, ("누가", "남기나"))}</h1>{diag}<p class="vq-r3-flow-note copy-check">{esc(body_blocks[0])}</p></section>'
        variant = "flow"
    elif cid in {"case-a", "case-b"}:
        rows = body_blocks[0].splitlines()
        row_html = ''.join(f'<div class="vq-r3-list-item copy-check"><span class="vq-r3-list-index">{i+1:02d}</span><span>{esc(row)}</span></div>' for i, row in enumerate(rows))
        picture = f'<img class="vq-r3-photo" src="{data_uri(art)}" alt=""><div class="vq-r3-scrim"></div>'
        copy = f'<section class="vq-r3-copy"><h1 class="vq-r3-title vq-r3-title-secondary copy-check">{highlighted(headline, ("공간 주인", "운전자가"))}</h1><div class="vq-r3-list-items">{row_html}</div>'
        if len(body_blocks) > 1:
            copy += f'<p class="vq-r3-body copy-check">{esc(body_blocks[1])}</p>'
        copy += '</section>'
        variant = "list"
    else:
        items = []
        labels = ["원칙", "장애물", "첫 실험"]
        for label, text in zip(labels, body_blocks):
            if cid == "opportunity" and "\n\n" in text:
                text = text.split("\n\n", 1)[0]
            pieces = text.split("：", 1) if "：" in text else text.split(":", 1)
            line = pieces[-1].strip() if len(pieces) == 2 else text.strip()
            separator = ": " if len(pieces) == 2 else ""
            items.append(f'<div class="vq-r3-list-item copy-check"><span class="vq-r3-list-index">{esc(label)}{separator}</span><span>{esc(line)}</span></div>')
        continuation_html = ""
        for label, text in zip(labels, body_blocks):
            if "\n\n" in text:
                continuation = text.split("\n\n", 1)[1].strip()
                if continuation:
                    continuation_html += f'<p class="vq-r3-body copy-check">{esc(continuation)}</p>'
        parking_lines = '<div class="parking-graphic" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><b></b></div>'
        copy = f'<section class="vq-r3-copy"><h1 class="vq-r3-title vq-r3-title-secondary copy-check">{highlighted(headline, ("좁게", "가설로"))}</h1><div class="vq-r3-list-items">{"".join(items)}</div>{parking_lines}{continuation_html}</section>'
        variant = "list"
    source = frame.get("source_note", "")
    photo_class = " has-photo" if art else " deterministic-art"
    if round6 and cid in {"cover", "case-a", "opportunity"}:
        return f'{head_html(round6=True)}<article class="vq-r6-card {card_class}{photo_class}" data-card="{esc(cid)}">{picture}<header class="vq-r6-header"><span>BUSINESS IDEA / M1</span><span>{index} / 5</span></header>{copy}<footer class="vq-r6-footer"><span>{esc(source)}</span><span>{index} / 5</span></footer></article></body></html>'
    return f'{head_html(round6=round6)}<article class="vq-r3-card vq-r3-{variant}{photo_class}" data-card="{esc(cid)}">{picture}<header class="vq-r3-header"><span class="series-shadow">BUSINESS IDEA / M1</span><span>{index} / 5</span></header>{copy}<footer class="vq-r3-footer"><span>{esc(source)}</span><span>{index} / 5</span></footer></article></body></html>'


def fit_check(page, expected_strings: list[str], viewport: str) -> dict:
    report = page.evaluate("""() => {
      const card=document.querySelector('[data-card]'); const box=card.getBoundingClientRect();
      const textEls=[...card.querySelectorAll('.vq-r3-header,.vq-r3-footer,.vq-r3-title,.vq-r3-body,.vq-r3-series,.vq-r3-number,.vq-r3-number-label,.vq-r3-flow-node,.vq-r3-list-item,.vq-r3-list-index,.vq-r6-header,.vq-r6-footer,.vq-r6-title,.vq-r6-body,.vq-r6-row,.vq-r6-story-row,.vq-r6-ending')];
      const clipping=textEls.filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+2).map(e=>({selector:e.className,text:e.innerText,scroll:[e.scrollWidth,e.scrollHeight],client:[e.clientWidth,e.clientHeight]}));
      const outOfBounds=textEls.filter(e=>{const r=e.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1}).map(e=>{const r=e.getBoundingClientRect();return {class:e.className,rect:[r.x,r.y,r.width,r.height],card:[box.x,box.y,box.width,box.height]}});
      const content=card.querySelector('.vq-r3-copy,.vq-r6-copy,.vq-r6-explainer,.vq-r6-story'),footer=card.querySelector('.vq-r3-footer,.vq-r6-footer');
      const visibleContent=content?[...content.children].filter(e=>e.matches('.vq-r3-title,.vq-r3-body,.vq-r3-flowline,.vq-r3-flow-support,.vq-r3-flow-note,.vq-r3-list-items,.parking-graphic,.vq-r6-title,.vq-r6-rows,.vq-r6-story-rows,.vq-r6-ending')):[];
      const maxContentBottom=visibleContent.length?Math.max(...visibleContent.map(e=>e.getBoundingClientRect().bottom)):0;
      const contentFooterOverlap=!!footer&&maxContentBottom>footer.getBoundingClientRect().top+1;
      const sizes=textEls.map(e=>parseFloat(getComputedStyle(e).fontSize));
      const minFont=Math.min(...sizes); const body=document.body;
      return {viewport:[innerWidth,innerHeight],card:[box.width,box.height],pageScroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],clipping,outOfBounds,contentFooterOverlap,minFont,fonts:sizes,overflow:card.scrollHeight>card.clientHeight+2||document.documentElement.scrollWidth>innerWidth+1||clipping.length>0||outOfBounds.length>0||contentFooterOverlap};
    }""")
    text_content = page.locator("[data-card]").inner_text().replace("\n", " ")
    normalized = re.sub(r"\s+", " ", text_content)
    missing = [s for s in expected_strings if re.sub(r"\s+", " ", s) not in normalized]
    source_text = re.sub(r"\s+", " ", " ".join(expected_strings))
    counts = {value: normalized.count(re.sub(r"\s+", " ", value)) for value in expected_strings}
    expected_counts = {value: source_text.count(re.sub(r"\s+", " ", value)) for value in expected_strings}
    duplicates = [value for value, count in counts.items() if count != expected_counts[value]]
    actual_copy = "\n".join(page.locator(".copy-check").all_inner_texts())
    actual_copy = re.sub(r"\s+", " ", actual_copy).strip()
    report.update({"viewport_label": viewport, "missing_source_strings": missing, "source_string_occurrences": counts, "expected_source_string_occurrences": expected_counts, "copy_multiplicity_mismatches": duplicates, "rendered_copy_sha256": hashlib.sha256(actual_copy.encode()).hexdigest()})
    if report["overflow"] or missing or duplicates:
        raise RuntimeError(f"{viewport} card QA failed: {report}")
    if viewport == "390x488" and report["minFont"] < 16:
        raise RuntimeError(f"390px font below 16 CSS px: {report['minFont']}")
    return report


def contact_sheet(pairs: list[tuple[Path, Path, str]], out: Path, width: int = 400) -> None:
    thumb_h = round(width * H_CARD / W)
    title_h = 42
    canvas = Image.new("RGB", (width * 2, (thumb_h + title_h) * len(pairs)), "#17212b")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=18)
    for i, (left, right, label) in enumerate(pairs):
        y = i * (thumb_h + title_h)
        draw.text((12, y + 12), label, fill="white", font=font)
        for j, path in enumerate((left, right)):
            im = Image.open(path).convert("RGB").resize((width, thumb_h), Image.Resampling.LANCZOS)
            canvas.paste(im, (j * width, y + title_h))
    canvas.save(out, format="PNG", optimize=False, compress_level=7)


def build_cards(out: Path, series: dict, frames: list[dict], round6: bool = False) -> dict:
    flow = json.loads(MONEY.read_text(encoding="utf-8"))
    cards = out / "m1"
    cards.mkdir(parents=True, exist_ok=True)
    copied_assets = out / "inputs/m1"
    copied_assets.mkdir(parents=True, exist_ok=True)
    for path in [BASE_SERIES, MONEY, *[p for p in [BASELINE / "cover.png", BASELINE / "case-a.png", BASELINE / "case-b.png"]]]:
        shutil.copy2(path, copied_assets / path.name)
    outcomes, pairs, mobile_pairs = [], [], []
    with sync_playwright() as p:
        chromium = os.environ.get("VQ_CHROMIUM", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        browser = p.chromium.launch(headless=True, executable_path=chromium)
        for idx, frame in enumerate(frames, 1):
            cid = frame["id"]
            card_out = cards / cid
            card_out.mkdir(exist_ok=True)
            art = card_art(cid)
            html_path = card_out / f"{cid}.html"
            html_path.write_text(card_html(frame, idx, art, flow, round6=round6), encoding="utf-8")
            page = browser.new_page(viewport={"width": W, "height": H_CARD}, device_scale_factor=1)
            page.route("**/*", lambda route: route.continue_() if route.request.url.startswith(("file:", "data:")) else route.abort())
            page.goto(html_path.as_uri(), wait_until="load")
            page.evaluate("document.fonts.ready")
            if not page.evaluate("document.fonts.check('800 52px \"AES Sans KR\"')"):
                raise RuntimeError(f"AES font failed to load: {cid}")
            expected = [frame["headline"]]
            for block in frame["blocks"]:
                if block.get("kind") != "text":
                    continue
                if cid in {"case-a", "case-b", "opportunity"} and block["text"]:
                    expected.extend(line.strip() for line in block["text"].splitlines() if line.strip())
                else:
                    expected.append(block["text"])
            if cid == "money":
                expected.extend(value for node in flow["nodes"] for value in (node["label"],node["text"]))
            if cid == "cover": expected += ["BUSINESS IDEA / M1"]
            qa_desktop = fit_check(page, expected, "1080x1350")
            png = card_out / ("round6-1080x1350.png" if round6 else "round4-1080x1350.png")
            page.locator("[data-card]").screenshot(path=str(png), animations="disabled")
            page.set_viewport_size({"width":390,"height":488})
            qa_mobile = fit_check(page, expected, "390x488")
            mobile = card_out / ("round6-responsive-390x488.png" if round6 else "round4-responsive-390x488.png")
            page.locator("[data-card]").screenshot(path=str(mobile), animations="disabled")
            page.close()
            if round6:
                baseline = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round4-final4") / "m1" / cid / "round4-1080x1350.png"
                label = "Round 4 opt-in grammar"
            else:
                baseline, label = card_baseline(cid)
            if not baseline.is_file():
                raise RuntimeError(f"required baseline missing: {baseline}")
            baseline_copy = card_out / "baseline.png"
            shutil.copy2(baseline, baseline_copy)
            round = "round6" if round6 else "round4"
            comp = card_out / f"baseline-vs-{round}.png"
            contact_sheet([(baseline_copy, png, f"{cid} | {label}  →  {round.title()}")], comp, width=540)
            pairs.append((baseline_copy, png, f"{cid} | {label}  →  {round.title()}"))
            outcomes.append({"id":cid,"variant":({"cover":"declaration","money":"round4-flow","case-a":"explainer","case-b":"round4-list","opportunity":"narrative"} if round6 else {"cover":"cover","money":"flow","case-a":"list","case-b":"list","opportunity":"list"})[cid],"source_photo":str(art) if art else None,"source_photo_sha256":sha(art) if art else None,"expected_source_strings_sha256":hashlib.sha256("\n".join(expected).encode()).hexdigest(),"rendered_copy_sha256":qa_desktop["rendered_copy_sha256"],"implementation":implementation_identity(),"baseline":str(baseline),"baseline_label":label,"outputs":{"1080x1350":str(png),"390x488":str(mobile),"comparison":str(comp)},"output_sha256":{"1080x1350":sha(png),"390x488":sha(mobile)},"qa":{"desktop":qa_desktop,"mobile":qa_mobile}})
        browser.close()
    round = "round6" if round6 else "round4"
    contact_sheet(pairs, out / f"m1/baseline-vs-{round}-contact-sheet.png", width=540)
    # A larger, directly readable mobile sheet; original responsive 390px captures.
    mobile_contact_sheet([(Path(entry["outputs"]["390x488"]),entry["id"]) for entry in outcomes], out / f"m1/{round}-mobile-contact-sheet.png")
    return {"cards":outcomes,"contact_sheet":str(out / "m1/baseline-vs-round4-contact-sheet.png"),"mobile_contact_sheet":str(out / "m1/round4-mobile-contact-sheet.png"),"copy_fact_policy":"frame headlines, text blocks, money-flow nodes and source notes preserved exactly; labels used only where already present in frozen source"}


def copy_video_inputs(out: Path) -> list[Path]:
    inp = out / "inputs/water"
    inp.mkdir(parents=True, exist_ok=True)
    for source, name in zip(V56_IMAGES, [f"scene-{i:02d}.png" for i in range(1,7)]):
        if not source.is_file(): raise RuntimeError(f"Shorts Gen original asset missing: {source}")
        shutil.copy2(source, inp / name)
    # Source scene 4 frames the food/drink photo inside an off-white card. Crop
    # the actual photo pixels for the full-bleed R3 scene; preserve the source.
    scene4_crop=inp/"scene-04-photo-only-crop.png"
    with Image.open(inp/"scene-04.png") as source_image:
        source_image.crop((230,635,845,1256)).save(scene4_crop)
    # Scene 1 has a full-width cream panel below its photo. Locate its first
    # uniform cream rows and crop those pixels before using the photo as a
    # full-bleed 9:16 background, matching the Round 3 opening treatment.
    scene1_crop=inp/"scene-01-photo-only-crop.png"
    with Image.open(inp/"scene-01.png") as source_image:
        rgb=source_image.convert("RGB")
        sample=rgb.resize((min(160,rgb.width),rgb.height),Image.Resampling.BILINEAR)
        panel_start=None
        for y in range(round(rgb.height*.45),round(rgb.height*.9)):
            row=[sample.getpixel((x,y)) for x in range(sample.width)]
            cream=sum(1 for r,g,b in row if r>=240 and g>=234 and b>=214)
            if cream/len(row)>=.96:
                if panel_start is None: panel_start=y
            else:
                panel_start=None
            if panel_start is not None and y-panel_start>=4:
                break
        if panel_start is None:
            raise RuntimeError("scene-01 embedded cream panel boundary not found")
        crop_bottom=max(1,panel_start-1)
        rgb.crop((0,0,rgb.width,crop_bottom)).save(scene1_crop)
        with Image.open(scene1_crop) as cropped:
            if cropped.height!=crop_bottom or cropped.width!=rgb.width or crop_bottom>=panel_start:
                raise RuntimeError("scene-01 panel exclusion crop geometry invalid")
    for source, name in [(V56_VIDEO,"v56-video-original.mp4"),(V56_PLAN,"v56-render-plan.json"),(V56_SRT,"v56-captions.srt"),(V56_MANIFEST,"v56-manifest.json")]:
        shutil.copy2(source, inp / name)
    return [inp / f"scene-{i:02d}.png" for i in range(1,7)] + [scene4_crop,scene1_crop]


def video_scene_assets(images: list[Path]) -> list[tuple[int,int,Path]]:
    # output scene id, originating asset scene id, panel-free image used
    return [(1,1,images[7]),(2,2,images[1]),(3,2,images[1]),(4,4,images[6]),(5,5,images[4]),(6,6,images[5])]


def video_page_html(images: list[Path], render_plan: dict) -> str:
    pages = render_plan["caption_pages"]["9:16"]
    payload = json.dumps(pages, ensure_ascii=False).replace("</", "<\\/")
    # The water reference scene stays photographic. Reuse the preceding water
    # photo behind the chart facts, then crop the food image from the source
    # scene 4 card so the original cream panel is not part of the new design.
    scene_assets=video_scene_assets(images)
    sections = ''.join(f'<img class="vq-r3-photo scene-bg" data-scene="{scene}" data-source-scene="{source_scene}" src="{data_uri(image)}" alt="">' for scene,source_scene,image in scene_assets)
    facts='<div id="data-facts" class="vq-r3-video-facts"><div class="vq-r3-video-fact"><strong class="vq-r3-video-value">2.7L</strong><span>여성</span></div><div class="vq-r3-video-fact"><strong class="vq-r3-video-value">3.7L</strong><span>남성</span></div></div>'
    opening_title='<h1 id="opening-title" class="vq-r3-video-opening-title">하루에 물은<span>얼마나 마실까?</span></h1>'
    return f'''{head_html()}<main id="stage" class="vq-r3-card vq-r3-video vq-r3-cover">{sections}<div class="vq-r3-scrim"></div>{opening_title}<div id="data-top" class="vq-r3-video-label">총수분 참고값 · 19–30세</div>{facts}<div id="caption" class="vq-r3-video-copy"><div class="vq-r3-caption"></div><div id="data-bottom" class="vq-r3-video-label">개인별 목표가 아닌 참고값</div></div></main><script>window.CAPTION_PAGES={payload};</script></body></html>'''


def video_layout_check(page, t: float) -> dict:
    result = page.evaluate("""() => {
      const stage=document.querySelector('#stage'), sb=stage.getBoundingClientRect();
      const selectors=['#opening-title','#caption .vq-r3-caption','#data-top','#data-bottom','#data-facts .vq-r3-video-fact','#data-facts .vq-r3-video-value','#data-facts .vq-r3-video-fact span'];
      const items=[];
      for(const selector of selectors){for(const el of document.querySelectorAll(selector)){
        const style=getComputedStyle(el), r=el.getBoundingClientRect();
        if(style.display==='none'||style.visibility==='hidden'||!el.innerText.trim()||r.width<1||r.height<1) continue;
        const font=parseFloat(style.fontSize);
        const bounds=[r.left>=sb.left-1,r.right<=sb.right+1,r.top>=sb.top-1,r.bottom<=sb.bottom+1].every(Boolean);
        const range=document.createRange(); range.selectNodeContents(el); const tr=range.getBoundingClientRect();
        const textBounds=[tr.left>=sb.left-1,tr.right<=sb.right+1,tr.top>=sb.top-1,tr.bottom<=sb.bottom+1].every(Boolean);
        const clipped=el.scrollWidth>el.clientWidth+3;
        items.push({selector,text:el.innerText,rect:[r.x,r.y,r.width,r.height],text_rect:[tr.x,tr.y,tr.width,tr.height],font,bounds,text_bounds:textBounds,clipped,scroll:[el.scrollWidth,el.scrollHeight],client:[el.clientWidth,el.clientHeight]});
      }}
      const caption=items.find(x=>x.selector==='#caption .vq-r3-caption');
      const top=items.find(x=>x.selector==='#data-top'), bottom=items.find(x=>x.selector==='#data-bottom');
      const overlap=(a,b)=>a&&b&&a.rect[0]<b.rect[0]+b.rect[2]&&a.rect[0]+a.rect[2]>b.rect[0]&&a.rect[1]<b.rect[1]+b.rect[3]&&a.rect[1]+a.rect[3]>b.rect[1];
      const supports=[top,bottom].filter(Boolean);
      return {items,min_caption_px:caption?caption.font:null,min_support_px:supports.length?Math.min(...supports.map(x=>x.font)):null,support_count:supports.length,issues:items.filter(x=>!x.bounds||!x.text_bounds||x.clipped),caption_support_overlap:overlap(caption,bottom)};
    }""")
    result["time_seconds"] = round(t, 3)
    title=page.locator("#opening-title")
    if t<2.566667:
        title_text=re.sub(r"\s+"," ",title.inner_text()).strip() if title.is_visible() else ""
        if title_text!="하루에 물은 얼마나 마실까?":
            raise RuntimeError(f"opening title missing or changed at {t:.3f}s: {title_text!r}")
        if page.locator("#caption .vq-r3-caption").inner_text().strip():
            raise RuntimeError(f"opening karaoke caption duplicates the title at {t:.3f}s")
    elif title.is_visible():
        raise RuntimeError(f"opening title persists beyond scene 1 at {t:.3f}s")
    if 5.5 <= t < 12.6:
        top_text = re.sub(r"\s+", " ", page.locator("#data-top").inner_text()).strip()
        bottom_text = re.sub(r"\s+", " ", page.locator("#data-bottom").inner_text()).strip()
        fact_nodes = [re.sub(r"\s+", " ", el.inner_text()).strip() for el in page.locator("#data-facts .vq-r3-video-fact").all()]
        result["fact_elements"] = {"top": top_text, "bottom": bottom_text, "numbers": fact_nodes}
        if top_text != "총수분 참고값 · 19–30세" or bottom_text != "개인별 목표가 아닌 참고값" or fact_nodes != ["2.7L 여성", "3.7L 남성"]:
            raise RuntimeError(f"video fact elements differ from expected source strings: {result}")
    if result["issues"] or result["caption_support_overlap"]:
        raise RuntimeError(f"video text layout failed: {result}")
    if result["min_caption_px"] is not None and result["min_caption_px"] < 42:
        raise RuntimeError(f"video caption below 42 CSS px: {result}")
    if result["support_count"] and result["min_support_px"] < 44:
        raise RuntimeError(f"video support label below 44 CSS px: {result}")
    return result


def render_water(out: Path) -> dict:
    images = copy_video_inputs(out)
    panel_fixture_result=panel_guard_self_test()
    source_controls={}
    for source_scene,path in ((1,images[0]),(3,images[2]),(4,images[3])):
        with Image.open(path) as source_image:
            detected=large_neutral_panel_regions(source_image)
        source_controls[str(source_scene)]={"source":path.name,"panel_detected":bool(detected),"regions":detected}
        if not detected:
            raise RuntimeError(f"panel detector failed the known source control for scene {source_scene}")
    with Image.open(images[0]) as opening_source:
        detected_top=source_controls["1"]["regions"][0]["bounds_normalized"][1]*opening_source.height
    with Image.open(images[7]) as opening_crop:
        scene1_crop_box=[0,0,opening_crop.width,opening_crop.height]
    if scene1_crop_box[3]>detected_top+2:
        raise RuntimeError(f"scene-01 crop overlaps its detected panel region: crop={scene1_crop_box}, panel_y={detected_top}")
    scene_photo_checks=[]
    for output_scene,source_scene,path in video_scene_assets(images):
        with Image.open(path) as visible_asset:
            panel_regions=large_neutral_panel_regions(visible_asset)
        check={"output_scene":output_scene,"source_scene":source_scene,"source":path.name,"asset_sha256":sha(path),"embedded_panel_excluded":not bool(panel_regions),"detected_panel_regions":panel_regions}
        if output_scene==1: check["crop_box_px"]=scene1_crop_box
        if output_scene==4: check["crop_box_px"]=[230,635,845,1256]
        if panel_regions:
            raise RuntimeError(f"photo-only source check found a panel in output scene {output_scene}: {check}")
        scene_photo_checks.append(check)
    plan = json.loads(V56_PLAN.read_text(encoding="utf-8"))
    pages = plan["caption_pages"]["9:16"]
    for cap in pages:
        for line_index,line in enumerate(cap["lines"]):
            source_line=line["text"]
            words=" ".join(w["text"] for w in cap["words"] if w["line_index"]==line_index)
            if re.sub(r"\s+"," ",source_line.strip()) != re.sub(r"\s+"," ",words.strip()):
                raise RuntimeError(f"caption words differ from v56 source string: {source_line!r} != {words!r}")
    duration = float(plan["duration_s"])
    frame_dir = out / "water/round5-frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    page_path = out / "water/render.html"
    page_path.write_text(video_page_html(images, plan), encoding="utf-8")
    start=time.perf_counter(); cpu_start=resource.getrusage(resource.RUSAGE_SELF)
    layout_min_caption=999.0; layout_min_support=999.0; layout_support_samples=0
    frame_scene_counts={i:0 for i in range(1,7)}
    with sync_playwright() as p:
        chromium = os.environ.get("VQ_CHROMIUM", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        browser=p.chromium.launch(headless=True,executable_path=chromium)
        page=browser.new_page(viewport={"width":W,"height":H_VIDEO},device_scale_factor=1,reduced_motion="reduce")
        page.route("**/*",lambda route:route.continue_() if route.request.url.startswith(("file:","data:")) else route.abort())
        page.goto(page_path.as_uri(),wait_until="load")
        page.evaluate("document.fonts.ready")
        if not page.evaluate("document.fonts.check('800 52px \"AES Sans KR\"')"): raise RuntimeError("video AES font failed to load")
        for n in range(round(duration*FPS)):
            t=n/FPS
            scene_index=next((i for i,s in enumerate(plan["segments"]) if s["start_s"]<=t<s["end_s"]),len(plan["segments"])-1)
            scene_id=plan["segments"][scene_index]["scene_id"]
            image_scene=int(scene_id[-3:])
            frame_scene_counts[image_scene]+=1
            page.evaluate("""([t,scene,pages]) => {
              const imgs=[...document.querySelectorAll('.scene-bg')];
              imgs.forEach((im,i)=>{ const active=(i+1)===scene; im.style.opacity=active?'1':'0'; if(active){const progress=t/27.5; im.style.transform=`scale(${1.015+progress*.025}) translate(${(progress-.5)*-1.2}%, ${(progress-.5)*.7}%)`;}});
              const active=pages.find(p=>t>=p.start_s&&t<p.end_s);
              document.querySelector('#opening-title').style.display=scene===1?'block':'none';
              const caption=document.querySelector('.vq-r3-caption'); caption.replaceChildren();
              if(active && !(t<2.566667)){
                const lines=active.lines.map(()=>[]);
                for(const w of active.words){ if(t>=w.start_s) lines[w.line_index].push({text:w.text,end:w.end_s}); }
                for(const words of lines){if(!words.length)continue; const row=document.createElement('div'); for(let i=0;i<words.length;i++){const span=document.createElement('span');span.textContent=words[i].text+(i<words.length-1?' ':'');span.className='revealed'+(i===words.length-1&&t<words[i].end?' current':'');row.append(span);}caption.append(row);}
              }
              const showData=t>=5.5&&t<12.6;
              document.querySelector('#data-top').style.display=showData?'block':'none';
              document.querySelector('#data-bottom').style.display=showData?'block':'none';
              document.querySelector('#data-facts').style.display=showData?'grid':'none';
            }""",[t,image_scene,pages])
            layout = video_layout_check(page, t)
            if layout["min_caption_px"] is not None: layout_min_caption=min(layout_min_caption,layout["min_caption_px"])
            if layout["support_count"]:
                layout_min_support=min(layout_min_support,layout["min_support_px"]); layout_support_samples+=1
            page.locator("#stage").screenshot(path=str(frame_dir/f"frame-{n:04d}.jpg"),type="jpeg",quality=90,animations="disabled")
        browser.close()
    if sum(frame_scene_counts.values())!=round(duration*FPS) or any(count==0 for count in frame_scene_counts.values()):
        raise RuntimeError(f"photo-only scene checks did not cover every rendered frame: {frame_scene_counts}")
    render_wall=time.perf_counter()-start; cpu_end=resource.getrusage(resource.RUSAGE_SELF)
    out_video=out/"water/water-round5-27s-9x16.mp4"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate",str(FPS),"-i",str(frame_dir/"frame-%04d.jpg"),"-frames:v",str(round(duration*FPS)),"-an","-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p","-movflags","+faststart",str(out_video)])
    # Reuse the exact local TTS/BGM mix as encoded in the v56 MP4 audio stream.
    muxed=out/"water/water-round5-27s-9x16-muxed.mp4"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(out_video),"-i",str(V56_VIDEO),"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","copy","-shortest","-movflags","+faststart",str(muxed)])
    # Retain the clean no-audio encode for audit, then promote muxed to final artifact filename.
    final=out/"water/water-round5-27s-9x16.mp4"
    muxed.replace(final)
    source_audio=out/"water/v56-audio-original.aac"
    final_audio=out/"water/round4-audio-reused.aac"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(V56_VIDEO),"-vn","-c:a","copy","-f","adts",str(source_audio)])
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(final),"-vn","-c:a","copy","-f","adts",str(final_audio)])
    # Sample corresponding before/after frames at every storyboard beat plus the ending.
    sample_ts=[0.5,2.7,5.7,8.8,12.8,16.9,22.4,27.1]
    before_after=[]
    for i,t in enumerate(sample_ts,1):
        b=out/f"water/v56-t{i:02d}.jpg"; a=out/f"water/round5-t{i:02d}.jpg"
        run(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss",str(t),"-i",str(V56_VIDEO),"-frames:v","1","-q:v","2",str(b)])
        shutil.copy2(frame_dir/f"frame-{round(t*FPS):04d}.jpg",a)
        before_after.append((b,a,f"{t:.1f}s | v56 → Round 5"))
    video_sheet=out/"water/v56-before-after-round5-contact-sheet.png"
    video_contact_sheet(before_after,video_sheet)
    # Per-sample direct inspection sheet from Round 4 frames, with timestamp labels.
    after_sheet=out/"water/round5-keyframes-contact-sheet.png"
    video_contact_sheet([(a,a,label.split(" | ")[0]+" | Round 5") for _,a,label in before_after],after_sheet)
    opening_sheets=water_opening_review_sheets(out,frame_dir)
    ebur = run(["ffmpeg","-hide_banner","-nostats","-i",str(final),"-filter_complex","ebur128=peak=true","-f","null","-"],capture=True)
    (out/"water/ebur128.txt").write_text(ebur,encoding="utf-8")
    qa={"ffprobe":json.loads(run(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(final)],capture=True)),"ebur128_summary":next((line.strip() for line in reversed(ebur.splitlines()) if "I:" in line and "LUFS" in line),None),"source_audio_sha256":sha(source_audio),"final_audio_sha256":sha(final_audio),"audio_bitstream_identical":sha(source_audio)==sha(final_audio),"caption_pages":len(pages),"caption_source_srt_sha256":sha(V56_SRT),"caption_timing_plan_sha256":sha(V56_PLAN),"video_frame_layout_checks":round(duration*FPS),"video_layout_issues":0,"minimum_caption_font_px":None if layout_min_caption==999.0 else layout_min_caption,"minimum_support_font_px":None if layout_min_support==999.0 else layout_min_support,"support_label_visible_frames":layout_support_samples,"frames":round(duration*FPS),"samples":[str(a) for _,a,_ in before_after]}
    for item in scene_photo_checks: item["rendered_frames"]=frame_scene_counts[item["output_scene"]]
    if [item["output_scene"] for item in scene_photo_checks]!=list(range(1,7)) or not all(item["embedded_panel_excluded"] and item["rendered_frames"]>0 for item in scene_photo_checks):
        raise RuntimeError("photo-only check is missing a rendered scene")
    result={"implementation":implementation_identity(),"source_video":str(V56_VIDEO),"source_video_sha256":sha(V56_VIDEO),"assets":[{"path":str(x),"sha256":sha(x)} for x in images],"scene_01_panel_exclusion":"uniform cream lower panel detected from source pixels and crop boundary checked against the detected component","scene_01_source_panel_detection":source_controls["1"],"scene_01_photo_crop_box_px":scene1_crop_box,"scene_03_source_panel_detection":source_controls["3"],"scene_03_render_policy":"embedded data card source omitted; output scene uses the photo-only scene-02 asset behind deterministic fact typography","scene_04_source_panel_detection":source_controls["4"],"scene_04_photo_crop_box_px":[230,635,845,1256],"panel_guard_algorithm":{"color":"near-neutral bright pixels: min RGB >=220 and channel spread <=32","minimum_component_fraction":0.15,"minimum_component_width_fraction":0.18,"minimum_component_height_fraction":0.12,"synthetic_negative_fixture":panel_fixture_result},"photo_only_scene_checks":scene_photo_checks,"photo_only_scene_frame_counts":frame_scene_counts,"opening_title":"하루에 물은 / 얼마나 마실까?","opening_title_visible_until_seconds":2.566667,"opening_duplicate_caption_hidden":True,"opening_review_sheets":opening_sheets,"water_fact_strings_displayed":["총수분 참고값","19–30세","2.7L","여성","3.7L","남성","개인별 목표가 아닌 참고값"],"duration_seconds":duration,"fps":FPS,"output":str(final),"output_sha256":sha(final),"before_after_contact_sheet":str(video_sheet),"keyframes_contact_sheet":str(after_sheet),"ebur128_path":str(out/"water/ebur128.txt"),"technical_qa":qa,"runtime":{"playwright_wall_seconds":round(render_wall,2),"process_user_cpu_seconds":round(cpu_end.ru_utime-cpu_start.ru_utime,2),"process_system_cpu_seconds":round(cpu_end.ru_stime-cpu_start.ru_stime,2),"process_max_rss_mb":round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/(1024*1024),1),"browser":"Chromium"}}
    (out/"water/receipt.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return result


def video_contact_sheet(items: list[tuple[Path,Path,str]], out: Path, width: int=270) -> None:
    h=round(width*16/9); label_h=34
    canvas=Image.new("RGB",(width*2,(h+label_h)*len(items)),"#17212b")
    draw=ImageDraw.Draw(canvas); font=ImageFont.load_default(size=16)
    for i,(before,after,label) in enumerate(items):
        y=i*(h+label_h); draw.text((10,y+10),label,fill="white",font=font)
        for j,path in enumerate((before,after)):
            im=Image.open(path).convert("RGB").resize((width,h),Image.Resampling.LANCZOS)
            canvas.paste(im,(j*width,y+label_h))
    canvas.save(out,format="PNG",optimize=False,compress_level=7)


def water_opening_review_sheets(out: Path, frame_dir: Path) -> dict:
    review_times=[i/2 for i in range(9)]
    samples=[frame_dir/f"frame-{round(t*FPS):04d}.jpg" for t in review_times]
    if any(not p.is_file() for p in samples):
        raise RuntimeError("water opening review sample frame missing")
    width=360; height=round(width*16/9); label_h=32; cols=3; rows=3
    grid=Image.new("RGB",(cols*width,rows*(height+label_h)),"#17212b")
    draw=ImageDraw.Draw(grid); font=ImageFont.load_default(size=18)
    for i,(t,path) in enumerate(zip(review_times,samples)):
        x=(i%cols)*width; y=(i//cols)*(height+label_h)
        draw.text((x+10,y+8),f"Round 5 | {t:.1f}s",fill="white",font=font)
        im=Image.open(path).convert("RGB").resize((width,height),Image.Resampling.LANCZOS)
        grid.paste(im,(x,y+label_h))
    opening_sheet=out/"water/round5-opening-0-to-4s-half-second-contact-sheet.png"
    grid.save(opening_sheet,format="PNG",optimize=False,compress_level=7)

    r3=Path("/Volumes/OricoSSD/MacArchive/vq-v2-round3/art-direction-poc")
    r4=Path("/Volumes/OricoSSD/MacArchive/vq-v2-round4-final4/water/round4-frames")
    trio=[
      (r3/"opening-r3-t000.jpg",r4/"frame-0015.jpg",frame_dir/"frame-0015.jpg","0.5s: R3 0.0s | R4 0.5s | R5 0.5s"),
      (r3/"opening-r3-t125.jpg",r4/"frame-0045.jpg",frame_dir/"frame-0045.jpg","1.5s: R3 1.25s | R4 1.5s | R5 1.5s"),
    ]
    trio_sheet=Image.new("RGB",(width*3,len(trio)*(height+label_h)),"#17212b")
    draw=ImageDraw.Draw(trio_sheet)
    for row,items in enumerate(trio):
        y=row*(height+label_h); draw.text((10,y+8),items[3],fill="white",font=font)
        for col,path in enumerate(items[:3]):
            if not path.is_file(): raise RuntimeError(f"comparison evidence missing: {path}")
            im=Image.open(path).convert("RGB").resize((width,height),Image.Resampling.LANCZOS)
            trio_sheet.paste(im,(col*width,y+label_h))
    comparison=out/"water/round3-vs-round4-vs-round5-opening-contact-sheet.png"
    trio_sheet.save(comparison,format="PNG",optimize=False,compress_level=7)
    return {"opening_0_to_4s_half_second_contact_sheet":str(opening_sheet),"round3_round4_round5_comparison_sheet":str(comparison),"sample_times_seconds":review_times}


def mobile_contact_sheet(items: list[tuple[Path,str]], out: Path) -> None:
    label_h=30; card_w=390; card_h=488
    canvas=Image.new("RGB",(card_w,(card_h+label_h)*len(items)),"#17212b")
    draw=ImageDraw.Draw(canvas); font=ImageFont.load_default(size=16)
    for i,(path,label) in enumerate(items):
        y=i*(card_h+label_h); draw.text((10,y+8),f"{label} | responsive 390×488",fill="white",font=font)
        im=Image.open(path).convert("RGB").resize((card_w,card_h),Image.Resampling.LANCZOS)
        canvas.paste(im,(0,y+label_h))
    canvas.save(out,format="PNG",optimize=False,compress_level=7)


def main() -> None:
    ap=argparse.ArgumentParser()
    ap.add_argument("--out",type=Path,default=Path("/Volumes/OricoSSD/MacArchive/vq-v2-round4"))
    ap.add_argument("--cards-only",action="store_true")
    ap.add_argument("--video-only",action="store_true")
    ap.add_argument("--owner-reference-variants",action="store_true",help="render opt-in R6 owner-selected reference grammars for M1 cards")
    args=ap.parse_args()
    if args.cards_only and args.video_only: raise SystemExit("choose one scope or neither")
    if args.owner_reference_variants and args.video_only: raise SystemExit("owner reference variants apply to M1 cards only")
    out=args.out.resolve()
    if out.exists() and any(out.iterdir()): raise SystemExit(f"evidence output must be empty to protect prior results: {out}")
    out.mkdir(parents=True,exist_ok=True)
    series,frames=load_m1()
    cards_result=None; video_result=None
    if not args.video_only: cards_result=build_cards(out,series,frames,round6=args.owner_reference_variants)
    if not args.cards_only: video_result=render_water(out)
    result={"schema":"vq-v2-round4-render/1","round":"6-owner-reference-variants" if args.owner_reference_variants else "4","status":"LOCAL_RENDERED; OWNER_REFERENCE_CANDIDATES_SELECTED; OWNER_AESTHETIC_REVIEW_PENDING","owner_quote_verbatim":"2,3,4,8,10 괜찮아 - 나머지도 괜찮지만 패턴이 유사해보임" if args.owner_reference_variants else OWNER_QUOTE,"provider_calls":0,"paid_spend_usd":0,"defaults_changed":False,"implementation":implementation_identity(),"m1":cards_result,"video":video_result,"runtime":{"platform":platform.platform(),"python":platform.python_version()}}
    (out/"receipt.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"OK","out":str(out),"cards":bool(cards_result),"video":bool(video_result)},ensure_ascii=False))

if __name__=="__main__": main()
