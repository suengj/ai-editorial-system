#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, realpathSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/watermark-core.mjs';
import { executeCarousel, loadVisualRecipes, planCarousel } from './lib/carousel-core.mjs';
import { buildNativeCardPrompt, findNewestNativePng, intakeNativeCard, nativeReviewToFeedbackRecord, renderNativeChrome, validateNativeCardReview } from './lib/hybrid-card-core.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const FIX=resolve(ROOT,'scripts/fixtures/carousel');
const base=JSON.parse(readFileSync(resolve(FIX,'series.json'),'utf8'));
const recipes=loadVisualRecipes();
const hash=(bytes)=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log(`PASS ${name}`);};
const png=(width=216,height=270)=>{
  const pixels=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*4; pixels[i]=x%256; pixels[i+1]=y%256; pixels[i+2]=97; pixels[i+3]=255;
  }
  return encodePng({width,height,channels:4,pixels});
};
const nativeFrame=(series=structuredClone(base))=>{
  series.art_direction_sha256=`sha256:${'a'.repeat(64)}`;
  const frame=series.frames[0];
  frame.blocks=[{id:'whole-card',region:'content',kind:'generated',instruction:'Attach a synthetic native whole-card image at render time.'}];
  frame.art_direction={plan_id:'native-test',visual_mode:'mechanism_flow',focal_subject:'A synthetic paper diagram',message:'Explain the simple synthetic flow.',reading_order:['whole-card'],asset:{need:true,source:'generated',rationale:'Synthetic fixture only.'},asset_block_id:'whole-card',avoid:[],protected:{claim_ids:[],fields:[]},brand_elements:[],reuse:[],render_method:'native_card',native_prompt_strings:['Exact synthetic headline','Exact synthetic body.']};
  return series;
};
const targetCatalog={targets:[{id:'personal-instagram',label:'Synthetic target display label'}]};

