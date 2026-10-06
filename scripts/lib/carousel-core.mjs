/** SUE-1345: series realization over the existing single-image executor.
 * The caller/LLM owns editorial interpretation. This module never generates,
 * verifies claims, approves, publishes, or introduces another visual axis.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CAROUSEL_VERSION = '1.0.0';
const obj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const stable = (x) => Array.isArray(x) ? x.map(stable) : obj(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable(x[k])])) : x;
const hash = (x) => `sha256:${createHash('sha256').update(Buffer.isBuffer(x) ? x : JSON.stringify(stable(x))).digest('hex')}`;
const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const need = (condition, code, message) => { if (!condition) fail(code, message); };
const text = (s) => typeof s === 'string' && s.trim().length > 0;
const slug = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s);
function keys(value, allowed, where) {
  need(obj(value), 'SERIES_INPUT', `${where} must be an object`);
  for (const key of Object.keys(value)) need(allowed.includes(key), 'SERIES_UNKNOWN_FIELD', `${where}.${key}`);
}
const overlaps = (a, b) => a.x < b.x+b.width-1e-8 && a.x+a.width > b.x+1e-8 && a.y < b.y+b.height-1e-8 && a.y+a.height > b.y+1e-8;
function checkRegions(regions) {
  for (const [id, r] of Object.entries(regions)) {
    keys(r, ['x','y','width','height'], `region ${id}`);
    need(['x','y','width','height'].every((k) => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 1) && r.width > 0 && r.height > 0 && r.x+r.width <= 1 && r.y+r.height <= 0.93,
      'SERIES_REGION', `${id}: normalized region must fit above the reserved watermark/illustrative footer`);
  }
  const pairs = Object.entries(regions);
  for (let i=0;i<pairs.length;i++) for (let j=0;j<i;j++) need(!overlaps(pairs[i][1],pairs[j][1]), 'SERIES_COLLISION', `${pairs[i][0]} overlaps ${pairs[j][0]}`);
}
const mergeRoles = (base, override={}) => Object.fromEntries(Object.entries(base).map(([role, style]) => [role, {...style, ...(override[role] ?? {})}]));
export function loadVisualRecipes() { return JSON.parse(readFileSync(resolve(ROOT, 'editorial/visual-recipes.v1.json'), 'utf8')); }

/** Pure planning: emits unchanged v1 single-image plans, not rendered evidence. */
export function planCarousel(series, catalog=loadVisualRecipes()) {
  keys(series, ['schema_version','series_id','request','source','profiles','recipe','task','typography','regions','layouts','series_label','beats','frames'], 'series');
  need(series.schema_version === CAROUSEL_VERSION && slug(series.series_id), 'SERIES_VERSION', 'v1 and a slug series_id are required');
  need(text(series.request) && text(series.series_label), 'SERIES_INPUT', 'request and series_label are required');
  keys(series.source, ['ref','sha256','scope'], 'source');
  need(text(series.source.ref) && ['source_bound','illustrative'].includes(series.source.scope), 'SERIES_SOURCE', 'actual source ref and scope required');
  keys(series.profiles, ['surface','artifact','brand'], 'profiles');
  need(text(series.profiles.surface) && series.profiles.artifact === 'visual/slide-image', 'SERIES_PROFILE', 'use existing visual/slide-image and a compatible surface');
  const recipe = catalog.recipes[series.recipe];
  need(recipe, 'SERIES_RECIPE', `unknown recipe: ${series.recipe}`);
  const task = series.task ?? {};
  keys(task, ['canvas','theme','text_policy','density','watermark','watermark_layer'], 'task');
  need(task.text_policy !== 'no_text', 'SERIES_TEXT', 'silent carousel includes headlines, sources and pagination');
  const preset = {canvas:{width:1080,aspect_ratio:'4:5'},theme:{...recipe.theme},text_policy:'hybrid_template',density:{semantic:'moderate',visual:'low'},watermark:{enabled:false}};
  keys(series.typography ?? {}, Object.keys(catalog.typography), 'typography');
  const typography = mergeRoles(mergeRoles(catalog.typography,recipe.typography),series.typography);
  for (const [role,style] of Object.entries(typography)) {
    keys(style,['font_size','weight','max_lines','line_height','align'],`typography.${role}`);
    need(Number.isInteger(style.font_size) && style.font_size >= 14 && style.font_size <= 256 && [400,500,600,700,800].includes(style.weight) && Number.isInteger(style.max_lines) && style.max_lines >= 1 && style.max_lines <= 20 && style.line_height >= 1.05 && style.line_height <= 2 && (style.align === undefined || ['start','middle','end'].includes(style.align)), 'SERIES_TYPE', role);
  }
  keys(series.regions ?? {},Object.keys(catalog.regions),'regions');
  keys(series.layouts ?? {},Object.keys(catalog.layouts),'layouts');
  const recurring = {...catalog.regions, ...(series.regions ?? {})};
  const layouts = {...catalog.layouts,...(series.layouts ?? {})};
  for (const [name,layout] of Object.entries(layouts)) {
    keys(layout,Object.keys(catalog.layouts[name]),`layouts.${name}`);
    need(Object.keys(catalog.layouts[name]).every((k)=>layout[k]), 'SERIES_REGION', `missing region in ${name}`);
    checkRegions({...recurring,...layout});
  }
  need(Array.isArray(series.frames) && series.frames.length >= 1 && series.frames.length <= 20, 'SERIES_FRAMES', '1–20 is a local v1 resource bound, not an Instagram platform limit');
  need(Array.isArray(series.beats) && series.beats.length > 0 && series.beats.length <= 60, 'SERIES_BEATS', 'declare the carried beat graph');
  const beats = new Map();
  for (const b of series.beats) {
    keys(b,['id','depends_on'],'beat');
    need(slug(b.id) && !beats.has(b.id) && Array.isArray(b.depends_on), 'SERIES_BEATS', 'unique beat ID and depends_on list required');
    need(new Set(b.depends_on).size === b.depends_on.length, 'SERIES_BEATS', 'duplicate dependency');
    beats.set(b.id,b);
  }
  for (const b of beats.values()) for (const dep of b.depends_on) need(beats.has(dep) && dep!==b.id, 'SERIES_BEATS', `unresolved/self dependency ${dep}`);
  const used = new Set(), ids = new Set(), frames=[];
  const functions = ['orient','assert','show_evidence','explain_mechanism','compare','qualify','turn','show_consequence','decision','close'];
  for (const [i,f] of series.frames.entries()) {
    keys(f,['id','function','beat_ids','takeaway','alt_text','headline','source_note','layout','blocks','caption','job_ref'],'frame');
    need(slug(f.id) && !ids.has(f.id), 'SERIES_FRAME_ID', 'unique frame slug required'); ids.add(f.id);
    need(functions.includes(f.function) && text(f.takeaway) && text(f.alt_text) && text(f.headline) && text(f.source_note), 'SERIES_MEANING', `${f.id}: function, takeaway, alt text, headline and source_note required`);
    need(Array.isArray(f.beat_ids) && f.beat_ids.length && new Set(f.beat_ids).size===f.beat_ids.length, 'SERIES_BEATS', f.id);
    for (const id of f.beat_ids) {
      need(beats.has(id), 'SERIES_BEATS', `unknown beat ${id}`);
      for (const dep of beats.get(id).depends_on) need(used.has(dep), 'SERIES_ORDER', `${id} precedes prerequisite ${dep}`);
      used.add(id);
    }
    const layoutName = f.layout ?? recipe.default_layout, layout = layouts[layoutName];
    need(layout, 'SERIES_LAYOUT', String(layoutName));
    need(Array.isArray(f.blocks) && f.blocks.length > 0 && f.blocks.length <= Object.keys(layout).length, 'SERIES_BLOCKS', `${f.id}: one block per region; split independent messages`);
    const layers=[], occupied=new Set();
    const addText = (id,value,slot,role,source_ref='request') => layers.push({id,kind:'text',text:value,source_ref,slot,...typography[role]});
    addText('series-label',series.series_label,recurring.eyebrow,'eyebrow');
    addText('headline',f.headline,recurring.headline,'headline');
    for (const b of f.blocks) {
      keys(b,['id','region','kind','ref','sha256','mode','fit','rights_note','protect','text','source_ref','instruction'],'block');
      need(slug(b.id) && !['series-label','headline','source','pagination'].includes(b.id) && !layers.some((l)=>l.id===b.id),'SERIES_LAYER_ID',String(b.id));
      need(layout[b.region] && !occupied.has(b.region),'SERIES_REGION',`unknown or duplicate region ${b.region}`); occupied.add(b.region);
      need(['text','image','chart','generated'].includes(b.kind),'SERIES_LAYER',String(b.kind));
      const {region,...layer}=b; layer.slot=layout[region];
      if (b.kind==='text') {
        keys(b,['id','region','kind','text','source_ref'],'text block');
        need(text(b.text) && text(b.source_ref),'SERIES_TEXT',b.id);
        Object.assign(layer,typography.body);
      } else if (b.kind==='chart') {
        keys(b,['id','region','kind','ref','sha256'],'chart block');
        need(text(b.ref),'SERIES_SOURCE',b.id);
      } else {
        keys(b,['id','region','kind','ref','sha256','mode','fit','rights_note','protect',...(b.kind==='generated'?['instruction']:[])],'image block');
        if (b.kind==='generated') {
          need(text(b.instruction),'SERIES_GENERATION',b.id);
          layer.instruction = `${recipe.generation_direction}\nFrame purpose: ${f.takeaway}\n${b.instruction}\nCreate only the illustration for the content slot ${JSON.stringify(layer.slot)}. The compositor clips this asset to that slot; it adds headline, source, page count and watermark separately. Do not draw exact text, data, numbers or branding. A prompt alone is not pixel reservation.`;
        } else need(text(b.ref),'SERIES_SOURCE',b.id);
      }
      layers.push(layer);
    }
    addText('source',f.source_note,recurring.source,'source',series.source.ref);
    addText('pagination',`${i+1} / ${series.frames.length}`,recurring.pagination,'pagination');
    const plan = {schema_version:'1.0.0',request:series.request,source:series.source,profiles:series.profiles,task:structuredClone(task),layers,caption:f.caption??''};
    if (f.job_ref) plan.job_ref=f.job_ref;
    frames.push({id:f.id,index:i+1,function:f.function,beat_ids:f.beat_ids,takeaway:f.takeaway,alt_text:f.alt_text,layout:layoutName,plan});
  }
  need([...beats.keys()].every((id)=>used.has(id)),'SERIES_BEAT_MISSING','a declared beat is not represented');
  return {schema_version:CAROUSEL_VERSION,series_id:series.series_id,recipe:series.recipe,recipe_hash:hash({version:catalog.schema_version,recipe,regions:recurring,layouts,typography}),preset,typography,frames,
    density_profile:'silent_carousel',narration_dependency:'none',
    review_contract:'editorial/SLIDES-AND-CAROUSELS.md#11-series-information-consistency-contract',
    review_owner:'skills/review-visual/; SUE-646/647; user Phase4 SUE-1337',
    candidate_policy:{initial_candidates:1,repair:'failed layer/frame first; new direction only for concept failure'},
    publication_authorized:false};
}

