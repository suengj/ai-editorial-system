/** SUE-1417: a bounded editorial packet -> existing carousel plan.
 * Declared evidence is checked for structure, NOT independently fact-checked.
 * No network, image-model call, publication, or new profile/renderer axis.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planCarousel, loadVisualRecipes } from './carousel-core.mjs';
import { assertArtDirectionPlan, artDirectionHash } from './art-direction-core.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const requireThat = (ok, code, message) => { if (!ok) throw Object.assign(new Error(message), { code }); };
function keys(x, allowed, where) {
  requireThat(object(x), 'BIZ_INPUT', `${where}: object required`);
  for (const k of Object.keys(x)) requireThat(allowed.includes(k), 'BIZ_UNKNOWN_FIELD', `${where}.${k}`);
}
function date(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === x;
}
function index(rows, label) {
  requireThat(Array.isArray(rows), 'BIZ_INPUT', `${label}: array required`);
  const map = new Map();
  for (const row of rows) {
    requireThat(object(row) && text(row.id) && !map.has(row.id), 'BIZ_ID', `${label}: unique IDs required`);
    map.set(row.id, row);
  }
  return map;
}
function refs(list, map, label, nonempty = true) {
  requireThat(Array.isArray(list) && (!nonempty || list.length > 0) && new Set(list).size === list.length && list.every(id => map.has(id)), 'BIZ_REFERENCE', label);
}
export function loadBusinessMagazineProfile() {
  return JSON.parse(readFileSync(resolve(ROOT, 'editorial/business-idea-magazine.v1.json'), 'utf8'));
}

export function compileBusinessMagazine(packet, evidence, { sourceRef, sourceSha, baseDir = process.cwd(), asOf = new Date().toISOString().slice(0, 10), profile = loadBusinessMagazineProfile(), artDirection } = {}) {
  keys(packet, ['schema_version', 'series_id', 'request', 'series_label', 'evidence_ref', 'idea', 'money', 'frames', 'caption', 'art_direction'], 'packet');
  if (packet.art_direction && artDirection && artDirectionHash(packet.art_direction) !== artDirectionHash(artDirection)) requireThat(false, 'BIZ_ART_DIRECTION', 'packet.art_direction and opts.artDirection differ');
  artDirection ??= packet.art_direction;
  requireThat(packet.schema_version === '1.0.0' && text(sourceRef), 'BIZ_INPUT', 'v1 and a stable sourceRef required');
  requireThat(text(packet.request) && text(packet.series_label) && text(packet.caption), 'BIZ_INPUT', 'request, series_label, caption required');
  if (sourceSha !== undefined) requireThat(/^sha256:[a-f0-9]{64}$/.test(sourceSha), 'BIZ_SOURCE_HASH', 'invalid sourceSha');
  keys(packet.idea, ['problem', 'target', 'payer', 'mechanism', 'revenue'], 'idea');
  for (const k of ['problem', 'target', 'payer', 'mechanism', 'revenue']) requireThat(text(packet.idea[k]), 'BIZ_IDEA', `idea.${k}`);
  keys(packet.money, ['value_flow', 'payment_flow', 'platform_revenue', 'main_cost'], 'money');
  for (const k of ['value_flow', 'payment_flow', 'platform_revenue', 'main_cost']) requireThat(text(packet.money[k]), 'BIZ_MONEY', `money.${k}`);
  keys(evidence, ['schema_version', 'as_of', 'sources', 'claims', 'cases'], 'evidence');
  requireThat(evidence.schema_version === '1.0.0' && date(asOf) && date(evidence.as_of) && evidence.as_of <= asOf, 'BIZ_DATE', 'invalid/future evidence date');
  const sources = index(evidence.sources, 'sources'), claims = index(evidence.claims, 'claims'), cases = index(evidence.cases, 'cases');
  requireThat(sources.size > 0 && claims.size > 0 && cases.size > 0, 'BIZ_NO_CASE', 'at least one evidence-backed case required');
  const artFrames = artDirection ? assertArtDirectionPlan(artDirection, { evidence, packet, profile, catalog: loadVisualRecipes() }) : null;
  for (const s of sources.values()) {
    keys(s, ['id', 'url', 'title', 'kind', 'published_at', 'checked_at'], 'source');
    let u; try { u = new URL(s.url); } catch { /* rejected below */ }
    requireThat(u && ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password && text(s.title), 'BIZ_SOURCE', s.id);
    requireThat(['official', 'independent'].includes(s.kind), 'BIZ_SOURCE', `${s.id}: source kind`);
    requireThat(date(s.checked_at) && s.checked_at <= evidence.as_of, 'BIZ_DATE', `${s.id}: check date`);
    requireThat(s.published_at == null || (date(s.published_at) && s.published_at <= s.checked_at), 'BIZ_DATE', `${s.id}: publication date`);
  }
  for (const c of claims.values()) {
    keys(c, ['id', 'kind', 'text', 'source_ids'], 'claim');
    requireThat(['fact', 'analysis', 'assumption'].includes(c.kind) && text(c.text), 'BIZ_CLAIM', c.id);
    refs(c.source_ids, sources, `claim ${c.id}`, c.kind === 'fact');
  }
  for (const c of cases.values()) {
    keys(c, ['id', 'name', 'match', 'claim_ids'], 'case');
    requireThat(text(c.name) && ['same_model', 'adjacent'].includes(c.match), 'BIZ_CASE', c.id);
    refs(c.claim_ids, claims, `case ${c.id}`);
    requireThat(c.claim_ids.some(id => claims.get(id).kind === 'fact'), 'BIZ_CASE', `${c.id}: factual support required`);
  }
  const expectedRoles = artDirection ? artDirection.frames.map(f => f.role) : profile.frame_roles;
  requireThat(Array.isArray(packet.frames) && packet.frames.length === expectedRoles.length, artDirection ? 'BIZ_ART_DIRECTION' : 'BIZ_FIVE_FRAMES', `expected ${expectedRoles.length} ordered frames`);
  const frameMap = [], derivedAssets = {};
  const frames = packet.frames.map((f, i) => {
    keys(f, ['role', 'headline', 'body', 'takeaway', 'alt_text', 'claim_ids', 'case_id', 'case_mode', 'visual'], 'frame');
    requireThat(f.role === expectedRoles[i], 'BIZ_ORDER', `frame ${i + 1}`);
    for (const k of ['headline', 'body', 'takeaway', 'alt_text']) requireThat(text(f[k]), 'BIZ_COPY', `${f.role}.${k}`);
    refs(f.claim_ids, claims, `frame ${f.role}`);
    const kinds = new Set(f.claim_ids.map(id => claims.get(id).kind));
    let citedCase;
    if (f.role === 'case-a' || f.role === 'case-b') {
      citedCase = cases.get(f.case_id);
      requireThat(citedCase, 'BIZ_CASE', `${f.role}: case_id required`);
      requireThat(f.claim_ids.some(id => citedCase.claim_ids.includes(id) && claims.get(id).kind === 'fact'), 'BIZ_CASE', `${f.role}: carry this case\'s factual claim`);
      if (f.role === 'case-b') {
        requireThat(['compare', 'deep-dive'].includes(f.case_mode), 'BIZ_CASE_MODE', 'case-b mode required');
        const caseA = packet.frames.find(frame => frame.role === 'case-a');
        requireThat((f.case_id === caseA?.case_id) === (f.case_mode === 'deep-dive'), 'BIZ_CASE_MODE', 'same company must be deep-dive; comparison needs another company');
      } else requireThat(f.case_mode === undefined, 'BIZ_CASE_MODE', 'case_mode belongs to case-b only');
    } else requireThat(f.case_id === undefined && f.case_mode === undefined, 'BIZ_CASE_MODE', `${f.role}: unexpected case mapping`);
    if (f.role === 'opportunity') requireThat(kinds.has('assumption'), 'BIZ_OPPORTUNITY', 'opportunity must include an explicitly proposed hypothesis');
    const labels = [kinds.has('assumption') ? '가정·제안' : '', kinds.has('analysis') ? '해석' : ''].filter(Boolean);
    const sourceNote = [citedCase?.name ?? (kinds.has('fact') ? '출처: 본문' : '사업 아이디어'), ...(citedCase ? [citedCase.match === 'adjacent' ? '인접 사례' : '유사 모델'] : []), ...labels].join(' · ');
    let body = f.body;
    if (f.role === 'opportunity' && !body.includes(profile.cta)) body += `\n\n${profile.cta}`;
    let blocks, artMeta;
    if (!artDirection) {
      blocks = [{ id: 'copy', region: f.visual ? 'right' : 'content', kind: 'text', text: body, source_ref: sourceRef }];
      if (f.visual) {
        keys(f.visual, ['kind', 'ref', 'sha256', 'mode', 'fit', 'rights_note', 'protect', 'instruction'], 'visual');
        requireThat(['image', 'generated', 'chart'].includes(f.visual.kind), 'BIZ_VISUAL', f.role);
        const visual = structuredClone(f.visual);
        if (visual.ref) visual.ref = resolve(baseDir, visual.ref);
        blocks.unshift({ id: 'art', region: 'left', ...visual });
      }
    } else {
      const direction = artDirection.frames[i], plannedById = new Map(direction.blocks.map(b => [b.id, b]));
      const textBlocks = direction.blocks.filter(b => b.kind === 'text');
      requireThat(textBlocks.length > 0, 'BIZ_ART_DIRECTION', `${f.role}: at least one text block must carry the packet body`);
      if (direction.layout === 'stack') requireThat(textBlocks.length === 3 && ['principle', 'constraint', 'first-test'].every(role => textBlocks.some(b => b.role === role)), 'BIZ_ART_DIRECTION', 'stack layout requires principle, constraint and first-test text blocks');
      const paragraphs = body.split(/\n{2,}/);
      requireThat(paragraphs.length >= textBlocks.length, 'BIZ_ART_DIRECTION', `${f.role}: body needs at least ${textBlocks.length} blank-line-separated copy sections`);
      const textValues = new Map();
      textBlocks.forEach((b, j) => textValues.set(b.id, textBlocks.length === 1 ? body : paragraphs.slice(j, j + 1).join('\n\n') || paragraphs.slice(j).join('\n\n')));
      if (textBlocks.length > 1) {
        const orderedText = direction.reading_order.filter(id => plannedById.get(id)?.kind === 'text');
        const assigned = paragraphs.slice(0, orderedText.length - 1).concat(paragraphs.slice(orderedText.length - 1).join('\n\n'));
        orderedText.forEach((id, j) => textValues.set(id, assigned[j]));
      }
      const hasVisual = direction.blocks.some(b => ['image', 'generated', 'chart', 'diagram'].includes(b.kind));
      if (f.visual && !hasVisual) requireThat(false, 'BIZ_ART_DIRECTION', `${f.role}: packet visual is not selected by the art direction plan`);
      if (f.visual) keys(f.visual, ['kind', 'ref', 'sha256', 'mode', 'fit', 'rights_note', 'protect', 'instruction', 'generation', 'provenance'], 'visual');
      const diagramBlock = direction.blocks.find(b => b.kind === 'diagram');
      if (diagramBlock) {
        requireThat(f.visual === undefined, 'BIZ_ART_DIRECTION_ASSET', `${f.role}: deterministic diagram uses packet fields and cannot accept a packet visual override`);
        requireThat(f.role === 'money', 'BIZ_ART_DIRECTION_DIAGRAM', 'the built-in deterministic money diagram uses the money packet fields');
        const ref = `art-direction/${f.role}-money-flow.json`;
        derivedAssets[ref] = {
          schema_version: '1.0.0', type: 'flow',
          nodes: [
            { id: 'value', label: '가치 흐름', text: packet.money.value_flow },
            { id: 'payment', label: '결제 흐름', text: packet.money.payment_flow },
            { id: 'revenue', label: '플랫폼 수익', text: packet.money.platform_revenue },
            { id: 'cost', label: '주요 비용', text: packet.money.main_cost },
          ],
          edges: [{ from: 'value', to: 'payment' }],
        };
      }
      blocks = direction.reading_order.map(id => {
        const planned = plannedById.get(id);
        requireThat(planned && !['series-label', 'headline', 'source', 'pagination'].includes(planned.id), 'BIZ_ART_DIRECTION', `${f.role}: invalid or reserved block id ${id}`);
        if (planned.kind === 'text') return { id: planned.id, region: planned.region, kind: 'text', text: textValues.get(id), source_ref: sourceRef };
        if (planned.kind === 'diagram') return { id: planned.id, region: planned.region, kind: 'chart', ref: `art-direction/${f.role}-money-flow.json` };
        if (planned.kind === 'chart') {
          requireThat(f.visual?.kind === 'chart' && text(f.visual.ref), 'BIZ_ART_DIRECTION_ASSET', `${f.role}: chart block needs its packet chart asset`);
          return { id: planned.id, region: planned.region, kind: 'chart', ref: resolve(baseDir, f.visual.ref), ...(f.visual.sha256 ? { sha256: f.visual.sha256 } : {}) };
        }
        if (planned.kind === 'image') {
          requireThat(f.visual?.kind === 'image' && text(f.visual.ref) && f.visual.rights_note === direction.asset.rights_note, 'BIZ_ART_DIRECTION_ASSET', `${f.role}: authorized original and its rights note must match the packet asset`);
          const visual = Object.fromEntries(['ref', 'sha256', 'mode', 'fit', 'rights_note', 'protect', 'provenance', 'generation'].filter(k => f.visual[k] !== undefined).map(k => [k, structuredClone(f.visual[k])]));
          visual.ref = resolve(baseDir, visual.ref);
          return { id: planned.id, region: planned.region, kind: 'image', ...visual };
        }
        if (planned.kind === 'generated') {
          if (f.visual) requireThat(f.visual.kind === 'generated', 'BIZ_ART_DIRECTION_ASSET', `${f.role}: generated block conflicts with packet visual kind`);
          const visual = f.visual ? structuredClone(f.visual) : {};
          const instruction = [
            direction.message,
            `Focal subject: ${direction.focal_subject}.`,
            `Asset rationale: ${direction.asset.rationale}.`,
            'Illustration only. Do not draw text, numbers, logos, screenshots, product UI, metrics, or citations. The existing compositor renders exact copy and sources.',
          ].filter(Boolean).join('\n');
          const media = Object.fromEntries(['ref', 'sha256', 'mode', 'fit', 'rights_note', 'protect', 'generation', 'provenance'].filter(k => visual[k] !== undefined).map(k => [k, structuredClone(visual[k])]));
          if (media.ref) media.ref = resolve(baseDir, media.ref);
          return { id: planned.id, region: planned.region, kind: 'generated', ...media, instruction };
        }
        requireThat(false, 'BIZ_ART_DIRECTION', `${f.role}: unsupported planned block kind ${planned.kind}`);
      });
      artMeta = {
        plan_id: artDirection.plan_id,
        visual_mode: direction.visual_mode,
        focal_subject: direction.focal_subject,
        message: direction.message,
        reading_order: [...direction.reading_order],
        asset: structuredClone(direction.asset),
        ...(direction.blocks.find(b => ['image', 'generated', 'chart', 'diagram'].includes(b.kind)) ? { asset_block_id: direction.blocks.find(b => ['image', 'generated', 'chart', 'diagram'].includes(b.kind)).id } : {}),
        avoid: [...direction.avoid],
        protected: structuredClone(direction.protected),
        brand_elements: [...direction.brand_elements],
        reuse: [...direction.reuse],
      };
    }
    frameMap.push({ role: f.role, claim_ids: [...f.claim_ids], case_id: f.case_id ?? null, case_match: citedCase?.match ?? null, case_mode: f.case_mode ?? null, visible_qualification: labels, alt_text: f.alt_text, ...(artMeta ? { art_direction: artMeta } : {}) });
    const functionIndex = profile.frame_roles.indexOf(f.role);
    const frameFunction = f.role === 'case-b' && f.case_mode === 'deep-dive' ? 'qualify' : f.role === 'trend' ? 'show_evidence' : profile.frame_functions[functionIndex];
    return { id: f.role, function: frameFunction, beat_ids: [f.role], takeaway: f.takeaway, alt_text: f.alt_text, headline: f.headline, source_note: sourceNote, layout: artDirection ? artDirection.frames[i].layout : f.visual ? 'split' : 'text', blocks, ...(artMeta ? { art_direction: artMeta } : {}) };
  });
  const series = { schema_version: '1.0.0', series_id: packet.series_id, request: packet.request, source: { ref: sourceRef, ...(sourceSha ? { sha256: sourceSha } : {}), scope: 'source_bound' }, profiles: { surface: 'instagram', artifact: 'visual/slide-image' }, recipe: profile.recipe, ...structuredClone(profile.series_options), series_label: packet.series_label, beats: expectedRoles.map((id, i) => ({ id, depends_on: i ? [expectedRoles[i - 1]] : [] })), frames, ...(artDirection ? { art_direction_sha256: artDirectionHash(artDirection) } : {}) };
  const compatibility = planCarousel(series);
  const caption = `${packet.caption.trim()}\n\n사실과 제안 구분: 실제 사례의 출처는 아래에 기재했습니다. 신규 사업의 수익성과 시장 공백은 검증 전 가설입니다.\n자료 기준: ${evidence.as_of}\n${[...sources.values()].map(s => `[${s.id}] ${s.title}\n${s.url}`).join('\n\n')}\n`;
  const planHash = artDirection ? artDirectionHash(artDirection) : null;
  const frameLabel = artDirection?.frames.length === 6 ? 'Six ordered frame briefs' : 'Five ordered frame briefs';
  const briefFrames = artDirection ? packet.frames.map(({ visual, ...frame }) => frame) : packet.frames;
  const baseBrief = `${profile.positioning.join(' × ')}\n${JSON.stringify(profile.visual_direction, null, 2)}\n\nBusiness mechanism:\n${JSON.stringify(packet.money, null, 2)}\n\n${frameLabel}:\n${JSON.stringify(briefFrames, null, 2)}\n\nNo invented company photography, product screenshots, logos or numerical results. Source labels and qualifiers must survive every route. Native integrated generation is not proof of the local renderer running.`;
  const generatedBrief = artDirection ? artDirection.frames.flatMap(direction => direction.blocks.filter(b => b.kind === 'generated').map(() => `\n- ${direction.role}: ${direction.visual_mode}; focal subject: ${direction.focal_subject}. ${direction.message} Asset rationale: ${direction.asset.rationale}. Generate illustration only; never draw copy, numbers, logos, screenshots, product UI, metrics, or citations.`)).join('') : '';
  const generationBrief = artDirection ? `${baseBrief}\n\nArtDirectionPlan sha256: ${planHash}${generatedBrief ? `\nGenerated-block instructions:${generatedBrief}` : ''}` : baseBrief;
  const sidecar = { profile: profile.id, idea: structuredClone(packet.idea), money: structuredClone(packet.money), evidence: structuredClone(evidence), frames: frameMap, source_ref: sourceRef, source_sha256: sourceSha ?? null, planning: 'PASS', renderer_plan_count: compatibility.frames.length, semantic_review: 'NOT_REVIEWED', source_truth: 'DECLARED_SUPPORT_NOT_INDEPENDENTLY_VERIFIED', visual_review: 'NOT_REVIEWED', publication_authorized: false, ...(artDirection ? { art_direction_sha256: planHash, art_direction_warnings: artFrames.warnings } : {}) };
  return { series, caption, sidecar, generation_brief: generationBrief, ...(artDirection && Object.keys(derivedAssets).length ? { derived_assets: derivedAssets } : {}) };
}
