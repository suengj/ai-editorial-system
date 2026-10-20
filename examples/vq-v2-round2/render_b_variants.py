#!/usr/bin/env python3
"""Render Round 2 B repairs and reference-trait B-prime variants offline.

All copy and source imagery are read from the frozen M1 artifacts. The public
reference screenshots are not loaded, copied into the HTML, or distributed.
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
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = Path("/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/out-base-r0")
BASE = Path("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline")
FONTS = [ROOT / "assets/fonts/aes-sans-kr" / f for f in ("AESSansKR-Regular.otf", "AESSansKR-SemiBold.otf", "AESSansKR-ExtraBold.otf")]
CANVAS=(1080,1350); MOBILE=(390,488)

def sha(p: Path) -> str: return hashlib.sha256(p.read_bytes()).hexdigest()
def uri(p: Path) -> str: return f"data:{mimetypes.guess_type(p.name)[0] or 'application/octet-stream'};base64,{base64.b64encode(p.read_bytes()).decode()}"

def validate_card(page, width: int, height: int):
    metrics = page.evaluate("""() => {
      const card = document.querySelector('.card');
      const bounds = card.getBoundingClientRect();
      const problems = [];
      for (const el of [card, ...card.querySelectorAll('*')]) {
        const rect = el.getBoundingClientRect();
        const name = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.replaceAll(' ', '.') : ''}`;
        const outside = rect.left < bounds.left - 1 || rect.top < bounds.top - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1;
        if (outside && rect.width && rect.height) problems.push({element:name, issue:'outside-card', rect:rect.toJSON()});
        const style = getComputedStyle(el);
        if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1 ||
            (style.overflowY === 'hidden' || style.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 1)
          problems.push({element:name, issue:'clipped-scroll-content', scroll:[el.scrollWidth,el.scrollHeight], client:[el.clientWidth,el.clientHeight]});
        for (let ancestor=el.parentElement; ancestor; ancestor=ancestor.parentElement) {
          const clip=getComputedStyle(ancestor);
          if (clip.overflowX === 'hidden' || clip.overflowX === 'clip' || clip.overflowY === 'hidden' || clip.overflowY === 'clip') {
            const a=ancestor.getBoundingClientRect();
            if (rect.left < a.left - 1 || rect.top < a.top - 1 || rect.right > a.right + 1 || rect.bottom > a.bottom + 1)
              problems.push({element:name, issue:'outside-clipping-ancestor', ancestor:ancestor.tagName, rect:rect.toJSON(), ancestorRect:a.toJSON()});
          }
        }
        if (el !== card && style.visibility === 'hidden' && (el.innerText || '').trim())
          problems.push({element:name, issue:'hidden-text'});
      }
      return {viewport:[innerWidth,innerHeight], document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight], card:bounds.toJSON(), problems};
    }""")
    if [width, height] != metrics["viewport"] or metrics["problems"]:
        raise SystemExit(f"card bounds/content validation failed at {width}x{height}: {metrics}")
    return metrics

def data():
    cover=json.loads((ARCHIVE/"render/cover.plan.json").read_text())
    money=json.loads((ARCHIVE/"render/money.plan.json").read_text())
    case=json.loads((ARCHIVE/"render/case-a.plan.json").read_text())
    return {k:{x["id"]:x.get("text","") for x in v["layers"]} for k,v in (("cover",cover),("money",money),("case-a",case))}

def html_doc(kind: str, variant: str, texts: dict, cover_photo: Path | None = None) -> str:
    c=html.escape
    fonts="".join(f'@font-face{{font-family:AES;src:url("{uri(p)}") format("opentype");font-weight:{w};font-display:block}}' for p,w in zip(FONTS,(400,600,800)))
    head='<header><span>BUSINESS IDEA / M1</span><span class="page">{page}</span></header>'
    foot='<footer><span>{source}</span><span>{page}</span></footer>'
    if kind=="cover":
        photo=cover_photo or BASE/"m1-source/cover.png"
        title,body,source,page=(texts[kind][i] for i in ("headline","cover-copy","source","pagination"))
        if variant=="B":
            content=f'<img class="cover-photo" src="{uri(photo)}"><main><h1><span>놀고 있는 주차면,</span><span>돈이 되는 자리로</span></h1><p>{c(body)}</p></main>'
            css='''header{height:64px;padding:0 64px;flex:none}.cover-photo{height:43%;width:100%;object-fit:cover;object-position:center 56%;flex:none}main{padding:32px 64px 8px;display:flex;flex-direction:column;justify-content:center;gap:20px;flex:1;min-height:0}h1{margin:0;display:flex;flex-direction:column;font-size:78px;line-height:1.06;letter-spacing:-.045em;font-weight:800;text-wrap:balance;word-break:keep-all}h1 span{white-space:nowrap}p{margin:0;font-size:32px;line-height:1.4;max-width:930px;word-break:keep-all}footer{padding:0 64px 26px;font-size:22px}'''
            traits="wrap-safe two-line phrase grouping; wider readable title"
        else:
            content=f'<div class="cover-split"><img src="{uri(photo)}"><section><div class="eyebrow">01 / EMPTY SPACE</div><h1>{c(title)}</h1><p>{c(body)}</p></section></div>'
            css='''.cover-split{display:grid;grid-template-columns:47% 1fr;gap:48px;align-items:center;flex:1;min-height:0;padding:28px 64px 14px}.cover-split img{width:100%;height:100%;max-height:900px;object-fit:cover;object-position:50% 50%}.cover-split section{display:flex;flex-direction:column;justify-content:center;gap:30px}.eyebrow{font-size:22px;letter-spacing:.12em;color:#59705C}.cover-split h1{margin:0;font-size:68px;line-height:1.16;letter-spacing:-.04em;font-weight:800;word-break:keep-all;text-wrap:balance}.cover-split p{margin:0;font-size:30px;line-height:1.48;word-break:keep-all}footer{padding:0 64px 26px;font-size:22px}'''
            traits="single-message hierarchy; asymmetrical editorial photo-and-copy composition"
    elif kind=="case-a":
        source_json=json.loads((ARCHIVE/"series.json").read_text())
        f=next(f for f in source_json["frames"] if f["id"]=="case-a")
        facts=texts[kind]["case-a-copy"].splitlines(); title=texts[kind]["headline"];source=texts[kind]["source"];page=texts[kind]["pagination"]
        art=uri(BASE/"m1-source/case-a.png")
        items=[]
        for line in facts:
            k,v=line.split(":",1); items.append(f'<div class="fact"><b>{c(k)}:</b><span>{c(v.strip())}</span></div>')
        if variant=="B":
            first=items[0].replace("3%", "<strong>3%</strong>")
            content=f'<main class="case-main"><section class="fact-list">{first}{items[1]}{items[2]}{items[3]}{items[4]}</section><img src="{art}" alt="{c(f["alt_text"])}"></main>'
            css='''h1{font-size:62px;line-height:1.08;margin:14px 0 22px;letter-spacing:-.04em}main.case-main{display:grid;grid-template-columns:1.12fr .88fr;gap:28px;flex:1;min-height:0;align-items:stretch}.case-main img{width:100%;height:100%;max-height:900px;object-fit:cover}.fact-list{display:flex;flex-direction:column;justify-content:space-between;gap:8px;min-height:0}.fact{display:grid;grid-template-columns:150px 1fr;gap:12px;align-items:center;border-bottom:1px solid #b7b9b1;padding:14px 4px;font-size:30px;line-height:1.25}.fact b{font-size:22px;color:#59705C}.fact span{word-break:keep-all}.fact:first-child span strong{font-size:1.55em}footer{padding:14px 0 0;font-size:21px}'''
            traits="larger editorial type hierarchy; open fact list with image aligned to content"
        else:
            content=f'<main class="case-editorial"><div class="lead"><b>수수료 부담자:</b><span>공간 주인 (2022 MSE 보도 <strong>3%<small>)</small></strong></span></div><section class="case-facts">{items[1]}{items[2]}{items[3]}{items[4]}</section><img src="{art}" alt="{c(f["alt_text"])}"></main>'
            css='''h1{font-size:60px;line-height:1.08;margin:14px 0 16px;letter-spacing:-.04em}main.case-editorial{display:grid;grid-template-columns:.85fr 1.05fr .9fr;gap:24px;flex:1;min-height:0;align-items:stretch}.lead{display:flex;flex-direction:column;justify-content:flex-start;padding-top:36px;border-top:3px solid #59705C;border-bottom:1px solid #b7b9b1}.lead b{font-size:24px;color:#59705C}.rate{display:flex;align-items:flex-end}.lead strong{font-size:142px;line-height:.95;letter-spacing:-.06em}.lead strong small{font-size:24px;vertical-align:baseline;letter-spacing:0}.lead>span{font-size:24px}.case-editorial img{width:100%;height:100%;max-height:900px;object-fit:cover}.case-facts{display:flex;flex-direction:column;justify-content:flex-start;gap:13px}.fact{display:flex;flex-direction:column;gap:6px;border-bottom:1px solid #b7b9b1;padding:10px 0;font-size:24px;line-height:1.3}.fact b{font-size:19px;color:#59705C}.fact span{word-break:keep-all}footer{padding:14px 0 0;font-size:21px}'''
            traits="fact-led typographic hierarchy; asymmetrical editorial image placement"
    elif kind=="money":
        src=json.loads((ARCHIVE/"art-direction/money-money-flow.json").read_text())
        title=texts[kind]["headline"];body=texts[kind]["money-copy"];source=texts[kind]["source"];page=texts[kind]["pagination"]
        nodes=src["nodes"]
        if variant=="B":
            costs=nodes
            flow='<section class="route"><div class="lane"><b>가치 흐름</b><span>공간 주인</span><i>→</i><span>운전자</span></div><div class="lane payment"><b>결제 흐름</b><span>운전자</span><i>→</i><span>플랫폼</span><i>→</i><span>공간 주인</span><small>수수료를 뗀 뒤 정산</small></div></section>'
            notes=''.join(f'<div class="note"><b>{c(n["label"])}</b><span>{c(n["text"])}</span></div>' for n in costs)
            content=f'<main><p class="summary">{c(body)}</p>{flow}<section class="support">{notes}</section></main>'
            css='''h1{font-size:64px;line-height:1.08;margin:14px 0 0;letter-spacing:-.04em}.summary{font-size:29px;line-height:1.38;max-width:930px;margin:0 0 10px;word-break:keep-all}main{display:flex;flex:1;min-height:0;flex-direction:column;justify-content:space-around}.route{min-height:320px;display:flex;flex-direction:column;justify-content:center;gap:22px;margin:0 2%;padding:18px 20px;border-top:3px solid #59705C;border-bottom:1px solid #b7b9b1}.lane{display:grid;grid-template-columns:180px 1fr 54px 1fr;align-items:center;gap:12px;min-height:95px;font-size:34px;font-weight:600}.lane>b{font-size:23px;color:#59705C}.lane>i{font-style:normal;font-size:52px;text-align:center;color:#59705C}.lane.payment{grid-template-columns:180px 1fr 42px 1fr 42px 1fr}.lane small{grid-column:2/-1;font-size:20px;color:#536756;font-weight:400;margin-top:-4px}.support{display:grid;grid-template-columns:1fr 1fr;gap:18px 38px;padding:20px 10px 0;border-top:1px solid #59705C}.note{display:flex;flex-direction:column;gap:7px}.note b{font-size:21px;color:#59705C}.note span{font-size:22px;line-height:1.3;word-break:keep-all}footer{padding:0 0 24px;font-size:21px}'''
            traits="information arranged as a visual route; hierarchy between process and supporting facts"
        else:
            rows=''.join(f'<div class="step"><i>{i+1:02}</i><div><b>{c(n["label"])}</b><p>{c(n["text"])}</p></div></div>' for i,n in enumerate(nodes))
            content=f'<main><p class="summary">{c(body)}</p><section class="steps">{rows}</section></main>'
            css='''h1{font-size:62px;line-height:1.1;margin:14px 0 0;letter-spacing:-.04em}.summary{font-size:28px;line-height:1.38;max-width:930px;margin:0 0 10px;word-break:keep-all}main{display:flex;flex:1;min-height:0;flex-direction:column;justify-content:space-around}.steps{display:grid;grid-template-columns:1fr 1fr;column-gap:42px;row-gap:15px;position:relative;padding:14px 0}.step{display:grid;grid-template-columns:72px 1fr;gap:18px;align-items:start;padding:18px 0;border-bottom:1px solid #b7b9b1}.step i{font-style:normal;font-size:33px;color:#59705C;font-weight:800}.step b{font-size:21px;color:#59705C}.step p{font-size:24px;line-height:1.34;margin:7px 0 0;word-break:keep-all}footer{padding:0 0 24px;font-size:21px}'''
            traits="sequential narrative information hierarchy; step labels separated from explanations without panels"
    else: raise ValueError(kind)
    title=texts[kind]["headline"];source=texts[kind]["source"];page=texts[kind]["pagination"]
    css+='''*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#F7F4EC}body{font-family:AES,sans-serif;color:#14213D}.card{display:flex;flex-direction:column;width:100vw;height:100vh;overflow:hidden;padding:32px 70px 0;background:#F7F4EC}header{display:flex;justify-content:space-between;align-items:center;flex:none;height:48px;font-size:25px;font-weight:600;letter-spacing:.02em}.page{font-weight:600}footer{display:flex;justify-content:space-between;align-items:center;flex:none;margin-top:auto;color:#59705C}@media(max-width:600px){.card{min-width:320px;padding:15px 20px 0}header{height:28px;font-size:13px}.cover-photo{height:36%}main{padding-left:0;padding-right:0}.cover-split{grid-template-columns:1fr;grid-template-rows:35% 1fr;padding:12px 0 2px;gap:14px}.cover-split img{max-height:none}.cover-split section{gap:10px}.cover-split h1{font-size:32px;line-height:1.14}.cover-split p{font-size:15px;line-height:1.35}.eyebrow{font-size:12px}h1{font-size:29px!important;line-height:1.12!important;margin:8px 0 12px!important}h1 span{white-space:nowrap;font-size:28px}p{font-size:14px!important;line-height:1.35!important}.summary{font-size:14px!important;line-height:1.35!important}.route{min-height:130px;margin:0 0 8px;padding:7px 0;gap:5px}.lane{grid-template-columns:74px 1fr 20px 1fr;gap:3px;min-height:52px;font-size:13px}.lane>b{font-size:10px}.lane>i{font-size:19px}.lane.payment{grid-template-columns:64px 1fr 14px 1fr 14px 1fr}.lane small{font-size:9px;margin-top:-4px}.support{gap:12px;padding:10px 0 0}.note{gap:4px}.note b{font-size:12px}.note span{font-size:12px;line-height:1.3}.steps{gap:4px 14px;padding:4px 0}.step{grid-template-columns:30px 1fr;gap:8px;padding:7px 0}.step i{font-size:16px}.step b{font-size:11px}.step p{font-size:12px;line-height:1.24;margin-top:4px}.case-main{grid-template-columns:1fr .65fr!important;gap:9px!important}.case-main img{object-fit:cover}.fact-list{gap:0}.fact{grid-template-columns:1fr!important;gap:3px!important;padding:6px 0!important;font-size:13px!important}.fact b{font-size:10px!important}.case-editorial{grid-template-columns:.6fr 1fr .65fr!important;gap:8px!important}.lead{padding-top:8px}.lead b{font-size:9px}.lead>span{font-size:8px}.lead strong{font-size:38px}.lead strong small{font-size:9px}.case-facts{justify-content:flex-start;gap:4px}.case-facts .fact{font-size:11px!important;padding:3px 0!important}.case-facts .fact b{font-size:9px!important}footer{font-size:11px!important;padding:8px 0 10px!important}}'''
    accent = json.loads((ARCHIVE / "render/cover.plan.json").read_text())["task"]["theme"]["accent"]
    css = css.replace("#59705C", accent).replace("#536756", accent)
    title_tag = "" if kind == "cover" else f"<h1>{c(title)}</h1>"
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{fonts}{css}</style></head><body><article class="card"><header><span>BUSINESS IDEA / M1</span><span class="page">{c(page)}</span></header>{title_tag}{content}<footer><span>{c(source)}</span><span>{c(page)}</span></footer></article></body></html>'''

def down(src:Path,dst:Path):
    im=Image.open(src).convert("RGB"); im.thumbnail(MOBILE,Image.Resampling.LANCZOS); canvas=Image.new("RGB",MOBILE,"#0b1120"); canvas.paste(im,((390-im.width)//2,(488-im.height)//2));canvas.save(dst)
def compare(left,right,out,label):
    a=Image.open(left).convert("RGB");b=Image.open(right).convert("RGB");board=Image.new("RGB",(2160,1400),"white");d=ImageDraw.Draw(board);f=ImageFont.load_default(size=20);d.text((18,14),label[0],fill="#14213d",font=f);d.text((1098,14),label[1],fill="#14213d",font=f);board.paste(a,(0,48));board.paste(b,(1080,48));board.save(out)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,required=True);args=ap.parse_args();out=args.out.resolve()
    if out.exists() and any(out.iterdir()):raise SystemExit(f"refuse to overwrite evidence: {out}")
    inputs=[ARCHIVE/"render/cover.plan.json",ARCHIVE/"render/money.plan.json",ARCHIVE/"render/case-a.plan.json",ARCHIVE/"art-direction/money-money-flow.json",ARCHIVE/"series.json",BASE/"m1-source/cover.png",BASE/"m1-source/case-a.png",*FONTS]
    if not all(p.is_file() for p in inputs):raise SystemExit("frozen input/font missing")
    texts=data();out.mkdir(parents=True,exist_ok=True);t0=time.perf_counter();cpu0=resource.getrusage(resource.RUSAGE_SELF)
    runs=[]
    with sync_playwright() as p:
        options={"headless":True}; executable=os.environ.get("CHROMIUM_EXECUTABLE") or "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";options["executable_path"]=executable
        browser=p.chromium.launch(**options)
        for kind in ("cover","case-a","money"):
            for variant in ("B","B-prime"):
                folder=out/kind/variant;folder.mkdir(parents=True)
                page=browser.new_page(viewport={"width":1080,"height":1350},device_scale_factor=1)
                page.route("**/*",lambda route: route.abort())
                page.set_content(html_doc(kind,variant,texts),wait_until="load");page.evaluate("document.fonts.ready")
                if not page.evaluate("document.fonts.check('800 36px AES')"):raise SystemExit("font load failure")
                desktop_metrics=validate_card(page,*CANVAS)
                desktop=folder/"render-1080x1350.png";page.screenshot(path=str(desktop),animations="disabled")
                desktop_text=page.locator("body").inner_text().replace("\n","")
                expected=[texts[kind]["headline"],texts[kind].get("cover-copy","") if kind=="cover" else texts[kind].get("case-a-copy","") if kind=="case-a" else texts[kind].get("money-copy","") ,texts[kind]["source"]]
                if kind=="money":expected += [piece for n in json.loads((ARCHIVE/"art-direction/money-money-flow.json").read_text())["nodes"] for piece in (n["label"],n["text"])]
                normalize=lambda value:" ".join(value.split())
                rendered=normalize(page.locator("body").inner_text())
                if any(normalize(value) not in rendered for value in expected if value):raise SystemExit(f"visible copy differs from frozen input {kind}/{variant}: {expected}")
                page.set_viewport_size({"width":390,"height":488});metrics=validate_card(page,*MOBILE);mobile=folder/"render-390x488.png";page.screenshot(path=str(mobile),animations="disabled")
                if Image.open(desktop).size!=CANVAS or Image.open(mobile).size!=MOBILE:raise SystemExit("bad render dimensions")
                page.close()
                a_source=("/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase1/run5/html-playwright-1080x1350.png" if kind=="cover" else f"/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase1/additional-final8/{'case-a' if kind=='case-a' else 'money'}/html-playwright-1080x1350.png")
                a=Path(a_source)
                if not a.is_file():raise SystemExit(f"baseline comparison unavailable: {a}")
                label="B · repaired" if variant=="B" else "B′ · reference traits, owner selection pending"
                compare(a,desktop,folder/"comparison-1080x1350.png",("Round 1 B","Round 2 "+label))
                down(desktop,folder/"scaled-390x488.png")
                receipt={"status":"LOCAL_EXPERIMENT; OWNER_AESTHETIC_REVIEW_PENDING","kind":kind,"variant":variant,"reference_authority":"candidate trait hypothesis only; owner has not selected or approved a reference","applied_traits":"repair: no candidate reference applied" if variant=="B" else ("candidate-derived: "+traits_for(kind)),"frozen_inputs":{"copy_plan_sha256":sha(ARCHIVE/("render/cover.plan.json" if kind=="cover" else "render/case-a.plan.json" if kind=="case-a" else "render/money.plan.json")),"cover_photo_sha256":sha(BASE/"m1-source/cover.png"),"case_photo_sha256":sha(BASE/"m1-source/case-a.png"),"money_flow_sha256":sha(ARCHIVE/"art-direction/money-money-flow.json"),"font_sha256":[sha(x) for x in FONTS]},"provider_calls":0,"paid_api_calls":0,"network_requests":"blocked","runtime":{"platform":platform.platform(),"python":platform.python_version(),"playwright":__import__('playwright').__version__ if hasattr(__import__('playwright'),'__version__') else "installed", "chromium":browser.version,"wall_s":round(time.perf_counter()-t0,3),"max_rss_mb":round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024/1024,2)},"desktop_metrics":desktop_metrics,"mobile_metrics":metrics,"outputs":{x.name:{"sha256":sha(x),"bytes":x.stat().st_size,"dimensions":list(Image.open(x).size)} for x in (desktop,mobile,folder/"comparison-1080x1350.png",folder/"scaled-390x488.png")}}
                (folder/"receipt.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n");runs.append({"kind":kind,"variant":variant,"folder":str(folder)})
        browser.close()
    print(json.dumps({"status":"OK","runs":runs,"wall_s":round(time.perf_counter()-t0,3),"python_cpu_s":{"user":round(resource.getrusage(resource.RUSAGE_SELF).ru_utime-cpu0.ru_utime,3),"system":round(resource.getrusage(resource.RUSAGE_SELF).ru_stime-cpu0.ru_stime,3)}},ensure_ascii=False,indent=2))

def traits_for(kind):
    return {"cover":"one-message editorial hierarchy + image/copy relationship (The Pudding story structure)","case-a":"larger editorial typography + open fact list with image aligned to content (Visual Newsis hierarchy/composition)","money":"narrative flow + clear information sequencing without repeated panels (The Pudding)"}[kind]

if __name__=='__main__':main()
