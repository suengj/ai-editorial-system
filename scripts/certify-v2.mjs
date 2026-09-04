#!/usr/bin/env node
/**
 * certify-v2 — AES-V2.11 (SUE-569).
 *
 * Runs every V2 gate and maps the results onto the V2 certification matrix.
 * Modeled directly on `scripts/certify-v1.mjs` — same discipline, four
 * statuses instead of two:
 *
 *   PASS      the check demonstrably ran and succeeded
 *   PARTIAL   the mechanism exists and is exercised by fixtures, but not by
 *             real operating evidence
 *   DEFERRED  intentionally out of V2 scope, with the boundary stated
 *   NOT_RUN   cannot be established from this repository, with the reason
 *
 * A document existing is not evidence (docs/architecture/REPOSITORY-CONTRACT.md).
 * This script never reports PASS on the strength of a file being present —
 * only on the strength of a check that ran and a fixture that was exercised.
 * Absence of a finding is a PASS only when the check demonstrably ran.
 *
 * Exit code is 0 regardless of PARTIAL/DEFERRED/NOT_RUN — those are honest,
 * expected outcomes at this stage of V2, not failures of this script. Exit
 * code is non-zero only if a gate that should mechanically pass did not, or
 * if this script's own execution failed.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const runNpm = (script) => {
  try {
    execFileSync('npm', ['run', '--silent', script], { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

const runNode = (relScript, ...args) => {
  try {
    execFileSync('node', [relScript, ...args], { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

const has = (...paths) => paths.every((p) => existsSync(resolve(ROOT, p)));
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const countFiles = (dir, pattern) => {
  const full = resolve(ROOT, dir);
  if (!existsSync(full)) return 0;
  return readdirSync(full).filter((f) => (pattern ? pattern.test(f) : true)).length;
};

/** Every gate this script can mechanically run, run once. */
const gates = {
  validate: runNpm('validate'),
  test: runNpm('test'),
  eval: runNpm('eval'),
  matrix: runNpm('matrix'),
  'certify:v1': runNpm('certify'),
  'system-scorecard:validate': runNode('scripts/system-scorecard.mjs', '--validate'),
  'system-scorecard:check': runNode('scripts/system-scorecard.mjs', '--check'),
  'calibration:validate': runNode('scripts/calibration.mjs', '--validate'),
  'test:calibration': runNode('scripts/test-calibration.mjs'),
  'validate:intent': runNpm('validate:intent'),
  'test:intent': runNpm('test:intent'),
  'validate:visual': runNpm('validate:visual'),
  'test:visual': runNpm('test:visual'),
  'validate:audio': runNpm('validate:audio'),
  'test:audio': runNpm('test:audio'),
  'validate:routing': runNpm('validate:routing'),
  'test:routing': runNpm('test:routing'),
  'validate:corpus': runNpm('validate:corpus'),
  'validate:package': runNpm('validate:package'),
  'test:package': runNpm('test:package'),
  'validate:registry': runNpm('validate:registry'),
  'registry:check': runNpm('registry:check'),
  'validate:profiles': runNpm('validate:profiles'),
  'test:profiles': runNpm('test:profiles'),
};

const all = (...names) => names.every((n) => gates[n]);

/** Real (non-synthetic, non-placeholder) evidence counters, read honestly. */
const evidence = {
  feedbackRecords: countFiles('feedback/records', /\.json$/),
  feedbackRecordsDogfood: countFiles('feedback/records', /^dogfood-.*\.json$/),
  calibrationLedgerRecords: countFiles('calibration/ledger', /\.json$/),
  calibrationVersions: countFiles('calibration/versions', /\.json$/),
  referenceEvaluationsExternal: (() => {
    try {
      const idx = JSON.parse(read('references/index.json'));
      return idx.counts?.by_provenance_class ?? {};
    } catch {
      return {};
    }
  })(),
  corpusEntries: countFiles('evals/real-output-corpus/entries', /\.json$/),
  visualJobExamples: countFiles('schemas/examples', /^visual-job-.*\.example\.json$/),
  audioPlanExamples: countFiles('schemas/examples', /^audio-plan-.*\.example\.json$/),
  surfaceProfiles: countFiles('editorial/profiles/surface', /\.json$/),
};

