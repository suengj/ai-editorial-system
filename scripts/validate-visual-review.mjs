#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'; import { resolve } from 'node:path'; import { validateVisualFixture } from './lib/visual-review-core.mjs';
let bad=0; for(const f of readdirSync('evals/visual-review/fixtures/negative')){const issues=validateVisualFixture(JSON.parse(readFileSync(resolve('evals/visual-review/fixtures/negative',f),'utf8')));if(issues.length){bad++;console.error(`${f}: ${issues.map(x=>x.code).join(',')}`)}}console.log(bad?'visual-review: FAIL':'visual-review: PASS');process.exit(bad?1:0);
