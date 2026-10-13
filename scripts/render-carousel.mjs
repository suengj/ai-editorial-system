#!/usr/bin/env node
/** SUE-1345: one series packet -> existing single-image execution. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { isRenderedOk } from './lib/visual-execution-core.mjs';
import { RuleReader, loadManifest, gateRender } from './lib/resolve-core.mjs';
import { planCarousel, executeCarousel } from './lib/carousel-core.mjs';

try {
  const {values}=parseArgs({options:{plan:{type:'string'},out:{type:'string'},previous:{type:'string'},'profile-receipt':{type:'string'},'pinned-revision':{type:'string'},rasterizer:{type:'string',default:'auto'},'compile-only':{type:'boolean',default:false}},strict:true});
  if (!values.plan || !values.out) throw new Error('usage: node scripts/render-carousel.mjs --plan series.json --out NEW_DIR [--previous OLD_DIR] [--compile-only] [--rasterizer auto|rsvg|magick]');
  const path=resolve(values.plan), out=resolve(values.out), series=JSON.parse(readFileSync(path,'utf8'));
  // SUE-1426: registered SNS surfaces render only under a READY resolved-profile receipt (see scripts/resolve-editorial.mjs).
  const gate=gateRender(series,values['profile-receipt']?JSON.parse(readFileSync(resolve(values['profile-receipt']),'utf8')):null,loadManifest(new RuleReader()).manifest,{reader:new RuleReader(),pinnedRevision:values['pinned-revision']??null});
  if (!gate.ok) throw Object.assign(new Error(gate.message),{code:gate.code});
  if (gate.applies) console.log(`profile gate: ${gate.profile_id} revision=${gate.revision} (${gate.revision_check}) ${gate.integrity}`);
  if (values['compile-only']) {
    if (existsSync(out) && readdirSync(out).length) throw new Error('OUTPUT_EXISTS: use a new empty directory');
    const result=planCarousel(series); mkdirSync(out,{recursive:true});
    writeFileSync(resolve(out,'series-plan.json'),`${JSON.stringify(result,null,2)}\n`);
    console.log('PLANNED_NOT_RENDERED: source bytes, profile authority and glyph fit are checked by execution, not by this planning-only mode');
  } else {
    const result=await executeCarousel(series,{baseDir:dirname(path),outDir:out,rasterizer:values.rasterizer,previousDir:values.previous?resolve(values.previous):null});
    console.log(`${result.status}: ${result.frames.length} frames; ${result.frames.filter((f)=>f.reused).length} reused; visual approval NOT_GRANTED`);
    if (!isRenderedOk(result.status)) process.exitCode=2;
  }
} catch(e) { console.error(`[${e.code??'ERROR'}] ${e.message}`); process.exitCode=1; }
