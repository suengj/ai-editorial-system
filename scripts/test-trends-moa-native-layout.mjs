import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const script = resolve(root, 'examples/trends-moa-native-layout.py');
const fonts = resolve(root, 'assets/fonts/aes-sans-kr');
const python = process.env.AES_PYTHON || 'python3';
const env = { ...process.env };
const workspacePydeps = resolve(root, '../pydeps');
if (!env.PYTHONPATH && existsSync(workspacePydeps)) env.PYTHONPATH = workspacePydeps;
const temp = mkdtempSync(join(tmpdir(), 'aes-trends-layout-'));
const run = (args) => spawnSync(python, args, { encoding: 'utf8', env });
const sha = (data) => createHash('sha256').update(data).digest('hex');

try {
  const pillow = run(['-c', 'import PIL']);
  assert.equal(pillow.status, 0, `Pillow is required: ${pillow.stderr || pillow.stdout}`);
  const common = ['--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-bold', join(fonts, 'AESSansKR-ExtraBold.otf')];
  const render = (name) => {
    const png = join(temp, `${name}.png`);
    const receipt = join(temp, `${name}.json`);
    const result = run([script, '--mode', 'after', '--out', png, '--receipt', receipt, ...common]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /SELF_CHECK=PASS/);
    return { png, receipt: JSON.parse(readFileSync(receipt, 'utf8')) };
  };

  const a = render('after-a');
  const b = render('after-b');
  assert.deepEqual(readFileSync(a.png), readFileSync(b.png), 'same inputs must produce byte-identical PNGs');
  assert.equal(a.receipt.output_sha256, sha(readFileSync(a.png)));
  assert.equal(a.receipt.status, 'PASS');
  assert.equal(a.receipt.grid_x, 64);
  assert.ok(a.receipt.checks.length >= 18);
  assert.ok(a.receipt.checks.every((row) => row.status === 'PASS'));
  assert.ok(a.receipt.checks.filter((row) => row.check === 'bbox_inside_and_symmetric_padding')
    .every((row) => row.bbox_inside && row.padding_asymmetry_px <= 2));
  assert.ok(a.receipt.checks.filter((row) => row.check === 'left_grid')
    .every((row) => Math.abs(row.delta_px) <= 2));

  const beforePng = join(temp, 'before.png');
  const beforeReceipt = join(temp, 'before.json');
  const before = run([script, '--mode', 'before', '--out', beforePng, '--receipt', beforeReceipt, ...common]);
  assert.equal(before.status, 0, before.stderr || before.stdout);
  assert.equal(JSON.parse(readFileSync(beforeReceipt, 'utf8')).status, 'REPRODUCTION_ONLY');
  assert.notDeepEqual(readFileSync(beforePng), readFileSync(a.png));

  const noFontOut = join(temp, 'must-not-exist.png');
  const noFont = run([script, '--out', noFontOut, '--receipt', join(temp, 'bad.json'),
    '--font-regular', join(temp, 'missing.otf'), '--font-bold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assert.notEqual(noFont.status, 0);
  assert.match(noFont.stderr, /FONT_LOAD_ERROR: font file not found/);
  assert.equal(existsSync(noFontOut), false, 'failed font load must not write a fallback-font artifact');

  const protectedFont = join(fonts, 'AESSansKR-Regular.otf');
  const collision = run([script, '--out', protectedFont, '--receipt', join(temp, 'collision.json'), ...common]);
  assert.notEqual(collision.status, 0);
  assert.match(collision.stderr, /OUTPUT_PATH_COLLISION: output\/receipt must not overwrite input/);
  const sameOutputs = run([script, '--out', join(temp, 'same.png'), '--receipt', join(temp, 'same.png'), ...common]);
  assert.notEqual(sameOutputs.status, 0);
  assert.match(sameOutputs.stderr, /OUTPUT_PATH_COLLISION: --out and --receipt/);
  console.log('trends.moa native layout geometry, fail-closed fonts, and PNG determinism: PASS');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