const temp=mkdtempSync(resolve(tmpdir(),'aes-native-card-'));
try {
  await test('native prompt is deterministic, palette-bound, and quotes exact strings',()=>{
    const frame=nativeFrame().frames[0], palette=recipes.recipes['editorial-minimal'].theme;
    const a=buildNativeCardPrompt(frame,{palette}), b=buildNativeCardPrompt(frame,{palette});
    assert.equal(a,b);
    assert(a.includes(JSON.stringify('Exact synthetic headline')));
    assert(a.includes(JSON.stringify('Exact synthetic body.')));
    assert(a.includes('top chrome band at y=0..139'));
    assert(a.includes('No logos, brand marks, plates, signage'));
  });

  await test('native_card carousel metadata validates and remains separate from compositor frames',()=>{
    const series=nativeFrame();
    const compiled=planCarousel(series);
    assert.equal(compiled.frames[0].art_direction.render_method,'native_card');
    assert.deepEqual(compiled.frames[0].art_direction.native_prompt_strings,series.frames[0].art_direction.native_prompt_strings);
    const bad=structuredClone(series); bad.task.canvas={width:1080,aspect_ratio:'1:1'};
    assert.throws(()=>planCarousel(bad),e=>e.code==='NATIVE_CARD_CANVAS');
    const missing=structuredClone(series); delete missing.frames[0].art_direction.native_prompt_strings;
    assert.throws(()=>planCarousel(missing),e=>e.code==='SERIES_ART_DIRECTION');
  });

  const smallBytes=png(), smallPath=resolve(temp,'small.png'); writeFileSync(smallPath,smallBytes);
  await test('native intake validates route and digest, then normalizes 4:5 pixels to 1080x1350',()=>{
    const intake=intakeNativeCard({pngPath:'small.png',receipt:{route:'native_session',generator_id:'native-image-generator',sha256:hash(smallBytes)},baseDir:temp});
    const normalized=decodePng(intake.bytes);
    assert.deepEqual([normalized.width,normalized.height],[1080,1350]);
    assert.equal(intake.receipt.source_sha256,hash(smallBytes));
    assert.equal(intake.receipt.geometry.aspect_ratio,'4:5');
    assert.equal(intake.receipt.normalization,'rsvg_resize');
    assert.throws(()=>intakeNativeCard({pngPath:'small.png',receipt:{route:'api',sha256:hash(smallBytes)},baseDir:temp}),e=>e.code==='NATIVE_RECEIPT_INVALID');
    assert.throws(()=>intakeNativeCard({pngPath:'small.png',receipt:{route:'native_session',generator_id:'native-image-generator',sha256:`sha256:${'0'.repeat(64)}`},baseDir:temp}),e=>e.code==='NATIVE_RECEIPT_HASH_MISMATCH');
    const square=png(216,216); writeFileSync(resolve(temp,'square.png'),square);
    assert.throws(()=>intakeNativeCard({pngPath:'square.png',receipt:{route:'native_session',generator_id:'native-image-generator',sha256:hash(square)},baseDir:temp}),e=>e.code==='NATIVE_CARD_ASPECT');
  });

  await test('directory fallback uses an injectable newest-PNG finder',()=>{
    const chosen=resolve(temp,'small.png'); let calledWith=null;
    const selected=intakeNativeCard({sourceDir:'.',receipt:{route:'native_session',generator_id:'native-image-generator',sha256:hash(smallBytes)},baseDir:temp,findNewestFile:(dir)=>{calledWith=dir;return chosen;}});
    assert.equal(calledWith,realpathSync(temp));
    assert.equal(selected.receipt.selected_by,'source_dir_newest');
    const listed=findNewestNativePng(temp,{listFiles:()=>[
      {path:resolve(temp,'older.png'),isFile:true,mtimeMs:1},
      {path:resolve(temp,'newer.png'),isFile:true,mtimeMs:2},
      {path:resolve(temp,'newer.txt'),isFile:true,mtimeMs:3},
    ]});
    assert.equal(listed,resolve(temp,'newer.png'));
  });

  const normalized=intakeNativeCard({pngPath:'small.png',receipt:{route:'native_session',generator_id:'native-image-generator',sha256:hash(smallBytes)},baseDir:temp}).bytes;
  const palette=recipes.recipes['editorial-minimal'].theme;
  const chrome=renderNativeChrome(normalized,{label:targetCatalog.targets[0].label,sourceLine:'Source: synthetic fixture',pageMark:'1/3',tokens:palette});
  await test('deterministic chrome draws the target label and changes zero pixels outside reserved bands',()=>{
    assert.equal(chrome.proof.label,'Synthetic target display label');
    assert.equal(chrome.proof.outside_changed_pixels,0);
    const before=decodePng(normalized), after=decodePng(chrome.bytes);
    assert.equal(before.width,after.width); assert.equal(before.height,after.height);
    const sample=(img,x,y)=>[...img.pixels.subarray((y*img.width+x)*img.channels,(y*img.width+x)*img.channels+img.channels)];
    assert.deepEqual(sample(before,540,500),sample(after,540,500));
    assert.notDeepEqual(sample(before,0,0),sample(after,0,0));
    assert.throws(()=>renderNativeChrome(normalized,{label:'',sourceLine:'Source',pageMark:'1/3',tokens:palette}),e=>e.code==='UNRESOLVED_LABEL');
  });

  const cardSha=hash(chrome.bytes);
  const review={schema_version:'1.0.0',review_id:'native-card-review:synthetic-pass',reviewed_at:'2026-10-16T03:00:00Z',card_sha256:cardSha,
    reviewer:{type:'agent',id:'independent-synthetic-reviewer',independent:true},expected_strings:['Exact synthetic headline','Exact synthetic body.'],observed_strings:['Exact synthetic headline','Exact synthetic body.'],logo_detected:false,chrome_match:true,status:'PASS'};
  await test('review contract requires an independent card-hash-bound exact match',()=>{
    assert.equal(validateNativeCardReview(review,{expectedStrings:review.expected_strings,cardSha256:cardSha,generatorId:'native-image-generator'}).ok,true);
    const self=structuredClone(review); self.self_check=true;
    assert.equal(validateNativeCardReview(self,{expectedStrings:review.expected_strings,cardSha256:cardSha,generatorId:'native-image-generator'}).ok,false);
    for (const id of ['native-image-generator','Native-Image-Generator','self']) {
      const same=structuredClone(review); same.reviewer.id=id;
      assert.equal(validateNativeCardReview(same,{expectedStrings:review.expected_strings,cardSha256:cardSha,generatorId:'native-image-generator'}).ok,false,id);
    }
    assert.equal(validateNativeCardReview(review,{expectedStrings:review.expected_strings,cardSha256:cardSha}).ok,false);
    const wrongHash=structuredClone(review); wrongHash.card_sha256=`sha256:${'0'.repeat(64)}`;
    assert.equal(validateNativeCardReview(wrongHash,{expectedStrings:review.expected_strings,cardSha256:cardSha,generatorId:'native-image-generator'}).ok,false);
    const mismatch=structuredClone(review); mismatch.observed_strings[1]='Exact synthetic body'; mismatch.status='TEXT_MISMATCH';
    assert.equal(validateNativeCardReview(mismatch,{expectedStrings:review.expected_strings,cardSha256:cardSha,generatorId:'native-image-generator'}).derived_status,'TEXT_MISMATCH');
    const feedback=nativeReviewToFeedbackRecord(review,{frameId:'opening',seriesId:'carousel-smoke'});
    assert.equal(feedback.owner_verdict,'unknown');
    assert.equal(feedback.routing.layer,'verification');
    assert.equal(feedback.verdict,'good');
  });

  await test('render pipeline holds native_card in pending until matching PASS review is attached',async()=>{
    const series=nativeFrame(), bytes=png(1080,1350), nativePath=resolve(temp,'full.png'); writeFileSync(nativePath,bytes);
    const target={id:'personal-instagram',label:'Synthetic target display label'};
    const sourceLine=series.frames[0].source_note;
    const expectedChrome=renderNativeChrome(bytes,{label:target.label,sourceLine,pageMark:'1/3',tokens:planCarousel(series).preset.theme});
    const attachedReview={...review,card_sha256:hash(expectedChrome.bytes)};
    const session={schema_version:'1.0.0',route:'native_session',frames:{opening:{png_path:'full.png',receipt:{route:'native_session',generator_id:'native-image-generator',sha256:hash(bytes)},review:attachedReview}}};
    const out=resolve(temp,'render-pass');
    const result=await executeCarousel(series,{baseDir:FIX,outDir:out,targetId:target.id,targetCatalog,nativeSession:session,nativeSessionBaseDir:temp});
    const opening=result.frames.find(f=>f.id==='opening');
    if(result.status!=='RENDERED_NEEDS_REVIEW') console.error('native-card render diagnostic',JSON.stringify({status:result.status,opening,qa:result.qa}));
    assert.equal(result.status,'RENDERED_NEEDS_REVIEW');
    assert.equal(opening.native_review_status,'PASS');
    assert.equal(opening.chrome_outside_changed_pixels,0);
    assert.equal(opening.outputs['image.png'].sha256,hash(readFileSync(resolve(out,'opening/image.png'))));
    assert.equal(JSON.parse(readFileSync(resolve(out,'opening/native-feedback.json'),'utf8')).owner_verdict,'unknown');

    const reusedOut=resolve(temp,'render-pass-reused');
    const reused=await executeCarousel(series,{baseDir:FIX,outDir:reusedOut,previousDir:out,targetId:target.id,targetCatalog,nativeSession:session,nativeSessionBaseDir:temp});
    const reusedOpening=reused.frames.find(f=>f.id==='opening');
    assert.equal(reusedOpening.reused,true);
    assert.equal(reusedOpening.outputs['native-prompt.txt'].sha256,hash(readFileSync(resolve(reusedOut,'opening/native-prompt.txt'))));
    const receipt=JSON.parse(readFileSync(resolve(reusedOut,'opening/receipt.json'),'utf8'));
    assert(existsSync(resolve(reusedOut,receipt.native_prompt_ref)));

    const pendingOut=resolve(temp,'render-pending');
    const pending=await executeCarousel(series,{baseDir:FIX,outDir:pendingOut,targetId:target.id,targetCatalog,nativeSession:{schema_version:'1.0.0',route:'native_session',frames:{opening:{png_path:'full.png',receipt:{route:'native_session',generator_id:'native-image-generator',sha256:hash(bytes)}}}},nativeSessionBaseDir:temp});
    assert.equal(pending.status,'INCOMPLETE');
    assert.equal(pending.frames.find(f=>f.id==='opening').status,'NATIVE_REVIEW_REQUIRED');
    assert.equal(readFileSync(resolve(pendingOut,'opening/pending/image.png')).length>0,true);
    assert.equal(existsSync(resolve(pendingOut,'opening/image.png')),false);
  });

  await test('session paths are contained in the native session directory',async()=>{
    const series=nativeFrame(), bytes=png(1080,1350); writeFileSync(resolve(temp,'full.png'),bytes);
    const rc={route:'native_session',generator_id:'native-image-generator',sha256:hash(bytes)};
    for (const bad of ['../outside.png','/etc/passwd','a/../../x.png']) for (const key of ['png_path','source_dir','review_path']) {
      const frame={receipt:rc,[key]:bad}; if(key==='review_path') frame.png_path='full.png';
      await assert.rejects(executeCarousel(series,{baseDir:FIX,outDir:resolve(temp,'trav'),targetId:'personal-instagram',targetCatalog,nativeSession:{schema_version:'1.0.0',route:'native_session',frames:{opening:frame}},nativeSessionBaseDir:temp}),e=>e.code==='NATIVE_PATH_ESCAPE',`${key}:${bad}`);
    }
    assert.throws(()=>intakeNativeCard({pngPath:'../x.png',receipt:rc,baseDir:temp}),e=>e.code==='NATIVE_PATH_ESCAPE');
    const noGen={route:'native_session',sha256:hash(bytes)};
    assert.throws(()=>intakeNativeCard({pngPath:'full.png',receipt:noGen,baseDir:temp}),e=>e.code==='NATIVE_RECEIPT_INVALID');
  });

  await test('explicit compositor frames also receive catalog chrome while legacy frames remain untouched',async()=>{
    const series=structuredClone(base);
    series.art_direction_sha256=`sha256:${'b'.repeat(64)}`;
    series.frames[0].art_direction={plan_id:'compositor-test',visual_mode:'text_focus',focal_subject:'Synthetic text layout',message:'Keep the exact supplied text.',reading_order:['body'],asset:{need:false,source:'none',rationale:'Compositor text remains exact.'},avoid:[],protected:{claim_ids:[],fields:[]},brand_elements:[],reuse:[],render_method:'compositor'};
    const out=resolve(temp,'render-compositor');
    const result=await executeCarousel(series,{baseDir:FIX,outDir:out,targetId:'personal-instagram',targetCatalog});
    assert.equal(result.status,'RENDERED_NEEDS_REVIEW');
    const chromeRecord=JSON.parse(readFileSync(resolve(out,'opening/chrome.json'),'utf8'));
    assert.equal(chromeRecord.master.label,targetCatalog.targets[0].label);
    assert.equal(chromeRecord.master.outside_changed_pixels,0);
    assert.equal(result.frames[0].outputs['chrome.json'].sha256,hash(readFileSync(resolve(out,'opening/chrome.json'))));
    assert.equal(result.frames[1].outputs['chrome.json'],undefined);
  });

  await test('native session without a catalog target label fails closed',async()=>{
    const series=nativeFrame();
    await assert.rejects(executeCarousel(series,{baseDir:FIX,outDir:resolve(temp,'no-label'),targetId:'missing-target',targetCatalog}),e=>e.code==='UNRESOLVED_LABEL');
  });
} finally { rmSync(temp,{recursive:true,force:true}); }

console.log(`\n${passed} native-card checks PASS. Synthetic PNGs only; no model calls, real pilot assets, visual acceptance, or publication.`);
