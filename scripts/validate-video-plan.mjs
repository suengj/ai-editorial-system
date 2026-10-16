#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, resolveLocalSourceEvidence, validateVideoDocument } from './lib/video-plan-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLOW = resolve(ROOT, 'schemas/examples/video/allow');
const files = process.argv.slice(2).length ? process.argv.slice(2).map((p) => resolve(p)) : readdirSync(ALLOW).map((f) => resolve(ALLOW, f));
const records = files.map((file) => {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const name = file.split('/').at(-1);
  const kind = ['video-critique', 'video-plan-v2', 'narration-script-v2', 'audio-plan-v2', 'bgm-catalog-v2', 'video-qa', 'video-plan', 'narration-script', 'tts-contract', 'bgm-catalog'].find((prefix) => name.startsWith(prefix));
  return { file, doc, name, kind };
});
const plans = new Map(records.filter((r) => r.kind === 'video-plan-v2').map((r) => [r.doc.plan_id, r.doc]));
const scripts = new Map(records.filter((r) => r.kind === 'narration-script-v2').map((r) => [r.doc.script_id, r.doc]));
let failures = 0;
for (const { file, doc, kind } of records) {
  const planRef = doc.video_plan_ref ?? doc.plan_ref;
  const scriptRef = doc.script_ref;
  const videoPlan = kind === 'video-plan-v2' ? doc : planRef && plans.has(planRef) ? plans.get(planRef) : null;
  const context = {
    ...(videoPlan ? { videoPlan, verifiedProtectedSpans: resolveLocalSourceEvidence(videoPlan) } : {}),
    ...(scriptRef && scripts.has(scriptRef) ? { narrationScript: scripts.get(scriptRef) } : {}),
  };
  const issues = validateVideoDocument(kind, doc, context);
  if (!issues.length) console.log(`video-contract: PASS — ${relative(ROOT, file)}`);
  else { failures++; console.error(`video-contract: FAIL — ${relative(ROOT, file)} (${issues.length})`); for (const e of issues) console.error(`  [${e.code}] ${e.where} — ${e.message}`); }
}
process.exit(failures ? 1 : 0);
