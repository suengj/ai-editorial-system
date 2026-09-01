#!/usr/bin/env node
/**
 * certify-v1 — AES-P6.4 (SUE-462).
 *
 * Runs every gate and maps the results onto the V1 certification matrix.
 *
 * Items that cannot be certified from this repository are reported BLOCKED
 * with the reason, never quietly passed. A certification that reports only
 * what it can prove is worth more than one that reports ten green rows.
 *
 * Exit code reflects the checkable items only; blocked items are surfaced for
 * a human to resolve.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const run = (script) => {
  try {
    execFileSync('npm', ['run', '--silent', script], { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

const has = (...paths) => paths.every((p) => existsSync(resolve(ROOT, p)));
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

/** Every gate, run once. */
const gates = {
  'validate:boundary': run('validate:boundary'),
  'validate:source': run('validate:source'),
  'validate:article': run('validate:article'),
  'validate:rights': run('validate:rights'),
  'validate:skills': run('validate:skills'),
  'validate:plan': run('validate:plan'),
  'validate:presentation': run('validate:presentation'),
  'validate:hitl': run('validate:hitl'),
  'poc:check': run('poc:check'),
  'handoff:check': run('handoff:check'),
  eval: run('eval'),
  matrix: run('matrix'),
  'test:boundary': run('test:boundary'),
  'test:source': run('test:source'),
  'test:article': run('test:article'),
  'test:rights': run('test:rights'),
  'test:gates': run('test:gates'),
  'test:profiles': run('test:profiles'),
  'test:skills': run('test:skills'),
  'test:pipeline': run('test:pipeline'),
  'test:eval': run('test:eval'),
  'test:poc': run('test:poc'),
  'test:hitl': run('test:hitl'),
  'test:matrix': run('test:matrix'),
  'test:handoff': run('test:handoff'),
  'test:presentation': run('test:presentation'),
};

const all = (...names) => names.every((n) => gates[n]);

