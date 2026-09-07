#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'; import { createHash } from 'node:crypto'; import { spawnSync } from 'node:child_process'; import { resolve } from 'node:path'; import { tmpdir } from 'node:os';
import { REVIEW_CODES, VISUAL_FAILURE_ACTIONS, expectedVisualReviewRoute, validateVisualFixture, validateVisualReview } from './lib/visual-review-core.mjs';
const root=resolve(new URL('..',import.meta.url).pathname), read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8')); let bad=0; const ok=(n,v)=>{console.log(`${v?'PASS':'FAIL'} ${n}`);if(!v)bad++};
const dims=['thesis_clarity','reading_path','narrative_composition','editorial_authorship','spatial_richness','information_hierarchy','article_fit','reference_adherence','brand_compatibility','factual_text_integrity','mobile_crop_resilience'].map(d=>({dimension:d,verdict:'pass',evidence:'observed pixel region'}));
const good={schema_version:'1.0.0',review_id:'visual-review:mobile',asset_ref:'evals/prototypes/sue629/plate-a-mechanism.svg',asset_sha256:'sha256:b2d2e0144f2e73703b3b34799d61253b68b0a30331400aacdce1355c45803894',review_mode:'mobile_downscaled',dimensions:dims,verdict:'REROUTE',defect_tags:['dashboardization'],primary_tag:'dashboardization',failure_class:'dashboardization',next_action:'reroute_composition_renderer',feedback_ref:'feedback:visual-review-sue629-a',final_authority:'human'};
ok('mobile review record validates',validateVisualReview(good).length===0); for(const x of ['HUMAN_APPROVED_LOCKED','APPROVED_MASTER','approved']){const j={...good,verdict:x};ok(`approval-shaped verdict rejected ${x}`,validateVisualReview(j).some(i=>i.code===REVIEW_CODES.SCHEMA));}
const fx=read('evals/visual-review/fixtures/negative/sue629-a.json'); ok('real negative fixture hash validates',validateVisualFixture(fx).length===0); ok('hash mismatch rejected',validateVisualFixture({...fx,asset_sha256:'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}).some(i=>i.code===REVIEW_CODES.FIXTURE_HASH)); const slot=read('evals/visual-review/fixtures/positive-slots.json').slots[0];ok('empty positive slot inert',validateVisualFixture(slot).length===0);ok('positive slot cannot point at repository asset',validateVisualFixture({...slot,asset_ref:fx.asset_ref,asset_sha256:fx.asset_sha256}).some(i=>i.code===REVIEW_CODES.POSITIVE));
ok('missing fixture rejected',validateVisualFixture({...fx,asset_ref:'evals/missing.svg'}).some(i=>i.code===REVIEW_CODES.FIXTURE_PATH));ok('outside fixture rejected',validateVisualFixture({...fx,asset_ref:'/tmp/no.svg'}).some(i=>i.code===REVIEW_CODES.FIXTURE_PATH));ok('a negative fixture cannot claim an accepted owner judgement',validateVisualFixture({...fx,owner_judgement:'accepted'}).some(i=>i.code===REVIEW_CODES.POSITIVE));
for(const tag of ['dashboardization','ui_mimicry','flat_svg_aesthetic','generic_icon_grid','box_overload','over_minimalization','weak_visual_thesis','style_dilution','dense_text','reference_drift','factual_overlay_intrusion']){const r=expectedVisualReviewRoute(tag),j={...good,verdict:'REROUTE',defect_tags:[tag],primary_tag:tag,failure_class:r?.failure_class,next_action:r?.next_action};ok(`tag schema and parity ${tag}`,r&&VISUAL_FAILURE_ACTIONS[r.failure_class]===r.next_action&&!validateVisualReview(j).some(x=>!String(x.code).startsWith('visual-review-feedback-')));}
const plates=['sue629-a.json','sue629-b.json','sue629-c.json'].map(x=>read(`evals/visual-review/fixtures/negative/${x}`));ok('rejected SUE-629 records carry dashboard UI and flat-SVG warnings routed to reroute', ['dashboardization','ui_mimicry','flat_svg_aesthetic'].every(t=>plates.some(p=>p.failure_tags.includes(t))&&expectedVisualReviewRoute(t).next_action==='reroute_composition_renderer'));
const harness=spawnSync('node',['scripts/compare-visual-review-fixtures.mjs'],{cwd:root,encoding:'utf8'});ok('empty positive slots make comparison UNRUNNABLE non-success',harness.status===2&&harness.stdout.includes('UNRUNNABLE'));

// --- comparison harness ---------------------------------------------------
// Every case runs in a mkdtemp scope the test creates and removes. The valid
// case needs repository-CONTAINED assets, so its scope is made inside the repo
// root and removed again; nothing is ever committed.
const runHarness = (slotsPath, feedbackDir) => spawnSync(
  'node', ['scripts/compare-visual-review-fixtures.mjs'],
  { cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      VISUAL_POSITIVE_SLOTS: slotsPath,
      ...(feedbackDir ? { VISUAL_FEEDBACK_DIR: feedbackDir } : {}),
    } },
);

{
  // The reviewer's forgery: two real rejected repository SVGs with their real
  // digests, a negative status, and a review reference that is just a string.
  const scope = mkdtempSync(resolve(tmpdir(), 'visual-review-forged-'));
  try {
    const a = read('evals/visual-review/fixtures/negative/sue629-a.json');
    const b = read('evals/visual-review/fixtures/negative/sue629-b.json');
    const forged = [a, b].map((f, i) => ({
      fixture_id: `forged-${i}`, asset_ref: f.asset_ref, asset_sha256: f.asset_sha256,
      status: 'negative', owner_judgement: 'rejected', failure_tags: [],
      usage_limit: 'forged', review_record: 'not-a-review',
    }));
    const p = resolve(scope, 'slots.json');
    writeFileSync(p, JSON.stringify({ slots: forged }));
    const run = runHarness(p);
    ok('forged negative-status slots are UNRUNNABLE',
      run.status === 2 && run.stdout.includes('not owner_positive'));
  } finally { rmSync(scope, { recursive: true, force: true }); }
}

{
  // Same assets, but now claiming owner_positive — an asset already registered
  // as a negative fixture must never become a positive reference.
  const scope = mkdtempSync(resolve(tmpdir(), 'visual-review-promoted-'));
  try {
    const a = read('evals/visual-review/fixtures/negative/sue629-a.json');
    const p = resolve(scope, 'slots.json');
    writeFileSync(p, JSON.stringify({ slots: [{
      fixture_id: 'promoted', asset_ref: a.asset_ref, asset_sha256: a.asset_sha256,
      status: 'owner_positive', owner_judgement: 'accepted', failure_tags: [],
      usage_limit: 'promoted', review_record: 'evals/visual-review/fixtures/negative/sue629-a.json',
    }] }));
    const run = runHarness(p);
    ok('a registered negative asset cannot be promoted to a positive reference',
      run.status === 2 && run.stdout.includes('registered as a negative fixture'));
  } finally { rmSync(scope, { recursive: true, force: true }); }
}

{
  // The genuinely valid pair the earlier test never built. Each temp review
  // gets its own temp feedback record, injected via VISUAL_FEEDBACK_DIR, so the
  // mandatory feedback-routing contract is genuinely satisfied and nothing is
  // written into the committed registry.
  const scope = mkdtempSync(resolve(root, '.visual-review-valid-'));
  const rel = (p) => p.slice(root.length + 1);
  try {
    const feedbackDir = resolve(scope, 'feedback-records');
    mkdirSync(feedbackDir);
    const slots = [0, 1].map((i) => {
      const assetPath = resolve(scope, `positive-${i}.svg`);
      writeFileSync(assetPath, `<svg xmlns="http://www.w3.org/2000/svg"><title>positive ${i}</title></svg>`);
      const digest = `sha256:${createHash('sha256').update(readFileSync(assetPath)).digest('hex')}`;
      const feedbackId = `feedback:temp-positive-${i}`;
      writeFileSync(resolve(feedbackDir, `temp-positive-${i}.json`), JSON.stringify({
        schema_version: '1.0.0', feedback_id: feedbackId, created_at: '2026-09-07T00:00:00Z',
        subject: { kind: 'artifact', ref: rel(assetPath) },
        evaluator: { type: 'agent', agent: { runtime: 'vision-agent' } },
        basis: 'model_inference', signal: 'publication_fit', verdict: 'mixed',
        owner_verdict: 'unknown',
        statement: `Temporary fixture finding for positive slot ${i}.`,
        routing: { layer: 'surface', confidence: 'low', abstained: true, rationale: 'Temporary fixture.' },
        scope: 'task_local', calibration_ref: null, evidence_links: [],
      }));
      const reviewPath = resolve(scope, `review-${i}.json`);
      writeFileSync(reviewPath, JSON.stringify({
        ...good, review_id: `visual-review:positive-${i}`,
        asset_ref: rel(assetPath), asset_sha256: digest,
        verdict: 'PASS_TO_HUMAN_REVIEW', defect_tags: [], primary_tag: null,
        failure_class: null, next_action: 'human_judgement', feedback_ref: feedbackId,
      }));
      return {
        fixture_id: `positive-${i}`, asset_ref: rel(assetPath), asset_sha256: digest,
        status: 'owner_positive', owner_judgement: 'accepted', failure_tags: [],
        usage_limit: 'temp fixture', review_record: rel(reviewPath),
      };
    });
    const p = resolve(scope, 'slots.json');
    writeFileSync(p, JSON.stringify({ slots }));
    ok('a genuinely valid owner-positive pair reports COMPARABLE',
      (() => { const r = runHarness(p, feedbackDir); return r.status === 0 && r.stdout.includes('COMPARABLE'); })());

    // A review that is schema-shaped but fails the feedback contract must not count.
    const badFeedback = JSON.parse(JSON.stringify(slots));
    const strayReview = resolve(scope, 'review-stray.json');
    writeFileSync(strayReview, JSON.stringify({
      ...good, review_id: 'visual-review:stray',
      asset_ref: slots[0].asset_ref, asset_sha256: slots[0].asset_sha256,
      verdict: 'PASS_TO_HUMAN_REVIEW', defect_tags: [], primary_tag: null,
      failure_class: null, next_action: 'human_judgement',
      feedback_ref: 'feedback:not-in-this-corpus',
    }));
    badFeedback[0].review_record = rel(strayReview);
    writeFileSync(p, JSON.stringify({ slots: badFeedback }));
    ok('a review failing the feedback contract is UNRUNNABLE',
      (() => { const r = runHarness(p, feedbackDir); return r.status === 2 && r.stdout.includes('feedback'); })());

    // ...and one broken condition at a time still blocks it.
    const broken = JSON.parse(JSON.stringify(slots));
    broken[0].asset_sha256 = 'sha256:' + 'a'.repeat(64);
    writeFileSync(p, JSON.stringify({ slots: broken }));
    ok('a wrong digest on an otherwise valid slot is UNRUNNABLE',
      runHarness(p, feedbackDir).status === 2);

    const noReview = JSON.parse(JSON.stringify(slots));
    noReview[1].review_record = rel(resolve(scope, 'absent-review.json'));
    writeFileSync(p, JSON.stringify({ slots: noReview }));
    ok('an unresolvable review record is UNRUNNABLE', runHarness(p, feedbackDir).status === 2);

    const wrongSubject = JSON.parse(JSON.stringify(slots));
    wrongSubject[0].review_record = wrongSubject[1].review_record;
    writeFileSync(p, JSON.stringify({ slots: wrongSubject }));
    ok('a review record about a different asset is UNRUNNABLE',
      runHarness(p, feedbackDir).status === 2);
  } finally { rmSync(scope, { recursive: true, force: true }); }
}

// --- feedback routing: one named negative per condition --------------------
// The three record-shaped conditions use an injected temp corpus. Nothing in
// the committed registry is written, so a crash or a concurrent run cannot
// leave the checkout dirty.
{
  const missing = JSON.parse(JSON.stringify(good));
  delete missing.feedback_ref;
  ok('feedback route rejects: missing feedback_ref',
    validateVisualReview(missing).some((i) => i.code === REVIEW_CODES.SCHEMA));

  const unresolvable = { ...good, feedback_ref: 'feedback:does-not-exist' };
  ok('feedback route rejects: unresolvable feedback_ref',
    validateVisualReview(unresolvable).some((i) => i.code === REVIEW_CODES.FEEDBACK_UNRESOLVED));

  const scope = mkdtempSync(resolve(tmpdir(), 'visual-review-feedback-'));
  try {
    const base = JSON.parse(readFileSync(
      resolve(root, 'feedback/records/visual-review-sue629-a.json'), 'utf8'));
    const withRecord = (mutate) => {
      const record = JSON.parse(JSON.stringify(base));
      mutate(record);
      // The registry requires the filename to match the feedback_id.
      writeFileSync(resolve(scope, `${record.feedback_id.split(':').pop()}.json`), JSON.stringify(record));
      return validateVisualReview(good, { feedbackDir: scope });
    };
    ok('feedback route accepts a consistent record',
      withRecord(() => {}).length === 0);
    ok('feedback route rejects: feedback about a different subject',
      withRecord((r) => { r.subject.ref = 'evals/prototypes/sue629/plate-b-comparison.svg'; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_SUBJECT));
    ok('feedback route rejects: feedback basis is not model_inference',
      withRecord((r) => { r.basis = 'owner_statement'; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_BASIS));
    ok('feedback route rejects: feedback carries an owner verdict',
      withRecord((r) => { r.owner_verdict = 'accepted'; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_OWNER));
    ok('feedback route rejects: feedback modality disagrees with the primary tag',
      withRecord((r) => { r.routing.modality_layer = 'reference_drift'; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_MODALITY));
    ok('feedback route rejects: a record the feedback contract itself rejects',
      withRecord((r) => { delete r.statement; delete r.scope; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_INVALID));
  } finally { rmSync(scope, { recursive: true, force: true }); }
}

process.exitCode = bad ? 1 : 0;
