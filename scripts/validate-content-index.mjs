#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, buildIndex, readManifests, serializeIndex } from './lib/content-index-core.mjs';

const FIXTURE = resolve(ROOT, 'scripts/fixtures/content-index');
const ALLOWLIST = resolve(FIXTURE, 'contents-allowed.yaml');
const INDEX = resolve(FIXTURE, 'contents-index.yaml');
const rows = readManifests(ROOT, ALLOWLIST);
const expected = serializeIndex(buildIndex(rows));
let ok = false;
try { ok = readFileSync(INDEX, 'utf8') === expected; } catch {}
if (!ok) { console.error('content-index: FAIL — fixture index missing, corrupt, or stale'); process.exit(1); }
console.log(`content-index: PASS — ${rows.length} fixture manifest(s)`);
