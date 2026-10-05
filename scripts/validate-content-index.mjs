#!/usr/bin/env node
import { INDEX, buildIndex, readManifests, serializeIndex } from './lib/content-index-core.mjs';
import { readFileSync } from 'node:fs';
const rows = readManifests();
const expected = serializeIndex(buildIndex(rows));
let ok = false;
try { ok = readFileSync(INDEX, 'utf8') === expected; } catch {}
if (!ok) { console.error('content-index: FAIL — index missing, corrupt, or stale; run npm run content-index:rebuild'); process.exit(1); }
console.log(`content-index: PASS — ${rows.length} bounded manifest(s)`);
