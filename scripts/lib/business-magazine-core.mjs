/** SUE-1417: a bounded editorial packet -> existing carousel plan.
 * Declared evidence is checked for structure, NOT independently fact-checked.
 * No network, image-model call, publication, or new profile/renderer axis.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planCarousel } from './carousel-core.mjs';
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

export function compileBusinessMagazine(packet, evidence, { sourceRef, sourceSha, baseDir = process.cwd(), asOf = new Date().toISOString().slice(0, 10), profile = loadBusinessMagazineProfile() } = {}) {
  keys(packet, ['schema_version', 'series_id', 'request', 'series_label', 'evidence_ref', 'idea', 'money', 'frames', 'caption'], 'packet');
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
  requireThat(Array.isArray(packet.frames) && packet.frames.length === 5, 'BIZ_FIVE_FRAMES', 'exactly five frames required');
  const frameMap = [];
  const frames = packet.frames.map((f, i) => {
    keys(f, ['role', 'headline', 'body', 'takeaway', 'alt_text', 'claim_ids', 'case_id', 'case_mode', 'visual'], 'frame');
    requireThat(f.role === profile.frame_roles[i], 'BIZ_ORDER', `frame ${i + 1}`);
    for (const k of ['headline', 'body', 'takeaway', 'alt_text']) requireThat(text(f[k]), 'BIZ_COPY', `${f.role}.${k}`);
    refs(f.claim_ids, claims, `frame ${f.role}`);
    const kinds = new Set(f.claim_ids.map(id => claims.get(id).kind));
    let citedCase;
    if (i === 2 || i === 3) {
      citedCase = cases.get(f.case_id);
      requireThat(citedCase, 'BIZ_CASE', `${f.role}: case_id required`);
      requireThat(f.claim_ids.some(id => citedCase.claim_ids.includes(id) && claims.get(id).kind === 'fact'), 'BIZ_CASE', `${f.role}: carry this case's factual claim`);
      if (i === 3) {
        requireThat(['compare', 'deep-dive'].includes(f.case_mode), 'BIZ_CASE_MODE', 'case-b mode required');
        requireThat((f.case_id === packet.frames[2].case_id) === (f.case_mode === 'deep-dive'), 'BIZ_CASE_MODE', 'same company must be deep-dive; comparison needs another company');
      } else requireThat(f.case_mode === undefined, 'BIZ_CASE_MODE', 'case_mode belongs to frame 4 only');
    } else requireThat(f.case_id === undefined && f.case_mode === undefined, 'BIZ_CASE_MODE', `${f.role}: unexpected case mapping`);
    if (i === 4) requireThat(kinds.has('assumption'), 'BIZ_OPPORTUNITY', 'opportunity must include an explicitly proposed hypothesis');
    const labels = [kinds.has('assumption') ? '가정·제안' : '', kinds.has('analysis') ? '해석' : ''].filter(Boolean);
    const sourceNote = [citedCase?.name ?? (kinds.has('fact') ? '출처: 본문' : '사업 아이디어'), ...(citedCase ? [citedCase.match === 'adjacent' ? '인접 사례' : '유사 모델'] : []), ...labels].join(' · ');
    let body = f.body;
    if (i === 4 && !body.includes(profile.cta)) body += `\n\n${profile.cta}`;
    const blocks = [{ id: 'copy', region: f.visual ? 'right' : 'content', kind: 'text', text: body, source_ref: sourceRef }];
    if (f.visual) {
      keys(f.visual, ['kind', 'ref', 'sha256', 'mode', 'fit', 'rights_note', 'protect', 'instruction'], 'visual');
      requireThat(['image', 'generated', 'chart'].includes(f.visual.kind), 'BIZ_VISUAL', f.role);
      const visual = structuredClone(f.visual);
      if (visual.ref) visual.ref = resolve(baseDir, visual.ref);
      blocks.unshift({ id: 'art', region: 'left', ...visual });
    }
    frameMap.push({ role: f.role, claim_ids: [...f.claim_ids], case_id: f.case_id ?? null, case_match: citedCase?.match ?? null, case_mode: f.case_mode ?? null, visible_qualification: labels, alt_text: f.alt_text });
    return { id: f.role, function: i === 3 && f.case_mode === 'deep-dive' ? 'qualify' : profile.frame_functions[i], beat_ids: [f.role], takeaway: f.takeaway, alt_text: f.alt_text, headline: f.headline, source_note: sourceNote, layout: f.visual ? 'split' : 'text', blocks };
  });
  const series = { schema_version: '1.0.0', series_id: packet.series_id, request: packet.request, source: { ref: sourceRef, ...(sourceSha ? { sha256: sourceSha } : {}), scope: 'source_bound' }, profiles: { surface: 'instagram', artifact: 'visual/slide-image' }, recipe: profile.recipe, ...structuredClone(profile.series_options), series_label: packet.series_label, beats: profile.frame_roles.map((id, i) => ({ id, depends_on: i ? [profile.frame_roles[i - 1]] : [] })), frames };
  const compatibility = planCarousel(series);
  const caption = `${packet.caption.trim()}\n\n사실과 제안 구분: 실제 사례의 출처는 아래에 기재했습니다. 신규 사업의 수익성과 시장 공백은 검증 전 가설입니다.\n자료 기준: ${evidence.as_of}\n${[...sources.values()].map(s => `[${s.id}] ${s.title}\n${s.url}`).join('\n\n')}\n`;
  return { series, caption, sidecar: { profile: profile.id, idea: structuredClone(packet.idea), money: structuredClone(packet.money), evidence: structuredClone(evidence), frames: frameMap, source_ref: sourceRef, source_sha256: sourceSha ?? null, planning: 'PASS', renderer_plan_count: compatibility.frames.length, semantic_review: 'NOT_REVIEWED', source_truth: 'DECLARED_SUPPORT_NOT_INDEPENDENTLY_VERIFIED', visual_review: 'NOT_REVIEWED', publication_authorized: false }, generation_brief: `${profile.positioning.join(' × ')}\n${JSON.stringify(profile.visual_direction, null, 2)}\n\nBusiness mechanism:\n${JSON.stringify(packet.money, null, 2)}\n\nFive ordered frame briefs:\n${JSON.stringify(packet.frames, null, 2)}\n\nNo invented company photography, product screenshots, logos or numerical results. Source labels and qualifiers must survive every route. Native integrated generation is not proof of the local renderer running.` };
}
