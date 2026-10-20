#!/usr/bin/env node
/** SUE-1345. Default: planner tests. --render: real existing executor, no mocks. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { planCarousel, executeCarousel, loadVisualRecipes } from './lib/carousel-core.mjs';
import { resolveDefaultVisualStyle } from './lib/visual-style-policy.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const FIX=resolve(ROOT,'scripts/fixtures/carousel');
const base=JSON.parse(readFileSync(resolve(FIX,'series.json'),'utf8'));
const clone=(x=base)=>structuredClone(x); let passed=0;
const ok=(name,fn)=>{fn();passed++;console.log(`PASS ${name}`);};
const bad=(name,mut,code)=>ok(name,()=>{const v=clone();mut(v);assert.throws(()=>planCarousel(v),(e)=>e.code===code);});
const first=planCarousel(base),json=JSON.stringify(base);
ok('three frames and original order',()=>assert.deepEqual(first.frames.map((f)=>f.id),['opening','evidence','closing']));
ok('input unchanged',()=>assert.equal(JSON.stringify(base),json));
ok('one semantic type role across frames',()=>assert.equal(new Set(first.frames.map((f)=>JSON.stringify(f.plan.layers.find((l)=>l.id==='headline').font_size))).size,1));
ok('page numbering is deterministic',()=>assert.deepEqual(first.frames.map((f)=>f.plan.layers.at(-1).text),['1 / 3','2 / 3','3 / 3']));
ok('role hierarchy and independent layouts',()=>{assert(first.typography.headline.font_size>first.typography.body.font_size);assert.equal(new Set(first.frames.map((f)=>f.layout)).size,3);});
ok('silent profile and no narration dependency',()=>{assert.equal(first.density_profile,'silent_carousel');assert.equal(first.narration_dependency,'none');});
ok('original recipe catalogue remains available beside R4/R7',()=>{const recipes=loadVisualRecipes().recipes;assert.equal(new Set(['editorial-minimal','dark-data','pop-collage'].map((id)=>recipes[id].theme.background)).size,3);assert(recipes['r4-photo-fullbleed']);assert(recipes['r7-illustration-fallback']);});
ok('existing legacy-default series route through the approved selector',()=>{assert.equal(first.recipe,'r7-illustration-fallback');assert.equal(first.visual_style.reason,'photo_asset_absent');const withPhoto=clone();withPhoto.frames[0].blocks[0]={id:'photo',region:'content',kind:'image',ref:'photo.png'};assert.equal(planCarousel(withPhoto).recipe,'r4-photo-fullbleed');});
ok('R4 is the default and records its basis',()=>{const s=clone();s.visual_style={requested_style:'AUTO',content_kind:'other',photo_asset_quality:'strong'};const p=planCarousel(s);assert.equal(p.recipe,'r4-photo-fullbleed');assert.equal(p.visual_style.reason,'strong_photo_asset');});
ok('R7 fallback applies only to documented triggers',()=>{for(const input of [{content_kind:'other',photo_asset_quality:'absent'},{content_kind:'other',photo_asset_quality:'weak'},{content_kind:'lifestyle_practical',photo_asset_quality:'strong'}])assert.equal(resolveDefaultVisualStyle(input).recipe,'r7-illustration-fallback');assert.equal(resolveDefaultVisualStyle({content_kind:'other',photo_asset_quality:'unknown'}).recipe,'r4-photo-fullbleed');});
ok('AUTO selection preserves a producer-specific recipe',()=>{const s=clone();s.recipe='dark-data';s.visual_style={requested_style:'AUTO',content_kind:'other',photo_asset_quality:'strong'};const p=planCarousel(s);assert.equal(p.recipe,'dark-data');assert.equal(p.visual_style.reason,'explicit_recipe_preserved');});
ok('explicit R4/R7 and legacy rollback resolve deterministically',()=>{assert.equal(resolveDefaultVisualStyle({requested_style:'R7'}).style,'R7');assert.deepEqual(resolveDefaultVisualStyle({}, {rollback:true}),{style:'legacy',recipe:'editorial-minimal',reason:'rollback_flag'});assert.equal(resolveDefaultVisualStyle({requested_style:'R4'},{rollback:true}).style,'R4');});
ok('runtime rollback flag restores only the default selector',()=>{const prior=process.env.VQ_V2_CARD_STYLE_DEFAULT;try{process.env.VQ_V2_CARD_STYLE_DEFAULT='legacy';const s=clone();s.visual_style={requested_style:'AUTO',content_kind:'other',photo_asset_quality:'strong'};assert.equal(planCarousel(s).recipe,'editorial-minimal');s.visual_style.requested_style='R4';assert.equal(planCarousel(s).recipe,'r4-photo-fullbleed');}finally{if(prior===undefined)delete process.env.VQ_V2_CARD_STYLE_DEFAULT;else process.env.VQ_V2_CARD_STYLE_DEFAULT=prior;}});
ok('no automatic approval or multi-candidate quota',()=>{assert.equal(first.publication_authorized,false);assert.equal(first.candidate_policy.initial_candidates,1);});
ok('R7 default changes a simple text card into illustration plus copy',()=>{const f=first.frames[0];assert.equal(f.layout,'r7-illustration');assert.deepEqual(f.plan.layers.find((l)=>l.id==='vq-r7-artwork').slot,loadVisualRecipes().layouts['r7-illustration'].art);assert.deepEqual(f.plan.layers.find((l)=>l.id==='body').slot,loadVisualRecipes().layouts['r7-illustration'].copy);assert.equal(JSON.stringify(base),JSON.stringify(clone()));});
ok('R7 weak-photo fallback replaces the unsuitable photo with generated art',()=>{const s=clone();s.visual_style={requested_style:'AUTO',content_kind:'other',photo_asset_quality:'weak'};s.frames[0].blocks=[{id:'weak-photo',region:'content',kind:'image',ref:'weak.jpg',rights_note:'source asset'}];const p=planCarousel(s);assert.equal(p.recipe,'r7-illustration-fallback');assert.equal(p.frames[0].layout,'r7-illustration');assert.equal(p.frames[0].plan.layers.some((l)=>l.id==='weak-photo'||l.kind==='image'),false);assert.equal(p.frames[0].plan.layers.find((l)=>l.id==='vq-r7-artwork').kind,'generated');assert.equal(s.frames[0].blocks[0].id,'weak-photo');});
ok('specialized producer recipes retain their authored layouts and source',()=>{const s=clone();s.recipe='dark-data';s.visual_style={requested_style:'AUTO',content_kind:'other',photo_asset_quality:'strong'};const p=planCarousel(s);assert.equal(p.recipe,'dark-data');assert.equal(p.frames[0].layout,'text');assert.deepEqual(p.frames[1].plan.layers.find((l)=>l.kind==='chart').slot,loadVisualRecipes().layouts.visual.content);assert.notDeepEqual(p.preset.theme,first.preset.theme);});
ok('per-series typography override applies everywhere',()=>{const s=clone();s.typography={headline:{font_size:60}};assert(planCarousel(s).frames.every((f)=>f.plan.layers.find((l)=>l.id==='headline').font_size===60));});
ok('task override forwarded not overwritten by recipe',()=>{const s=clone();s.task.canvas={width:1080,aspect_ratio:'1:1'};s.task.theme={background:'#EEEEDD'};assert.equal(planCarousel(s).frames[0].plan.task.canvas.aspect_ratio,'1:1');});
ok('job reference is retained for original authority path',()=>{const s=clone();s.frames[0].job_ref='real-job.json';assert.equal(planCarousel(s).frames[0].plan.job_ref,'real-job.json');});
ok('no chart values copied into prompts',()=>{assert(first.frames.flatMap((f)=>f.plan.layers).filter((l)=>l.kind==='chart').every((l)=>l.ref && !l.points && !l.instruction));});
const gen=clone();gen.frames[0].layout='visual';gen.frames[0].blocks=[{id:'art',region:'content',kind:'generated',instruction:'One quiet paper sculpture.'}];
ok('generation instructions explicitly stay in content slot',()=>{const l=planCarousel(gen).frames[0].plan.layers.find((x)=>x.kind==='generated');assert(l.instruction.includes('compositor clips'));assert.deepEqual(l.slot,loadVisualRecipes().layouts.visual.content);});
ok('unused recipe edits do not invalidate selected recipe',()=>{const c=loadVisualRecipes();c.recipes['pop-collage'].theme.background='#123456';assert.equal(planCarousel(base,c).recipe_hash,first.recipe_hash);});
const mutations=[
 ['unknown root field',s=>s.style_axis='new','SERIES_UNKNOWN_FIELD'],
 ['unknown visual style value',s=>s.visual_style={requested_style:'R8'},'SERIES_STYLE'],
 ['null visual style',s=>s.visual_style=null,'SERIES_STYLE'],
 ['missing frames uses the named contract error',s=>delete s.frames,'SERIES_FRAMES'],
 ['unknown frame style override',s=>s.frames[0].theme={},'SERIES_UNKNOWN_FIELD'],
 ['unknown typography role',s=>s.typography={foo:{}},'SERIES_UNKNOWN_FIELD'],
 ['invalid typography',s=>s.typography={body:{font_size:2}},'SERIES_TYPE'],
 ['unknown recipe',s=>s.recipe='missing','SERIES_RECIPE'],
 ['missing source',s=>delete s.source.ref,'SERIES_SOURCE'],
 ['invalid source scope',s=>s.source.scope='verified','SERIES_SOURCE'],
 ['wrong artifact',s=>s.profiles.artifact='visual/social-card','SERIES_PROFILE'],
 ['duplicate frame ID',s=>s.frames[1].id=s.frames[0].id,'SERIES_FRAME_ID'],
 ['bad frame path',s=>s.frames[0].id='../x','SERIES_FRAME_ID'],
 ['unknown frame function',s=>s.frames[0].function='decorate','SERIES_MEANING'],
 ['missing alt text',s=>delete s.frames[0].alt_text,'SERIES_MEANING'],
 ['missing source note',s=>delete s.frames[0].source_note,'SERIES_MEANING'],
 ['missing takeaway',s=>delete s.frames[0].takeaway,'SERIES_MEANING'],
 ['unknown beat',s=>s.frames[0].beat_ids=['bogus'],'SERIES_BEATS'],
 ['duplicate beat',s=>s.beats.push(s.beats[0]),'SERIES_BEATS'],
 ['unrepresented beat',s=>s.beats.push({id:'unused',depends_on:[]}),'SERIES_BEAT_MISSING'],
 ['wrong sequence',s=>s.frames.reverse(),'SERIES_ORDER'],
 ['cycle',s=>s.beats[0].depends_on=['close'],'SERIES_ORDER'],
 ['dependency missing',s=>s.beats[1].depends_on=['gone'],'SERIES_BEATS'],
 ['no-text carousel',s=>s.task.text_policy='no_text','SERIES_TEXT'],
 ['overlapping reserved title',s=>s.regions={headline:{x:0.06,y:0.04,width:0.88,height:0.21}},'SERIES_COLLISION'],
 ['body invades source footer',s=>s.layouts={text:{content:{x:0.06,y:0.35,width:0.88,height:0.57}}},'SERIES_COLLISION'],
 ['out-of-bounds region',s=>s.regions={headline:{x:0,y:0,width:2,height:0.2}},'SERIES_REGION'],
 ['zero region',s=>s.layouts={text:{content:{x:0.06,y:0.35,width:0,height:0.45}}},'SERIES_REGION'],
 ['unknown slot',s=>s.frames[0].blocks[0].region='headline','SERIES_REGION'],
 ['duplicate region',s=>s.frames[2].blocks[1].region='left','SERIES_REGION'],
 ['unknown block override',s=>s.frames[0].blocks[0].font_size=5,'SERIES_UNKNOWN_FIELD'],
 ['chart cannot hide arbitrary ignored copy',s=>s.frames[1].blocks[0].text='wrong','SERIES_UNKNOWN_FIELD'],
 ['duplicate block ID',s=>s.frames[2].blocks[1].id='keep','SERIES_LAYER_ID'],
 ['reserved block ID',s=>s.frames[0].blocks[0].id='headline','SERIES_LAYER_ID'],
 ['unknown layout',s=>s.frames[0].layout='random','SERIES_LAYOUT'],
 ['too many blocks',s=>s.frames[0].blocks.push(s.frames[0].blocks[0]),'SERIES_BLOCKS'],
 ['blank body',s=>s.frames[0].blocks[0].text='','SERIES_TEXT']
];
for(const [name,mut,code] of mutations) bad(name,mut,code);

if(process.argv.includes('--render')) {
  const {findRasterizer}=await import('./lib/svg-tools.mjs');
  const {compileExecution,executeVisual}=await import('./lib/visual-execution-core.mjs');
  const {decodePng,encodePng,sha256}=await import('./lib/watermark-core.mjs');
  assert(findRasterizer(),'--render requires a real SVG rasterizer, not a mock');
  const root=mkdtempSync(resolve(tmpdir(),'aes-carousel-test-'));
  const input=resolve(root,'input');mkdirSync(input);
  for(const f of ['source.md','counts.json'])copyFileSync(resolve(FIX,f),resolve(input,f));
  const run=(s,dir,previousDir=null)=>executeCarousel(s,{baseDir:input,outDir:resolve(root,dir),previousDir});
  const renderBase=clone();renderBase.recipe='dark-data';renderBase.visual_style={requested_style:'AUTO',content_kind:'other',photo_asset_quality:'strong'};
  const a=await run(renderBase,'a');
  ok('real 3-frame series output',()=>assert.equal(a.status,'RENDERED_NEEDS_REVIEW'));
  ok('render receipt persists the resolved style and reason',()=>{const receipt=JSON.parse(readFileSync(resolve(root,'a/series.json'),'utf8'));assert.equal(receipt.visual_style.style,'dark-data');assert.equal(receipt.visual_style.reason,'explicit_recipe_preserved');});
  ok('full-size PNG exact 4:5',()=>{const p=decodePng(readFileSync(resolve(root,'a/opening/image.png')));assert.deepEqual([p.width,p.height],[1080,1350]);});
  ok('phone PNG is 390px wide',()=>assert.equal(decodePng(readFileSync(resolve(root,'a/opening/phone.png'))).width,390));
  ok('contact sheet has three columns',()=>assert.equal(decodePng(readFileSync(resolve(root,'a/contact-sheet.png'))).width,1170));
  ok('actual bar labels preserve source data',()=>{const r=JSON.parse(readFileSync(resolve(root,'a/evidence/receipt.json'),'utf8'));assert.deepEqual(r.charts[0].displayed.map((x)=>x.value),[125,180,240]);assert.equal(r.charts[0].displayed[0].category,'준비');});
  ok('QA remains unreviewed',()=>{const r=JSON.parse(readFileSync(resolve(root,'a/review-worklist.json'),'utf8'));assert.equal(r.status,'NOT_REVIEWED');assert(r.frames.every((f)=>f.verdict==='NOT_REVIEWED'));});
  const b=await run(renderBase,'b',resolve(root,'a'));
  ok('unchanged frames reused when font environment is observable',()=>assert.equal(b.frames.filter((f)=>f.reused).length,a.runtime.font_environment?3:0));
  ok('same inputs reproduce image bytes',()=>assert.deepEqual(a.frames.map((f)=>f.outputs['image.png'].sha256),b.frames.map((f)=>f.outputs['image.png'].sha256)));
  const edit=structuredClone(renderBase);edit.frames[1].headline='근거를\n분명하게 보여줍니다';
  const c=await run(edit,'c',resolve(root,'a'));
  ok('only edited frame rerendered',()=>{assert.equal(c.frames[1].reused,false);assert.equal(c.frames.filter((f)=>f.reused).length,a.runtime.font_environment?2:0);});
  ok('other frame image hashes preserved',()=>{assert.equal(c.frames[0].outputs['image.png'].sha256,a.frames[0].outputs['image.png'].sha256);assert.equal(c.frames[2].outputs['image.png'].sha256,a.frames[2].outputs['image.png'].sha256);assert.notEqual(c.frames[1].outputs['image.png'].sha256,a.frames[1].outputs['image.png'].sha256);});
  const explicit=clone();explicit.task.canvas={width:1080,aspect_ratio:'1:1'};explicit.task.theme={background:'#FFEEDD'};
  const p=planCarousel(explicit), ep=await compileExecution(p.frames[0].plan,{baseDir:input,preset:p.preset});
  ok('explicit task geometry and palette actually consumed',()=>{assert.equal(ep.canvas.height,1080);assert.equal(ep.theme.background,'#FFEEDD');});
  const missing=clone();missing.source.ref='absent.md';
  await assert.rejects(run(missing,'missing'),e=>e.code==='SOURCE_REQUIRED');passed++;console.log('PASS missing source blocks execution');
  const overflow=structuredClone(renderBase);overflow.frames[0].headline='너무 긴 제목 '.repeat(8);
  await assert.rejects(run(overflow,'overflow'),/TEXT_OVERFLOW/);passed++;console.log('PASS real Korean overflow rejects without shrinking');
  ok('overflow creates no stale image',()=>assert(!existsSync(resolve(root,'overflow/opening/image.png'))));
  const waiting=await run(gen,'waiting');
  ok('missing generated bytes are not complete',()=>{assert.equal(waiting.status,'INCOMPLETE');assert.equal(waiting.frames[0].status,'RENDER_REQUIRED');assert(!existsSync(resolve(root,'waiting/contact-sheet.png')));});
  const pixels=Buffer.alloc(240*240*4,255);for(let i=0;i<pixels.length;i+=4){pixels[i]=180;pixels[i+1]=90;pixels[i+2]=20;}
  const image=encodePng({width:240,height:240,channels:4,pixels});writeFileSync(resolve(input,'pattern.png'),image);
  const photo=clone();photo.recipe='dark-data';photo.frames[2].blocks[1]={id:'photo',region:'right',kind:'image',ref:'pattern.png',rights_note:'Authored synthetic pixel pattern, not a real photo.',fit:'contain'};
  photo.task.watermark={enabled:true,text:'DEMO',scale:0.02};
  const ph=await run(photo,'photo');
  ok('image plus chart plus watermark in one series',()=>{assert.equal(ph.status,'RENDERED_NEEDS_REVIEW');const r=JSON.parse(readFileSync(resolve(root,'photo/closing/receipt.json'),'utf8'));assert.equal(r.images[0].source_sha256,sha256(image));assert(r.watermark);});
  ok('photo cannot change pixels outside its slot',()=>{const before=decodePng(readFileSync(resolve(root,'a/closing/master.png'))),after=decodePng(readFileSync(resolve(root,'photo/closing/master.png')));const b=JSON.parse(readFileSync(resolve(root,'photo/closing/receipt.json'),'utf8')).images[0].slot;let outside=0;for(let y=0;y<before.height;y++)for(let x=0;x<before.width;x++){if(x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height)continue;const n=before.channels,o=(y*before.width+x)*n;for(let c=0;c<n;c++)if(before.pixels[o+c]!==after.pixels[o+c])outside++;}assert.equal(outside,0);});
  ok('source image file remains byte-identical',()=>assert.equal(sha256(readFileSync(resolve(input,'pattern.png'))),sha256(image)));
  const independentPlan=planCarousel(renderBase);const independent=resolve(root,'single');await executeVisual(independentPlan.frames[0].plan,{baseDir:input,preset:independentPlan.preset,outDir:independent});
  ok('single-image executor compatibility unchanged',()=>assert.equal(sha256(readFileSync(resolve(independent,'image.png'))),a.frames[0].outputs['image.png'].sha256));
  const old=resolve(root,'a/opening/image.png');writeFileSync(old,Buffer.from('corrupt'));
  await assert.rejects(run(renderBase,'tampered',resolve(root,'a')),e=>e.code==='SERIES_REUSE');passed++;console.log('PASS changed prior bytes rejected');
  console.log(`ARTIFACT_DIR ${root}`);
} else console.log('NOT_RUN real rendering (use --render); planner assertions are not visual approval');
console.log(`carousel: ${passed} assertions PASS`);
