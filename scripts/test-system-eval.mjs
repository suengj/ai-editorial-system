#!/usr/bin/env node
/**
 * Regression test for the system evaluation surface — AES-V2.14 (SUE-573).
 *
 * Allow/deny fixtures over the live seed snapshot plus mutated clones, per
 * the repo's evidence rule (see scripts/test-registry.mjs and
 * scripts/test-rights-policy.mjs for the pattern this follows).
 */

import { readFileSync } from 'node:fs';
import {
  CODES, PATHS, FIXED_DIMENSION_IDS, loadSchema, loadJson,
  validateSnapshotObject, validateSnapshotFile, listSnapshotFiles,
  canonicalJson, rebuildCurrent, checkCurrentFreshness,
  scanForAggregateScore, findSilenceMisuse, resolveEvidenceRef, parseEvidenceRef,
} from './lib/system-eval-core.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const schema = loadSchema();

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function codesOf(issues) {
  return issues.map((i) => i.code);
}

// --- worked examples: every seed record is clean ---------------------------
console.log('seed records (expect 0 issues each)');
for (const path of listSnapshotFiles()) {
  const issues = validateSnapshotFile(path, { schema });
  check(`snapshot is valid: ${path}`, issues.length === 0, JSON.stringify(issues));
}
{
  const issues = validateSnapshotFile(PATHS.currentPath, { schema });
  check('current.json is valid', issues.length === 0, JSON.stringify(issues));
}

const seedSnapshot = loadJson(listSnapshotFiles()[0]);
check('seed snapshot has exactly the 10 SUE-573 dimensions', seedSnapshot.dimensions.length === FIXED_DIMENSION_IDS.length);
check('seed snapshot dimensions are all INSUFFICIENT_EVIDENCE (no operating history yet)',
  seedSnapshot.dimensions.every((d) => d.state === 'INSUFFICIENT_EVIDENCE'));

// --- current.json freshness -------------------------------------------------
console.log('current.json freshness');
{
  const fresh = checkCurrentFreshness();
  check('current.json matches a fresh rebuild from the newest snapshot', fresh.matches);
  const rebuiltTwice = canonicalJson(rebuildCurrent()) === canonicalJson(rebuildCurrent());
  check('rebuild is deterministic (byte-identical across two runs)', rebuiltTwice);
}

// --- ALLOW: a well-formed additional snapshot passes ------------------------
console.log('allow cases');
{
  const good = clone(seedSnapshot);
  good.snapshot_id = 'system-eval:2026-09-05-seed';
  const issues = validateSnapshotObject(good, { schema });
  check('a byte-for-byte clone of the seed snapshot validates clean', issues.length === 0, JSON.stringify(issues));
}
{
  // A dimension legitimately promoted to WATCH with real evidence is allowed.
  const good = clone(seedSnapshot);
  const dim = good.dimensions.find((d) => d.id === 'reference_health');
  dim.state = 'WATCH';
  dim.evidence_refs = ['references/index.json#by_provenance_class — no owner_created or generated_output references yet'];
  const issues = validateSnapshotObject(good, { schema });
  check('WATCH with a real, resolvable evidence ref is allowed', issues.length === 0, JSON.stringify(issues));
}

// --- DENY: aggregate score -----------------------------------------------
console.log('deny: aggregate score');
{
  check('scanForAggregateScore finds an injected overall_score number',
    scanForAggregateScore({ dimensions: [{ id: 'quality_lift', overall_score: 82 }] }) !== null);
  check('scanForAggregateScore finds a score-shaped key at any depth',
    scanForAggregateScore({ a: { b: { quality_percentage: 91 } } }) !== null);
  check('scanForAggregateScore does not flag the legitimate activation.overall enum string',
    scanForAggregateScore({ activation: { overall: 'sufficient' } }) === null);
  check('scanForAggregateScore does not flag ordinary evidence text mentioning the word score',
    scanForAggregateScore({ notes: 'no numeric score of any kind appears here' }) === null);

  // End-to-end: additionalProperties:false already rejects the unknown key,
  // and the dedicated scanner independently flags it too.
  const bad = clone(seedSnapshot);
  bad.dimensions[0].overall_score = 82;
  const issues = validateSnapshotObject(bad, { schema });
  check('a snapshot carrying an aggregate score is rejected end-to-end',
    issues.some((i) => i.code === CODES.SCHEMA) && scanForAggregateScore(bad) !== null);
}

