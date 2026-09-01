#!/usr/bin/env node
/**
 * Regression test for the boundary validator — AES-P0.1 (SUE-434).
 *
 * Proves both directions:
 *   allow/ fixtures  → zero violations   (no false positives)
 *   deny/  fixtures  → the expected rule fires on each file (no silent pass)
 *   repo root        → clean under the real charter
 *
 * A validator that never fires is not evidence. Absence is never PASS.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, scan } from './lib/boundary-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const FIXTURES = join(HERE, 'fixtures', 'boundary');

let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// --- 1. allow fixtures produce no findings --------------------------------
console.log('allow fixtures (expect 0 violations)');
{
  const { files, violations } = scan(join(FIXTURES, 'allow'));
  check(`${files.length} allow fixtures scanned`, files.length >= 4, `saw ${files.length}`);
  check(
    'no violations on legitimate control-plane content',
    violations.length === 0,
    violations.map((v) => `${v.rule}:${v.file}`).join(', '),
  );
}

// --- 2. deny fixtures each fire the expected rule --------------------------
console.log('deny fixtures (expect the named rule on each file)');
{
  const expected = {
    'leaked-key.txt': RULES.SECRET,
    'captions.vtt': RULES.SOURCE_CORPUS,
    'confidential-note.md': RULES.PRIVATE_RESEARCH,
    'archived-article.md': RULES.ARTICLE_ARCHIVE,
  };

  const { files, violations } = scan(join(FIXTURES, 'deny'));
  check(
    'every deny fixture is covered by an expectation',
    files.every((f) => f in expected),
    `uncovered: ${files.filter((f) => !(f in expected)).join(', ')}`,
  );

  for (const [file, rule] of Object.entries(expected)) {
    const hit = violations.some((v) => v.file === file && v.rule === rule);
    check(`${file} → ${rule}`, hit, `got ${JSON.stringify(violations.filter((v) => v.file === file))}`);
  }
}

// --- 3. large-binary ceiling (generated, never committed) ------------------
console.log('large-binary ceiling');
{
  const dir = mkdtempSync(join(tmpdir(), 'aes-boundary-'));
  try {
    writeFileSync(join(dir, 'oversized.mp4'), Buffer.alloc(3 * 1024 * 1024, 0x41));
    writeFileSync(join(dir, 'small.png'), Buffer.alloc(1024, 0x42));
    const { violations } = scan(dir);
    check(
      'a 3 MB .mp4 trips large-binary',
      violations.some((v) => v.file === 'oversized.mp4' && v.rule === RULES.LARGE_BINARY),
    );
    check(
      'a 1 KB .png does not',
      !violations.some((v) => v.file === 'small.png'),
      violations.map((v) => `${v.rule}:${v.file}`).join(', '),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- 4. the real repository is clean ---------------------------------------
console.log('repository root under the live charter');
{
  const { files, violations } = scan(REPO_ROOT, { exclude: ['scripts/fixtures'] });
  check(`${files.length} repository files scanned`, files.length > 0);
  check(
    'repository root has no boundary violations',
    violations.length === 0,
    violations.map((v) => `[${v.rule}] ${v.file}: ${v.detail}`).join('; '),
  );
}

console.log(failures === 0 ? '\nboundary regression: PASS' : `\nboundary regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
