#!/usr/bin/env node
/** SUE-1345: one series packet -> existing single-image execution. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { compileExecution, isRenderedOk } from './lib/visual-execution-core.mjs';
import { RuleReader, loadManifest, gateRender } from './lib/resolve-core.mjs';
import { planCarousel, executeCarousel } from './lib/carousel-core.mjs';
import { loadAndValidateCardNewsBrief } from './lib/card-news-brief-core.mjs';
import { buildNativeCardPrompt } from './lib/hybrid-card-core.mjs';
import { buildCatalog } from './export-web-catalog.mjs';

try {
  const {values}=parseArgs({options:{plan:{type:'string'},out:{type:'string'},previous:{type:'string'},'profile-receipt':{type:'string'},'pinned-revision':{type:'string'},'native-session':{type:'string'},rasterizer:{type:'string',default:'auto'},'compile-only':{type:'boolean',default:false}},strict:true});
  if (!values.plan || !values.out) throw new Error('usage: node scripts/render-carousel.mjs --plan series.json --out NEW_DIR [--previous OLD_DIR] [--profile-receipt receipt.json] [--native-session native-session.json] [--compile-only] [--rasterizer auto|rsvg|magick]');
  const path=resolve(values.plan), out=resolve(values.out), series=JSON.parse(readFileSync(path,'utf8'));
  const contentBriefCheck=loadAndValidateCardNewsBrief(series,path);
  if(!contentBriefCheck.ok) throw Object.assign(new Error(`card-news brief gate failed: ${contentBriefCheck.issues.map((x)=>`${x.code}${x.card_id?`:${x.card_id}`:''}`).join(', ')}`),{code:'CARD_NEWS_BRIEF_INVALID'});
  // SUE-1426: registered SNS surfaces render only under a READY resolved-profile receipt (see scripts/resolve-editorial.mjs).
  const gate=gateRender(series,values['profile-receipt']?JSON.parse(readFileSync(resolve(values['profile-receipt']),'utf8')):null,loadManifest(new RuleReader()).manifest,{reader:new RuleReader(),pinnedRevision:values['pinned-revision']??null});
  if (!gate.ok) throw Object.assign(new Error(gate.message),{code:gate.code});
  if (gate.applies) console.log(`profile gate: ${gate.profile_id} revision=${gate.revision} (${gate.revision_check}) ${gate.integrity}`);
  if (values['compile-only']) {
    if (existsSync(out) && readdirSync(out).length) throw new Error('OUTPUT_EXISTS: use a new empty directory');
    const result=planCarousel(series,undefined,contentBriefCheck.applies?contentBriefCheck.brief:null); mkdirSync(out,{recursive:true});
    writeFileSync(resolve(out,'series-plan.json'),`${JSON.stringify(result,null,2)}\n`);
    for(const frame of result.frames.filter((f)=>f.art_direction?.render_method==='native_card')) {
      const packet=await compileExecution(frame.plan,{baseDir:dirname(path),preset:result.preset});
      writeFileSync(resolve(out,`${frame.id}.native-prompt.txt`),`${buildNativeCardPrompt(frame,{palette:packet.theme,fontFamily:packet.theme.font_family})}\n`);
    }
    console.log('PLANNED_NOT_RENDERED: native prompts are deterministic text; profile authority and source bytes were resolved, but pixels, chrome, text fit, and reviewer result remain execution checks');
  } else {
    const nativeSessionPath=values['native-session']?resolve(values['native-session']):null;
    const nativeSession=nativeSessionPath?JSON.parse(readFileSync(nativeSessionPath,'utf8')):null;
    const nativeFrames=series.frames?.filter((f)=>f.art_direction?.render_method==='native_card')??[];
    const hybridFrames=series.frames?.filter((f)=>['native_card','compositor'].includes(f.art_direction?.render_method))??[];
    if(values['native-session']&&!nativeFrames.length) throw Object.assign(new Error('--native-session is only valid when the series contains native_card frames'),{code:'NATIVE_SESSION_INVALID'});
    const targetCatalog=hybridFrames.length?buildCatalog():null;
    const result=await executeCarousel(series,{baseDir:dirname(path),outDir:out,rasterizer:values.rasterizer,previousDir:values.previous?resolve(values.previous):null,
      targetId:gate.applies?gate.target:null,targetCatalog,nativeSession,nativeSessionBaseDir:nativeSessionPath?dirname(nativeSessionPath):dirname(path),contentBrief:contentBriefCheck.applies?contentBriefCheck.brief:null});
    console.log(`${result.status}: ${result.frames.length} frames; ${result.frames.filter((f)=>f.reused).length} reused; visual approval NOT_GRANTED`);
    if (!isRenderedOk(result.status)) process.exitCode=2;
  }
} catch(e) { console.error(`[${e.code??'ERROR'}] ${e.message}`); process.exitCode=1; }
