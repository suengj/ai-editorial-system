#!/usr/bin/env node
/** SUE-1345: one series packet -> existing single-image execution. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { planCarousel, executeCarousel } from './lib/carousel-core.mjs';

try {
  const {values}=parseArgs({options:{plan:{type:'string'},out:{type:'string'},previous:{type:'string'},rasterizer:{type:'string',default:'auto'},'compile-only':{type:'boolean',default:false}},strict:true});
  if (!values.plan || !values.out) throw new Error('usage: node scripts/render-carousel.mjs --plan series.json --out NEW_DIR [--previous OLD_DIR] [--compile-only] [--rasterizer auto|rsvg|magick]');
  const path=resolve(values.plan), out=resolve(values.out), series=JSON.parse(readFileSync(path,'utf8'));
  if (values['compile-only']) {
    if (existsSync(out) && readdirSync(out).length) throw new Error('OUTPUT_EXISTS: use a new empty directory');
    const result=planCarousel(series); mkdirSync(out,{recursive:true});
    writeFileSync(resolve(out,'series-plan.json'),`${JSON.stringify(result,null,2)}\n`);
    console.log('PLANNED_NOT_RENDERED: source bytes, profile authority and glyph fit are checked by execution, not by this planning-only mode');
  } else {
    const result=await executeCarousel(series,{baseDir:dirname(path),outDir:out,rasterizer:values.rasterizer,previousDir:values.previous?resolve(values.previous):null});
    console.log(`${result.status}: ${result.frames.length} frames; ${result.frames.filter((f)=>f.reused).length} reused; visual approval NOT_GRANTED`);
    if (result.status!=='RENDERED_NEEDS_REVIEW') process.exitCode=2;
  }
} catch(e) { console.error(`[${e.code??'ERROR'}] ${e.message}`); process.exitCode=1; }
