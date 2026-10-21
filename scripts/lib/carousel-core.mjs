/** SUE-1345: series realization over the existing single-image executor.
 * The caller/LLM owns editorial interpretation. This module never generates,
 * verifies claims, approves, publishes, or introduces another visual axis.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolveChrome, verifyChromeText } from './chrome-tokens.mjs';
import { buildNativeCardPrompt, intakeNativeCard, nativeReviewToFeedbackRecord, containedNativePath, renderNativeChrome, validateNativeCardReview } from './hybrid-card-core.mjs';
import { resolveDefaultVisualStyle } from './visual-style-policy.mjs';
import { validateCardNewsBrief } from './card-news-brief-core.mjs';

import { bundledFontDigest, CARD_NEWS_TYPE_ROLES, CARD_NEWS_TYPE_TOKENS } from './typography-core.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CAROUSEL_VERSION = '1.0.0';
/** Series constraints as data (single source for planCarousel and the web catalog export). */
export const CAROUSEL_CONSTRAINTS = Object.freeze({
  frames: Object.freeze({ min: 1, max: 20 }),
  beats: Object.freeze({ min: 1, max: 60 }),
  series_fields: Object.freeze(['schema_version','series_id','request','source','profiles','recipe','visual_style','footer_policy','content_kind','numeric_profile','brief_file','task','typography','regions','layouts','series_label','beats','frames','art_direction_sha256']),
  frame_fields: Object.freeze(['id','function','beat_ids','takeaway','alt_text','headline','headline_emphasis','source_note','layout','blocks','caption','job_ref','art_direction']),
  art_direction_fields: Object.freeze(['plan_id','visual_mode','focal_subject','message','reading_order','asset','asset_block_id','avoid','protected','brand_elements','reuse','render_method','native_prompt_strings']),
  block_fields: Object.freeze(['id','region','kind','ref','sha256','mode','fit','rights_note','protect','focal_box','focal_min_area_ratio','focal_fallback','mockup_risk','text','text_role','source_ref','instruction','generation','provenance']),
  block_kinds: Object.freeze(['text','image','chart','generated']),
  frame_functions: Object.freeze(['orient','assert','show_evidence','explain_mechanism','compare','qualify','turn','show_consequence','decision','close']),
});
const obj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const stable = (x) => Array.isArray(x) ? x.map(stable) : obj(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable(x[k])])) : x;
const hash = (x) => `sha256:${createHash('sha256').update(Buffer.isBuffer(x) ? x : JSON.stringify(stable(x))).digest('hex')}`;
export function receiptConfirmsGeneratedAsset(status, receipt, masterSha256, blockId) {
  return ['RENDERED_NEEDS_REVIEW', 'GENERATED_COMPOSED_NEEDS_REVIEW'].includes(status)
    && receipt?.outputs?.master?.sha256 === masterSha256
    && receipt?.generation?.some(g => g.id === blockId && g.asset_in_final_png === true) === true;
}
const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const need = (condition, code, message) => { if (!condition) fail(code, message); };
const text = (s) => typeof s === 'string' && s.trim().length > 0;
const contentOnlyCopyIssue = (s) => /\[[^\]]+\]|\{\{[^}]+\}\}|\b(?:PLACEHOLDER|TODO|TBD)\b|편집자 확인 필요/i.test(s)
  || /30일 요청|실제 차트는 7일|거래가 관측된 점만 이었다|움직임은 확인, 원인은 확인 중|계약 가격은 사건의 확인이 아니다|확정하지 않(?:습니다|는다|음)|확정되지 않(?:습니다|는다|음)|단정할 수 없(?:습니다|다)|단정하지 않(?:습니다|는다|음)|투자\s*권유|정보\s*제공|disclaimer|면책|참고용|\bPMC\b|\b\d+\s*\/\s*\d+\b|as[- ]?of|updated\s*at|timestamp|타임스탬프|기준\s*시각|기준\s*일|업데이트\s*시각|선두|원관측|illustrative|연출|USD\s*bn|수치는\s*정확하지\s*않음/i.test(s);
export const isForbiddenCardNewsCopy = (value) => contentOnlyCopyIssue(String(value ?? ''));
const slug = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s);
function keys(value, allowed, where) {
  need(obj(value), 'SERIES_INPUT', `${where} must be an object`);
  for (const key of Object.keys(value)) need(allowed.includes(key), 'SERIES_UNKNOWN_FIELD', `${where}.${key}`);
}
const overlaps = (a, b) => a.x < b.x+b.width-1e-8 && a.x+a.width > b.x+1e-8 && a.y < b.y+b.height-1e-8 && a.y+a.height > b.y+1e-8;
function checkRegions(regions, { bandedBackgroundRegions = [] } = {}) {
  for (const [id, r] of Object.entries(regions)) {
    keys(r, ['x','y','width','height'], `region ${id}`);
    const maxY = bandedBackgroundRegions.includes(id) ? 1 : 0.93;
    need(['x','y','width','height'].every((k) => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 1) && r.width > 0 && r.height > 0 && r.x+r.width <= 1 && r.y+r.height <= maxY,
      'SERIES_REGION', `${id}: normalized region must fit above the reserved watermark/illustrative footer`);
  }
  const pairs = Object.entries(regions);
  for (let i=0;i<pairs.length;i++) for (let j=0;j<i;j++) {
    const [a] = pairs[i], [b] = pairs[j];
    if (bandedBackgroundRegions.includes(a) || bandedBackgroundRegions.includes(b)) continue;
    need(!overlaps(pairs[i][1],pairs[j][1]), 'SERIES_COLLISION', `${a} overlaps ${b}`);
  }
}
const mergeRoles = (base, override={}) => Object.fromEntries(Object.entries(base).map(([role, style]) => [role, {...style, ...(override[role] ?? {})}]));
export function loadVisualRecipes() { return JSON.parse(readFileSync(resolve(ROOT, 'editorial/visual-recipes.v1.json'), 'utf8')); }

