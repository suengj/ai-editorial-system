#!/usr/bin/env python3
"""Render two same-input HTML/Playwright samples against frozen AES outputs.

This is an offline visual experiment. Existing compositor PNGs and all source
facts/artwork are reused byte-for-byte; this script does not invoke providers.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import html
from importlib.metadata import version
import json
import mimetypes
import os
import platform
import resource
import subprocess
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = Path("/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/out-base-r0")
BASELINE = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline")
FONT_DIR = ROOT / "assets/fonts/aes-sans-kr"
FONTS = {
    "regular": FONT_DIR / "AESSansKR-Regular.otf",
    "semibold": FONT_DIR / "AESSansKR-SemiBold.otf",
    "extrabold": FONT_DIR / "AESSansKR-ExtraBold.otf",
}
CANVAS = (1080, 1350)
MOBILE = (390, 488)
SOURCE_JSON = BASELINE / "m1-source/source-evidence.json"
SERIES_JSON = ARCHIVE / "series.json"
MONEY_JSON = ARCHIVE / "art-direction/money-money-flow.json"
SOURCE_LOG = ARCHIVE.parent / "art/gen/case-a.log"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def page_html(kind: str) -> str:
    series = json.loads(SERIES_JSON.read_text(encoding="utf-8"))
    frames = {f["id"]: f for f in series["frames"]}
    money = json.loads(MONEY_JSON.read_text(encoding="utf-8"))
    font_rules = "\n".join(
        f'@font-face{{font-family:"AES Sans KR";src:url("{uri(path)}") format("opentype");font-weight:{weight};font-display:block}}'
        for (name, weight), path in zip((("regular", 400), ("semibold", 600), ("extrabold", 800)), FONTS.values())
    )
    base_css = f'''
      {font_rules}
      *{{box-sizing:border-box}}html,body{{margin:0;width:100%;height:100%;background:#F7F4EC}}
      body{{font-family:"AES Sans KR",sans-serif;color:#14213D}}
      .card{{position:relative;isolation:isolate;width:100vw;height:100vh;overflow:hidden;padding:5.5% 6.5% 4%;display:flex;flex-direction:column;gap:30px;background:#F7F4EC}}
      .top{{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #536756;padding-bottom:18px;font-size:28px;font-weight:600;letter-spacing:.03em}}
      h1{{margin:0;font-size:68px;line-height:1.12;letter-spacing:-.035em;font-weight:800;word-break:keep-all}}
      .source{{margin-top:auto;display:flex;justify-content:space-between;color:#536756;font-size:24px}}
      @media(max-width:600px){{.card{{min-width:320px;padding:22px 24px 18px;gap:16px}}.top{{font-size:15px;padding-bottom:11px}}h1{{font-size:36px;line-height:1.08}}.source{{font-size:13px}}}}
    '''
    if kind == "money":
        f = frames["money"]
        headline = html.escape(f["headline"])
        body = html.escape(f["blocks"][1]["text"])
        source = html.escape(f["source_note"])
        nodes_html = "".join(f'<article class="node"><small>{html.escape(n["label"])}</small><span>{html.escape(n["text"])}</span></article>' for n in money["nodes"])
        graphic = f'<section class="flow" aria-label="가치 흐름, 결제 흐름, 플랫폼 수익, 주요 비용">{nodes_html}</section>'
        css = '''.flow{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:minmax(170px,auto);gap:18px;margin:10px 0 20px}.node{padding:24px;border:1px solid #536756;border-radius:20px;background:#F7F4EC;display:flex;flex-direction:column;justify-content:center;gap:14px}.node:nth-child(2){border-color:#536756;background:#F7F4EC}.node small{font-size:25px;color:#536756}.node span{font-size:26px;line-height:1.38;word-break:keep-all}.explain{font-size:34px;line-height:1.42;max-width:900px;word-break:keep-all}@media(max-width:600px){.card{padding:16px 20px 14px;gap:10px}.top{font-size:14px;padding-bottom:8px}h1{font-size:30px;line-height:1.08}.source{font-size:12px}.flow{grid-template-columns:1fr 1fr;grid-auto-rows:minmax(108px,auto);gap:8px;margin:0}.node{padding:9px;border-radius:11px;gap:6px}.node small{font-size:11px}.node span{font-size:12px;line-height:1.28}.explain{font-size:13px;line-height:1.3}}'''
        content = f'{graphic}<p class="explain">{body}</p>'
        brand = "BUSINESS IDEA / M1"
        page = "2 / 5"
    elif kind == "case-a":
        f = frames["case-a"]
        headline = html.escape(f["headline"])
        source = html.escape(f["source_note"])
        art = BASELINE / "m1-source/case-a.png"
        alt = html.escape(f["alt_text"])
        rows = [("", line) for line in f["blocks"][1]["text"].splitlines()]
        rows_html = "".join(f'<div class="fact"><b>{html.escape(k)}</b><span>{html.escape(v)}</span></div>' for k, v in rows)
        content = f'<div class="case"><img src="{uri(art)}" alt="{alt}"><section class="facts">{rows_html}</section></div>'
        css = '''.case{min-height:0;flex:1;display:grid;grid-template-columns:.85fr 1.15fr;gap:26px;align-items:stretch}.case img{width:100%;height:100%;max-height:800px;object-fit:cover;border-radius:22px}.facts{display:flex;flex-direction:column;justify-content:center;gap:12px}.fact{display:grid;grid-template-columns:1fr;align-items:center;gap:14px;padding:20px 18px;border-bottom:1px solid #536756;font-size:25px;line-height:1.35}.fact span{word-break:keep-all}@media(max-width:600px){.card{padding:15px 20px 13px;gap:8px}.top{font-size:14px;padding-bottom:8px}h1{font-size:28px;line-height:1.08}.source{font-size:11px}.case{grid-template-columns:1fr;grid-template-rows:auto auto;align-content:start;flex:0 0 auto;gap:6px}.case img{height:105px;border-radius:11px}.facts{justify-content:flex-start;gap:0}.fact{grid-template-columns:1fr;gap:6px;padding:5px 2px;font-size:12px;line-height:1.2}}'''
        brand = "BUSINESS IDEA / M1"
        page = "3 / 5"
    else:
        raise ValueError(kind)
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{base_css}{css}</style></head><body><article class="card"><header class="top"><span>{brand}</span><span>{page}</span></header><h1>{headline}</h1>{content}<footer class="source"><span>{source}</span><span>{page}</span></footer></article></body></html>'''


def render_a(kind: str, run: Path) -> tuple[Path, str]:
    plan_name = "money" if kind == "money" else "case-a"
    plan = json.loads((ARCHIVE / f"render/{plan_name}.plan.json").read_text(encoding="utf-8"))
    plan["source"]["ref"] = str(SOURCE_JSON)
    plan["source"]["sha256"] = f"sha256:{sha(SOURCE_JSON)}"
    plan["task"]["theme"]["font_family"] = "'AES Sans KR', sans-serif"
    for layer in plan["layers"]:
        if layer.get("weight") == 500:
            layer["weight"] = 600
        elif layer.get("weight") == 700:
            layer["weight"] = 800
        if isinstance(layer.get("source_ref"), str) and layer["source_ref"].startswith("/Users/"):
            layer["source_ref"] = str(SOURCE_JSON)
        if layer.get("kind") == "chart":
            layer["ref"] = str(MONEY_JSON)
        if layer.get("kind") == "generated":
            art = BASELINE / "m1-source/case-a.png"
            layer["ref"] = str(art)
            layer["sha256"] = f"sha256:{sha(art)}"
            generation = layer["generation"]
            generation["asset_sha256"] = f"sha256:{sha(art)}"
            generation["response_ref"] = str(SOURCE_LOG)
            generation["response_sha256"] = f"sha256:{sha(SOURCE_LOG)}"
    plan_path = run / "aes-plan.json"
    profile_path = run / "profile-receipt.json"
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    profile = subprocess.run(["node",str(ROOT/"scripts/resolve-editorial.mjs"),"--plan",str(ARCHIVE/"series.json"),"--target","signalytics-news","--task-kind","visual","--out",str(profile_path)],cwd=ROOT,capture_output=True,text=True)
    if profile.returncode:
        raise RuntimeError(f"AES profile resolution failed: {profile.stdout}\n{profile.stderr}")
    result = subprocess.run(["node",str(ROOT/"scripts/render-visual.mjs"),"--plan",str(plan_path),"--out",str(run/"aes"),"--profile-receipt",str(profile_path),"--rasterizer","rsvg"],cwd=ROOT,capture_output=True,text=True)
    if result.returncode:
        raise RuntimeError(f"current AES render failed: {result.stdout}\n{result.stderr}")
    candidates = [run/"aes/master.png",run/"aes/image.png"]
    a = next((p for p in candidates if p.is_file()),None)
    if a is None: raise RuntimeError(f"current AES PNG missing: {run / 'aes'}")
    return a, plan_path.read_text(encoding="utf-8")


def downscale(src: Path, dest: Path) -> None:
    with Image.open(src) as im:
        im = im.convert("RGB")
        im.thumbnail(MOBILE, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", MOBILE, (11, 17, 32))
        canvas.paste(im, ((390-im.width)//2, (488-im.height)//2))
        canvas.save(dest, format="PNG", optimize=False, compress_level=9)


def compare(a: Path, b: Path, out: Path, labels: tuple[str, str]) -> None:
    with Image.open(a) as x, Image.open(b) as y:
        x, y = x.convert("RGB"), y.convert("RGB")
        board = Image.new("RGB", (x.width + y.width, x.height + 48), "white")
        draw = ImageDraw.Draw(board)
        font = ImageFont.load_default(size=20)
        draw.text((18, 14), labels[0], fill="#111827", font=font)
        draw.text((x.width+18, 14), labels[1], fill="#111827", font=font)
        board.paste(x, (0,48)); board.paste(y, (x.width,48))
        board.save(out, format="PNG", optimize=False, compress_level=9)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--kinds", nargs="+", choices=["money", "case-a"], default=["money", "case-a"])
    args = ap.parse_args()
    out = args.out.resolve()
    if len(args.kinds) != len(set(args.kinds)):
        raise SystemExit("--kinds must not contain duplicates")
    occupied = [out / kind for kind in args.kinds if (out / kind).exists() and any((out / kind).iterdir())]
    if occupied:
        raise SystemExit(f"all requested run directories must be empty to preserve existing evidence: {occupied}")
    out.mkdir(parents=True, exist_ok=True)
    start = time.perf_counter()
    cpu_start = resource.getrusage(resource.RUSAGE_SELF)
    browser_version = "unknown"
    with sync_playwright() as p:
        opts = {"headless": True}
        if os.environ.get("CHROMIUM_EXECUTABLE"):
            opts["executable_path"] = os.environ["CHROMIUM_EXECUTABLE"]
        browser = p.chromium.launch(**opts); browser_version = browser.version
        for kind in args.kinds:
            run = out / kind; run.mkdir(exist_ok=True)
            a, _ = render_a(kind, run)
            a_dest = run / "aes-1080x1350.png"
            Image.open(a).convert("RGB").save(a_dest, format="PNG", optimize=False, compress_level=9)
            if Image.open(a_dest).size != CANVAS:
                raise SystemExit(f"bad A canvas {kind}: {Image.open(a_dest).size}")
            page = browser.new_page(viewport={"width":1080,"height":1350},device_scale_factor=1)
            page.route("**/*", lambda route: route.abort())
            page.set_content(page_html(kind), wait_until="load")
            page.evaluate("document.fonts.ready")
            if not page.evaluate("document.fonts.check('800 48px \"AES Sans KR\"')"):
                raise SystemExit(f"font failed to load: {kind}")
            desktop_fit = page.evaluate("""(kind) => {
              const card=document.querySelector('.card'), box=card.getBoundingClientRect();
              const header=document.querySelector('.top'), title=document.querySelector('h1'), footer=document.querySelector('.source');
              const primary=kind==='money'?document.querySelector('.flow'):document.querySelector('.case');
              const detail=kind==='money'?document.querySelector('.explain'):null;
              const ordered=detail?[header,title,primary,detail,footer]:[header,title,primary,footer];
              const r=ordered.map(e=>e.getBoundingClientRect());
              const orderedSeparated=r.slice(0,-1).every((x,i)=>x.bottom<=r[i+1].top);
              const insideCard=r.every(x=>x.left>=box.left&&x.right<=box.right&&x.top>=box.top&&x.bottom<=box.bottom);
              let internal=true;
              if(kind==='money'){
                const nodes=[...document.querySelectorAll('.node')].map(e=>e.getBoundingClientRect());
                internal=nodes.every((a,i)=>nodes.slice(i+1).every(b=>a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));
              } else {
                const art=document.querySelector('.case img').getBoundingClientRect(), facts=document.querySelector('.facts').getBoundingClientRect();
                const rows=[...document.querySelectorAll('.fact')].map(e=>e.getBoundingClientRect());
                internal=(art.right<=facts.left||facts.right<=art.left||art.bottom<=facts.top||facts.bottom<=art.top)&&rows.slice(0,-1).every((x,i)=>x.bottom<=rows[i+1].top);
              }
              return card.scrollHeight<=card.clientHeight&&document.documentElement.scrollWidth<=innerWidth&&orderedSeparated&&insideCard&&internal;
            }""",kind)
            if not desktop_fit: raise SystemExit(f"desktop content overflow: {kind}")
            b_dest = run / "html-playwright-1080x1350.png"
            page.screenshot(path=str(b_dest), full_page=True, animations="disabled")
            if Image.open(b_dest).size != CANVAS: raise SystemExit(f"bad B canvas {kind}")
            page.set_viewport_size({"width":390,"height":488})
            mobile_fit = page.evaluate("""(kind) => {
              const card=document.querySelector('.card'), box=card.getBoundingClientRect();
              const header=document.querySelector('.top'), title=document.querySelector('h1'), footer=document.querySelector('.source');
              const primary=kind==='money'?document.querySelector('.flow'):document.querySelector('.case');
              const detail=kind==='money'?document.querySelector('.explain'):null;
              const ordered=detail?[header,title,primary,detail,footer]:[header,title,primary,footer];
              const r=ordered.map(e=>e.getBoundingClientRect());
              const orderedSeparated=r.slice(0,-1).every((x,i)=>x.bottom<=r[i+1].top);
              const insideCard=r.every(x=>x.left>=box.left&&x.right<=box.right&&x.top>=box.top&&x.bottom<=box.bottom);
              let internal=true;
              if(kind==='money'){
                const nodes=[...document.querySelectorAll('.node')].map(e=>e.getBoundingClientRect());
                internal=nodes.every((a,i)=>nodes.slice(i+1).every(b=>a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));
              } else {
                const art=document.querySelector('.case img').getBoundingClientRect(), facts=document.querySelector('.facts').getBoundingClientRect();
                const rows=[...document.querySelectorAll('.fact')].map(e=>e.getBoundingClientRect());
                internal=(art.right<=facts.left||facts.right<=art.left||art.bottom<=facts.top||facts.bottom<=art.top)&&rows.slice(0,-1).every((x,i)=>x.bottom<=rows[i+1].top);
              }
              return card.scrollHeight<=card.clientHeight&&document.documentElement.scrollWidth<=innerWidth&&orderedSeparated&&insideCard&&internal;
            }""",kind)
            if not mobile_fit: raise SystemExit(f"mobile content overflow: {kind}")
            page.screenshot(path=str(run / "html-playwright-responsive-390x488.png"),full_page=True,animations="disabled")
            page.close()
            a390=run/"aes-downscaled-390x488.png"; b390=run/"html-downscaled-390x488.png"
            downscale(a_dest,a390); downscale(b_dest,b390)
            compare(a_dest,b_dest,run/"comparison-1080x1350.png",("A · current AES compositor","B · HTML/CSS + Playwright"))
            compare(a390,b390,run/"comparison-390px-downscaled.png",("A · AES scaled from 1080","B · HTML scaled from 1080"))
            cpu_end = resource.getrusage(resource.RUSAGE_SELF)
            receipt={"status":"LOCAL_STATIC_POC; OWNER_AESTHETIC_REVIEW_PENDING","kind":kind,"source_input_sha256":sha(SOURCE_JSON),"series_input_sha256":sha(SERIES_JSON),"diagram_input_sha256":sha(MONEY_JSON) if kind=="money" else None,"art_input_sha256":sha(BASELINE/"m1-source/case-a.png") if kind=="case-a" else None,"aes_output_sha256":sha(a),"html_output_sha256":sha(b_dest),"assets_sha256":{p.name:sha(p) for p in FONTS.values()},"dimensions":{"A":list(Image.open(a_dest).size),"B":list(Image.open(b_dest).size),"mobile_scaled":[390,488]},"technical":{"font_loaded":True,"desktop_fit":desktop_fit,"responsive_fit":mobile_fit,"network_enabled":False,"paid_api_calls":0,"provider_calls":0},"runtime":{"platform":platform.platform(),"python":platform.python_version(),"playwright":version("playwright"),"chromium":browser_version,"wall_seconds":round(time.perf_counter()-start,3),"python_user_cpu_seconds":round(cpu_end.ru_utime-cpu_start.ru_utime,3),"python_system_cpu_seconds":round(cpu_end.ru_stime-cpu_start.ru_stime,3),"python_process_max_rss_mb":round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/(1024*1024),2)}}
            (run/"receipt.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n")
        browser.close()
    print(json.dumps({"status":"OK","kinds":args.kinds,"out":str(out)},ensure_ascii=False))

if __name__ == "__main__": main()