// --- DENY: HEALTHY with no evidence -----------------------------------------
console.log('deny: state without evidence');
{
  const bad = clone(seedSnapshot);
  const dim = bad.dimensions.find((d) => d.id === 'quality_lift');
  dim.state = 'HEALTHY';
  dim.evidence_refs = [];
  const issues = validateSnapshotObject(bad, { schema });
  check('HEALTHY with empty evidence_refs is rejected', codesOf(issues).includes(CODES.HEALTHY_NO_EVIDENCE), JSON.stringify(issues));
}

// --- DENY: evidence ref pointing at a nonexistent path ----------------------
console.log('deny: unresolved evidence ref');
{
  const bad = clone(seedSnapshot);
  const dim = bad.dimensions.find((d) => d.id === 'quality_lift');
  dim.evidence_refs.push('definitely/not/a/real/path.json#nope — fabricated');
  const issues = validateSnapshotObject(bad, { schema });
  check('a nonexistent evidence path is rejected', codesOf(issues).includes(CODES.EVIDENCE_UNRESOLVED), JSON.stringify(issues));
}
{
  const bad = clone(seedSnapshot);
  const dim = bad.dimensions.find((d) => d.id === 'quality_lift');
  dim.evidence_sources.push('schemas/feedback-record.schema.json#this_field_does_not_exist');
  const issues = validateSnapshotObject(bad, { schema });
  check('a real file with a fabricated field pointer is rejected', codesOf(issues).includes(CODES.EVIDENCE_UNRESOLVED), JSON.stringify(issues));
}
{
  const r = resolveEvidenceRef('schemas/feedback-record.schema.json#owner_verdict — a real field');
  check('resolveEvidenceRef resolves a real path + real field', r.ok === true);
  const p = parseEvidenceRef('a/b/c.json#foo.bar — some note');
  check('parseEvidenceRef splits path/pointer/note correctly',
    p.path === 'a/b/c.json' && p.pointer === 'foo.bar' && p.note === 'some note');
}

// --- DENY: stale current.json ------------------------------------------------
console.log('deny: stale current.json');
{
  const stale = `${JSON.stringify({ ...seedSnapshot, kind: 'current', snapshot_id: 'system-eval:current', derived_from_snapshot: 'system-eval:2026-09-05-seed', notes: 'hand-edited' }, null, 2)}\n`;
  check('a hand-edited current.json is caught as stale against a fresh rebuild',
    stale !== canonicalJson(rebuildCurrent()));
}

// --- DENY: silence is not acceptance ----------------------------------------
console.log('deny: silence treated as acceptance');
{
  const hits = findSilenceMisuse({ interpretation: 'No owner complaints were raised, so the output is treated as accepted.' });
  check('the silence-as-acceptance keyword gate fires on a real misuse sentence', hits.length > 0);

  const clean = findSilenceMisuse({ interpretation: 'Silence is not acceptance: owner_verdict stays unknown until the owner actually says something.' });
  check('the same keyword gate does not fire on a sentence stating the rule itself', clean.length === 0, JSON.stringify(clean));

  const bad = clone(seedSnapshot);
  bad.dimensions.find((d) => d.id === 'quality_lift').interpretation =
    'The article was published with no complaints, so it counts as accepted.';
  const issues = validateSnapshotObject(bad, { schema });
  check('a snapshot inferring acceptance from publication/silence is rejected end-to-end',
    codesOf(issues).includes(CODES.SILENCE_MISUSE), JSON.stringify(issues));
}

