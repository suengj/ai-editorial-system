#!/usr/bin/env python3
"""Render opt-in R7 illustrated M1 cover and opportunity cards; R4 stays default."""
from __future__ import annotations
import argparse, base64, hashlib, html, json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
SERIES=Path('/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline/m1-source/base-series.json')
R4=Path('/Volumes/OricoSSD/MacArchive/vq-v2-round4-final4/m1')
FONT_DIR=ROOT/'assets/fonts/aes-sans-kr'
CSS=(HERE/'round7-illustrated.css').read_text(encoding='utf-8')

def sha(path:Path)->str: return hashlib.sha256(path.read_bytes()).hexdigest()
def data_uri(path:Path,mime='image/png')->str:
    return f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
def source_css()->str:
    fonts=[]
    for face,weight,file in [('AESSansKR-Regular.otf',400,'AESSansKR-Regular.otf'),('AESSansKR-ExtraBold.otf',800,'AESSansKR-ExtraBold.otf')]:
        fonts.append(f'@font-face{{font-family:"AES Sans KR";src:url({data_uri(FONT_DIR/file,"font/otf")});font-weight:{weight}}}')
    return '\n'.join(fonts)+'\n'+CSS

def card_html(frame:dict,index:int)->str:
    cid=frame['id']; blocks=[b['text'] for b in frame['blocks'] if b.get('kind')=='text']
    art=HERE/'assets'/f'{cid}.png'
    if cid=='cover':
        headline=html.escape(frame['headline']).replace('주차면, ','주차면,<br>').replace('돈이 되는 자리로','<span class="vq-r7-highlight">돈이 되는 자리로</span>')
        body=f'<p class="vq-r7-body">{html.escape(blocks[0])}</p>'
        card_class='vq-r7-cover'
    elif cid=='opportunity':
        headline=html.escape(frame['headline']).replace('좁게','<span class="vq-r7-highlight">좁게</span>').replace(', 수익성은 ', ',<br>수익성은 ')
        items=[]
        labels=['원칙','장애물','첫 실험']
        for label,text in zip(labels,blocks):
            lines=text.split('\n\n',1)
            first=lines[0]
            question=lines[1] if len(lines)>1 else ''
            items.append(f'<div class="vq-r7-row">{html.escape(first)}</div>')
            if question: items.append(f'<div class="vq-r7-row">{html.escape(question)}</div>')
        body=f'<section class="vq-r7-rows">{"".join(items)}</section>'
        card_class='vq-r7-opp'
    else: raise ValueError(f'unsupported Round 7 frame: {cid}')
    page=f'{index} / 5'
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><style>{source_css()}</style></head><body><article class="vq-r7-card {card_class}" data-card="{cid}"><div class="vq-r7-brand">BUSINESS IDEA / M1</div><div class="vq-r7-page">{page}</div><h1 class="vq-r7-title">{headline}</h1><img class="vq-r7-art" src="{data_uri(art)}" alt=""><div class="vq-r7-copy">{body}</div><footer class="vq-r7-footer"><span>{html.escape(frame.get('source_note',''))}</span><span>{page}</span></footer></article></body></html>'''

def validate(page,frame,viewport):
    expected=[frame['headline']]+[b['text'] for b in frame['blocks'] if b.get('kind')=='text']+['BUSINESS IDEA / M1']
    report=page.evaluate('''() => {
      const card=document.querySelector('[data-card]'),box=card.getBoundingClientRect();
      const text=[...card.querySelectorAll('.vq-r7-brand,.vq-r7-page,.vq-r7-title,.vq-r7-body,.vq-r7-row,.vq-r7-footer')];
      const clipping=text.filter(e=>e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+8).map(e=>e.innerText);
      const bounds=text.filter(e=>{const r=e.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1}).map(e=>e.innerText);
      const art=card.querySelector('.vq-r7-art'),artBox=art.getBoundingClientRect();
      const rows=[...card.querySelectorAll('.vq-r7-row')];
      const rowRatios=rows.map(e=>e.getBoundingClientRect().width/box.width);
      const rowFontSizes=rows.map(e=>parseFloat(getComputedStyle(e).fontSize));
      const artRatio=artBox.width/box.width,artCenterOffset=Math.abs((artBox.left+artBox.width/2)-(box.left+box.width/2))/box.width;
      return {card:[box.width,box.height],clipping,bounds,artLoaded:art.complete&&art.naturalWidth>0,overflow:card.scrollWidth>box.width+1||card.scrollHeight>box.height+2,rowRatios,rowFontSizes,artRatio,artCenterOffset};
    }''')
    text=re.sub(r'\s+',' ',page.locator('[data-card]').inner_text())
    missing=[s for s in expected if re.sub(r'\s+',' ',s) not in text]
    layout_failure=frame['id']=='opportunity' and (min(report['rowRatios'],default=0)<.85 or report['artRatio']<.65 or report['artCenterOffset']>.1 or (viewport=='390x488' and min(report['rowFontSizes'],default=0)<16))
    report.update({'viewport':viewport,'missing_copy':missing,'opportunity_layout_failure':layout_failure,'pass':not (report['clipping'] or report['bounds'] or report['overflow'] or not report['artLoaded'] or missing or layout_failure)})
    if not report['pass']: raise RuntimeError(f'R7 render QA failed for {frame["id"]} {viewport}: {json.dumps(report,ensure_ascii=False)}')
    return report

def board_html(out:Path,mobile:bool,r4_root:Path):
    width='390px' if mobile else '540px'; height='488px' if mobile else '675px'
    contents=[]
    for cid in ('cover','opportunity'):
        r4=r4_root/cid/('round4-responsive-390x488.png' if mobile else 'round4-1080x1350.png')
        r7=out/'m1'/cid/('round7-responsive-390x488.png' if mobile else 'round7-1080x1350.png')
        for label,path in [('R4',r4),('R7 illustrated',r7)]:
            if not path.is_file(): raise FileNotFoundError(path)
            contents.append(f'<figure><figcaption>{cid.upper()} · {label}</figcaption><img src="{data_uri(path)}"></figure>')
    return f'''<!doctype html><html><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0;padding:12px;background:#dedbd2;font:700 18px Arial,sans-serif}}main{{display:grid;grid-template-columns:repeat(2,{width});gap:14px 10px}}figure{{margin:0;background:white;padding:6px}}figcaption{{height:28px;padding:4px;color:#17223c;font-size:16px}}img{{display:block;width:{width};height:{height};object-fit:contain}}</style><main>{''.join(contents)}</main></html>'''

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--out',type=Path,required=True,help='empty output directory for local captures')
    ap.add_argument('--series',type=Path,default=SERIES)
    ap.add_argument('--r4-baseline',type=Path,default=R4)
    ap.add_argument('--chromium',default=os.environ.get('VQ_CHROMIUM','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
    args=ap.parse_args(); out=args.out.resolve()
    if out.exists() and any(out.iterdir()): raise SystemExit(f'output directory must be empty: {out}')
    series=json.loads(args.series.read_text(encoding='utf-8'))
    frames={x['id']:x for x in series['frames']}
    selected=[frames['cover'],frames['opportunity']]
    expected_assets={'cover.png':'dc5d6628be08c2b2a39d983b267b3979dfed5464f8837d5f4f41a61ba9a96ee9','opportunity.png':'7c0a0e8c2d0be876b1ba4ad1891303b7e47f20fa5c0829458773c5df2dbb7cd6'}
    for name,expected_hash in expected_assets.items():
        if sha(HERE/'assets'/name)!=expected_hash: raise RuntimeError(f'illustration asset hash mismatch: {name}')
    out.mkdir(parents=True,exist_ok=True); results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=args.chromium)
        for index,frame in ((1,selected[0]),(5,selected[1])):
            cid=frame['id']; folder=out/'m1'/cid; folder.mkdir(parents=True,exist_ok=True)
            source=card_html(frame,index); html_path=folder/f'{cid}.html'; html_path.write_text(source,encoding='utf-8')
            page=browser.new_page(viewport={'width':1080,'height':1350},device_scale_factor=1)
            page.set_content(source,wait_until='load'); page.evaluate('document.fonts.ready')
            desktop_qa=validate(page,frame,'1080x1350')
            desktop=folder/'round7-1080x1350.png'; page.locator('[data-card]').screenshot(path=str(desktop),animations='disabled')
            page.set_viewport_size({'width':390,'height':488}); mobile_qa=validate(page,frame,'390x488')
            mobile=folder/'round7-responsive-390x488.png'; page.locator('[data-card]').screenshot(path=str(mobile),animations='disabled'); page.close()
            baseline_root=args.r4_baseline.resolve()
            baseline=baseline_root/cid/'round4-1080x1350.png'; baseline_mobile=baseline_root/cid/'round4-responsive-390x488.png'
            results.append({'id':cid,'expected_copy':[frame['headline']]+[b['text'] for b in frame['blocks'] if b.get('kind')=='text'],'source_note':frame.get('source_note'),'asset_sha256':sha(HERE/'assets'/f'{cid}.png'),'desktop_sha256':sha(desktop),'mobile_sha256':sha(mobile),'r4_baseline_sha256':sha(baseline),'r4_mobile_sha256':sha(baseline_mobile),'qa':{'desktop':desktop_qa,'mobile':mobile_qa}})
        for mobile,width,height in ((False,1128,1400),(True,820,1040)):
            page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
            page.set_content(board_html(out,mobile,args.r4_baseline.resolve()),wait_until='load')
            page.screenshot(path=str(out/('round7-vs-r4-mobile-comparison.png' if mobile else 'round7-vs-r4-desktop-comparison.png')),full_page=True)
            page.close()
        browser.close()
    receipt={'schema':'vq-v2-round7-illustrated-render/1','round':'7-illustrated-opt-in','status':'LOCAL_RENDERED; OWNER_AESTHETIC_REVIEW_PENDING','provider_calls':0,'defaults_changed':False,'series_sha256':sha(args.series),'cards':results,'comparisons':{'desktop':str(out/'round7-vs-r4-desktop-comparison.png'),'mobile':str(out/'round7-vs-r4-mobile-comparison.png')},'scope':'cover and opportunity only'}
    (out/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','out':str(out),'cards':[x['id'] for x in results],'desktop_comparison':receipt['comparisons']['desktop'],'mobile_comparison':receipt['comparisons']['mobile']},ensure_ascii=False))

if __name__=='__main__': main()