// Fontconfig metadata is a conservative cache boundary, not a glyph-quality verdict.
function fontEnvironment() {
  try {
    const r=spawnSync('fc-list',['--format','%{file}\n'],{encoding:'utf8',timeout:5000,maxBuffer:4*1024*1024});
    if (r.status!==0 || !r.stdout.trim()) return null;
    const files=[...new Set(r.stdout.trim().split('\n'))].sort();
    return hash(files.map((p)=>{const st=statSync(p);return [p,st.size,st.mtimeMs];}));
  } catch {return null;}
}

const writeJson=(p,x)=>writeFileSync(p,`${JSON.stringify(x,null,2)}\n`);
const basenameSafe=(root,path)=>{ need(typeof path==='string' && !relative(root,resolve(root,path)).startsWith('..') && !path.startsWith('/'),'SERIES_REUSE','invalid prior output locator'); return resolve(root,path); };

/** Existing executor owns typography, charts, source hashing and image bytes. */
export async function executeCarousel(series,{baseDir=process.cwd(),outDir,rasterizer='auto',previousDir=null}={}) {
  const {compileExecution,executeVisual,prepareOutput}=await import('./visual-execution-core.mjs');
  const {findRasterizer,rasterize,svgDocument}=await import('./svg-tools.mjs');
  const compiled=planCarousel(series); prepareOutput(outDir);
  const adapter=findRasterizer(rasterizer);
  const codeFiles=['carousel-core.mjs','visual-execution-core.mjs','svg-tools.mjs','chart-renderer.mjs','watermark-core.mjs'];
  const runtime={adapter:adapter?{name:adapter.name,version:adapter.version}:null,font_environment:fontEnvironment(),code:codeFiles.map((p)=>hash(readFileSync(resolve(ROOT,'scripts/lib',p))))};
  // Preflight every frame before writing any PNG. This does not prove taste.
  const packets=[];
  for (const f of compiled.frames) packets.push(await compileExecution(f.plan,{baseDir,preset:compiled.preset}));
  const prior=previousDir?JSON.parse(readFileSync(resolve(previousDir,'series.json'),'utf8')):null;
  if (prior) need(prior.series_id===compiled.series_id && Array.isArray(prior.frames),'SERIES_REUSE','different or invalid prior series');
  mkdirSync(outDir,{recursive:true});
  const result={schema_version:CAROUSEL_VERSION,series_id:compiled.series_id,recipe:compiled.recipe,recipe_hash:compiled.recipe_hash,runtime,
    status:'INCOMPLETE',frames:[],qa:{mechanical:'PREFLIGHT_PASSED',visual:'NOT_REVIEWED',source_truth:'NOT_ESTABLISHED',publication:'NOT_AUTHORIZED'},publication_authorized:false};
  const save=()=>writeJson(resolve(outDir,'series.json'),result);
  try {
    for (const [i,f] of compiled.frames.entries()) {
      const dir=resolve(outDir,f.id), fingerprint=hash({packet:packets[i].execution_hash,recipe:compiled.recipe_hash,runtime});
      const old=prior?.frames.find((p)=>p.id===f.id && p.fingerprint===fingerprint && p.status==='RENDERED_NEEDS_REVIEW');
      const entry={id:f.id,index:f.index,function:f.function,beat_ids:f.beat_ids,takeaway:f.takeaway,alt_text:f.alt_text,fingerprint,status:'NOT_RUN',reused:false,outputs:{}};
      if (adapter && runtime.font_environment && old && Object.keys(old.outputs??{}).length===5) {
        mkdirSync(dir,{recursive:true});
        for (const name of ['master.png','image.png','master.svg','execution.json','receipt.json']) {
          const o=old.outputs[name]; need(o && text(o.sha256),'SERIES_REUSE',`missing ${name}`);
          const input=basenameSafe(resolve(previousDir),o.ref); need(hash(readFileSync(input))===o.sha256,'SERIES_REUSE',`changed prior ${f.id}/${name}`);
          copyFileSync(input,resolve(dir,name));
        }
        entry.reused=true; entry.status='RENDERED_NEEDS_REVIEW';
      } else {
        const executed=await executeVisual(f.plan,{baseDir,preset:compiled.preset,outDir:dir,rasterizer});
        entry.status=executed.status;
      }
      const checked=await compileExecution(f.plan,{baseDir,preset:compiled.preset});
      need(checked.execution_hash===packets[i].execution_hash,'SERIES_SOURCE_CHANGED',`${f.id}: inputs changed during execution`);
      writeJson(resolve(outDir,`${f.id}.plan.json`),f.plan);
      if (entry.status==='RENDERED_NEEDS_REVIEW') for (const name of ['master.png','image.png','master.svg','execution.json','receipt.json']) entry.outputs[name]={ref:`${f.id}/${name}`,sha256:hash(readFileSync(resolve(dir,name)))};
      result.frames.push(entry); save();
    }
    const complete=result.frames.every((f)=>f.status==='RENDERED_NEEDS_REVIEW');
    result.status=complete?'RENDERED_NEEDS_REVIEW':'INCOMPLETE';
    if (complete && adapter) {
      const {width,height}=packets[0].canvas, phoneWidth=390, phoneHeight=Math.round(phoneWidth*height/width);
      const tiles=[];
      for (const [i,f] of result.frames.entries()) {
        const png=readFileSync(resolve(outDir,f.outputs['image.png'].ref));
        const element=`<image width="${phoneWidth}" height="${phoneHeight}" xlink:href="data:image/png;base64,${png.toString('base64')}"/>`;
        const phone=rasterize(svgDocument(phoneWidth,phoneHeight,element),adapter);
        writeFileSync(resolve(outDir,f.id,'phone.png'),phone);
        f.phone={ref:`${f.id}/phone.png`,sha256:hash(phone)};
        tiles.push(`<svg x="${(i%3)*phoneWidth}" y="${Math.floor(i/3)*phoneHeight}" width="${phoneWidth}" height="${phoneHeight}">${element}</svg>`);
      }
      const sheet=rasterize(svgDocument(Math.min(3,result.frames.length)*phoneWidth,Math.ceil(result.frames.length/3)*phoneHeight,tiles.join('')),adapter);
      writeFileSync(resolve(outDir,'contact-sheet.png'),sheet); result.contact_sheet={ref:'contact-sheet.png',sha256:hash(sheet)};
    }
    writeJson(resolve(outDir,'review-worklist.json'),{series_id:series.series_id,review_owner:compiled.review_owner,status:'NOT_REVIEWED',not_a_visual_review_record:true,
      known_failure_tags:['dashboardization','box_overload','dense_text','style_dilution','reference_drift','factual_overlay_intrusion','weak_visual_thesis'],
      contract:compiled.review_contract,contact_sheet:result.contact_sheet??null,
      dimensions:['focal_hierarchy','balance_whitespace','text_readability','visual_density','style_coherence','source_photo_chart_collision','sequence_and_role_consistency'],
      frames:result.frames.map((f)=>({id:f.id,full:f.outputs['image.png']??null,phone:f.phone??null,alt_text:f.alt_text,verdict:'NOT_REVIEWED'})),
      repair_routing:{text_or_collision:'fix the affected region/frame',fact:'correct source-bound evidence, never redraw by image AI',style:'change selected recipe dimension, not facts',concept:'bounded new direction after diagnosis'},publication_authorized:false});
    save(); return result;
  } catch(e) {result.error={code:e.code??'RENDER_FAILED',message:e.message};save();throw e;}
}
