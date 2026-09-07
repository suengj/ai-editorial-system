#!/usr/bin/env node
/** SUE-643 reference retrieval: registry-only visual craft candidates. */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryVisualReferenceEvaluations } from './lib/registry-core.mjs';
import { validateReferenceAuthority, validateRenderSpec, validateVisualBrief } from './lib/visual-job-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

function candidatesFor(brief) {
  return queryVisualReferenceEvaluations({
    ...brief.reference_requirements,
    artifact_profile: brief.artifact_profile,
  });
}

function report(issues) {
  if (issues.length === 0) return 0;
  for (const i of issues) console.error(`[${i.code}] ${i.where} — ${i.message}`);
  return 1;
}

const [,, mode, arg] = process.argv;
if (mode === '--brief' && arg) {
  const brief = read(resolve(arg));
  const issues = validateVisualBrief(brief, arg);
  if (issues.length) process.exit(report(issues));
  console.log(JSON.stringify(candidatesFor(brief), null, 2));
  process.exit(0);
}
if (mode === '--validate' && arg) {
  const renderSpec = read(resolve(arg));
  const issues = [...validateRenderSpec(renderSpec, arg), ...validateReferenceAuthority(renderSpec, {}, arg)];
  process.exit(report(issues));
}
if (mode === '--validate-examples') {
  const dir = resolve(ROOT, 'schemas/examples');
  const issues = [];
  for (const file of readdirSync(dir).filter((f) => f.startsWith('visual-job-') && f.endsWith('.example.json')).sort()) {
    const job = read(resolve(dir, file));
    if (!job.visual_brief && !job.render_spec) continue;
    issues.push(...validateVisualBrief(job.visual_brief, file));
    issues.push(...validateRenderSpec(job.render_spec, file));
    issues.push(...validateReferenceAuthority(job.render_spec, { ...job.visual_brief.reference_requirements, artifact_profile: job.artifact_profile }, file));
  }
  if (issues.length === 0) console.log('visual-reference: PASS — V2 example authority contracts resolve through registry only');
  process.exit(report(issues));
}
console.error('usage: node scripts/resolve-visual-references.mjs --brief <visual-brief.json> | --validate <render-spec.json> | --validate-examples');
process.exit(2);
