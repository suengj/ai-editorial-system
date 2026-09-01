#!/usr/bin/env node
/**
 * Regression test for the cross-repo handoff — AES-P6.1 (SUE-459).
 *
 * The property under test: every failure mode still leaves a readable
 * canonical article, and nothing in the handoff moves publication authority.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, CONTRACT_VERSION, KNOWN_ROLES, buildReceipt, digest,
  resolvePresentation, validateReceipt,
} from './lib/handoff-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const receipt = JSON.parse(readFileSync(resolve(ROOT, 'evals/poc/handoff-receipt.json'), 'utf8'));
const body = readFileSync(resolve(ROOT, 'evals/fixtures/golden/G-01-synthesis.md'), 'utf8');
const bundle = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8'));
const doc = readFileSync(resolve(ROOT, 'docs/architecture/SUENGJ-COM-HANDOFF.md'), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codes = (r, b = body, o = {}) => validateReceipt(r, b, o).map((i) => i.code);
const mutate = (fn) => { const r = JSON.parse(JSON.stringify(receipt)); fn(r); return r; };

// --- the receipt ----------------------------------------------------------
console.log('worked receipt');
{
  check('the receipt is valid against its body', codes(receipt).length === 0,
    JSON.stringify(validateReceipt(receipt, body)));
  check('it targets the canonical path and URL',
    receipt.target.path === 'content/editorial/ai-inference-pricing-and-saas-gross-margin.md' &&
    receipt.target.canonical_url === '/content/ai-inference-pricing-and-saas-gross-margin');
  check('it carries provenance and citations in front matter',
    'provenance' in receipt.front_matter && 'citations' in receipt.front_matter);
  check('it references artifacts rather than embedding them',
    receipt.artifacts.every((a) => a.artifact_id && a.location && !('content' in a)));
  check('execution evidence is referenced by path only',
    Object.values(receipt.evidence ?? {}).every((v) => typeof v === 'string' && v.endsWith('.json')));
}

// --- the canonical article is the deliverable ----------------------------
console.log('the article is the deliverable, everything else optional');
{
  const bare = mutate((r) => { r.artifacts = []; delete r.presentation; delete r.evidence; });
  check('a handoff with no artifacts and no sidecar is valid', codes(bare).length === 0,
    JSON.stringify(validateReceipt(bare, body)));
  check('the body digest is unchanged by removing them', bare.body_sha256 === receipt.body_sha256);
  check('the front matter is unchanged by removing them',
    JSON.stringify(bare.front_matter) === JSON.stringify(receipt.front_matter));
}

// --- presentation degrades, never breaks ---------------------------------
console.log('presentation degrades safely');
{
  const applied = resolvePresentation(receipt, body);
  check('every block in the worked receipt resolves',
    applied.applied.length === receipt.presentation.blocks.length && applied.dropped.length === 0);

  const broken = mutate((r) => { r.presentation.blocks[0].anchor = '이 문장은 본문에 없다.'; });
  const r1 = resolvePresentation(broken, body);
  check('an unresolved anchor drops its block rather than throwing',
    r1.dropped.some((d) => d.reason === 'anchor-not-found') && r1.applied.length === 2);
  check('and the strict check reports it before handoff',
    codes(broken).includes(CODES.ANCHOR_UNRESOLVED));

  const ambiguous = mutate((r) => { r.presentation.blocks[0].anchor = '가격이'; });
  check('an ambiguous anchor is dropped, never guessed at',
    resolvePresentation(ambiguous, body).dropped.some((d) => d.reason === 'anchor-ambiguous'));
  check('and is reported', codes(ambiguous).includes(CODES.ANCHOR_AMBIGUOUS));

  const unknown = mutate((r) => { r.presentation.blocks[0].role = 'sparkle'; });
  check('an unknown role degrades to plain content',
    resolvePresentation(unknown, body).dropped.some((d) => d.reason === 'unknown-role'));
  check('and is reported', codes(unknown).includes(CODES.UNKNOWN_ROLE));

  const futureMajor = mutate((r) => { r.presentation.schema_version = '2.0.0'; });
  const r2 = resolvePresentation(futureMajor, body);
  check('an incompatible sidecar major is ignored wholesale',
    r2.applied.length === 0 && r2.dropped.every((d) => d.reason === 'incompatible-major-version'));

  check('resolution never throws, whatever it is given',
    (() => {
      for (const input of [null, {}, { presentation: null }, { presentation: { blocks: null } }]) {
        try { resolvePresentation(input, body); } catch { return false; }
      }
      return true;
    })());
}

// --- the fallback is the body --------------------------------------------
console.log('plain Markdown remains complete');
{
  check('every anchor is text that already exists in the body',
    receipt.presentation.blocks.every((b) => body.includes(b.anchor)));
  check('the sidecar adds no text the body lacks',
    receipt.presentation.blocks.every((b) => Object.keys(b).every((k) => ['role', 'anchor'].includes(k))));
  check('the body carries no directive syntax',
    !/^:::/m.test(body) && !/<[A-Z][A-Za-z]*/.test(body));
  check('the decision and its runner-up are recorded',
    /Front-matter sidecar with text anchors\*\* \| \*\*Chosen/.test(doc) && /close second/.test(doc));
}

