#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, validateVideoDocument } from './lib/video-plan-core.mjs';

const allow = resolve(ROOT, 'schemas/examples/video/allow');
const deny = resolve(ROOT, 'schemas/examples/video/deny');
let failures = 0;
function check(label, ok, detail = '') { if (ok) console.log(`  PASS ${label}`); else { failures++; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); } }
function read(dir, file) { return JSON.parse(readFileSync(resolve(dir, file), 'utf8')); }
function kind(file) { return ['video-plan', 'narration-script', 'tts-contract', 'bgm-catalog'].find((prefix) => file.startsWith(prefix)); }
console.log('video contract allow fixtures');
const renderSpecSchemaPath = resolve(ROOT, 'schemas/render-spec.schema.json');
const renderSpecSchema = JSON.parse(readFileSync(renderSpecSchemaPath, 'utf8'));
const watermarkPointer = '#/$defs/watermark';
check('watermark_ref target schema and pointer exist', existsSync(renderSpecSchemaPath) && Boolean(renderSpecSchema.$defs?.watermark) && renderSpecSchema.properties?.watermark?.$ref === watermarkPointer);
const allowFiles = readdirSync(allow).sort();
check('expected allow fixtures are present', allowFiles.length === 8, allowFiles.join(', '));
for (const file of allowFiles) {
  const doc = read(allow, file); const errors = validateVideoDocument(kind(file), doc);
  check(file, errors.length === 0, errors.map((e) => `[${e.code}] ${e.message}`).join('; '));
}
console.log('\nvideo contract deny fixtures');
const expected = new Map([
  ['narration-script-fabricated-quote.json', 'fabricated-quote'],
  ['video-plan-forced-6s.json', 'audio-duration-not-reconciled'],
  ['bgm-catalog-missing-license.json', 'schema'],
]);
for (const [file, code] of expected) {
  const errors = validateVideoDocument(kind(file), read(deny, file));
  check(`${file} rejected by ${code}`, errors.some((e) => e.code === code), errors.map((e) => `[${e.code}]`).join(', '));
}
const unverifiedTts = read(allow, 'tts-contract-neutral.json');
unverifiedTts.support = { status: 'verified_supported', checked_at: null, evidence_ref: null };
check('provider capability cannot be marked verified without evidence', validateVideoDocument('tts-contract', unverifiedTts).some((e) => e.code === 'tts-support-unevidenced'));
process.exit(failures ? 1 : 0);