/** Pure planning: emits unchanged v1 single-image plans, not rendered evidence. */
export function planCarousel(series, catalog=loadVisualRecipes(), contentBrief=null) {
  keys(series, CAROUSEL_CONSTRAINTS.series_fields, 'series');
  need(series.schema_version === CAROUSEL_VERSION && slug(series.series_id), 'SERIES_VERSION', 'v1 and a slug series_id are required');
  if (series.profiles?.artifact === 'visual/prediction-market-carousel') {
    need(series.content_kind === 'card-news' && series.numeric_profile === true, 'CARD_NEWS_PROFILE_CONTRACT', 'prediction-market carousel profile requires card-news content and its numeric contract');
    need(contentBrief, 'CARD_NEWS_BRIEF_REQUIRED', 'the selected prediction-market profile requires its sourced brief');
  }
  if (series.content_kind === 'card-news') {
    need(contentBrief, 'CARD_NEWS_BRIEF_REQUIRED', 'brief.json is required for every card-news series');
    const briefCheck = validateCardNewsBrief(series, contentBrief);
    need(briefCheck.ok, 'CARD_NEWS_BRIEF_INVALID', briefCheck.issues.map((x) => `${x.code}${x.card_id ? `:${x.card_id}` : ''}`).join(', '));
    need(series.footer_policy === 'content_only', 'CARD_NEWS_CONTENT_ONLY', 'card-news artwork is content-only: no disclaimer, timestamp, source, or pagination footer');
    if (series.numeric_profile === true) {
      need(series.frames.every((frame) => frame.blocks?.some((block) => block.kind === 'chart')), 'CARD_NEWS_DATA_VISUAL', 'every numeric card needs a chart/data visual block as its hero');
    } else need(series.numeric_profile === undefined || series.numeric_profile === false, 'CARD_NEWS_NUMERIC_PROFILE', 'numeric_profile must be boolean');
  }
  need(series.footer_policy === undefined || ['source_and_pagination','content_only'].includes(series.footer_policy), 'SERIES_FOOTER_POLICY', 'footer_policy must be source_and_pagination or content_only');
  if (series.art_direction_sha256 !== undefined) need(typeof series.art_direction_sha256 === 'string' && /^sha256:[a-f0-9]{64}$/.test(series.art_direction_sha256), 'SERIES_ART_DIRECTION', 'art_direction_sha256 must be a SHA-256 digest');
  need(text(series.request) && (series.series_label === undefined || series.series_label === '' || /^@[A-Za-z0-9._]+$/.test(series.series_label)), 'SERIES_INPUT', 'request required; optional footer series_label may only be an explicit publishing account handle');
  keys(series.source, ['ref','sha256','scope'], 'source');
  need(text(series.source.ref) && ['source_bound','illustrative'].includes(series.source.scope), 'SERIES_SOURCE', 'actual source ref and scope required');
  keys(series.profiles, ['surface','artifact','brand'], 'profiles');
  need(text(series.profiles.surface) && ['visual/slide-image','visual/prediction-market-carousel'].includes(series.profiles.artifact), 'SERIES_PROFILE', 'use a registered slide-image or prediction-market-carousel artifact and a compatible surface');
  need(Array.isArray(series.frames), 'SERIES_FRAMES', 'frames array required');
  need(series.visual_style === undefined || obj(series.visual_style), 'SERIES_STYLE', 'visual_style must be an object');
  const hasPhotoAsset = series.frames.some((frame) => Array.isArray(frame?.blocks) && frame.blocks.some((block) => block?.kind === 'image'));
  const implicitStyle = series.visual_style === undefined && (!series.recipe || series.recipe === 'editorial-minimal')
    ? { requested_style: 'AUTO', content_kind: 'unknown', photo_asset_quality: hasPhotoAsset ? 'unknown' : 'absent' }
    : null;
  const styleInput = series.visual_style ?? implicitStyle;
  if (styleInput !== null && styleInput !== undefined) {
    keys(styleInput, ['requested_style','content_kind','photo_asset_quality'], 'visual_style');
    need(['AUTO','R4','R7'].includes(styleInput.requested_style ?? 'AUTO'), 'SERIES_STYLE', 'visual_style.requested_style must be AUTO, R4, or R7');
    need(['unknown','lifestyle_practical','other'].includes(styleInput.content_kind ?? 'unknown'), 'SERIES_STYLE', 'visual_style.content_kind is invalid');
    need(['unknown','strong','weak','absent'].includes(styleInput.photo_asset_quality ?? 'unknown'), 'SERIES_STYLE', 'visual_style.photo_asset_quality is invalid');
  }
  const requestedStyle = styleInput?.requested_style ?? 'AUTO';
  const resolvedStyle = styleInput ? resolveDefaultVisualStyle(styleInput) : null;
  const preserveExplicitRecipe = series.visual_style && resolvedStyle && requestedStyle === 'AUTO' && series.recipe && series.recipe !== 'editorial-minimal';
  const style = preserveExplicitRecipe
    ? { style: series.recipe, recipe: series.recipe, reason: 'explicit_recipe_preserved' }
    : resolvedStyle;
  const resolvedRecipeId = style?.recipe ?? series.recipe;
  const applyDefaultTreatment = Boolean(style && !preserveExplicitRecipe && style.reason !== 'rollback_flag' && ['R4','R7'].includes(style.style));
  const recipe = catalog.recipes[resolvedRecipeId];
  need(recipe, 'SERIES_RECIPE', `unknown recipe: ${resolvedRecipeId}`);
  const task = series.task ?? {};
  keys(task, ['canvas','theme','text_policy','density','watermark','watermark_layer'], 'task');
  need(task.text_policy !== 'no_text', 'SERIES_TEXT', 'silent carousel includes headlines, sources and pagination');
  if (series.content_kind === 'card-news') need((task.canvas?.width ?? 1080) === CARD_NEWS_TYPE_TOKENS.canvas_width, 'CARD_NEWS_CANVAS', 'shared card-news typography requires a 1080px logical canvas');
  const preset = {canvas:{width:1080,aspect_ratio:'4:5'},theme:{...recipe.theme},text_policy:'hybrid_template',density:{semantic:'moderate',visual:'low'},watermark:{enabled:false}};
  keys(series.typography ?? {}, Object.keys(catalog.typography), 'typography');
  let typography = mergeRoles(mergeRoles(catalog.typography,recipe.typography),series.typography);
  for (const [role,style] of Object.entries(typography)) {
    keys(style,['font_size','weight','max_lines','line_height','align','font_family'],`typography.${role}`);
    need(Number.isInteger(style.font_size) && style.font_size >= 14 && style.font_size <= 256 && [400,500,600,700,800].includes(style.weight) && Number.isInteger(style.max_lines) && style.max_lines >= 1 && style.max_lines <= 20 && style.line_height >= 1.05 && style.line_height <= 2 && (style.align === undefined || ['start','middle','end'].includes(style.align)) && (style.font_family === undefined || text(style.font_family)), 'SERIES_TYPE', role);
  }
  if (series.content_kind === 'card-news') typography = Object.fromEntries(Object.entries(typography).filter(([role]) => CARD_NEWS_TYPE_ROLES[role]).map(([role, style]) => [role, { ...style, ...CARD_NEWS_TYPE_ROLES[role] }]));
  keys(series.regions ?? {},Object.keys(catalog.regions),'regions');
  need(obj(series.layouts ?? {}) && Object.keys(series.layouts ?? {}).every(slug), 'SERIES_LAYOUT', 'custom layout ids must be slugs');
  const recurring = {...catalog.regions, ...(series.regions ?? {})};
  const layouts = {...catalog.layouts,...(series.layouts ?? {})};
  for (const [name,layout] of Object.entries(layouts)) {
    const baseLayout = catalog.layouts[name] ?? {};
    keys(layout,Object.keys(baseLayout).length ? Object.keys(baseLayout) : Object.keys(layout),`layouts.${name}`);
    need(Object.keys(baseLayout).every((k)=>layout[k]), 'SERIES_REGION', `missing region in ${name}`);
    const effect = catalog.layout_effects?.[name] ?? {};
    const backgroundRegions = effect.background_regions ?? [];
    need(Array.isArray(backgroundRegions) && backgroundRegions.every((id) => Object.hasOwn(layout, id)), 'SERIES_LAYOUT_EFFECT', `${name}: invalid background region`);
    const solidBands = effect.solid_bands ?? [];
    if (backgroundRegions.length) need(solidBands.length > 0, 'SERIES_TEXT_SAFE_BAND', `${name}: a background behind text requires an explicit solid/scrim safe band`);
    const bandedBackgroundRegions = effect.background_regions ?? [];
    const rec = {...recurring, ...(effect.recurring_regions ?? {})};
    const regionsToCheck = (series.footer_policy ?? 'source_and_pagination') === 'content_only'
      ? Object.fromEntries(Object.entries(rec).filter(([id]) => !['source','pagination'].includes(id)))
      : rec;
    checkRegions({...regionsToCheck,...layout},{bandedBackgroundRegions});
    for (const band of solidBands) {
      need(obj(band) && /^[a-z0-9][a-z0-9-]*$/.test(band.id ?? '') && ['x','y','width','height'].every(k => Number.isFinite(band[k]) && band[k] >= 0 && band[k] <= 1) && band.width > 0 && band.height > 0 && band.x + band.width <= 1 && band.y + band.height <= 1 && (band.fill === 'theme.background' || /^#[0-9a-f]{6}$/i.test(band.fill ?? '')) && (band.gradient === undefined || (Array.isArray(band.gradient) && band.gradient.length >= 2 && band.gradient.every(st => Array.isArray(st) && st.length === 2 && st.every(n => Number.isFinite(n) && n >= 0 && n <= 1)))), 'SERIES_LAYOUT_EFFECT', `${name}: invalid solid band`);
    }
    if (backgroundRegions.length && solidBands.length) {
      const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
      const textRegions = [rec.eyebrow, rec.headline, rec.source, rec.pagination];
      need(solidBands.length > 0 && textRegions.every(region => solidBands.some(band => contains(band, region))), 'SERIES_TEXT_SAFE_BAND', `${name}: recurring text regions must fit inside a declared solid/scrim text-safe band`);
    }
  }
  need(Array.isArray(series.frames) && series.frames.length >= CAROUSEL_CONSTRAINTS.frames.min && series.frames.length <= CAROUSEL_CONSTRAINTS.frames.max, 'SERIES_FRAMES', '1–20 is a local v1 resource bound, not an Instagram platform limit');
  need(Array.isArray(series.beats) && series.beats.length >= CAROUSEL_CONSTRAINTS.beats.min && series.beats.length <= CAROUSEL_CONSTRAINTS.beats.max, 'SERIES_BEATS', 'declare the carried beat graph');
  const beats = new Map();
  for (const b of series.beats) {
    keys(b,['id','depends_on'],'beat');
    need(slug(b.id) && !beats.has(b.id) && Array.isArray(b.depends_on), 'SERIES_BEATS', 'unique beat ID and depends_on list required');
    need(new Set(b.depends_on).size === b.depends_on.length, 'SERIES_BEATS', 'duplicate dependency');
    beats.set(b.id,b);
  }
  for (const b of beats.values()) for (const dep of b.depends_on) need(beats.has(dep) && dep!==b.id, 'SERIES_BEATS', `unresolved/self dependency ${dep}`);
  const used = new Set(), ids = new Set(), frames=[];
  const functions = CAROUSEL_CONSTRAINTS.frame_functions;
  for (const [i,f] of series.frames.entries()) {
    keys(f,CAROUSEL_CONSTRAINTS.frame_fields,'frame');
    need(slug(f.id) && !ids.has(f.id), 'SERIES_FRAME_ID', 'unique frame slug required'); ids.add(f.id);
    need(functions.includes(f.function) && text(f.takeaway) && text(f.alt_text) && text(f.headline) && text(f.source_note), 'SERIES_MEANING', `${f.id}: function, takeaway, alt text, headline and source_note required`);
    if (series.footer_policy === 'content_only') {
      const visibleCopy = [f.headline, ...(f.blocks ?? []).filter((b) => b?.kind === 'text').map((b) => b.text)].filter((s) => typeof s === 'string').join('\n');
      need(!contentOnlyCopyIssue(visibleCopy), 'SERIES_COPY', `${f.id}: visible copy contains a placeholder or process/meta phrase`);
    }
    need(Array.isArray(f.beat_ids) && f.beat_ids.length && new Set(f.beat_ids).size===f.beat_ids.length, 'SERIES_BEATS', f.id);
    for (const id of f.beat_ids) {
      need(beats.has(id), 'SERIES_BEATS', `unknown beat ${id}`);
      for (const dep of beats.get(id).depends_on) need(used.has(dep), 'SERIES_ORDER', `${id} precedes prerequisite ${dep}`);
      used.add(id);
    }
    let frameBlocks = f.blocks;
    let layoutName = f.layout ?? recipe.default_layout;
    if (applyDefaultTreatment && (!f.layout || layouts[f.layout]) && (!f.layout || frameBlocks.every((b) => layouts[f.layout]?.[b.region])) && !f.art_direction && !frameBlocks.some((b) => b.kind === 'chart')) {
      const images = frameBlocks.filter((b) => b.kind === 'image');
      const texts = frameBlocks.filter((b) => b.kind === 'text');
      if (style.style === 'R4' && images.length === 1 && texts.length <= 1 && frameBlocks.length === images.length + texts.length) {
        layoutName = 'hero';
        frameBlocks = frameBlocks.map((b) => ({ ...b, region: b.kind === 'image' ? 'art' : 'copy' }));
      } else if (style.style === 'R7' && images.length === 0 && texts.length <= 1 && frameBlocks.length === texts.length) {
        layoutName = 'r7-illustration';
        frameBlocks = [
          { id: 'vq-r7-artwork', region: 'art', kind: 'generated', instruction: 'Create one clear, nonverbal illustration that supports this card’s stated takeaway.' },
          ...frameBlocks.map((b) => ({ ...b, region: 'copy' })),
        ];
      } else if (style.style === 'R7' && images.length === 1 && texts.length <= 1 && frameBlocks.length === images.length + texts.length) {
        layoutName = 'r7-illustration';
        frameBlocks = [
          { id: 'vq-r7-artwork', region: 'art', kind: 'generated', instruction: 'Replace the unsuitable source photo with one clear, nonverbal illustration that supports this card’s stated takeaway.' },
          ...texts.map((b) => ({ ...b, region: 'copy' })),
        ];
      }
    }
    const layout = layouts[layoutName];
    need(layout, 'SERIES_LAYOUT', String(layoutName));
    need(Array.isArray(frameBlocks) && frameBlocks.length > 0 && frameBlocks.length <= Object.keys(layout).length, 'SERIES_BLOCKS', `${f.id}: one block per region; split independent messages`);
    const textSafeEffect = catalog.layout_effects?.[layoutName] ?? {};
    if ((textSafeEffect.background_regions ?? []).length && frameBlocks.some((block) => block?.kind === 'text')) {
      const bands = textSafeEffect.solid_bands ?? [];
      need(bands.length > 0, 'SERIES_TEXT_SAFE_BAND', `${layoutName}: text over a background requires a declared solid/scrim safe band`);
      const contains = (outer, inner) => inner && inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
      for (const b of frameBlocks) if (b?.kind === 'text') need(bands.some(band => contains(band, layout[b.region])), 'SERIES_TEXT_SAFE_BAND', `${layoutName}.${b.region}: text region must fit inside a declared solid/scrim text-safe band`);
    }
    if (f.art_direction !== undefined) {
      keys(f.art_direction,CAROUSEL_CONSTRAINTS.art_direction_fields,'frame.art_direction');
      need(text(f.art_direction.plan_id) && text(f.art_direction.focal_subject) && text(f.art_direction.message) && Array.isArray(f.art_direction.reading_order) && Array.isArray(f.art_direction.avoid) && obj(f.art_direction.asset), 'SERIES_ART_DIRECTION', f.id);
      need(/^sha256:[a-f0-9]{64}$/.test(series.art_direction_sha256 ?? ''), 'SERIES_ART_DIRECTION', `${f.id}: plan hash required`);
      need(typeof f.art_direction.asset.need === 'boolean' && ['generated','authorized_original','deterministic_diagram','none'].includes(f.art_direction.asset.source), 'SERIES_ART_DIRECTION', `${f.id}: invalid asset declaration`);
      const nativeCard = f.art_direction.render_method === 'native_card';
      if (f.art_direction.render_method !== undefined) need(['compositor','native_card'].includes(f.art_direction.render_method), 'SERIES_ART_DIRECTION', `${f.id}: invalid render_method`);
      if (nativeCard) {
        need(Array.isArray(f.art_direction.native_prompt_strings) && f.art_direction.native_prompt_strings.length > 0 && f.art_direction.native_prompt_strings.every(text), 'SERIES_ART_DIRECTION', `${f.id}: native_prompt_strings required`);
        const nativeBlocks = frameBlocks.filter((block) => block.kind === 'generated' && block.id === f.art_direction.asset_block_id);
        need(nativeBlocks.length === 1 && f.blocks.length === 1 && f.art_direction.asset.source === 'generated' && f.art_direction.asset.need, 'SERIES_ART_DIRECTION', `${f.id}: native_card requires one generated whole-card block`);
        const canvas = task.canvas ?? {};
        let width = canvas.width ?? 1080, height = canvas.height ?? 1350;
        if (canvas.aspect_ratio !== undefined) {
          need(canvas.aspect_ratio === '4:5', 'NATIVE_CARD_CANVAS', 'native_card output is fixed at 4:5');
          if (canvas.height !== undefined && canvas.width === undefined) width = Math.round(canvas.height * 4 / 5);
          else height = Math.round(width * 5 / 4);
        }
        need(width === 1080 && height === 1350, 'NATIVE_CARD_CANVAS', 'native_card output is fixed at 1080x1350');
      } else need(f.art_direction.native_prompt_strings === undefined, 'SERIES_ART_DIRECTION', `${f.id}: native_prompt_strings requires render_method native_card`);
    }
    const layers=[], backgroundLayers=[], occupied=new Set();
    const lfx = catalog.layout_effects?.[layoutName] ?? {};
    const rec = {...recurring, ...(lfx.recurring_regions ?? {})};
    const sty = (role) => {
      const style = {...typography[role], ...(lfx.text_style?.[role] ?? {})};
      if (series.content_kind === 'card-news') {
        const token = CARD_NEWS_TYPE_ROLES[role];
        need(token, 'CARD_NEWS_TYPE_ROLE', `no shared card-news token for ${role}`);
        return {...style, ...token, min_contrast: 4.5};
      }
      return style;
    };
    const addText = (id,value,slot,role,source_ref='request') => layers.push({id,kind:'text',text:value,source_ref,slot,...sty(role)});
    if (series.series_label) addText('series-label',series.series_label,rec.eyebrow,'eyebrow');
    const margin = series.content_kind === 'card-news' ? CARD_NEWS_TYPE_TOKENS.margin_px / CARD_NEWS_TYPE_TOKENS.canvas_width : null;
    const tokenSlot = (slot) => {
      if (margin === null) return slot;
      const right = slot.x + slot.width;
      if (slot.x < margin + 0.002 && right > 1 - margin - 0.002) return { ...slot, x: margin, width: 1 - margin * 2 };
      if (slot.x < margin + 0.002) return { ...slot, x: margin, width: right - margin };
      return slot;
    };
    addText('headline',f.headline,tokenSlot(rec.headline),'headline');
    if (f.headline_emphasis!==undefined) { need(Array.isArray(f.headline_emphasis)&&f.headline_emphasis.every((e)=>obj(e)&&text(e.match)&&f.headline.includes(e.match)),'SERIES_TEXT',`${f.id}: headline_emphasis spans must be substrings of the headline`); layers.at(-1).emphasis=structuredClone(f.headline_emphasis); }
    for (const b of frameBlocks) {
      keys(b,CAROUSEL_CONSTRAINTS.block_fields,'block');
      need(slug(b.id) && !['series-label','headline','source','pagination'].includes(b.id) && !layers.some((l)=>l.id===b.id),'SERIES_LAYER_ID',String(b.id));
      need(layout[b.region] && !occupied.has(b.region),'SERIES_REGION',`unknown or duplicate region ${b.region}`); occupied.add(b.region);
      need(CAROUSEL_CONSTRAINTS.block_kinds.includes(b.kind),'SERIES_LAYER',String(b.kind));
      const {region,text_role,...layer}=b; layer.slot=tokenSlot(layout[region]);
      if (b.kind==='text') {
        keys(b,['id','region','kind','text','text_role','source_ref'],'text block');
        need(text(b.text) && text(b.source_ref),'SERIES_TEXT',b.id);
        need(text_role === undefined || Object.hasOwn(typography, text_role), 'SERIES_TYPE', `${b.id}: unknown text_role`);
        Object.assign(layer,sty(text_role ?? 'body'));
      } else if (b.kind==='chart') {
        keys(b,['id','region','kind','ref','sha256'],'chart block');
        need(text(b.ref),'SERIES_SOURCE',b.id);
      } else {
        keys(b,['id','region','kind','ref','sha256','mode','fit','rights_note','protect','focal_box','focal_min_area_ratio','focal_fallback','mockup_risk','provenance',...(b.kind==='generated'?['instruction','generation']:b.kind==='image'?['generation']:[])],'image block');
        if (b.kind==='generated') {
          need(text(b.instruction),'SERIES_GENERATION',b.id);
          layer.instruction = f.art_direction?.render_method === 'native_card'
            ? b.instruction
            : `${recipe.generation_direction}\nFrame purpose: ${f.takeaway}\n${b.instruction}\nCreate only the illustration for the content slot ${JSON.stringify(layer.slot)}. The compositor clips this asset to that slot; it adds headline, source, page count and watermark separately. Do not draw exact text, data, numbers or branding. A prompt alone is not pixel reservation.`;
        } else need(text(b.ref),'SERIES_SOURCE',b.id);
      }
      if ((catalog.layout_effects?.[layoutName]?.background_regions ?? []).includes(b.region)) backgroundLayers.push(layer);
      else layers.push(layer);
    }
    if (f.art_direction) {
      const generatedBlocks = frameBlocks.filter((b) => b.kind === 'generated');
      if (f.art_direction.asset.source === 'generated') {
        need(f.art_direction.asset.need === true && generatedBlocks.length === 1 && f.art_direction.asset_block_id === generatedBlocks[0].id, 'SERIES_ART_DIRECTION', `${f.id}: generated asset declaration must bind to exactly one generated block`);
      } else need(generatedBlocks.length === 0, 'SERIES_ART_DIRECTION', `${f.id}: generated block conflicts with the declared asset source`);
    }
    const effect = catalog.layout_effects?.[layoutName];
    if (effect) {
      const contentLayers = layers.splice(0);
      const bands = (effect.solid_bands ?? []).map((band) => ({
        id: band.id,
        kind: 'solid',
        color: band.fill === 'theme.background' ? (task.theme?.background ?? recipe.theme.background) : band.fill,
        slot: { x: band.x, y: band.y, width: band.width, height: band.height },
        ...(band.gradient ? { gradient: band.gradient } : {}),
      }));
      layers.push(...backgroundLayers, ...bands, ...contentLayers);
    }
    if ((series.footer_policy ?? 'source_and_pagination') === 'source_and_pagination') {
      addText('source',f.source_note,rec.source,'source',series.source.ref);
      addText('pagination',`${i+1} / ${series.frames.length}`,rec.pagination,'pagination');
    }
    const plan = {schema_version:'1.0.0',request:series.request,source:series.source,profiles:series.profiles,task:lfx.theme?{...structuredClone(task),theme:{...(task.theme??{}),...lfx.theme}}:structuredClone(task),layers,caption:f.caption??''};
    if (f.job_ref) plan.job_ref=f.job_ref;
    frames.push({id:f.id,index:i+1,function:f.function,beat_ids:f.beat_ids,takeaway:f.takeaway,alt_text:f.alt_text,layout:layoutName,...(f.art_direction?{art_direction:structuredClone(f.art_direction)}:{}),plan});
  }
  need([...beats.keys()].every((id)=>used.has(id)),'SERIES_BEAT_MISSING','a declared beat is not represented');
  return {schema_version:CAROUSEL_VERSION,series_id:series.series_id,recipe:resolvedRecipeId,...(style?{visual_style:{...style,requested:styleInput}}:{}),...(series.content_kind === 'card-news' ? {card_news_type_tokens:CARD_NEWS_TYPE_TOKENS} : {}),recipe_hash:hash({version:catalog.schema_version,recipe,regions:recurring,typography,card_news_type_tokens:series.content_kind === 'card-news' ? CARD_NEWS_TYPE_TOKENS : null,layout_effects:catalog.layout_effects??{}}),...(series.art_direction_sha256?{art_direction_sha256:series.art_direction_sha256}:{}),preset,typography,frames,
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

/** Adapt the public catalog (targets[].label) to SUE-1614 chrome token resolution; failure maps to UNRESOLVED_LABEL. */
function resolveHybridChrome(targetId,catalog) {
  const accounts=obj(catalog?.accounts)?catalog.accounts:Object.fromEntries((Array.isArray(catalog?.targets)?catalog.targets:[]).filter((t)=>t&&text(t.id)).map((t)=>[t.id,{chrome:{...(obj(t.chrome)?t.chrome:{}),...(text(t.label)?{brand_label:t.label}:{})}}]));
  try {
    return resolveChrome({target:targetId,catalog:{accounts},required:['brand_label'],defaults:{page_mark_format:'{index}/{total}'}});
  } catch(e) {
    if(e.code==='UNKNOWN_TARGET') throw Object.assign(new Error(e.message),{code:'UNRESOLVED_LABEL'});
    throw e;
  }
}
const writeJson=(p,x)=>writeFileSync(p,`${JSON.stringify(x,null,2)}\n`);
const basenameSafe=(root,path)=>{ need(typeof path==='string' && !relative(root,resolve(root,path)).startsWith('..') && !path.startsWith('/'),'SERIES_REUSE','invalid prior output locator'); return resolve(root,path); };

/** Existing executor owns typography, charts, source hashing and image bytes. */
export async function executeCarousel(series,{baseDir=process.cwd(),outDir,rasterizer='auto',previousDir=null,targetId=null,targetCatalog=null,nativeSession=null,nativeSessionBaseDir=baseDir,contentBrief=null}={}) {
  const {compileExecution,executeVisual,prepareOutput,isRenderedOk,GENERATED_OK,RENDER_OK,lineageRootOf,checkRepairLineage,enforceRepairLimit,appendLedger}=await import('./visual-execution-core.mjs');
  const {findRasterizer,rasterize,svgDocument}=await import('./svg-tools.mjs');
  const compiled=planCarousel(series,undefined,contentBrief);
  const nativeFrames=compiled.frames.filter((f)=>f.art_direction?.render_method==='native_card');
  const hybridFrames=compiled.frames.filter((f)=>['native_card','compositor'].includes(f.art_direction?.render_method));
  const nativeIds=new Set(nativeFrames.map((f)=>f.id));
  const sessionFrames=nativeSession?.frames??{};
  if(nativeSession!==null) {
    need(obj(nativeSession) && nativeSession.schema_version==='1.0.0' && nativeSession.route==='native_session' && obj(sessionFrames), 'NATIVE_SESSION_INVALID', 'native session needs schema_version 1.0.0, route native_session, and a frames object');
    keys(nativeSession,['schema_version','route','frames'],'native session');
    for(const id of Object.keys(sessionFrames)) need(nativeIds.has(id), 'NATIVE_SESSION_INVALID', `native session includes non-native or unknown frame ${id}`);
    for(const [id,input] of Object.entries(sessionFrames)) {
      keys(input,['png_path','source_dir','receipt','review','review_path'],`native session frame ${id}`);
      need(Boolean(text(input.png_path))!==Boolean(text(input.source_dir)), 'NATIVE_SESSION_INVALID', `${id}: provide exactly one of png_path or source_dir`);
      need(obj(input.receipt) && input.receipt.route==='native_session' && /^sha256:[a-f0-9]{64}$/.test(input.receipt.sha256??'') && text(input.receipt.generator_id), 'NATIVE_SESSION_INVALID', `${id}: receipt needs route native_session, sha256, and generator_id`);
      for(const k of ['png_path','source_dir','review_path']) if(input[k]!==undefined) containedNativePath(nativeSessionBaseDir,input[k],`${id}.${k}`);
      need(!(input.review!==undefined && input.review_path!==undefined), 'NATIVE_SESSION_INVALID', `${id}: use review or review_path, not both`);
    }
  }
  if (outDir && existsSync(outDir)) for (const f of compiled.frames) {
    const staleReceipt = resolve(outDir, f.id, 'receipt.json');
    if (existsSync(staleReceipt)) unlinkSync(staleReceipt);
    try { rmdirSync(resolve(outDir, f.id)); } catch {}
  }
  prepareOutput(outDir);
  const adapter=findRasterizer(rasterizer);
  const codeFiles=['carousel-core.mjs','visual-execution-core.mjs','svg-tools.mjs','chart-renderer.mjs','watermark-core.mjs','typography-core.mjs',...(hybridFrames.length?['hybrid-card-core.mjs']:[])];
  const runtime={adapter:adapter?{name:adapter.name,version:adapter.version}:null,font_environment:fontEnvironment(),code:codeFiles.map((p)=>hash(readFileSync(resolve(ROOT,'scripts/lib',p)))),bundled_fonts:bundledFontDigest()};
  // Preflight every frame before writing any PNG. This does not prove taste.
  const packets=[];
  for (const f of compiled.frames) packets.push(await compileExecution(f.plan,{baseDir,preset:compiled.preset}));
  const chrome=hybridFrames.length?resolveHybridChrome(targetId,targetCatalog):null;
  const pageMarkFor=(f)=>chrome.values.page_mark_format.replaceAll('{index}',String(f.index)).replaceAll('{total}',String(compiled.frames.length));
  const verifyChrome=(proof,f)=>{verifyChromeText(chrome,{[chrome.values.kicker?'kicker':'brand_label']:proof.label});need(proof.page_mark===pageMarkFor(f),'UNRESOLVED_LABEL',`${f.id}: printed page mark differs from page_mark_format`);};
  const targetLabel=chrome?(chrome.values.kicker??chrome.values.brand_label):null;
  const nativePrompts=new Map(nativeFrames.map((f)=>[f.id,buildNativeCardPrompt(f,{palette:packets[compiled.frames.indexOf(f)].theme,fontFamily:packets[compiled.frames.indexOf(f)].theme.font_family})]));
  const prior=previousDir?JSON.parse(readFileSync(resolve(previousDir,'series.json'),'utf8')):null;
  if (prior) need(prior.series_id===compiled.series_id && Array.isArray(prior.frames),'SERIES_REUSE','different or invalid prior series');
  // Enforced repair budget (SUE-1426). A workflow control, not tamper-proof (see lineage helpers in visual-execution-core).
  // A round is COUNTED only when the prior series was rendered-OK, the run changed some but not all frames, and the new
  // run completes OK. A repair that re-renders every frame is not a local fix: it is recorded as a NEW BASE.
  const lineage=lineageRootOf({kind:'carousel',series_id:compiled.series_id,request:series.request??null,source_ref:series.source?.ref??null});
  const outputNames=(f)=>f.art_direction?.render_method==='native_card'
    ? ['master.png','image.png','native-intake.json','chrome.json','native-review.json','native-feedback.json','native-prompt.txt','receipt.json']
    : f.art_direction?.render_method==='compositor'
      ? ['master.png','image.png','master.svg','execution.json','chrome.json','receipt.json']
    : ['master.png','image.png','master.svg','execution.json','receipt.json'];
  const nativeFingerprint=(f)=>{
    const input=sessionFrames[f.id];
    return input?{receipt:input.receipt,review:input.review??(input.review_path?readFileSync(resolve(nativeSessionBaseDir,input.review_path),'utf8'):null)}:null;
  };
  const fpOf=(f,i)=>hash({packet:packets[i].execution_hash,recipe:compiled.recipe_hash,runtime,...(f.art_direction?.render_method==='native_card'?{native_prompt:nativePrompts.get(f.id),native_session:nativeFingerprint(f),target_label:targetLabel}:f.art_direction?.render_method==='compositor'?{target_label:targetLabel}: {})});
  const reusableOld=(f,i)=>{const o=prior?.frames.find((p)=>p.id===f.id && p.fingerprint===fpOf(f,i) && isRenderedOk(p.status)); return adapter && runtime.font_environment && o && Object.keys(o.outputs??{}).length===outputNames(f).length ? o : null;};
  const rerender=compiled.frames.filter((f,i)=>!reusableOld(f,i)).map((f)=>f.id);
  let chk={priorOk:false,priorRound:0};
  if (prior) chk=checkRepairLineage(prior,prior.status,resolve(previousDir),lineage,{enforceLimit:false});
  const reuseObservable=Boolean(adapter&&runtime.font_environment);
  const allChanged=Boolean(prior)&&chk.priorOk&&reuseObservable&&rerender.length===compiled.frames.length;
  const wouldRepair=Boolean(prior)&&chk.priorOk&&rerender.length>0&&!allChanged;
  if (wouldRepair) enforceRepairLimit(chk.priorRound,resolve(previousDir),lineage);
  const repairRound=prior?(allChanged?0:chk.priorRound):0;
  mkdirSync(outDir,{recursive:true});
  const result={lineage_root:lineage,repair_round:repairRound,repair_counted:false,classification:prior?(allChanged?'new_base_all_frames_changed':wouldRepair?'local_repair':'no_change_or_retry'):'base',repaired_frames:prior&&!allChanged?rerender:[],schema_version:CAROUSEL_VERSION,series_id:compiled.series_id,recipe:compiled.recipe,...(compiled.visual_style?{visual_style:compiled.visual_style}:{}),recipe_hash:compiled.recipe_hash,runtime,
    status:'INCOMPLETE',frames:[],qa:{mechanical:'PREFLIGHT_PASSED',visual:'NOT_REVIEWED',source_truth:'NOT_ESTABLISHED',publication:'NOT_AUTHORIZED'},publication_authorized:false};
  if (series.art_direction_sha256) result.art_direction_sha256 = series.art_direction_sha256;
  const save=()=>writeJson(resolve(outDir,'series.json'),result);
  try {
    for (const [i,f] of compiled.frames.entries()) {
      const dir=resolve(outDir,f.id), fingerprint=fpOf(f,i);
      const old=prior?.frames.find((p)=>p.id===f.id && p.fingerprint===fingerprint && isRenderedOk(p.status));
      const entry={id:f.id,index:f.index,function:f.function,beat_ids:f.beat_ids,takeaway:f.takeaway,alt_text:f.alt_text,fingerprint,status:'NOT_RUN',reused:false,outputs:{}};
      const receiptPath = resolve(dir,'receipt.json');
      if (existsSync(receiptPath)) unlinkSync(receiptPath);
      if (adapter && runtime.font_environment && old && Object.keys(old.outputs??{}).length===outputNames(f).length) {
        mkdirSync(dir,{recursive:true});
        for (const name of outputNames(f)) {
          const o=old.outputs[name]; need(o && text(o.sha256),'SERIES_REUSE',`missing ${name}`);
          const input=basenameSafe(resolve(previousDir),o.ref); need(hash(readFileSync(input))===o.sha256,'SERIES_REUSE',`changed prior ${f.id}/${name}`);
          copyFileSync(input,resolve(dir,name));
        }
        entry.reused=true; entry.status=old.status;
      } else if(f.art_direction?.render_method==='native_card') {
        mkdirSync(dir,{recursive:true});
        writeFileSync(resolve(dir,'native-prompt.txt'),`${nativePrompts.get(f.id)}\n`);
        const supplied=sessionFrames[f.id];
        if(!supplied) {
          entry.status='RENDER_REQUIRED';
          entry.native_review_status='REQUIRED';
          entry.pending_image_ref=null;
          writeJson(resolve(dir,'receipt.json'),{schema_version:'1.0.0',status:entry.status,native_prompt_ref:`${f.id}/native-prompt.txt`,native_review_status:'REQUIRED',outputs:{},publication_authorized:false});
        } else {
          const intake=intakeNativeCard({pngPath:supplied.png_path,sourceDir:supplied.source_dir,receipt:supplied.receipt,baseDir:nativeSessionBaseDir,rasterizer:adapter});
          const sourceLayer=f.plan.layers.find((layer)=>layer.id==='source');
          const composed=renderNativeChrome(intake.bytes,{label:targetLabel,sourceLine:sourceLayer?.text,pageMark:pageMarkFor(f),tokens:packets[i].theme,rasterizer:adapter});
          need(hash(readFileSync(intake.path))===intake.receipt.source_sha256,'NATIVE_SOURCE_CHANGED',`${f.id}: native source changed during rendering`);
          const finalSha=hash(composed.bytes);
          const review=supplied.review??(supplied.review_path?JSON.parse(readFileSync(containedNativePath(nativeSessionBaseDir,supplied.review_path,'review_path'),'utf8')):null);
          const reviewCheck=review?validateNativeCardReview(review,{expectedStrings:f.art_direction.native_prompt_strings,cardSha256:finalSha,generatorId:supplied.receipt.generator_id}):null;
          const reviewStatus=!review?'REQUIRED':!reviewCheck.ok?'INVALID':review.status;
          entry.native_review_status=reviewStatus;
          verifyChrome(composed.proof,f);
          entry.native_card_sha256=finalSha;
          entry.chrome_outside_changed_pixels=composed.proof.outside_changed_pixels;
          if(review && !reviewCheck.ok) entry.native_review_issues=reviewCheck.issues;
          const accepted=reviewCheck?.ok && review.status==='PASS';
          entry.status=accepted?RENDER_OK:review&&!reviewCheck.ok?'NATIVE_REVIEW_INVALID':review&&review.status!=='PASS'?review.status:'NATIVE_REVIEW_REQUIRED';
          const pixelDir=accepted?dir:resolve(dir,review?'rejected':'pending');
          mkdirSync(pixelDir,{recursive:true});
          writeFileSync(resolve(pixelDir,'master.png'),intake.bytes);
          writeFileSync(resolve(pixelDir,'image.png'),composed.bytes);
          writeJson(resolve(dir,'native-intake.json'),intake.receipt);
          writeJson(resolve(dir,'chrome.json'),composed.proof);
          if(review && reviewCheck.ok) {
            const feedback=nativeReviewToFeedbackRecord(review,{frameId:f.id,seriesId:compiled.series_id});
            writeJson(resolve(pixelDir,'native-review.json'),review);
            writeJson(resolve(pixelDir,'native-feedback.json'),feedback);
          }
          entry.pending_image_ref=accepted?null:`${f.id}/${review?'rejected':'pending'}/image.png`;
          const outputReceipt={schema_version:'1.0.0',status:entry.status,native_prompt_ref:`${f.id}/native-prompt.txt`,native_intake:intake.receipt,chrome:composed.proof,native_review_status:reviewStatus,...(reviewCheck?.ok?{native_review:{review_id:review.review_id,status:review.status,card_sha256:review.card_sha256}}:{}),...(entry.native_review_issues?{native_review_issues:entry.native_review_issues}:{}),outputs:accepted?Object.fromEntries(outputNames(f).filter((name)=>name!=='receipt.json').map((name)=>[name,{ref:`${f.id}/${name}`,sha256:hash(readFileSync(resolve(dir,name)))}])):{image:{ref:entry.pending_image_ref,sha256:finalSha}},publication_authorized:false};
          writeJson(resolve(dir,'receipt.json'),outputReceipt);
        }
      } else {
        const executed=await executeVisual(f.plan,{baseDir,preset:compiled.preset,outDir:dir,rasterizer});
        entry.status=executed.status;
        if(f.art_direction?.render_method==='compositor' && isRenderedOk(entry.status)) {
          const sourceLayer=f.plan.layers.find((layer)=>layer.id==='source');
          const chromeOptions={label:targetLabel,sourceLine:sourceLayer?.text,pageMark:pageMarkFor(f),tokens:packets[i].theme,rasterizer:adapter};
          const masterChrome=renderNativeChrome(readFileSync(resolve(dir,'master.png')),{...chromeOptions});
          const imageChrome=renderNativeChrome(readFileSync(resolve(dir,'image.png')),{...chromeOptions});
          verifyChrome(masterChrome.proof,f); verifyChrome(imageChrome.proof,f);
          writeFileSync(resolve(dir,'master.png'),masterChrome.bytes);
          writeFileSync(resolve(dir,'image.png'),imageChrome.bytes);
          writeJson(resolve(dir,'chrome.json'),{schema_version:'1.0.0',master:masterChrome.proof,image:imageChrome.proof});
          const receipt=JSON.parse(readFileSync(resolve(dir,'receipt.json'),'utf8'));
          receipt.outputs.master.sha256=hash(masterChrome.bytes);
          receipt.outputs.image.sha256=hash(imageChrome.bytes);
          receipt.native_chrome={ref:'chrome.json',sha256:hash(readFileSync(resolve(dir,'chrome.json'))),outside_changed_pixels:masterChrome.proof.outside_changed_pixels};
          writeJson(resolve(dir,'receipt.json'),receipt);
          entry.chrome_outside_changed_pixels=masterChrome.proof.outside_changed_pixels;
        }
      }
      if (f.art_direction?.asset?.source === 'generated' && f.art_direction?.render_method !== 'native_card') {
        let consumed = false;
        if (isRenderedOk(entry.status) && existsSync(receiptPath) && existsSync(resolve(dir,'master.png'))) {
          try {
            const receipt = JSON.parse(readFileSync(receiptPath,'utf8'));
            const masterHash = hash(readFileSync(resolve(dir,'master.png')));
            consumed = receiptConfirmsGeneratedAsset(entry.status, receipt, masterHash, f.art_direction.asset_block_id);
          } catch { consumed = false; }
        }
        entry.art_direction_asset_in_final_png = consumed;
        if (!consumed) entry.status = 'RENDER_REQUIRED';
      }
      if(f.art_direction?.render_method!=='native_card') {
        const checked=await compileExecution(f.plan,{baseDir,preset:compiled.preset});
        need(checked.execution_hash===packets[i].execution_hash,'SERIES_SOURCE_CHANGED',`${f.id}: inputs changed during execution`);
      }
      writeJson(resolve(outDir,`${f.id}.plan.json`),f.plan);
      if (isRenderedOk(entry.status)) for (const name of outputNames(f)) entry.outputs[name]={ref:`${f.id}/${name}`,sha256:hash(readFileSync(resolve(dir,name)))};
      result.frames.push(entry); save();
    }
    const complete=result.frames.every((f)=>isRenderedOk(f.status));
    result.status=!complete?'INCOMPLETE':result.frames.some((f)=>f.status===GENERATED_OK)?GENERATED_OK:RENDER_OK;
    if (complete&&wouldRepair) {result.repair_round=chk.priorRound+1;result.repair_counted=true;}
    if (complete && adapter) {
      const {width,height}=packets[0].canvas, phoneWidth=390, phoneHeight=Math.round(phoneWidth*height/width);
      const tiles=[];
      for (const [i,f] of result.frames.entries()) {
        const png=readFileSync(resolve(outDir,f.outputs['image.png'].ref));
        const element=`<image width="${phoneWidth}" height="${phoneHeight}" xlink:href="data:image/png;base64,${png.toString('base64')}"/>`;
        const phone=rasterize(svgDocument(phoneWidth,phoneHeight,element),adapter);
        writeFileSync(resolve(outDir,f.id,'phone.png'),phone);
        f.phone={ref:`${f.id}/phone.png`,sha256:hash(phone)};
        // The registered PMC five-card package uses a centered 3+2 grid; generic carousels retain their 3-column grid.
        const gap=12, sheetWidth=phoneWidth*3+gap*4, contentWidth=sheetWidth-gap*2;
        const row=i<3?0:Math.floor(i/3), col=i%3, rowCount=compiled.frames.length===5&&row===1?2:3;
        const rowWidth=rowCount*phoneWidth+(rowCount-1)*gap;
        const x=gap+Math.round((contentWidth-rowWidth)/2)+col*(phoneWidth+gap), y=gap+row*(phoneHeight+gap);
        const phoneElement=`<image width="${phoneWidth}" height="${phoneHeight}" xlink:href="data:image/png;base64,${phone.toString('base64')}"/>`;
        tiles.push(`<svg x="${x}" y="${y}" width="${phoneWidth}" height="${phoneHeight}">${phoneElement}</svg>`);
      }
      const gap=12, sheetWidth=Math.min(3,result.frames.length)*phoneWidth+(Math.min(3,result.frames.length)-1)*gap+gap*2, sheetHeight=Math.ceil(result.frames.length/3)*phoneHeight+(Math.ceil(result.frames.length/3)-1)*gap+gap*2;
      const sheet=rasterize(svgDocument(sheetWidth,sheetHeight,`<rect x="0" y="0" width="${sheetWidth}" height="${sheetHeight}" fill="#E8E4DA"/>${tiles.join('')}`),adapter);
      writeFileSync(resolve(outDir,'contact-sheet.png'),sheet); result.contact_sheet={ref:'contact-sheet.png',sha256:hash(sheet)};
    }
    writeJson(resolve(outDir,'review-worklist.json'),{series_id:series.series_id,...(series.art_direction_sha256?{art_direction_sha256:series.art_direction_sha256}:{}),review_owner:compiled.review_owner,status:'NOT_REVIEWED',not_a_visual_review_record:true,
      known_failure_tags:['dashboardization','box_overload','dense_text','style_dilution','reference_drift','factual_overlay_intrusion','weak_visual_thesis'],
      avoid_tags:[...new Set(series.frames.flatMap(f=>f.art_direction?.avoid??[]).map(tag=>tag==='fake_screenshot'?'ui_mimicry':tag))].sort(),
      contract:compiled.review_contract,contact_sheet:result.contact_sheet??null,
      dimensions:['focal_hierarchy','balance_whitespace','text_readability','visual_density','style_coherence','source_photo_chart_collision','sequence_and_role_consistency'],
      frames:result.frames.map((f)=>({id:f.id,full:f.outputs['image.png']??null,phone:f.phone??null,alt_text:f.alt_text,...(series.frames.find(x=>x.id===f.id)?.art_direction?{art_direction:series.frames.find(x=>x.id===f.id).art_direction}:{}),verdict:'NOT_REVIEWED'})),
      repair_routing:{text_or_collision:'fix the affected region/frame',fact:'correct source-bound evidence, never redraw by image AI',style:'change selected recipe dimension, not facts',concept:'bounded new direction after diagnosis'},publication_authorized:false});
    save();
    if (prior) appendLedger(resolve(previousDir),{lineage_root:lineage,outcome:result.repair_counted?'repair_ok':allChanged&&complete?'new_base':'repair_not_counted',classification:result.classification,status:result.status,series_sha256:hash(readFileSync(resolve(outDir,'series.json')))});
    return result;
  } catch(e) {result.error={code:e.code??'RENDER_FAILED',message:e.message};save();throw e;}
}
