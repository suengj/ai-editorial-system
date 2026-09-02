#!/usr/bin/env node
/**
 * Regression test for the evaluation method — AES-P3.1 / P3.2 (SUE-449, SUE-450).
 *
 * The method's own failure mode is the interesting one: a rubric that reports
 * "smoother" as "better" would pass every naive test. Most of these checks
 * exist to prove it does not. The corpus also carries prose failures that are
 * intentionally invisible to deterministic gates.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibrate, compare, evaluate, loadManifest, loadRubric, UNSCORED } from './lib/eval-core.mjs';
import { loadProfiles } from './lib/profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FIXTURES = resolve(ROOT, 'evals/fixtures');

const rubric = loadRubric();
const manifest = loadManifest();
const profiles = loadProfiles();
const article = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8')).article;
const read = (p) => readFileSync(resolve(FIXTURES, p), 'utf8');
const fixture = (id) => manifest.fixtures.find((f) => f.id === id);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const run = (id, baseline = null) => {
  const f = fixture(id);
  return evaluate(read(f.path), { article, contentType: f.content_type, baseline, rubric });
};

// --- corpus shape (SUE-449) ----------------------------------------------
console.log('fixture corpus');
{
  const golden = manifest.fixtures.filter((f) => f.kind === 'golden');
  const negative = manifest.fixtures.filter((f) => f.kind === 'negative');

  check('golden corpus covers more than one content type',
    new Set(golden.map((f) => f.content_type)).size >= 3,
    [...new Set(golden.map((f) => f.content_type))].join());
  check('the golden corpus contains more than one analytical prose shape',
    golden.some((f) => f.id === 'G-01') && golden.some((f) => f.id === 'G-04'));
  check('the SUE-417 draft is represented as negative evidence',
    negative.some((f) => /SUE-417/i.test(f.origin ?? '')));
  check('every fixture states which dimensions it tests',
    manifest.fixtures.every((f) => (f.dimensions_tested ?? []).length > 0));
  check('every golden fixture records the anti-patterns it avoids',
    golden.every((f) => (f.anti_patterns_avoided ?? []).length > 0));
  check('every negative fixture diagnoses its failure modes',
    negative.every((f) => (f.failure_modes ?? []).length > 0));
  check('the corpus is small enough to rerun routinely',
    manifest.fixtures.length <= 10);
  check('no fixture reproduces third-party material',
    manifest.fixtures.every((f) => /synthetic|owner|reconstructed/i.test(f.origin ?? '')));
  check('a rights policy is recorded', /synthetic|owner-authored/i.test(manifest.rights_policy ?? ''));
}

// --- golden fixtures pass -------------------------------------------------
console.log('golden fixtures');
{
  const goldenIds = manifest.fixtures.filter((f) => f.kind === 'golden').map((f) => f.id);
  for (const id of goldenIds) {
    const card = run(id);
    check(`${id} does not hard fail`, !card.hard_fail,
      JSON.stringify(card.findings.map((f) => `${f.severity}:${f.gate}`)));
  }
  check('golden fixtures produce no gate findings at all',
    goldenIds.every((id) => run(id).findings.length === 0),
    JSON.stringify(goldenIds.map((id) => [id, run(id).findings.map((f) => f.gate)])));
}

// --- profile-relative calibration ----------------------------------------
console.log('evidence density is calibrated per content type');
{
  const view = read(fixture('G-02').path);
  const asView = evaluate(view, { article, contentType: 'view', rubric });
  const asNews = evaluate(view, { article, contentType: 'news', rubric });
  check('a View passes its own floor', !asView.findings.some((f) => f.gate === 'evidence-density'));
  check('the same body would fail the News floor',
    asNews.findings.some((f) => f.gate === 'evidence-density'));
  check('View and Note floors are lower than News and Research',
    profiles.view.quality_gates.evidence_density_floor < profiles.news.quality_gates.evidence_density_floor &&
    profiles.note.quality_gates.evidence_density_floor < profiles.research.quality_gates.evidence_density_floor);
}

// --- negative fixtures ----------------------------------------------------
console.log('negative fixtures');
{
  const n1 = run('N-01');
  check('N-01 hard fails', n1.hard_fail);
  for (const gate of ['prompt-echo', 'duplicate-paragraph', 'scaffolding-leak']) {
    check(`N-01 trips ${gate}`, n1.findings.some((f) => f.gate === gate));
  }

  const n2 = run('N-02');
  check('N-02 is mechanically clean, by design', !n2.hard_fail,
    JSON.stringify(n2.findings.map((f) => f.gate)));
  check('N-02 records that verify-claims is what catches it',
    /verify-claims/.test(fixture('N-02').expected?.caught_by ?? ''));
  check('I-3 claim-support is not claimed to be mechanical',
    rubric.dimensions.find((d) => d.id === 'I-3').mechanical === 'none');

  const n4 = run('N-04');
  check('N-04 translationese is not pretended to be a deterministic hard failure', !n4.hard_fail,
    JSON.stringify(n4.findings.map((f) => f.gate)));
  check('N-04 is assigned to E-13 human-or-judge review',
    /E-13/.test(fixture('N-04').expected?.caught_by ?? ''));

  const n5 = run('N-05');
  check('N-05 style overfit is not pretended to be a deterministic hard failure', !n5.hard_fail,
    JSON.stringify(n5.findings.map((f) => f.gate)));
  check('N-05 is assigned to E-11 human-or-judge review',
    /E-11/.test(fixture('N-05').expected?.caught_by ?? ''));
}

// --- the regression the method exists for --------------------------------
console.log('smoother but factually worse');
{
  const before = run('G-01');
  const after = run('N-03', read(fixture('G-01').path));
  const result = compare(before, after);

  check('the paired comparison is a regression', result.verdict === 'regression');
  check('the regression is on polish preservation',
    result.integrityRegressions.some((r) => r.id === 'I-2'));
  check('the changed number is named in the evidence',
    result.integrityRegressions.some((r) => /30%/.test(r.evidence) && /40%/.test(r.evidence)),
    JSON.stringify(result.integrityRegressions));
  check('N-03 hard fails', after.hard_fail);

  // Editorial improvement must not override an integrity regression.
  const improvedAfter = JSON.parse(JSON.stringify(after));
  for (const d of Object.values(improvedAfter.dimensions)) {
    if (d.class === 'editorial') d.result = 3;
  }
  const improvedBefore = JSON.parse(JSON.stringify(before));
  for (const d of Object.values(improvedBefore.dimensions)) {
    if (d.class === 'editorial') d.result = 1;
  }
  const forced = compare(improvedBefore, improvedAfter);
  check('every editorial dimension improving does not override the regression',
    forced.verdict === 'regression');
  check('the report says so explicitly', forced.improvedDespiteRegression === true);
}

// --- SUE-417 calibration --------------------------------------------------
console.log('SUE-417 calibration');
{
  const { baseline, calibrated } = manifest.calibration;
  const c = calibrate(run(baseline), run(calibrated));

  check('the smoke-draft shape hard fails', c.hard_fail.before === true);
  check('the calibrated shape does not', c.hard_fail.after === false);
  check('every blocking failure is cleared', c.rejects.after === 0 && c.rejects.before > 0);
  check('the result is materially better', c.materially_better === true);

  const stillBlocked = { ...run(calibrated), hard_fail: true, findings: [{ severity: 'reject', gate: 'x', detail: 'x' }] };
  check('merely reducing findings does not count as materially better',
    calibrate(run(baseline), stillBlocked).materially_better === false);
}

// --- method properties ----------------------------------------------------
console.log('method properties');
{
  check('integrity and editorial dimensions have different scales',
    rubric.scales.integrity.values.join() === 'pass,fail' &&
    rubric.scales.editorial.values.length === 4);
  check('the rubric carries 6 integrity and 13 editorial dimensions',
    rubric.dimensions.filter((d) => d.class === 'integrity').length === 6 &&
    rubric.dimensions.filter((d) => d.class === 'editorial').length === 13,
    `${rubric.dimensions.filter((d) => d.class === 'integrity').length}/${rubric.dimensions.filter((d) => d.class === 'editorial').length}`);
  check('there is no aggregate score', typeof rubric.no_aggregate_score === 'string');
  check('evidence is required for every rating', rubric.evidence_required === true);
  check('human authority is recorded as non-replaceable',
    /never replaced/i.test(rubric.human_authority.statement));
  check('the regression rule is stated in the machine form',
    /regardless of how many editorial dimensions improved/i.test(rubric.regression_rule.statement));

  const e11 = rubric.dimensions.find((d) => d.id === 'E-11');
  const e13 = rubric.dimensions.find((d) => d.id === 'E-13');
  check('voice-fit rejects mechanical imitation of signature moves',
    /mechanically imitating|signature moves/i.test(e11?.asks ?? ''));
  check('native-language prose is a separate editorial dimension',
    e13?.name === 'language-native-prose' && e13.mechanical === 'none');
  check('E-13 explicitly rejects AI-origin detection as its purpose',
    /not an AI-origin detector/i.test(e13?.note ?? ''));

  const card = run('G-01');
  const unscored = Object.values(card.dimensions).filter((d) => d.result === UNSCORED);
  check('judgement dimensions are left unscored rather than invented',
    unscored.length > 0 && unscored.every((d) => d.evidence));
  check('every unscored dimension says what would fill it',
    unscored.every((d) => typeof d.evidence === 'string' && d.evidence.length > 20),
    JSON.stringify(unscored.map((d) => [d.name, d.evidence])));
}

console.log(failures === 0 ? '\neval regression: PASS' : `\neval regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
