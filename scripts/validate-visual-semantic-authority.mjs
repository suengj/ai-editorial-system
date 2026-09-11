#!/usr/bin/env node
import { validateVisualSemanticAuthority } from './lib/visual-semantic-authority-core.mjs';

const result = validateVisualSemanticAuthority();
if (!result.ok) {
  console.error(`visual-semantic-authority: FAIL — ${result.issues.length} issue(s)`);
  for (const entry of result.issues) console.error(`  [${entry.code}] ${entry.path} — ${entry.message}`);
  process.exit(1);
}

const counts = {};
for (const entry of result.registry.fields) {
  const key = `${entry.rendered_text}/${entry.prompt_semantics}/${entry.localized_repair}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log(`visual-semantic-authority: PASS — ${result.inventory.length} schema properties exactly classified (${Object.keys(counts).length} classification combinations)`);
