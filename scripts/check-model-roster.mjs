#!/usr/bin/env node
/**
 * check-model-roster — AES-V2 FIX (B7 item 4)
 *
 * Flags — never fails — a persisted L1 review or editorial package whose
 * runtime differs from calibration/model-roster.json's approved pin for its
 * role. schemas/MODEL-DRIFT-CONTRACT.md: "A new model must be usable to be
 * evaluated; it must simply be visible." This is the visibility check, not
 * the gate — a mismatch is reported so it can be run through the §2
 * regression before it becomes a silent default, never blocked outright.
 *
 * Role mapping used here (the roster's roles are owned by
 * schemas/experiment-record.schema.json's model_drift.role_outcomes[].role
 * enum, not redefined by this script):
 *   - an l1-review record's `reviewer.agent` -> role "reviewer_l1"
 *   - an editorial-package's `lineage.produced_by.tool` -> role "writer"
 *     (the text-generation path this fix closes the coverage gap for)
 *
 * Usage: node scripts/check-model-roster.mjs [examples-dir]
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const rel = (p) => relative(ROOT, p) || p;

const ROSTER_PATH = resolve(ROOT, 'calibration/model-roster.json');
const EXAMPLES_DIR = resolve(process.argv[2] ?? resolve(ROOT, 'schemas/examples'));

const roster = JSON.parse(readFileSync(ROSTER_PATH, 'utf8'));
const approved = new Map(roster.roster.map((r) => [r.role, r]));

function runtimeKey(r) {
  return `${r.provider}/${r.model}@${r.model_version}`;
}

function differs(pin, runtime) {
  if (!pin || !runtime) return false;
  return pin.provider !== runtime.provider ||
    pin.model !== runtime.model ||
    pin.model_version !== runtime.model_version;
}

let flags = 0;
let checked = 0;

// --- l1-review records -> role reviewer_l1 ----------------------------------
const l1Path = resolve(EXAMPLES_DIR, 'l1-review.example.json');
try {
  const { records } = JSON.parse(readFileSync(l1Path, 'utf8'));
  const pin = approved.get('reviewer_l1');
  for (const r of records ?? []) {
    const runtime = r.reviewer?.agent;
    if (!runtime) continue;
    checked += 1;
    if (differs(pin, runtime)) {
      flags += 1;
      console.log(`model-roster: FLAG — ${rel(l1Path)} [${r.review_id}] reviewer_l1 runtime ${runtimeKey(runtime)} differs from the approved pin ${runtimeKey(pin)}`);
    }
  }
} catch {
  // no l1-review examples to check
}

// --- editorial packages -> role writer ---------------------------------------
let packageFiles = [];
try {
  packageFiles = readdirSync(EXAMPLES_DIR).filter((f) => f.startsWith('package-') && f.endsWith('.example.json'));
} catch {
  // no examples directory
}
const writerPin = approved.get('writer');
for (const f of packageFiles) {
  const path = resolve(EXAMPLES_DIR, f);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  const runtime = pkg.lineage?.produced_by?.tool;
  if (!runtime) continue;
  checked += 1;
  if (differs(writerPin, runtime)) {
    flags += 1;
    console.log(`model-roster: FLAG — ${rel(path)} produced_by.tool (writer) runtime ${runtimeKey(runtime)} differs from the approved pin ${runtimeKey(writerPin)}`);
  }
}

console.log(flags === 0
  ? `model-roster: 0 flags across ${checked} checked record(s) — every runtime matches its role's approved pin`
  : `model-roster: ${flags} flag(s) across ${checked} checked record(s) — visible, not blocking (schemas/MODEL-DRIFT-CONTRACT.md §3)`);

// Flagging only: this script never fails the build.
process.exit(0);