// --- DENY: owner_verdict "unknown" counted as accepted ----------------------
console.log('deny: owner_verdict unknown miscounted as accepted');
{
  // feedback/records/paragraph-order-2026-09-05.json has verdict "bad" and
  // owner_verdict is not set to "unknown" in the live seed, so build a small
  // synthetic fixture on disk-shaped data via a resolvable real file that
  // does carry owner_verdict: unknown — the corpus placeholder entry.
  const bad = clone(seedSnapshot);
  const dim = bad.dimensions.find((d) => d.id === 'quality_lift');
  dim.state = 'WATCH';
  dim.evidence_refs = ['evals/real-output-corpus/entries/corpus-placeholder-view-unknown.json#owner_verdict'];
  dim.interpretation = 'This output was accepted by the owner and demonstrates a real quality lift.';
  dim.recommended_action = 'Treat this as accepted evidence and move on.';
  const issues = validateSnapshotObject(bad, { schema });
  check('claiming acceptance from a record whose owner_verdict is "unknown" is rejected',
    codesOf(issues).includes(CODES.OWNER_VERDICT_MISCOUNT), JSON.stringify(issues));

  const good = clone(seedSnapshot);
  const dim2 = good.dimensions.find((d) => d.id === 'quality_lift');
  dim2.state = 'WATCH';
  dim2.evidence_refs = ['evals/real-output-corpus/entries/corpus-placeholder-view-unknown.json#owner_verdict'];
  dim2.interpretation = 'owner_verdict on this entry is unknown; no acceptance can be claimed from it.';
  const issues2 = validateSnapshotObject(good, { schema });
  check('acknowledging the unknown verdict instead of claiming acceptance is allowed',
    !codesOf(issues2).includes(CODES.OWNER_VERDICT_MISCOUNT), JSON.stringify(issues2));
}

// --- DENY: wrong dimension set -----------------------------------------------
console.log('deny: dimension set');
{
  const bad = clone(seedSnapshot);
  bad.dimensions = bad.dimensions.slice(1); // drop one, now 9
  const issues = validateSnapshotObject(bad, { schema });
  check('a snapshot missing a dimension is rejected', codesOf(issues).includes(CODES.DIMENSION_SET_INVALID), JSON.stringify(issues));
}
{
  const bad = clone(seedSnapshot);
  bad.dimensions.push(clone(bad.dimensions[0])); // duplicate quality_lift, now 11
  const issues = validateSnapshotObject(bad, { schema });
  check('a snapshot with a duplicated dimension id is rejected', codesOf(issues).includes(CODES.DIMENSION_SET_INVALID), JSON.stringify(issues));
}

// --- DENY: current/snapshot kind confusion ----------------------------------
console.log('deny: kind/derivation mismatch');
{
  const bad = clone(seedSnapshot);
  bad.kind = 'current';
  bad.snapshot_id = 'system-eval:current';
  // derived_from_snapshot left null
  const issues = validateSnapshotObject(bad, { schema });
  check('kind "current" with a null derived_from_snapshot is rejected', codesOf(issues).includes(CODES.KIND_DERIVATION_MISMATCH), JSON.stringify(issues));
}
{
  const bad = clone(seedSnapshot);
  bad.derived_from_snapshot = 'system-eval:2026-09-05-seed'; // a real snapshot with non-null derivation
  const issues = validateSnapshotObject(bad, { schema });
  check('kind "snapshot" with a non-null derived_from_snapshot is rejected', codesOf(issues).includes(CODES.KIND_DERIVATION_MISMATCH), JSON.stringify(issues));
}

// --- schema-level sanity -----------------------------------------------------
console.log('schema sanity');
{
  const rawSchema = JSON.parse(readFileSync(PATHS.schema, 'utf8'));
  check('schema uses only json-schema-lite-supported keywords (validate() would already reject an unsupported one)',
    validateSnapshotObject(seedSnapshot, { schema: rawSchema }).filter((i) => i.code === CODES.SCHEMA).length === 0);
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failing check(s)`);
process.exit(failures === 0 ? 0 : 1);
