#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, validateVideoDocument } from './lib/video-plan-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLOW = resolve(ROOT, 'schemas/examples/video/allow');
const files = process.argv.slice(2).length ? process.argv.slice(2).map((p) => resolve(p)) : readdirSync(ALLOW).map((f) => resolve(ALLOW, f));
let failures = 0;
for (const file of files) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const name = file.split('/').at(-1);
  const kind = ['video-plan', 'narration-script', 'tts-contract', 'bgm-catalog'].find((prefix) => name.startsWith(prefix));
  const issues = validateVideoDocument(kind, doc);
  if (!issues.length) console.log(`video-contract: PASS — ${relative(ROOT, file)}`);
  else { failures++; console.error(`video-contract: FAIL — ${relative(ROOT, file)} (${issues.length})`); for (const e of issues) console.error(`  [${e.code}] ${e.where} — ${e.message}`); }
}
process.exit(failures ? 1 : 0);
