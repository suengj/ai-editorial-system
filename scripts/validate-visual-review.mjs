#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'; import { resolve } from 'node:path'; import { validateVisualFixture, validateVisualReview } from './lib/visual-review-core.mjs';
let bad=0; for(const f of readdirSync('evals/visual-review/fixtures/negative')){const issues=validateVisualFixture(JSON.parse(readFileSync(resolve('evals/visual-review/fixtures/negative',f),'utf8')));if(issues.length){bad++;console.error(`${f}: ${issues.map(x=>x.code).join(',')}`)}}
// The review-record path is opt-in for the committed corpus and is used by
// fixture/CI callers. It deliberately calls the natural default consumer
// without injecting a visual job owner; verified-fact records must carry their
// own durable binding, whose job_ref/job_sha256 resolves the authoritative
// RenderSpec/job and whose factual check is digest-bound.
const reviewDir = process.env.VISUAL_REVIEW_RECORDS;
if (reviewDir) {
  for (const f of readdirSync(reviewDir).filter((name) => name.endsWith('.json'))) {
    let record;
    try { record = JSON.parse(readFileSync(resolve(reviewDir, f), 'utf8')); } catch { bad++; console.error(`${f}: visual-review-json-parse`); continue; }
    const issues = validateVisualReview(record, { feedbackDir: process.env.VISUAL_FEEDBACK_DIR ? resolve(process.env.VISUAL_FEEDBACK_DIR) : undefined });
    if (issues.length) { bad++; console.error(`${f}: ${issues.map((x) => x.code).join(',')}`); }
  }
}
console.log(bad?'visual-review: FAIL':'visual-review: PASS');process.exit(bad?1:0);