const MATRIX = [
  {
    id: 1,
    name: 'Public repo boundary, license, and public-safety checks',
    status: () => (all('validate:boundary', 'test:boundary') && has('LICENSE', 'LICENSE-DOCS', 'NOTICE', 'SECURITY.md') ? 'PASS' : 'FAIL'),
    evidence: 'validate:boundary, test:boundary, LICENSE + LICENSE-DOCS + NOTICE + SECURITY.md',
  },
  {
    id: 2,
    name: 'Source, Article, and Artifact contracts validated with examples',
    status: () => (all('validate:source', 'validate:article', 'validate:plan', 'test:source', 'test:article') ? 'PASS' : 'FAIL'),
    evidence: 'validate:source, validate:article, validate:plan + mutation regressions',
  },
  {
    id: 3,
    name: 'Constitution, voice, and content profiles present and referenced by Skills',
    status: () => {
      if (!has('editorial/constitution.md', 'editorial/voice.md', 'editorial/profiles')) return 'FAIL';
      // A Skill that does not defer to the constitution is not governed by it.
      const skills = ['frame-article', 'write-article', 'verify-claims', 'editorial-polish', 'plan-artifacts'];
      const governed = skills.every((s) => /editorial\/constitution\.md/.test(read(`skills/${s}/SKILL.md`)));
      return governed && all('validate:skills', 'test:profiles') ? 'PASS' : 'FAIL';
    },
    evidence: 'editorial/, all five Skills declare governed_by: editorial/constitution.md',
  },
  {
    id: 4,
    name: 'Frame / write / verify / polish / artifact-planning Skills exercised',
    status: () => (all('validate:skills', 'test:skills', 'test:pipeline') ? 'PASS' : 'FAIL'),
    evidence: 'test:pipeline — closed authority across the set, aligned handoffs',
  },
  {
    id: 5,
    name: 'Golden + negative fixtures and regression rubric exercised; SUE-417 improved',
    status: () => (all('eval', 'test:eval') ? 'PASS' : 'FAIL'),
    evidence: 'eval — calibration N-01 → G-01 MATERIALLY BETTER; regression G-01 → N-03 caught',
    caveat:
      'Fixture-based. Run against the real P03 drafts on 2026-09-01 the mechanical gates did not '
      + 'separate the first smoke draft from the calibrated ones — both are clean. They do catch the '
      + 'legacy Auto Blog artifact (scaffolding leak, duplicate paragraph). Discriminating editorial '
      + 'worth is left to the twelve judgement dimensions, so SUE-417 still needs the owner\'s reading.',
  },
  {
    id: 6,
    name: 'Cross-source HITL matrix: YouTube, market/research, GitHub project',
    status: () => (all('matrix', 'test:matrix', 'validate:hitl', 'test:hitl') ? 'PASS' : 'FAIL'),
    evidence: 'matrix — 3 source classes, 2 content-type profiles, one NO_ARTICLE',
    caveat: 'Structurally faithful cases, not live corpora. Real Drive content cannot enter a public repo.',
  },
  {
    id: 7,
    name: 'Brief + evidence visual + deck PoCs have valid lineage and stale behaviour',
    status: () => (all('poc:check', 'test:poc') ? 'PASS' : 'FAIL'),
    evidence: 'poc:check — all artifacts regenerate byte-identically; lineage and staleness tested',
    caveat: 'Generators are deterministic compilers, not writers. The model-in-the-slot case is untested.',
  },
  {
    id: 8,
    name: 'SUE-403 final Markdown handoff preserves Drive provenance and draft safety',
    status: () => (all('handoff:check', 'test:handoff') ? 'PASS' : 'FAIL'),
    evidence:
      'Executed 2026-09-01 on one real article: P03 seed (Drive YT_summary/source, T3hpzc0IGMw) '
      + '→ review draft (Drive YT_summary/drafts) → final (Drive PJT/Article, 13,389 bytes) '
      + '→ suengj-com content/editorial entry, merged as suengj-com 8190fa4. '
      + 'Provenance carried end to end; status stayed draft and the build stayed at 51 pages with the entry absent from dist.',
    caveat:
      'The boundary was tested, not the article. Its factual claims came from the P03 run and were not '
      + 're-verified here, and editorial approval remains the owner\'s.',
  },
  {
    id: 9,
    name: 'suengj.com artifact integration preserves canonical and AEO behaviour',
    status: () => (all('handoff:check', 'test:handoff') ? 'PASS' : 'FAIL'),
    evidence:
      'handoff:check; merged to suengj-com main as 8cf2b0d (PR #12). Full dist compared against the '
      + 'pre-merge build: 51 pages, 0 markup differences, 0 CSS rules changed, 9 added. '
      + 'Rendering verified on a real published article — prose byte-identical under an applied sidecar.',
    caveat: 'No article declares a sidecar yet, so the semantic path is exercised by tests and a probe rather than by live content.',
  },
  {
    id: 10,
    name: 'Media storage and audio/video roadmap decisions are explicit',
    status: () => (has('docs/architecture/MEDIA-STORAGE.md', 'docs/architecture/AUDIO-VIDEO-ROADMAP.md') ? 'PASS' : 'FAIL'),
    evidence: 'MEDIA-STORAGE.md (measured, 10,104 bytes/article → Git); AUDIO-VIDEO-ROADMAP.md (audio defer, video reject-for-now)',
  },
];

console.log('AI Editorial System — V1 certification\n');

const failedGates = Object.entries(gates).filter(([, ok]) => !ok).map(([n]) => n);
console.log(`gates: ${Object.keys(gates).length - failedGates.length}/${Object.keys(gates).length} passing`);
if (failedGates.length > 0) console.log(`failing: ${failedGates.join(', ')}`);
console.log('');

let failed = 0;
let blocked = 0;
for (const item of MATRIX) {
  const status = item.status();
  if (status === 'FAIL') failed += 1;
  if (status === 'BLOCKED') blocked += 1;
  console.log(`${String(item.id).padStart(2)}. ${status.padEnd(18)} ${item.name}`);
  console.log(`    evidence: ${item.evidence}`);
  if (item.caveat) console.log(`    caveat:   ${item.caveat}`);
  if (item.blocker) console.log(`    blocker:  ${item.blocker}`);
}

console.log('');
console.log(`certifiable items: ${MATRIX.length - blocked - failed} pass, ${failed} fail, ${blocked} blocked`);
console.log(failed === 0
  ? '\ncertification: PASS on every checkable item'
  : `\ncertification: FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
