#!/usr/bin/env node
/** Bounded register/rebuild and direct lookup. No discovery outside the allowlist. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, assertManifestRevision, assertPreviousRevision, buildIndex, lookupContent, readManifests, readYaml, serializeIndex, validateArtifactTransition, CODES } from './lib/content-index-core.mjs';

const args = process.argv.slice(2);
const mode = args[0];
const option = (name) => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
const help = () => { console.error('usage: node scripts/content-index.mjs --rebuild --allowlist PATH --index PATH [--manifest LOCATOR --previous-revision N] | --lookup CONTENT_ID --allowlist PATH'); process.exit(2); };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function snapshot(path) {
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  return { mtimeMs: statSync(path).mtimeMs, hash: hash(bytes), text: bytes.toString('utf8') };
}
function sameSnapshot(a, b) {
  return a === null ? b === null : b !== null && a.mtimeMs === b.mtimeMs && a.hash === b.hash;
}
try {
  const allowlistArg = option('--allowlist');
  if (!allowlistArg) help();
  const allowlist = resolve(allowlistArg);
  if (mode === '--lookup') {
    const result = lookupContent(args[1], ROOT, allowlist);
    console.log(`${result.manifest.content_id}\t${result.locator}\tproducer=${result.manifest.producer_id}\trevision=${result.manifest.revision}\tstatus=${result.manifest.status}`);
    process.exit(0);
  }
  if (mode !== '--rebuild') help();
  const indexArg = option('--index');
  if (!indexArg) help();
  const indexPath = resolve(indexArg);
  const previous = option('--previous-revision');
  const rows = readManifests(ROOT, allowlist);
  const before = snapshot(indexPath);
  let parsedOld = null;
  try {
    if (before !== null) {
      const candidate = readYaml(indexPath);
      if (candidate?.schema_version === '1.0.0' && Array.isArray(candidate.items)) parsedOld = candidate;
    }
  } catch { /* A rebuild may repair a corrupt index. */ }
  const existing = new Map((parsedOld?.items ?? []).map((item) => [item.content_id, item]));
  for (const row of rows) {
    const indexed = existing.get(row.manifest.content_id);
    const manifestHash = hash(readFileSync(row.path));
    assertManifestRevision(indexed, row.manifest.revision, manifestHash);
  }
  if (previous !== null) {
    const locator = args[args.indexOf('--manifest') + 1];
    const target = rows.find((row) => row.locator === locator);
    if (!locator || !target) throw new Error(`unknown locator: ${locator}`);
    const indexed = existing.get(target.manifest.content_id);
    const expected = Number(previous);
    assertPreviousRevision(indexed?.revision, target.manifest.revision, expected);
    const previousRow = rows.find((row) => row.locator === indexed?.manifest);
    if (previousRow) {
      const previousManifest = readYaml(previousRow.path);
      const transitionIssues = validateArtifactTransition(previousManifest, target.manifest);
      if (transitionIssues.length) throw new Error(`[${CODES.STALE}] ${transitionIssues.map((i) => i.message).join('; ')}`);
    }
  }
  const output = serializeIndex(buildIndex(rows));
  const temp = `${indexPath}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, output, { flag: 'wx' });
    const after = snapshot(indexPath);
    if (!sameSnapshot(before, after)) throw new Error(`[${CODES.CONFLICT}] index changed while rebuilding`);
    renameSync(temp, indexPath);
  } finally {
    try { unlinkSync(temp); } catch {}
  }
  console.log(`content-index: rebuilt ${rows.length} item(s) from ${allowlist}`);
} catch (err) {
  console.error(`content-index: FAIL — ${err.message}`);
  process.exitCode = 1;
}
