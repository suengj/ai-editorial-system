#!/usr/bin/env node
/** Bounded register/rebuild and direct lookup. No discovery outside the allowlist. */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALLOWLIST, INDEX, ROOT, assertPreviousRevision, buildIndex, lookupContent, readManifests, readYaml, serializeIndex, validateArtifactTransition, CODES } from './lib/content-index-core.mjs';

const args = process.argv.slice(2);
const mode = args[0];
const option = (name) => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
const help = () => { console.error('usage: node scripts/content-index.mjs --rebuild [--allowlist PATH] [--index PATH] [--manifest LOCATOR --previous-revision N] | --lookup CONTENT_ID [--allowlist PATH]'); process.exit(2); };
try {
  if (mode === '--lookup') {
    const result = lookupContent(args[1], ROOT, resolve(option('--allowlist') ?? ALLOWLIST));
    console.log(`${result.manifest.content_id}\t${result.locator}\trevision=${result.manifest.revision}\tstatus=${result.manifest.status}`);
    process.exit(0);
  }
  if (mode !== '--rebuild') help();
  const allowlist = resolve(option('--allowlist') ?? ALLOWLIST);
  const indexPath = resolve(option('--index') ?? INDEX);
  const previous = option('--previous-revision');
  const rows = readManifests(ROOT, allowlist);
  const old = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;
  let parsedOld = null;
  try { if (old !== null) parsedOld = readYaml(indexPath); } catch (err) { if (previous !== null) throw new Error(`[concurrent-update-conflict] prior index is corrupt: ${err.message}`); }
  if (previous !== null) {
    const locator = args[args.indexOf('--manifest') + 1];
    const target = rows.find((row) => row.locator === locator);
    if (!locator || !target) throw new Error(`unknown locator: ${locator}`);
    const indexed = (parsedOld?.items ?? []).find((item) => item.content_id === target.manifest.content_id);
    const expected = Number(previous);
    assertPreviousRevision(indexed?.revision, target.manifest.revision, expected);
    if (indexed?.manifest) {
      const previousManifest = readYaml(resolve(ROOT, indexed.manifest));
      const transitionIssues = validateArtifactTransition(previousManifest, target.manifest);
      if (transitionIssues.length) throw new Error(`[${CODES.STALE}] ${transitionIssues.map((i) => i.message).join('; ')}`);
    }
  }
  const output = serializeIndex(buildIndex(rows));
  // Re-read immediately before replacement so sequential or overlapping stale writers fail closed.
  const latest = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;
  if (latest !== old) throw new Error(`[${CODES.CONFLICT}] index changed while rebuilding`);
  const temp = `${indexPath}.${process.pid}.tmp`;
  writeFileSync(temp, output, { flag: 'wx' });
  renameSync(temp, indexPath);
  console.log(`content-index: rebuilt ${rows.length} item(s) from ${allowlist}`);
} catch (err) {
  console.error(`content-index: FAIL — ${err.message}`);
  process.exitCode = 1;
}