// --- version compatibility ------------------------------------------------
console.log('version compatibility is explicit');
{
  check('the contract declares a version', /^\d+\.\d+\.\d+$/.test(CONTRACT_VERSION));
  check('an unaccepted major is refused, not guessed at',
    codes(mutate((r) => { r.schema_version = '2.0.0'; })).includes(CODES.VERSION_INCOMPATIBLE));
  check('a minor bump is accepted',
    !codes(mutate((r) => { r.schema_version = '1.1.0'; })).includes(CODES.VERSION_INCOMPATIBLE));
  check('the accepted majors are the caller\'s choice, not ours',
    validateReceipt(mutate((r) => { r.schema_version = '2.0.0'; }), body, { acceptedMajors: [1, 2] })
      .every((i) => i.code !== CODES.VERSION_INCOMPATIBLE));
  check('the role vocabulary matches the presentation contract', KNOWN_ROLES.length === 10);
}

// --- stale artifacts ------------------------------------------------------
console.log('stale artifacts cannot masquerade as current');
{
  for (const level of ['material', 'unknown']) {
    check(`a ${level} artifact is refused at handoff`,
      codes(mutate((r) => { r.artifacts[0].staleness = level; })).includes(CODES.STALE_ARTIFACT));
  }
  check('fresh and cosmetic artifacts are eligible',
    receipt.artifacts.every((a) => ['fresh', 'cosmetic'].includes(a.staleness)));
}

// --- authority ------------------------------------------------------------
console.log('publication authority does not move');
{
  check('status is a constant on the target', codes(mutate((r) => { r.target.status = 'published'; })).length > 0);
  check('there is no approver field anywhere in the schema',
    !JSON.stringify(JSON.parse(readFileSync(resolve(ROOT, 'schemas/handoff-receipt.schema.json'), 'utf8')))
      .includes('approved_by'));
  check('a reader needs no editorial-system runtime',
    codes(mutate((r) => { r.front_matter.generator = 'ai-editorial-system/scripts/lib'; }))
      .includes(CODES.RUNTIME_DEPENDENCY));
}

// --- determinism ----------------------------------------------------------
console.log('the receipt is reproducible');
{
  const article = { ...bundle.article, version: { ...bundle.article.version, date: '2026-08-31' } };
  const a = buildReceipt(article, body, { producedAt: '2026-09-01T12:00:00Z' });
  const b = buildReceipt(article, body, { producedAt: '2026-09-01T12:00:00Z' });
  check('two builds of one article agree', JSON.stringify(a) === JSON.stringify(b));
  check('the body digest pins the file', a.body_sha256 === digest(body));
  check('a drifted body is caught',
    codes(receipt, `${body}\n추가된 문장.`).includes(CODES.BODY_DRIFT));
}

console.log(failures === 0 ? '\nhandoff regression: PASS' : `\nhandoff regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
