#!/usr/bin/env node
/**
 * Regression test for the artifact PoC — AES-P4.1 … P4.4
 * (SUE-452, SUE-453, SUE-454, SUE-455).
 *
 * Three properties are being proved: the artifacts regenerate byte-identically,
 * the generators refuse rather than improvise, and staleness is classified
 * correctly when the article changes.
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderChart, renderDiagram, validateChartAgainstArticle, validateChartSpec, RENDERER_VERSION } from './lib/chart-renderer.mjs';
import { BriefRefusal, digest, generateBrief } from './lib/brief-generator.mjs';
import { DeckRefusal, generateDeck } from './lib/deck-generator.mjs';
import { computeStaleness, validateArtifact } from './lib/article-contract-core.mjs';
import { classifyArtifact, isPresentable, regenerate, relocate } from './lib/lineage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POC = resolve(ROOT, 'evals/poc');
const read = (p) => readFileSync(resolve(POC, p), 'utf8');
const spec = (n) => JSON.parse(read(`specs/${n}`));

const bundle = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8'));
const plan = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/artifact-plan.example.json'), 'utf8'));
const article = bundle.article;
const briefDecision = plan.decisions.find((d) => d.kind === 'brief');
const slidesDecision = plan.decisions.find((d) => d.kind === 'slides');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const throws = (fn, Type) => {
  try { fn(); return false; } catch (e) { return Type ? e instanceof Type : true; }
};

// --- determinism ----------------------------------------------------------
console.log('regeneration is byte-identical');
{
  check('chart regenerates identically', renderChart(spec('cost-stack.chart.json')) === read('cost-stack.svg'));
  check('diagram regenerates identically', renderDiagram(spec('cost-flow.diagram.json')) === read('cost-flow.mmd'));
  check('brief regenerates identically', generateBrief(article, briefDecision) === read('brief.md'));
  check('deck regenerates identically', generateDeck(article, slidesDecision) === read('deck.md'));

  const twice = [renderChart(spec('cost-stack.chart.json')), renderChart(spec('cost-stack.chart.json'))];
  check('two renders of one spec agree', digest(twice[0]) === digest(twice[1]));
  check('the renderer declares a version for lineage', /^\d+\.\d+\.\d+$/.test(RENDERER_VERSION));
}

// --- the visual cannot invent (SUE-453) ----------------------------------
console.log('an evidence visual cannot invent');
{
  const base = spec('cost-stack.chart.json');
  const mutate = (fn) => { const s = JSON.parse(JSON.stringify(base)); fn(s); return s; };

  check('a series without a claim is rejected',
    validateChartSpec(mutate((s) => { delete s.series[0].claim; })).length > 0);
  check('a chart without a period is rejected',
    validateChartSpec(mutate((s) => { delete s.period; })).length > 0);
  check('a chart without a source note is rejected',
    validateChartSpec(mutate((s) => { delete s.source_note; })).length > 0);
  check('a chart without axis units is rejected',
    validateChartSpec(mutate((s) => { delete s.y.unit; })).length > 0);
  check('a non-numeric point is rejected',
    validateChartSpec(mutate((s) => { s.series[0].points[0] = ['q1', 100]; })).length > 0);
  check('an invalid spec throws rather than rendering something plausible',
    throws(() => renderChart(mutate((s) => { delete s.period; }))));

  check('every plotted series names a claim verified on the article',
    validateChartAgainstArticle(base, article).length === 0);
  check('depicting an unverified claim is rejected',
    validateChartAgainstArticle(mutate((s) => { s.series[0].claim = 'c3'; }), article).length > 0);
  check('depicting a nonexistent claim is rejected',
    validateChartAgainstArticle(mutate((s) => { s.series[0].claim = 'c99'; }), article).length > 0);

  check('the diagram rejects an edge to an undeclared node',
    throws(() => renderDiagram({ ...spec('cost-flow.diagram.json'), edges: [{ from: 'price', to: 'ghost' }] })));
  check('the chart carries no colour value', !/#[0-9a-f]{3,8}\b/i.test(read('cost-stack.svg')));
  check('series are distinguished without colour', /stroke-dasharray/.test(read('cost-stack.svg')));
  check('the chart is accessible to a screen reader',
    /role="img"/.test(read('cost-stack.svg')) && /<title/.test(read('cost-stack.svg')) && /<desc/.test(read('cost-stack.svg')));
  check('the source note survives into the rendered output',
    read('cost-stack.svg').includes('quarterly filings'));
}

// --- the brief cannot drift (SUE-452) ------------------------------------
console.log('a brief is a door, not a second article');
{
  const brief = read('brief.md');
  check('the brief identifies its article version',
    brief.includes(article.article_id) && brief.includes(`article_version: ${article.version.number}`));
  check('the brief records both hashes',
    brief.includes(article.version.content_hash) && brief.includes(article.version.claims_hash));
  check('the brief links to the full article', /\/content\/ai-inference-pricing/.test(brief));
  check('the brief carries the article uncertainty',
    article.frame.uncertainty.every((u) => brief.includes(u)));
  check('every asserted claim is a verified claim of the article',
    briefDecision.carries_claims.every((id) =>
      article.verification.claims.some((c) => c.claim_id === id && c.status === 'verified')));

  const withUnverified = { ...briefDecision, carries_claims: ['c3'] };
  check('carrying an unverified claim is refused',
    throws(() => generateBrief(article, withUnverified), BriefRefusal));
  const withGhost = { ...briefDecision, carries_claims: ['c99'] };
  check('carrying a nonexistent claim is refused',
    throws(() => generateBrief(article, withGhost), BriefRefusal));
  check('a brief with no claims is refused',
    throws(() => generateBrief(article, { ...briefDecision, carries_claims: [] }), BriefRefusal));
  check('a brief with no hierarchy is refused',
    throws(() => generateBrief(article, { ...briefDecision, spec: {} }), BriefRefusal));
  check('a skipped decision is refused',
    throws(() => generateBrief(article, { ...briefDecision, verdict: 'skip' }), BriefRefusal));
  check('a pre-final article is refused',
    throws(() => generateBrief({ ...article, state: 'drafted' }, briefDecision), BriefRefusal));
  check('an article without version identity is refused',
    throws(() => generateBrief({ ...article, version: undefined }, briefDecision), BriefRefusal));
  check('an article stating no uncertainty is refused',
    throws(() => generateBrief({ ...article, frame: { ...article.frame, uncertainty: [] } }, briefDecision), BriefRefusal));
}

// --- the deck (SUE-454) ---------------------------------------------------
console.log('the deck chain stays textual');
{
  const deck = read('deck.md');
  check('the deck is Marp-compatible Markdown', /^---\nmarp: true/.test(deck));
  check('the theme is a name, not a stylesheet', /theme: suengj/.test(deck) && !/#[0-9a-f]{3,6}\b/i.test(deck));
  check('the deck records its article version', deck.includes(`article_version: ${article.version.number}`));
  check('page count matches the planned target',
    (deck.match(/^## /gm) ?? []).length === slidesDecision.spec.narrative.length + 1);
  check('the deck carries the uncertainty page',
    article.frame.uncertainty.every((u) => deck.includes(u)));
  check('a narrative missing its beats is refused',
    throws(() => generateDeck(article, { ...slidesDecision, spec: { page_target: 6 } }), DeckRefusal));
  check('a narrative far from its page target is refused',
    throws(() => generateDeck(article, { ...slidesDecision, spec: { narrative: ['a'], page_target: 6 } }), DeckRefusal));
  check('a pre-final article is refused',
    throws(() => generateDeck({ ...article, state: 'reviewed' }, slidesDecision), DeckRefusal));
}

// --- lineage and staleness (SUE-455) -------------------------------------
console.log('staleness and regeneration');
{
  const v = article.version;
  const refFor = (text) => ({ content_hash: v.content_hash, claims_hash: v.claims_hash, from: digest(text) });

  check('an artifact built from the current version is fresh',
    computeStaleness(refFor(read('brief.md')), v) === 'fresh');

  const cosmetic = { ...v, content_hash: 'a'.repeat(64) };
  check('a prose-only edit makes artifacts cosmetically stale',
    computeStaleness({ content_hash: v.content_hash, claims_hash: v.claims_hash }, cosmetic) === 'cosmetic');

  const material = { ...v, content_hash: 'a'.repeat(64), claims_hash: 'b'.repeat(64) };
  check('a claim edit makes artifacts materially stale',
    computeStaleness({ content_hash: v.content_hash, claims_hash: v.claims_hash }, material) === 'material');

  // Regeneration behaviour: a changed claim changes the artifact; a changed
  // title does not change the claims and yet still changes the rendered brief,
  // which is exactly why two hashes exist.
  const changedClaim = JSON.parse(JSON.stringify(article));
  changedClaim.verification.claims[0].text = 'Published per-token prices fell by a wider margin than previously reported.';
  check('regenerating after a claim change produces different output',
    generateBrief(changedClaim, briefDecision) !== read('brief.md'));

  const changedTitle = { ...article, title: `${article.title} (개정)` };
  check('regenerating after a title change also differs',
    generateBrief(changedTitle, briefDecision) !== read('brief.md'));

  const untouched = generateBrief(article, briefDecision);
  check('regenerating after no change produces identical output', untouched === read('brief.md'));
}

// --- lineage operations (SUE-455) ----------------------------------------
console.log('lineage survives, staleness is explicit, review does not carry over');
{
  const artifact = bundle.artifacts.find((a) => a.kind === 'evidence_visual');
  const v = article.version;
  const bump = (patch) => ({ ...article, version: { ...v, number: v.number + 1, ...patch } });

  // Location changes must not touch lineage.
  const moved = relocate(artifact, { kind: 'suengj_com_asset', path: 'public/moved/elsewhere.svg' });
  check('moving an artifact leaves its lineage untouched',
    JSON.stringify(moved.article_ref) === JSON.stringify(artifact.article_ref));
  check('a moved artifact is still classified fresh',
    classifyArtifact(moved, article).level === 'fresh');

  // Classification is explicit and machine-readable.
  const fresh = classifyArtifact(artifact, article);
  check('a fresh classification is presentable and gives a reason',
    fresh.level === 'fresh' && fresh.presentable === true && fresh.reason.length > 0);
  check('the classification records the version it was checked against',
    fresh.against_version === v.number);

  const cosmeticArticle = bump({ content_hash: 'c'.repeat(64) });
  const cosmetic = classifyArtifact(artifact, cosmeticArticle);
  check('a prose-only revision is cosmetic and stays presentable',
    cosmetic.level === 'cosmetic' && cosmetic.presentable === true &&
    cosmetic.requires === 'optional-regeneration');

  const materialArticle = bump({ content_hash: 'c'.repeat(64), claims_hash: 'd'.repeat(64) });
  const material = classifyArtifact(artifact, materialArticle);
  check('a claim revision is material and not presentable',
    material.level === 'material' && material.presentable === false &&
    material.requires === 'regeneration');
  check('a stale artifact is not current merely because its file exists',
    isPresentable(artifact, materialArticle) === false);
  check('an unclassifiable artifact fails safe rather than passing',
    classifyArtifact({ article_ref: {} }, article).level === 'unknown' &&
    classifyArtifact({ article_ref: {} }, article).presentable === false);

  // The contract layer enforces the same rule from the other side.
  check('an approved artifact that went materially stale fails validation',
    validateArtifact(artifact, materialArticle).some((i) => i.code === 'staleness'));

  // Regeneration rebinds lineage and drops human judgement.
  const regenerated = regenerate(artifact, materialArticle, { generatedAt: '2026-09-02T00:00:00Z' });
  check('the regenerated artifact points at the new version',
    regenerated.article_ref.version_number === materialArticle.version.number &&
    regenerated.article_ref.claims_hash === materialArticle.version.claims_hash);
  check('the regenerated artifact is fresh again',
    classifyArtifact(regenerated, materialArticle).level === 'fresh');
  check('approval is not inherited across regeneration',
    artifact.state === 'approved' && regenerated.state === 'generated');
  check('verification timestamp is not inherited either',
    'verified_at' in artifact && !('verified_at' in regenerated));
  check('the regenerated artifact still validates against the contract',
    validateArtifact(regenerated, materialArticle).length === 0,
    JSON.stringify(validateArtifact(regenerated, materialArticle)));
}

// --- findings are recorded ------------------------------------------------
console.log('findings');
{
  const findings = readFileSync(resolve(POC, 'FINDINGS.md'), 'utf8');
  check('the visual finding is recorded', /divergence is the argument/i.test(findings));
  check('the counterfactual is recorded',
    /would have failed|thesis would have failed/i.test(findings));
  check('the limits are stated, including that the generators are compilers',
    /deterministic compilers, not writers/i.test(findings));
}

// --- the roadmap decision (SUE-456) --------------------------------------
console.log('audio/video roadmap');
{
  const roadmap = readFileSync(resolve(ROOT, 'docs/architecture/AUDIO-VIDEO-ROADMAP.md'), 'utf8');
  check('audio and video are decided separately',
    /## Audio — \*\*defer\*\*/.test(roadmap) && /## Video — \*\*reject for now\*\*/.test(roadmap));
  check('the decision cites PoC evidence',
    /evals\/poc\/FINDINGS\.md/.test(roadmap) && /byte-identically/.test(roadmap));
  check('deferral reasons and revisit triggers are explicit',
    /AV-1/.test(roadmap) && /AV-4/.test(roadmap) && /AV-5/.test(roadmap));
  check('cost is explicitly not the reason for deferring audio',
    /not deferred for.*\n*.*Cost/is.test(roadmap));
  check('article-first discipline is preserved',
    /canonical article remains the\s+destination/.test(roadmap));
  check('lineage requirements survive any later format',
    /would carry `article_ref` with both hashes/.test(roadmap));
}

