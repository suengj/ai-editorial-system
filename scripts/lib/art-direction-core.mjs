import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXPECTED_ROLES = ['cover', 'money', 'case-a', 'case-b', 'opportunity'];
const VISUAL_MODES = ['hero_image', 'mechanism_flow', 'case_pathway', 'case_contrast', 'synthesis_stack', 'text_focus'];
const BLOCK_KINDS = ['text', 'image', 'generated', 'chart', 'diagram'];
const GENERATED_BLOCK_ROLES = new Set(['concept-art', 'scene', 'texture', 'atmosphere', 'illustration']);
const ASSET_SOURCES = ['generated', 'authorized_original', 'deterministic_diagram', 'none'];
const PROTECTED_FIELDS = ['title', 'headline', 'body', 'numbers', 'company_names', 'sources', 'citations'];
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonblank = (v) => typeof v === 'string' && v.trim().length > 0;
const unique = (xs) => Array.isArray(xs) && new Set(xs).size === xs.length;
const exactKeys = (value, allowed, at, add) => {
  if (object(value)) for (const key of Object.keys(value)) if (!allowed.includes(key)) add(`${at}.${key}`, 'unknown field');
};
const stable = (v) => Array.isArray(v) ? v.map(stable) : object(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
export const artDirectionHash = (plan) => `sha256:${createHash('sha256').update(JSON.stringify(stable(plan))).digest('hex')}`;

function loadReviewTags() {
  const schema = JSON.parse(readFileSync(resolve(ROOT, 'schemas/visual-review.schema.json'), 'utf8'));
  return new Set(schema.properties.defect_tags.items.enum);
}

/** Structural and cross-record validation for the optional ArtDirectionPlan. */
export function validateArtDirectionPlan(plan, { evidence, packet, profile, catalog } = {}) {
  const errors = [], warnings = [];
  const add = (path, message) => errors.push({ path, message });
  if (!object(plan)) return { errors: [{ path: '$', message: 'object required' }], warnings };
  exactKeys(plan, ['schema_version', 'plan_id', 'profile', 'brand', 'trend_evidence_ref', 'frames'], '$', add);
  if (plan.schema_version !== '1.0.0') add('schema_version', 'must be 1.0.0');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(plan.plan_id ?? '')) add('plan_id', 'must be a lowercase slug');
  if (!nonblank(plan.profile)) add('profile', 'required');
  const invariants = profile?.visual_direction?.invariants;
  exactKeys(plan.brand, ['locked_invariants'], 'brand', add);
  if (!object(plan.brand) || !Array.isArray(plan.brand.locked_invariants)) add('brand.locked_invariants', 'required');
  else if (!Array.isArray(invariants) || JSON.stringify(plan.brand.locked_invariants) !== JSON.stringify(invariants)) {
    add('brand.locked_invariants', 'must exactly match the selected recipe invariants and cannot be overridden');
  }
  const frames = plan.frames;
  if (!Array.isArray(frames)) return { errors: [...errors, { path: 'frames', message: 'array required' }], warnings };
  if (frames.length < 5 || frames.length > 6) add('frames', 'five required roles and an optional trend role are supported');
  const hasTrend = frames.some(f => f?.role === 'trend');
  if (hasTrend !== (plan.trend_evidence_ref !== undefined)) add('trend_evidence_ref', 'is required only when a trend frame is present');
  const roles = hasTrend ? ['cover', 'money', 'case-a', 'case-b', 'trend', 'opportunity'] : EXPECTED_ROLES;
  if (frames.length !== roles.length || frames.some((f, i) => f?.role !== roles[i])) add('frames', `roles must be ordered: ${roles.join(', ')}`);
  const claims = new Map((evidence?.claims ?? []).filter(object).map(c => [c.id, c]));
  const sources = new Map((evidence?.sources ?? []).filter(object).map(s => [s.id, s]));
  const taxonomy = loadReviewTags();
  const expectedProfile = profile?.id?.replace(/\.v1$/, '');
  if (expectedProfile && plan.profile !== expectedProfile && plan.profile !== profile.id) add('profile', `must identify ${expectedProfile}`);

  for (const [i, frame] of frames.entries()) {
    const at = `frames[${i}]`;
    if (!object(frame)) { add(at, 'object required'); continue; }
    exactKeys(frame, ['role', 'render_method', 'native_prompt_strings', 'layout', 'message', 'visual_mode', 'focal_subject', 'reading_order', 'blocks', 'asset', 'protected', 'avoid', 'brand_elements', 'reuse'], at, add);
    if (frame.render_method !== undefined && !['compositor', 'native_card'].includes(frame.render_method)) add(`${at}.render_method`, 'must be compositor or native_card');
    const nativeCard = frame.render_method === 'native_card';
    if (nativeCard) {
      if (!Array.isArray(frame.native_prompt_strings) || frame.native_prompt_strings.length < 1 || frame.native_prompt_strings.length > 20
        || !unique(frame.native_prompt_strings) || frame.native_prompt_strings.some(value => !nonblank(value) || value.length > 2000)) {
        add(`${at}.native_prompt_strings`, 'native_card requires 1–20 unique, exact nonblank strings of at most 2000 characters');
      } else {
        const packetFrame = packet?.frames?.find(f => f?.role === frame.role);
        if (!packetFrame || !nonblank(packetFrame.headline) || !nonblank(packetFrame.body)) {
          add(`${at}.native_prompt_strings`, 'cannot bind exact strings without the matching packet headline and body');
        } else {
          let body = packetFrame.body;
          if (frame.role === 'opportunity' && nonblank(profile?.cta) && !body.includes(profile.cta)) body += `\n\n${profile.cta}`;
          const expected = [packetFrame.headline, ...body.split(/\n{2,}/)];
          if (JSON.stringify(frame.native_prompt_strings) !== JSON.stringify(expected)) {
            add(`${at}.native_prompt_strings`, 'must exactly equal the packet headline followed by its body paragraphs in order');
          }
        }
      }
    } else if (frame.native_prompt_strings !== undefined) {
      add(`${at}.native_prompt_strings`, 'is only valid when render_method is native_card');
    }
    if (!nonblank(frame.message) || frame.message.length > 240) add(`${at}.message`, 'required; maximum 240 characters');
    if (!VISUAL_MODES.includes(frame.visual_mode)) add(`${at}.visual_mode`, 'unsupported visual mode');
    if (!nonblank(frame.focal_subject) || frame.focal_subject.length > 160) add(`${at}.focal_subject`, 'required; maximum 160 characters');
    if (!nonblank(frame.layout) || !catalog?.layouts?.[frame.layout]) add(`${at}.layout`, 'must name a catalog layout');
    if (!Array.isArray(frame.blocks) || frame.blocks.length < 1) { add(`${at}.blocks`, 'at least one block required'); continue; }
    const ids = frame.blocks.map(b => b?.id);
    if (!unique(ids) || ids.some(id => !/^[a-z0-9][a-z0-9-]*$/.test(id ?? ''))) add(`${at}.blocks`, 'block ids must be unique lowercase slugs');
    const blockIds = new Set(ids);
    if (!Array.isArray(frame.reading_order) || !unique(frame.reading_order) || frame.reading_order.length !== frame.blocks.length || frame.reading_order.some(id => !blockIds.has(id))) {
      add(`${at}.reading_order`, 'must list every block id exactly once in reading order');
    }
    for (const [j, block] of frame.blocks.entries()) {
      const bp = `${at}.blocks[${j}]`;
      if (!object(block)) { add(bp, 'object required'); continue; }
      exactKeys(block, ['id', 'kind', 'role', 'region'], bp, add);
      if (['series-label', 'headline', 'source', 'pagination'].includes(block.id)) add(`${bp}.id`, 'reserved compositor id');
      if (!BLOCK_KINDS.includes(block.kind)) add(`${bp}.kind`, 'unsupported block kind');
      if (!nonblank(block.role)) add(`${bp}.role`, 'required');
      if (!nonblank(block.region) || !catalog?.layouts?.[frame.layout]?.[block.region]) add(`${bp}.region`, 'must be a region in the selected layout');
    }
    const asset = frame.asset;
    exactKeys(asset, ['need', 'source', 'rationale', 'rights_note'], `${at}.asset`, add);
    if (!object(asset) || typeof asset.need !== 'boolean' || !ASSET_SOURCES.includes(asset.source) || !nonblank(asset.rationale)) {
      add(`${at}.asset`, 'need, supported source, and rationale are required');
      continue;
    }
    if (asset.need !== (asset.source !== 'none')) add(`${at}.asset.need`, 'must be true exactly when an asset source is selected');
    if (asset.source === 'authorized_original' && !nonblank(asset.rights_note)) add(`${at}.asset.rights_note`, 'required for authorized originals');
    if (asset.source !== 'authorized_original' && asset.rights_note !== undefined) add(`${at}.asset.rights_note`, 'is only valid for an authorized original');
    const generated = frame.blocks.filter(b => b?.kind === 'generated');
    const originals = frame.blocks.filter(b => b?.kind === 'image');
    const diagrams = frame.blocks.filter(b => ['diagram', 'chart'].includes(b?.kind));
    if (generated.length && (!asset.need || asset.source !== 'generated')) add(`${at}.asset`, 'a generated block requires asset.need=true and source=generated');
    if (asset.source === 'generated' && generated.length !== 1) add(`${at}.asset`, 'source=generated requires exactly one generated block');
    if (asset.source === 'authorized_original' && originals.length !== 1) add(`${at}.asset`, 'authorized_original requires exactly one image block');
    if (asset.source === 'deterministic_diagram' && diagrams.length !== 1) add(`${at}.asset`, 'deterministic_diagram requires exactly one chart or diagram block');
    if (asset.source === 'none' && (generated.length || originals.length || diagrams.length)) add(`${at}.asset`, 'source=none cannot include image, generated, chart, or diagram blocks');
    if (new Set([...generated, ...originals, ...diagrams]).size > 1) add(`${at}.blocks`, 'one visual asset block per frame is supported');
    for (const b of generated) {
      const allowedNativeCard = nativeCard && b.role === 'native-card';
      if (!GENERATED_BLOCK_ROLES.has(b.role) && !allowedNativeCard) add(`${at}.blocks.${b.id}`, `generated role must be one of: ${[...GENERATED_BLOCK_ROLES].join(', ')}${nativeCard ? ', native-card' : ''}`);
      if (nativeCard && /(^|[-_])(text|copy|type|typography|headline|title|caption|lettering|word)([-_]|$)/i.test(b.role ?? '')) {
        add(`${at}.blocks.${b.id}`, 'native_card text belongs in native_prompt_strings, not a generated text role');
      }
    }
    if (nativeCard) {
      if (generated.length !== 1 || generated[0]?.role !== 'native-card' || frame.blocks.length !== 1) {
        add(`${at}.blocks`, 'native_card requires exactly one generated native-card block and no separate compositor layers');
      }
      if (asset.source !== 'generated' || asset.need !== true) add(`${at}.asset`, 'native_card requires a generated whole-card asset');
    }
    if (generated.length) {
      const protectedTexts = [
        ...(evidence?.cases ?? []).map(c => c?.name),
        ...(frame.protected?.claim_ids ?? []).map(id => claims.get(id)?.text),
      ].filter(nonblank);
      const promptFields = [frame.message, frame.focal_subject, asset?.rationale].filter(nonblank);
      if (promptFields.some(value => /\d/.test(value) || protectedTexts.some(secret => value.toLocaleLowerCase().includes(secret.toLocaleLowerCase())))) {
        add(`${at}.message`, 'generated-art prompt text cannot contain digits, company names, or protected claim text');
      }
    }
    if (frame.role === 'money' && !nativeCard) {
      if (!diagrams.length) add(`${at}.blocks`, 'money mechanics require a deterministic chart or diagram block');
    }
    const protectedData = frame.protected;
    exactKeys(protectedData, ['claim_ids', 'fields'], `${at}.protected`, add);
    if (!object(protectedData) || !Array.isArray(protectedData.claim_ids) || !unique(protectedData.claim_ids) || !Array.isArray(protectedData.fields) || !unique(protectedData.fields)) {
      add(`${at}.protected`, 'claim_ids and fields arrays are required and unique');
    } else {
      for (const id of protectedData.claim_ids) if (!claims.has(id)) add(`${at}.protected.claim_ids`, `unknown evidence claim ${id}`);
      const packetFrame = packet?.frames?.find(f => f.role === frame.role);
      for (const id of protectedData.claim_ids) if (packetFrame && !packetFrame.claim_ids?.includes(id)) add(`${at}.protected.claim_ids`, `${id} is not cited on the corresponding packet frame`);
      for (const field of protectedData.fields) if (!PROTECTED_FIELDS.includes(field)) add(`${at}.protected.fields`, `unsupported protected field ${field}`);
    }
    if (!Array.isArray(frame.avoid) || !unique(frame.avoid)) add(`${at}.avoid`, 'unique review taxonomy tags required');
    else for (const tag of frame.avoid) if (!taxonomy.has(tag)) add(`${at}.avoid`, `unknown visual review tag ${tag}`);
    if (!Array.isArray(frame.brand_elements) || !unique(frame.brand_elements)) add(`${at}.brand_elements`, 'unique locked brand invariant names required');
    else for (const item of frame.brand_elements) if (!invariants?.includes(item)) add(`${at}.brand_elements`, `${item} is not a selected recipe invariant`);
    if (!Array.isArray(frame.reuse) || !frame.reuse.every(nonblank) || !unique(frame.reuse)) add(`${at}.reuse`, 'unique reused component or recipe names required');
    if (frame.role === 'trend') {
      const ref = plan.trend_evidence_ref;
      if (!sources.has(ref)) add('trend_evidence_ref', 'must identify a source in evidence.sources');
      const packetFrame = packet?.frames?.find(f => f.role === 'trend');
      const boundClaims = (packetFrame?.claim_ids ?? []).map(id => claims.get(id)).filter(Boolean);
      if (!boundClaims.some(c => c.source_ids?.includes(ref))) add(`${at}.protected.claim_ids`, 'trend frame must cite a claim backed by trend_evidence_ref');
    }
  }
  const signature = (f) => JSON.stringify({ layout: f?.layout, block_roles: (f?.blocks ?? []).map(b => b?.role).sort() });
  let start = 0;
  while (start < frames.length) {
    let end = start + 1;
    while (end < frames.length && signature(frames[end]) === signature(frames[start])) end++;
    if (end - start >= 3) warnings.push({ code: 'LAYOUT_REPETITION', start_index: start, end_index: end - 1, count: end - start, signature: JSON.parse(signature(frames[start])) });
    start = end;
  }
  return { errors, warnings };
}

export function assertArtDirectionPlan(plan, context) {
  const result = validateArtDirectionPlan(plan, context);
  if (result.errors.length) {
    const error = new Error(result.errors.map(e => `${e.path}: ${e.message}`).join('; '));
    error.code = 'ART_DIRECTION_INVALID';
    error.issues = result.errors;
    throw error;
  }
  return result;
}
