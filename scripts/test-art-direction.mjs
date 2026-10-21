#!/usr/bin/env node
/** Synthetic ArtDirectionPlan contract/compiler/render-hook checks. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBusinessMagazine, loadBusinessMagazineProfile } from './lib/business-magazine-core.mjs';
import { artDirectionHash, validateArtDirectionPlan } from './lib/art-direction-core.mjs';
import { planCarousel, executeCarousel, loadVisualRecipes, receiptConfirmsGeneratedAsset } from './lib/carousel-core.mjs';
import { renderChartPanel } from './lib/chart-renderer.mjs';
import { encodePng, decodePng } from './lib/watermark-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profile = loadBusinessMagazineProfile(), catalog = loadVisualRecipes(), day = '2026-10-08';
const evidence = {
  schema_version: '1.0.0', as_of: day,
  sources: [
    { id: 's1', url: 'https://example.com/a', title: 'Synthetic source A', kind: 'official', published_at: null, checked_at: day },
    { id: 's2', url: 'https://example.com/b', title: 'Synthetic source B', kind: 'official', published_at: day, checked_at: day },
  ],
  claims: [
    { id: 'a', kind: 'fact', text: 'Synthetic A offers a service.', source_ids: ['s1'] },
    { id: 'b', kind: 'fact', text: 'Synthetic B offers an adjacent service.', source_ids: ['s2'] },
    { id: 'h', kind: 'assumption', text: 'A small paid experiment is proposed.', source_ids: [] },
  ],
  cases: [
    { id: 'a', name: 'Synthetic A', match: 'same_model', claim_ids: ['a'] },
    { id: 'b', name: 'Synthetic B', match: 'adjacent', claim_ids: ['b'] },
  ],
};
const packet = {
  schema_version: '1.0.0', series_id: 'art-direction-test', request: '합성 자료로 ArtDirectionPlan 경로를 검증한다.',
  series_label: '', evidence_ref: 'evidence.json',
  idea: { problem: 'unused capacity', target: 'small shops', payer: 'buyer', mechanism: 'matching', revenue: 'proposed transaction fee' },
  money: { value_flow: '상점에서 구매자에게 서비스 제공', payment_flow: '구매자가 플랫폼을 통해 상점에 결제', platform_revenue: '거래액과 구분한 수수료', main_cost: '정산 및 고객 지원' },
  frames: [
    { role: 'cover', headline: '가상 서비스의 표지', body: '서비스가 해결하는 문제를 소개합니다.', takeaway: '문제와 아이디어를 파악한다.', alt_text: '가상 표지 설명', claim_ids: ['h'] },
    { role: 'money', headline: '돈과 서비스 흐름', body: '가치와 결제 흐름을 나눠 봅니다.', takeaway: '가치·결제·수익·비용을 구분한다.', alt_text: '네 가지 합성 금전 항목을 보여주는 도식', claim_ids: ['h'] },
    { role: 'case-a', headline: '합성 사례 A', body: '합성 사례 A의 근거와 특징입니다.\n\n같은 비교 축에서 봅니다.', takeaway: '첫 사례의 근거를 확인한다.', alt_text: '합성 사례 A의 두 비교 열', claim_ids: ['a'], case_id: 'a' },
    { role: 'case-b', headline: '합성 사례 B', body: '합성 사례 B의 근거와 특징입니다.\n\n같은 비교 축에서 봅니다.', takeaway: '인접 사례와 차이를 확인한다.', alt_text: '합성 사례 B의 두 비교 열', claim_ids: ['b'], case_id: 'b', case_mode: 'compare' },
    { role: 'opportunity', headline: '작은 실험', body: '검증할 원칙입니다.\n\n실행을 가로막는 제약입니다.\n\n작게 확인할 첫 실험입니다.', takeaway: '가설을 작은 실험으로 바꾼다.', alt_text: '원칙과 제약과 첫 실험의 세 단계', claim_ids: ['h'] },
  ],
  caption: 'Synthetic fixture. Not a real company claim.',
};
const frame = (role, layout, blocks, asset, protectedClaims, visualMode, message, focal) => ({
  role, layout, blocks, reading_order: blocks.map(b => b.id), asset,
  protected: { claim_ids: protectedClaims, fields: ['headline', 'sources'] },
  visual_mode: visualMode, message, focal_subject: focal,
  avoid: ['box_overload', 'generic_icon_grid'], brand_elements: ['palette', 'headline-role'], reuse: ['editorial-minimal'],
});
const plan = {
  schema_version: '1.0.0', plan_id: 'synthetic-art-direction', profile: 'business-idea-magazine',
  brand: { locked_invariants: [...profile.visual_direction.invariants] },
  frames: [
    frame('cover', 'hero', [
      { id: 'cover-art', kind: 'generated', role: 'concept-art', region: 'art' },
      { id: 'cover-copy', kind: 'text', role: 'headline-support', region: 'copy' },
    ], { need: true, source: 'generated', rationale: 'A synthetic conceptual scene introduces the service.' }, ['h'], 'hero_image', 'A new service addresses a narrow capacity problem.', 'One abstract service exchange'),
    frame('money', 'flow', [
      { id: 'money-diagram', kind: 'diagram', role: 'flow', region: 'diagram' },
      { id: 'money-copy', kind: 'text', role: 'evidence', region: 'copy' },
    ], { need: true, source: 'deterministic_diagram', rationale: 'The four supplied money fields need exact visual labels.' }, ['h'], 'mechanism_flow', 'Separate value and payment paths from platform revenue and costs.', 'Value and payment flow'),
    frame('case-a', 'columns', [
      { id: 'case-a-left', kind: 'text', role: 'case-left', region: 'left' },
      { id: 'case-a-right', kind: 'text', role: 'case-right', region: 'right' },
    ], { need: false, source: 'none', rationale: 'Evidence and comparison copy carry this frame.' }, ['a'], 'case_contrast', 'Show the first synthetic case on the shared comparison axis.', 'Synthetic case A'),
    frame('case-b', 'columns', [
      { id: 'case-b-left', kind: 'text', role: 'case-left', region: 'left' },
      { id: 'case-b-right', kind: 'text', role: 'case-right', region: 'right' },
    ], { need: false, source: 'none', rationale: 'Evidence and comparison copy carry this frame.' }, ['b'], 'case_contrast', 'Show the adjacent synthetic case on the shared comparison axis.', 'Synthetic case B'),
    frame('opportunity', 'stack', [
      { id: 'principle', kind: 'text', role: 'principle', region: 'principle' },
      { id: 'constraint', kind: 'text', role: 'constraint', region: 'constraint' },
      { id: 'first-test', kind: 'text', role: 'first-test', region: 'first-test' },
    ], { need: false, source: 'none', rationale: 'The supplied three-part copy is the visual hierarchy.' }, ['h'], 'synthesis_stack', 'Turn the idea into one testable hypothesis.', 'Principle, constraint, first test'),
  ],
};
plan.frames[0].avoid.push('fake_screenshot', 'fake_logo');
plan.frames[1].avoid.push('invented_chart');

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const checked = (p, pck = packet, ev = evidence) => validateArtDirectionPlan(p, { evidence: ev, packet: pck, profile, catalog });
function insertTrend(p = structuredClone(plan), pck = structuredClone(packet)) {
  const trendFrame = { role: 'trend', headline: '합성 추세 자료', body: '합성 추세를 설명합니다.', takeaway: '자료의 범위 안에서 해석한다.', alt_text: '합성 추세 설명', claim_ids: ['a'] };
  pck.frames.splice(4, 0, trendFrame);
  p.frames.splice(4, 0, frame('trend', 'text', [{ id: 'trend-copy', kind: 'text', role: 'evidence', region: 'content' }], { need: false, source: 'none', rationale: 'Source-backed synthetic trend copy is sufficient.' }, ['a'], 'case_pathway', 'Show only the synthetic sourced trend.', 'A sourced synthetic trend'));
  p.trend_evidence_ref = 's1';
  return { p, pck };
}
function writeDerived(compiled, baseDir) {
  for (const [ref, value] of Object.entries(compiled.derived_assets ?? {})) {
    const target = resolve(baseDir, ref);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  }
}

await test('schema exposes versioned strict contract and valid fixture passes', () => {
  const schema = JSON.parse(readFileSync(resolve(root, 'schemas/art-direction-plan.schema.json'), 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schema_version.const, '1.0.0');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(checked(plan).errors, []);
});
await test('schema invalid version and unknown fields fail validation', () => {
  const bad = structuredClone(plan); bad.schema_version = '2.0.0'; bad.unregistered = true;
  const result = checked(bad);
  assert(result.errors.some(e => e.path === 'schema_version'));
  assert(result.errors.some(e => e.path === '$.unregistered'));
});
await test('native_card requires packet-exact strings and one whole-card asset', () => {
  const native = structuredClone(plan), f = native.frames[0], source = packet.frames[0];
  f.render_method = 'native_card';
  f.native_prompt_strings = [source.headline, source.body];
  f.blocks = [{ id: 'whole-card', kind: 'generated', role: 'native-card', region: 'art' }];
  f.reading_order = ['whole-card'];
  f.asset = { need: true, source: 'generated', rationale: 'A synthetic full-card scene for a local test.' };
  assert.deepEqual(checked(native).errors, []);
  const wrongCopy = structuredClone(native); wrongCopy.frames[0].native_prompt_strings[1] += ' altered';
  assert(checked(wrongCopy).errors.some(e => e.path === 'frames[0].native_prompt_strings'));
  const missingCopy = structuredClone(native); delete missingCopy.frames[0].native_prompt_strings;
  assert(checked(missingCopy).errors.some(e => e.path === 'frames[0].native_prompt_strings'));
  const generatedText = structuredClone(native); generatedText.frames[0].blocks[0].role = 'headline';
  assert(checked(generatedText).errors.some(e => e.message.includes('generated role must be one of')));
  const compiled = compileBusinessMagazine(packet, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: native });
  assert.equal(compiled.series.frames[0].art_direction.render_method, 'native_card');
  assert.deepEqual(compiled.series.frames[0].art_direction.native_prompt_strings, native.frames[0].native_prompt_strings);
  assert.equal(compiled.series.frames[0].blocks.length, 1);
  assert.equal(compiled.series.frames[0].blocks[0].ref, undefined);
  assert(compiled.generation_brief.includes('native whole-card body'));
  assert(compiled.generation_brief.includes(JSON.stringify(native.frames[0].native_prompt_strings)));
});
await test('locked recipe invariants cannot be overridden', () => {
  const bad = structuredClone(plan); bad.brand.locked_invariants.pop();
  assert(checked(bad).errors.some(e => e.path === 'brand.locked_invariants'));
});
await test('money frame requires a deterministic mechanism diagram', () => {
  const bad = structuredClone(plan); bad.frames[1].blocks = [{ id: 'copy', kind: 'text', role: 'flow', region: 'copy' }]; bad.frames[1].reading_order = ['copy']; bad.frames[1].asset = { need: false, source: 'none', rationale: 'Text only.' };
  assert(checked(bad).errors.some(e => e.message.includes('money mechanics require')));
});
await test('generated blocks require a requested generated asset', () => {
  const bad = structuredClone(plan); bad.frames[0].asset.need = false;
  assert(checked(bad).errors.some(e => e.path === 'frames[0].asset.need'));
});
await test('generated blocks use an allow-list on every frame role', () => {
  const forbidden = ['logo', 'brand-mark', 'screenshot', 'ui', 'headline', 'title', 'copy', 'number', 'label', 'source', 'chart', 'flow', 'diagram'];
  for (const role of forbidden) for (const frameRole of ['cover', 'money', 'opportunity']) {
    const bad = structuredClone(plan), f = bad.frames.find(item => item.role === frameRole);
    f.blocks[0] = { ...f.blocks[0], id: 'forbidden-generated', kind: 'generated', role };
    f.asset = { need: true, source: 'generated', rationale: 'Synthetic negative fixture.' };
    const issue = checked(bad).errors.find(e => e.path.endsWith('forbidden-generated'));
    assert(issue?.message.includes('generated role must be one of'), `${frameRole}/${role} was not rejected`);
  }
  const trended = insertTrend();
  trended.p.frames[4].blocks = [{ id: 'trend-ui', kind: 'generated', role: 'ui', region: 'content' }];
  trended.p.frames[4].reading_order = ['trend-ui'];
  trended.p.frames[4].asset = { need: true, source: 'generated', rationale: 'Synthetic negative fixture.' };
  assert(checked(trended.p, trended.pck).errors.some(e => e.path.endsWith('trend-ui') && e.message.includes('generated role must be one of')));
});
await test('generated prompt text rejects digits, company names and protected claim text', () => {
  for (const [field, value] of [['message', 'Illustrate 2 abstract forms.'], ['focal_subject', 'Synthetic A'], ['message', 'A small paid experiment is proposed.']]) {
    const bad = structuredClone(plan); bad.frames[0][field] = value;
    assert(checked(bad).errors.some(e => e.message.includes('generated-art prompt text')));
  }
});
await test('protected claim ids must exist and belong to the packet frame', () => {
  const bad = structuredClone(plan); bad.frames[2].protected.claim_ids = ['missing'];
  assert(checked(bad).errors.some(e => e.message.includes('unknown evidence claim')));
});
await test('authorized original requires a rights note', () => {
  const bad = structuredClone(plan), f = bad.frames[2];
  f.blocks = [{ id: 'case-image', kind: 'image', role: 'evidence-photo', region: 'left' }, { id: 'copy', kind: 'text', role: 'evidence', region: 'right' }];
  f.reading_order = ['case-image', 'copy']; f.asset = { need: true, source: 'authorized_original', rationale: 'Image ownership is being checked.' };
  assert(checked(bad).errors.some(e => e.path === 'frames[2].asset.rights_note'));
});
await test('avoid values must use the existing visual review taxonomy', () => {
  const bad = structuredClone(plan); bad.frames[0].avoid = ['not_a_review_tag'];
  assert(checked(bad).errors.some(e => e.message.includes('unknown visual review tag')));
});
await test('optional trend is blocked without its source evidence reference', () => {
  const { p } = insertTrend(); delete p.trend_evidence_ref;
  assert(checked(p).errors.some(e => e.path === 'trend_evidence_ref'));
});
await test('trend evidence resolves to a source-backed packet claim', () => {
  const { p, pck } = insertTrend();
  assert.deepEqual(checked(p, pck).errors, []);
  const compiled = compileBusinessMagazine(pck, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: p });
  assert.equal(compiled.series.frames.length, 6);
  assert.equal(compiled.series.frames[4].id, 'trend');
  assert.equal(compiled.series.frames[5].id, 'opportunity');
});
await test('three repeated layout and block-role signatures warn without failing', () => {
  const repeated = structuredClone(plan);
  for (const f of repeated.frames.slice(0, 3)) {
    f.layout = 'columns'; f.blocks = [{ id: 'panel', kind: 'diagram', role: 'mechanism', region: 'left' }, { id: 'copy', kind: 'text', role: 'copy', region: 'right' }];
    f.reading_order = ['panel', 'copy']; f.asset = { need: true, source: 'deterministic_diagram', rationale: 'Synthetic diagram panel.' };
  }
  const result = checked(repeated);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings[0].code, 'LAYOUT_REPETITION');
  assert.equal(result.warnings[0].count, 3);
});
await test('plan compiles to compatible carousel layouts for all five roles', () => {
  const compiled = compileBusinessMagazine(packet, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: plan });
  const carousel = planCarousel(compiled.series);
  assert.deepEqual(carousel.frames.map(f => f.id), ['cover', 'money', 'case-a', 'case-b', 'opportunity']);
  assert.deepEqual(carousel.frames.map(f => f.layout), ['hero', 'flow', 'columns', 'columns', 'stack']);
  assert.equal(carousel.art_direction_sha256, compiled.series.art_direction_sha256);
  assert.deepEqual(carousel.frames[1].plan.layers.find(l => l.id === 'money-diagram').kind, 'chart');
});
await test('carousel rejects generated-asset metadata detached from its block or plan hash', () => {
  const compiled = compileBusinessMagazine(packet, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: plan });
  const detached = structuredClone(compiled.series);
  detached.frames[0].art_direction.asset_block_id = 'missing-generated-block';
  assert.throws(() => planCarousel(detached), /generated asset declaration must bind/);
  const malformedHash = structuredClone(compiled.series);
  malformedHash.art_direction_sha256 = 'not-a-digest';
  assert.throws(() => planCarousel(malformedHash), /art_direction_sha256 must be a SHA-256 digest/);
});
await test('stale consumed receipt cannot pass when execution was not rendered-OK', () => {
  const stale = { outputs: { master: { sha256: 'sha256:old-run' } }, generation: [{ id: 'cover-art', asset_in_final_png: true }] };
  assert.equal(receiptConfirmsGeneratedAsset('NOT_RUN', stale, 'sha256:old-run', 'cover-art'), false);
  assert.equal(receiptConfirmsGeneratedAsset('GENERATED_COMPOSED_NEEDS_REVIEW', stale, 'sha256:current-run', 'cover-art'), false);
});
await test('additive layouts pass existing carousel region and invariant validation', () => {
  const compiled = compileBusinessMagazine(packet, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: plan });
  const carousel = planCarousel(compiled.series);
  assert.equal(carousel.frames.length, 5);
  const heroLayers = carousel.frames[0].plan.layers;
  assert.equal(heroLayers[0].slot.x, 0);
  assert.equal(heroLayers[0].slot.width, 1);
  assert(heroLayers.some(l => l.kind === 'solid' && l.id === 'hero-text-safe-band'));
  assert(heroLayers.find(l => l.id === 'source').slot.y >= 0.88);
  assert(heroLayers.find(l => l.id === 'pagination').slot.y >= 0.88);
});
await test('full-bleed text regions must be inside a declared safe band', () => {
  const compiled = compileBusinessMagazine(packet, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: plan });
  const unsafeLayout = structuredClone(catalog);
  unsafeLayout.layouts.hero.copy = { ...unsafeLayout.layouts.hero.copy, y: 0.62 };
  assert.throws(() => planCarousel(compiled.series, unsafeLayout), e => e.code === 'SERIES_TEXT_SAFE_BAND');
  const unbanded = structuredClone(catalog);
  unbanded.layout_effects.hero.solid_bands = [];
  unbanded.layouts.hero.art = { x: 0, y: 0.94, width: 1, height: 0.06 };
  assert.throws(() => planCarousel(compiled.series, unbanded), e => e.code === 'SERIES_REGION');
  unbanded.layouts.hero.art = { x: 0, y: 0, width: 1, height: 0.9 };
  assert.throws(() => planCarousel(compiled.series, unbanded), e => e.code === 'SERIES_COLLISION');
});
await test('deterministic money diagram keeps packet labels verbatim', () => {
  const compiled = compileBusinessMagazine(packet, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: plan });
  const spec = compiled.derived_assets['art-direction/money-money-flow.json'];
  const rendered = renderChartPanel(spec, { width: 900, height: 520, theme: { foreground: '#14213D', accent: '#536756' } });
  assert.deepEqual(rendered.displayed.map(n => n.text), Object.values(packet.money));
  assert.match(rendered.svg, /flow-arrow/);
  assert.match(rendered.svg, /구매자가 플랫폼을 통해/);
  assert.match(rendered.svg, /상점에 결제/);
});
await test('legacy compiler defaults to an empty series footer when no plan is supplied', () => {
  const legacyEvidence = {
    schema_version: '1.0.0', as_of: day,
    sources: [
      { id: 's1', url: 'https://example.com/a', title: 'Synthetic source A', kind: 'official', published_at: null, checked_at: day },
      { id: 's2', url: 'https://example.com/b', title: 'Synthetic source B', kind: 'official', published_at: day, checked_at: day },
    ],
    claims: [
      { id: 'a', kind: 'fact', text: 'Synthetic A offers a service.', source_ids: ['s1'] },
      { id: 'b', kind: 'fact', text: 'Synthetic B offers an adjacent service.', source_ids: ['s2'] },
      { id: 'h', kind: 'assumption', text: 'A small paid experiment is proposed.', source_ids: [] },
    ],
    cases: [
      { id: 'a', name: 'Synthetic A', match: 'same_model', claim_ids: ['a'] },
      { id: 'b', name: 'Synthetic B', match: 'adjacent', claim_ids: ['b'] },
    ],
  };
  const legacyPacket = {
    schema_version: '1.0.0', series_id: 'bizmag-test', request: '가상 자료로 5장 계획을 검증한다.', series_label: '', evidence_ref: 'evidence.json',
    idea: { problem: 'unused capacity', target: 'small shops', payer: 'buyer', mechanism: 'matching', revenue: 'proposed transaction fee' },
    money: { value_flow: 'shop to buyer', payment_flow: 'buyer to platform to shop', platform_revenue: 'fee, not gross transaction volume', main_cost: 'support and settlement' },
    frames: profile.frame_roles.map((role, i) => ({ role, headline: `가상 제목 ${i + 1}`, body: '가상 설명입니다.', takeaway: '가상 의미입니다.', alt_text: '가상 검증용 카드입니다.', claim_ids: [i === 2 ? 'a' : i === 3 ? 'b' : 'h'], ...(i === 2 ? { case_id: 'a' } : {}), ...(i === 3 ? { case_id: 'b', case_mode: 'compare' } : {}) })), caption: 'Synthetic fixture. Not a real company claim.',
  };
  const legacy = compileBusinessMagazine(legacyPacket, legacyEvidence, { sourceRef: '/stable/evidence.json', asOf: day });
  assert.equal(legacy.series.series_label, '');
  assert.equal(planCarousel(legacy.series).frames[0].plan.layers.some((layer) => layer.id === 'series-label'), false);
  const bytes = [JSON.stringify(legacy.series, null, 2) + '\n', legacy.caption, JSON.stringify(legacy.sidecar, null, 2) + '\n', legacy.generation_brief + '\n'].join('\0');
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, '99caf52b7ccf3e23d9f401e2d1537d8cf63859b9f59d2215ce0c05bf85e45f8e');
});
await test('plan hash is in series, sidecar and generation brief', () => {
  const compiled = compileBusinessMagazine(packet, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: plan });
  const digest = artDirectionHash(plan);
  assert.equal(compiled.series.art_direction_sha256, digest);
  assert.equal(compiled.sidecar.art_direction_sha256, digest);
  assert(compiled.generation_brief.includes(digest));
  assert.equal(compiled.sidecar.semantic_review, 'NOT_REVIEWED');
});
await test('plan owns generated instructions and deterministic diagrams reject packet visual overrides', () => {
  const generatedPacket = structuredClone(packet);
  generatedPacket.frames[0].visual = { kind: 'generated', instruction: 'PACKET_VISUAL_PROMPT_SENTINEL' };
  const compiled = compileBusinessMagazine(generatedPacket, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: plan });
  assert(!compiled.generation_brief.includes('PACKET_VISUAL_PROMPT_SENTINEL'));
  const diagramPacket = structuredClone(packet);
  diagramPacket.frames[1].visual = { kind: 'generated', instruction: 'UNUSED_DIAGRAM_VISUAL_SENTINEL' };
  assert.throws(() => compileBusinessMagazine(diagramPacket, evidence, { sourceRef: '/stable/evidence.json', asOf: day, artDirection: plan }), /deterministic diagram uses packet fields/);
});

const temp = resolve(tmpdir(), 'aes-art-direction-test');
rmSync(temp, { recursive: true, force: true }); mkdirSync(temp, { recursive: true });
try {
  writeFileSync(resolve(temp, 'evidence.json'), JSON.stringify(evidence));
  await test('generated requirement without consumed asset remains RENDER_REQUIRED and NOT_REVIEWED', async () => {
    const compiled = compileBusinessMagazine(packet, evidence, { sourceRef: 'evidence.json', asOf: day, baseDir: temp, artDirection: plan });
    writeDerived(compiled, temp);
    const staleOut = resolve(temp, 'render');
    mkdirSync(resolve(staleOut, 'cover'), { recursive: true });
    writeFileSync(resolve(staleOut, 'cover/receipt.json'), JSON.stringify({ status: 'RENDERED_NEEDS_REVIEW', outputs: { master: { sha256: 'sha256:stale' } }, generation: [{ id: 'cover-art', asset_in_final_png: true }] }));
    const result = await executeCarousel(compiled.series, { baseDir: temp, outDir: staleOut });
    const cover = result.frames.find(f => f.id === 'cover');
    assert.equal(result.status, 'INCOMPLETE');
    assert.equal(cover.status, 'RENDER_REQUIRED');
    assert.equal(cover.art_direction_asset_in_final_png, false);
    const worklist = JSON.parse(readFileSync(resolve(temp, 'render/review-worklist.json'), 'utf8'));
    assert.equal(worklist.status, 'NOT_REVIEWED');
    assert(worklist.avoid_tags.includes('box_overload'));
    assert(worklist.avoid_tags.includes('ui_mimicry'));
    assert(!worklist.avoid_tags.includes('fake_screenshot'));
    assert.equal(worklist.frames.find(f => f.id === 'cover').verdict, 'NOT_REVIEWED');
    assert.equal(existsSync(resolve(temp, 'render/contact-sheet.png')), false);
  });
  await test('generated hero asset is evidenced as consumed in this run final PNG', async () => {
    const generatedPlan = structuredClone(plan), generatedPacket = structuredClone(packet);
    const generated = generatedPlan.frames[0].blocks[0];
    generatedPlan.frames[0].asset.rationale = 'Synthetic gradient pixels exercise the local composition path.';
    const pixels = Buffer.alloc(160 * 160 * 4);
    for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) {
      const i = (y * 160 + x) * 4; pixels[i] = x; pixels[i + 1] = y; pixels[i + 2] = (x + y) % 256; pixels[i + 3] = 255;
    }
    const imageBytes = encodePng({ width: 160, height: 160, channels: 4, pixels });
    const assetPath = resolve(temp, 'generated-hero.png'); writeFileSync(assetPath, imageBytes);
    const responseBytes = Buffer.from('Synthetic fixture response metadata.');
    writeFileSync(resolve(temp, 'synthetic-response.json'), responseBytes);
    generatedPacket.frames[0].visual = { kind: 'generated', ref: assetPath, fit: 'contain', rights_note: 'Synthetic generated gradient fixture.', generation: {
      provider: 'synthetic-test', model: 'gradient-fixture', invocation_id: 'fixture-run', mode: 'native',
      asset_sha256: `sha256:${createHash('sha256').update(imageBytes).digest('hex')}`, response_ref: 'synthetic-response.json',
      response_sha256: `sha256:${createHash('sha256').update(responseBytes).digest('hex')}`,
    } };
    const compiled = compileBusinessMagazine(generatedPacket, evidence, { sourceRef: 'evidence.json', asOf: day, baseDir: temp, artDirection: generatedPlan });
    const result = await executeCarousel(compiled.series, { baseDir: temp, outDir: resolve(temp, 'generated-render') });
    const cover = result.frames.find(f => f.id === 'cover');
    assert.equal(cover.status, 'GENERATED_COMPOSED_NEEDS_REVIEW');
    assert.equal(cover.art_direction_asset_in_final_png, true);
    const receipt = JSON.parse(readFileSync(resolve(temp, 'generated-render/cover/receipt.json'), 'utf8'));
    assert.equal(receipt.outputs.master.sha256, `sha256:${createHash('sha256').update(readFileSync(resolve(temp, 'generated-render/cover/master.png'))).digest('hex')}`);
  });
  await test('hero bands composite over full-bleed synthetic art in the existing renderer', async () => {
    const heroPlan = structuredClone(plan), heroPacket = structuredClone(packet);
    const rights = 'Synthetic authored pixels for a local test; not a photograph.';
    heroPlan.frames[0].blocks[0].kind = 'image';
    heroPlan.frames[0].asset = { need: true, source: 'authorized_original', rationale: 'Synthetic pixels exercise the original-image route.', rights_note: rights };
    heroPacket.frames[0].visual = { kind: 'image', ref: 'hero-synthetic.png', fit: 'cover', rights_note: rights, focal_box: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, focal_min_area_ratio: 0.9 };
    const pixels = Buffer.alloc(320 * 320 * 4);
    for (let i = 0; i < 320 * 320; i++) { pixels[i * 4] = i % 256; pixels[i * 4 + 1] = Math.floor(i / 320) % 256; pixels[i * 4 + 2] = 110; pixels[i * 4 + 3] = 255; }
    writeFileSync(resolve(temp, 'hero-synthetic.png'), encodePng({ width: 320, height: 320, channels: 4, pixels }));
    const compiled = compileBusinessMagazine(heroPacket, evidence, { sourceRef: 'evidence.json', asOf: day, baseDir: temp, artDirection: heroPlan });
    writeDerived(compiled, temp);
    const result = await executeCarousel(compiled.series, { baseDir: temp, outDir: resolve(temp, 'hero-render') });
    assert.equal(result.status, 'RENDERED_NEEDS_REVIEW');
    const image = decodePng(readFileSync(resolve(temp, 'hero-render/cover/master.png')));
    const at = (x, y) => [...image.pixels.subarray((y * image.width + x) * image.channels, (y * image.width + x) * image.channels + image.channels)];
    assert.deepEqual(at(5, 100).slice(0, 3), [247, 244, 236]);
    assert.notDeepEqual(at(500, 1000).slice(0, 3), [247, 244, 236]);
    const receipt = JSON.parse(readFileSync(resolve(temp, 'hero-render/cover/receipt.json'), 'utf8'));
    assert.equal(receipt.text.find(t => t.id === 'headline').text, heroPacket.frames[0].headline);
    assert.equal(result.qa.visual, 'NOT_REVIEWED');
  });
} finally { rmSync(temp, { recursive: true, force: true }); }

console.log(`\n${passed} ArtDirectionPlan checks PASS. Synthetic fixtures only; no image generation, source verification, visual acceptance, publication, Studio pin update, or CI was performed.`);