const MATRIX = [
  {
    id: 1,
    name: 'Text path — contracts, Skills, L0/L1, routing',
    status: () =>
      all(
        'validate:intent', 'test:intent', 'validate:routing', 'test:routing',
        'validate', 'test', 'eval',
      ) ? 'PARTIAL' : 'NOT_RUN',
    evidence:
      'validate:intent, test:intent, validate:routing, test:routing, npm run eval (L0 fixture '
      + 'regression + calibration comparison), npm test (skills pipeline, L1 review fixtures).',
    caveat:
      'Every contract, Skill, and gate is exercised — but only against fixtures and worked '
      + 'schema examples (schemas/examples/intent-*.example.json). No real owner-reviewed article '
      + `has gone through intake → intent → frame/write → L0/L1 → routed feedback in this repository. `
      + `feedback/records/ holds ${evidence.feedbackRecords} record(s): ${evidence.feedbackRecordsDogfood} real `
      + `agent dogfood record(s) (evals/dogfood/) and ${evidence.feedbackRecords - evidence.feedbackRecordsDogfood} `
      + 'synthetic seed example(s), all with owner_verdict unknown (per evals/system/current.json, dimension '
      + 'quality_lift). Mechanism proven; operating evidence absent.',
  },
  {
    id: 2,
    name: 'Visual path — profiles, brand, lineage, pre-render gates',
    status: () =>
      all('validate:visual', 'test:visual', 'validate:package', 'test:package', 'validate:registry') ? 'PARTIAL' : 'NOT_RUN',
    evidence:
      `validate:visual, test:visual (${evidence.visualJobExamples} visual-job examples exercised: `
      + 'body-infographic, evidence-visual, skip, thumbnail-concept), schemas/visual-job.schema.json '
      + '#context_isolation (SUE-531 fix, required allowlist, not optional) and #information_gain '
      + '(SUE-534 gate), both schema-enforced and fixture-tested.',
    caveat:
      'The two pre-render gates (context isolation, information gain) and the brand-profile/renderer '
      + 'lineage are real, executable contracts covered by allow/deny fixtures — not aspirational '
      + 'documentation. This is not virgin territory for rendering in general: evals/poc/cost-stack.svg '
      + 'predates this branch, and evals/dogfood/2026-09-05-run-01 compiled a real compiled_prompt through '
      + 'a real visual job and rendered and inspected the resulting chart through the existing V1 '
      + '(deterministic, code-driven) chart renderer. But no *generative* image — one produced by an '
      + 'image-generation model rather than a deterministic renderer, which is what most visual-job '
      + 'artifact classes (e.g. thumbnail-concept) actually call for — has ever been rendered or inspected '
      + 'anywhere in this repository or its history. SUE-569 explicitly asks for that asset QA; it has not '
      + 'happened for the generative path.',
  },
  {
    id: 3,
    name: 'Audio — planning and script contract',
    status: () => 'DEFERRED',
    evidence:
      `validate:audio, test:audio (${evidence.audioPlanExamples} audio-plan examples: monologue, `
      + 'dialogue, timed-narration), schemas/audio-plan.schema.json#cost, script L1 pre-TTS gate '
      + 'enforced by deny fixtures (render before script_l1 passes, SSML/stage-direction leaks, '
      + 'persona-disclosure violations all rejected).',
    caveat:
      'TTS rendering itself has never been exercised — no audio has been generated, and no rendered '
      + 'QA exists. This is deferred by design (V2-EDITORIAL-LEARNING-CORE.md §13: "Audio is explicitly '
      + 'deferred from the pilot and must be described as deferred — not as working — wherever V2 '
      + 'capability is summarised"). Boundary: planning/script contract is real and gated; rendering is '
      + 'out of V2 scope pending SUE-570+.',
  },
  {
    id: 4,
    name: 'P03 → transformation → Editorial/Knowledge Package → adapter',
    status: () =>
      all('validate:package', 'test:package', 'validate:intent') ? 'PARTIAL' : 'NOT_RUN',
    evidence:
      'validate:package, test:package — schemas/editorial-package.schema.json exercised by its '
      + 'five worked examples; schemas/EDITORIAL-PACKAGE-CONTRACT.md documents adapter-neutral handoff.',
    caveat:
      'The five worked examples are synthetic constructions built to exercise the schema, not real '
      + 'P03 output carried through transformation into a package and out through an adapter. No '
      + 'live P03 → package → suengj.com/NotebookLM run exists in this repository.',
  },
  {
    id: 5,
    name: 'Non-suengj.com profile / genuinely generic capability',
    status: () => (all('validate:profiles', 'test:profiles') ? 'PARTIAL' : 'NOT_RUN'),
    evidence:
      `editorial/profiles/surface/ holds ${evidence.surfaceProfiles} surface profiles — `
      + 'academic-paper, newsletter, notebooklm, suengj-com, youtube-script — plus content profiles '
      + 'academic.json and promotional.json under editorial/profiles/content/. validate:profiles, '
      + 'test:profiles pass against all of them.',
    caveat:
      'These profiles are well-formed data files that validate against the shared axis schema and '
      + 'declare an honest authority/constraint split (e.g. academic-paper.json: "core_decides: '
      + 'evidence burden, verification, and voice fit up to the point of hand-off"). That proves the '
      + 'axis architecture accepts non-suengj.com data without a core change. It does NOT prove generic '
      + 'capability: no intent has ever been resolved end-to-end against any of these profiles, no '
      + 'text/visual has actually been produced under one, and no human has judged the result. A '
      + 'profile existing is not the same claim as the system genuinely serving that audience/surface.',
  },
  {
    id: 6,
    name: 'Feedback persisted and routed without manual JSON editing',
    status: () => (all('validate:registry', 'registry:check', 'validate:routing', 'test:routing') ? 'PARTIAL' : 'NOT_RUN'),
    evidence:
      'validate:registry, registry:check (feedback/index.json rebuilds deterministically and is '
      + 'fresh), validate:routing/test:routing exercise editorial/feedback-routing.json against '
      + `${evidence.feedbackRecords} feedback record(s) plus 5 worked routing examples, including a `
      + 'legitimate abstention case (feedback:routing-unclear-2026-09-05, routing.abstained: true).',
    caveat:
      'The protocol, schema, and validators are real and enforced — an agent appending a feedback '
      + 'record and rebuilding the index is a mechanically checked path, not aspiration. But this is '
      + 'a separate claim from "an agent has taken a natural-language utterance from the owner and '
      + 'persisted + routed it end to end without the owner touching JSON." No such session is on '
      + `record: ${evidence.feedbackRecordsDogfood} of ${evidence.feedbackRecords} feedback record(s) are real agent `
      + 'dogfood output (agent-authored L1 self-review, owner_verdict unknown), and the rest are seed/fixture data — '
      + 'none originates from an owner’s natural-language utterance persisted and routed without the owner '
      + 'touching JSON. The mechanism is proven; the owner-utterance-to-persisted-record loop is not.',
  },
  {
    id: 7,
    name: 'Calibration/tuning record — real keep-or-change decision',
    status: () => (all('calibration:validate', 'test:calibration') ? 'PARTIAL' : 'NOT_RUN'),
    evidence:
      `calibration:validate, test:calibration — calibration/ledger holds `
      + `${evidence.calibrationLedgerRecords} experiment record(s); calibration/versions holds `
      + `${evidence.calibrationVersions} version(s) (audience-beginner-learner.v1, audience-domain-expert.v1).`,
    caveat:
      'calibration/ledger/reference-selection-2026-09-05.json is explicitly authored, in its own '
      + '"notes" field, as a "SHAPE DEMONSTRATION ... of an honest insufficient_evidence decision" — '
      + 'it proves the ledger can record "we looked and could not yet justify a change" as a '
      + 'first-class outcome, which is real and valuable, but it is not a keep-or-change decision '
      + 'backed by repeated independent evidence or an explicit owner declaration (V2-EDITORIAL-'
      + 'LEARNING-CORE.md §6). No calibration version in the repository has survived real use, '
      + 'reversion pressure, or contradiction with another active preference.',
  },
  {
    id: 8,
    name: 'Cross-agent portability / interpretation regression',
    status: () => 'PARTIAL',
    evidence:
      'evals/system/portability/2026-09-05-portability-probe.md — one utterance, one frozen '
      + 'contract state, four routes scored on all six semantic contracts. Three Claude tiers '
      + '(Haiku 4.5 / Sonnet 5 / Opus 5) plus one genuine non-Anthropic route (OpenAI '
      + 'open-weights gpt-oss:120b via ollama). Transformation, audience, surface, artifact id '
      + 'and the routing layer id agreed ACROSS the vendor boundary. The content-type '
      + 'materiality gate failed on the weakest Claude route and on the cross-vendor route, '
      + 'both by fabricating an authority the contract does not contain — routed to the '
      + 'contract, not to a prompt, and fixed by scripts/lib/materiality-core.mjs.',
    caveat:
      'PARTIAL, not PASS, for three stated reasons: the completed non-Anthropic route (ollama) '
      + 'cannot browse a filesystem, so contracts were supplied in-context rather than discovered, '
      + 'which tests interpretation but not discovery; only one of three non-Anthropic routes '
      + 'completed (gemini needs interactive auth, deepseek returned nothing); and the strongest '
      + 'vendor route, OpenAI codex — authenticated on this machine — is quota-blocked until '
      + '2026-09-07 and should be rerun then for a full-strength result. An earlier draft recorded '
      + 'this area NOT_RUN on the stated grounds that no non-Claude route was available; that was '
      + 'asserted without checking the machine and was wrong. The full-strength method remains:\n'
      + '    Task: resolve one small, representative Editorial Intent from a natural-language request\n'
      + '    that has a materially ambiguous transformation/audience/surface read (e.g. the §3 example\n'
      + '    "make it a thumbnail" case, or a request that could be task-local vs durable feedback),\n'
      + '    then route one piece of natural-language feedback on a fixture output.\n'
      + '    Repository state: pin the commit SHA at execution time; both routes must read the exact\n'
      + '    same commit of this repository, with no route-specific prompt scaffolding beyond a thin\n'
      + '    adapter (per V2-EDITORIAL-LEARNING-CORE.md §8, "Generic Core, replaceable edges").\n'
      + '    Routes: (a) a Claude-family agent (e.g. Claude Code) and (b) a materially different model\n'
      + '    family with comparable agentic tool access (e.g. an OpenAI/ChatGPT or Codex-style route).\n'
      + '    Compare six semantic contracts, not prose or image style:\n'
      + '      1. Editorial Intent — do both routes resolve the same five axes to the same\n'
      + '         confirmed/assumed/missing_material states from the same utterance?\n'
      + '      2. Clarification decision — do both ask (or not ask) on the same missing_material\n'
      + '         fields, and offer equivalent choices with a default?\n'
      + '      3. Source vs Reference — do both correctly refuse to let a reference establish a fact,\n'
      + '         and correctly refuse to let a source dictate composition?\n'
      + '      4. Audience/profile selection — do both select the same audience/surface profile file\n'
      + '         for the same request, not merely a similar-sounding one?\n'
      + '      5. Calibration interpretation — do both read calibration/current.json the same way and\n'
      + '         refuse to promote an assumed value into durable preference (the calibration firewall,\n'
      + '         §4)?\n'
      + '      6. Feedback routing — do both route the same complaint to the same layer in\n'
      + '         editorial/feedback-routing.json, or both correctly abstain if the evidence is\n'
      + '         genuinely insufficient?\n'
      + '    Distinguishing style from contract failure: a style difference is any variation in prose\n'
      + '    wording, image composition detail, or phrasing that does not change which axis value,\n'
      + '    which profile file, which routing layer, or which authority-class action was selected. A\n'
      + '    contract-interpretation failure is any case where the two routes select a different axis\n'
      + '    state, profile file, routing layer, or write-authority class for the same input and the\n'
      + '    same repository state. Record the comparison as a system-eval snapshot evidence_ref\n'
      + '    (evals/system/) or a dedicated portability record — do not fold it into feedback/records,\n'
      + '    which is scoped to output judgement, not agent-comparison.\n'
      + '    If it fails: per SUE-569, route the failure to ambiguous contracts/profile loading first,\n'
      + '    before adding agent-specific prompt hacks. Agent-specific adapters must stay thin; shared\n'
      + '    editorial semantics stay in this repository, not in a per-agent prompt fork.',
  },
];

