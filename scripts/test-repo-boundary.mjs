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

// --- 3. runtime-only deny cases -------------------------------------------
// Secret-shaped material, oversized binaries, and source-corpus files are
// synthesised in a temp dir rather than committed: a public repo must not carry
// credential-shaped blobs even as test data, and the charter bans large
// binaries and raw transcript corpora outright.
//
// A committed fixture cannot test a rule that .gitignore already enforces —
// the file would be absent from a clean checkout and the case would pass
// vacuously. Synthesising it is the only way the rule is actually exercised.
console.log('runtime-only deny cases (secrets, large binaries, source corpus)');
{
  const dir = mkdtempSync(join(tmpdir(), 'aes-boundary-'));
  try {
    // Assembled at runtime so the literal never exists in a committed file.
    const KEY_HEADER = ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ');
    writeFileSync(join(dir, 'leaked-key.txt'), `${KEY_HEADER}\nMIIEowIBAAKCAQEA\n`);
    writeFileSync(join(dir, 'aws.txt'), 'id = AKIA' + 'ABCDEFGHIJKLMNOP' + '\n');
    writeFileSync(join(dir, 'assigned.yaml'), 'api_key: ' + 'k'.repeat(24) + '\n');
    writeFileSync(join(dir, '.env'), 'TOKEN=placeholder\n');
    writeFileSync(join(dir, 'oversized.mp4'), Buffer.alloc(3 * 1024 * 1024, 0x41));
    writeFileSync(join(dir, 'small.png'), Buffer.alloc(1024, 0x42));
    writeFileSync(join(dir, 'clean.md'), '# Ordinary document\n\nNothing forbidden here.\n');
    writeFileSync(
      join(dir, 'captions.vtt'),
      'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nraw transcript line\n',
    );

    const { violations } = scan(dir);
    const fired = (file, rule) => violations.some((v) => v.file === file && v.rule === rule);

    check('private key block trips secret', fired('leaked-key.txt', RULES.SECRET));
    check('AWS access key id trips secret', fired('aws.txt', RULES.SECRET));
    check('assigned api_key trips secret', fired('assigned.yaml', RULES.SECRET));
    check('.env file name trips secret', fired('.env', RULES.SECRET));
    check('a 3 MB .mp4 trips large-binary', fired('oversized.mp4', RULES.LARGE_BINARY));
    check('a .vtt transcript trips source-corpus', fired('captions.vtt', RULES.SOURCE_CORPUS));
    check(
      'a 1 KB .png does not',
      !violations.some((v) => v.file === 'small.png'),
      violations.map((v) => `${v.rule}:${v.file}`).join(', '),
    );
    check(
      'an ordinary document does not',
      !violations.some((v) => v.file === 'clean.md'),
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