// --- storage decision is measured, not projected (SUE-461) ---------------
console.log('media storage decision');
{
  // Prose is line-wrapped; match across whitespace rather than assuming a
  // phrase sits on one line.
  const raw = readFileSync(resolve(ROOT, 'docs/architecture/MEDIA-STORAGE.md'), 'utf8');
  const doc = raw.replace(/\s+/g, ' ');
  const files = [
    'cost-stack.svg', 'cost-flow.mmd', 'brief.md', 'deck.md',
    'specs/cost-stack.chart.json', 'specs/cost-flow.diagram.json', 'handoff-receipt.json',
  ];
  const total = files.reduce((n, f) => n + statSync(resolve(POC, f)).size, 0);

  check('one fully-artifacted article stays under 16 KB', total < 16 * 1024, `${total} bytes`);
  check('the document cites the measured figure', /~10 KB/.test(doc));
  check('every produced artifact is text',
    files.every((f) => !/\.(png|jpe?g|mp4|mp3|pdf|pptx)$/.test(f)));
  check('no artifact approaches the 2 MB charter ceiling',
    files.every((f) => statSync(resolve(POC, f)).size < 2 * 1024 * 1024));
  check('the decision names thresholds that would overturn it',
    ['ST-1', 'ST-2', 'ST-3', 'ST-4'].every((t) => doc.includes(t)));
  check('a migration path exists that is a location change, not a rewrite',
    /location change for one artifact class, not an architecture change/.test(doc));
  check('specs are never deleted', /Specs are never deleted/.test(doc));
  check('nothing is auto-deleted', /Nothing is auto-deleted/.test(doc));
}

console.log(failures === 0 ? '\nPoC regression: PASS' : `\nPoC regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