console.log('AI Editorial System — V2 certification (AES-V2.11 / SUE-569)\n');

const failedGates = Object.entries(gates).filter(([, ok]) => !ok).map(([n]) => n);
console.log(`gates: ${Object.keys(gates).length - failedGates.length}/${Object.keys(gates).length} passing`);
if (failedGates.length > 0) console.log(`failing: ${failedGates.join(', ')}`);
console.log('');

const counts = { PASS: 0, PARTIAL: 0, DEFERRED: 0, NOT_RUN: 0 };
for (const item of MATRIX) {
  const status = item.status();
  counts[status] += 1;
  console.log(`${String(item.id).padStart(2)}. ${status.padEnd(9)} ${item.name}`);
  console.log(`    evidence: ${item.evidence}`);
  if (item.caveat) console.log(`    caveat:   ${item.caveat.split('\n').join('\n              ')}`);
}

console.log('');
console.log(
  `matrix: ${counts.PASS} pass, ${counts.PARTIAL} partial, ${counts.DEFERRED} deferred, `
  + `${counts.NOT_RUN} not_run (of ${MATRIX.length} certification areas)`,
);
console.log(
  '\nThis is the expected mix at this stage of V2, not a failure of this script. A clean sheet of '
  + 'PASS here would itself be evidence of overstatement — see docs/architecture/V2-CERTIFICATION.md.',
);

// This script's own execution fails (non-zero exit) only when a gate that
// exists to mechanically pass or fail did not run cleanly — never because a
// certification-matrix row is honestly PARTIAL/DEFERRED/NOT_RUN.
process.exit(failedGates.length === 0 ? 0 : 1);
