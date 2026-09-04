# Context and cost budgets (AES-V2.10 / SUE-568)

Concretizes `../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §9 ("Context
and cost are budgeted") one level down: what actually loads at each stage,
how its size is recorded, which model class each stage uses, and how retry
is bounded. This document does not redefine §9's ordering — it operationalizes
it.

## 1. Bounded progressive loading

```text
intake / router
  → minimum core + only the profiles this intent selects   (§9; editorial/profiles/**)
  → current calibration snapshot, not its history           (calibration/current.json)
  → 1-3 relevant reference evaluations, not the corpus       (references/evaluations/**)
  → task / source context                                   (the actual source/reference material for this task)
  → generate / review
```

Each arrow is a hard boundary, not a preference:

| Stage | Loads | Never loads |
|---|---|---|
| intake/router | `editorial/profiles/axes.json` + the axis values this request plausibly resolves to | every profile under `editorial/profiles/**` |
| profile selection | the specific transformation/content/audience/surface/artifact profile files the resolved intent names | sibling profiles for axis values not selected |
| calibration | `calibration/current.json` (the derived active-snapshot index) plus, for the scopes this task actually touches, the one active `calibration/versions/*.json` file each names | `calibration/versions/*.json` for scopes outside this task; any `superseded` version |
| reference | 1-3 `references/evaluations/**` records selected by `applicable_to` match (content type × audience × artifact × surface) | `references/catalog.json` in full; the reference body itself (loaded only when the compact evaluation record is demonstrably insufficient — V2 §9) |
| feedback | nothing, by default | `feedback/records/**` in bulk — feedback informs calibration and the experiment ledger, which are what generation actually reads; raw feedback history is never re-loaded per task |
| task/source | the source(s) or reference(s) this specific task names | prior unrelated tasks' source material (also the `context_isolation` firewall in `schemas/visual-job.schema.json`) |

This is the same boundary `schemas/visual-job.schema.json`'s
`context_isolation.permitted_inputs`/`excluded` already enforces for visual
jobs (`excluded: ["ambient_conversation", "unrelated_project_state",
"prior_unrelated_jobs", "renderer_runtime_identity"]`) — this document states
the general rule the visual pipeline is one instance of.

## 2. Recording context size per stage

Where a runtime exposes token/context accounting, a major stage records a
compact size proxy alongside its lineage fields — not a new telemetry
system, per V2 §11 ("no new per-output record type"). The existing homes
already carry the field or a natural place for one:

- **job/plan records** (`schemas/visual-job.schema.json`,
  `schemas/audio-plan.schema.json`) already record `attempts`/`max_attempts`
  and cost fields; a context-size estimate for the compiled input set is a
  natural sibling field on the same record, not a new schema.
- **experiment ledger** (`schemas/experiment-record.schema.json`
  `cost_result.context_tokens_before` / `context_tokens_after`) records
  context size explicitly whenever a tuning or model-drift change is
  material enough to warrant a before/after comparison.
- Where no exact token count is available, a proxy is acceptable and should
  say so: number of profiles loaded, number of reference evaluations
  selected, whether the calibration snapshot or its history was read. An
  honest proxy beats a fabricated precise number.

Recording is "where practical," per the SUE-568 acceptance criteria — not
mandatory instrumentation added to every code path that does not yet have
it. Do not build a parallel context-accounting system to satisfy this
section; extend the record that already exists at that stage.

## 3. Model / cost routing

Cheapest reliable mechanism for the job, by class:

| Class of work | Route | Why |
|---|---|---|
| Schema/index validation, index rebuild, freshness checks | deterministic code (`scripts/*.mjs`, `scripts/lib/json-schema-lite.mjs`) | Zero model cost where a mechanical check is sufficient; also the only way `--check` staleness gates can be exact |
| Routine classification / JSON extraction / axis routing | a cheaper model, when quality allows | Intake and routing are high-volume, low-ambiguity-per-call; a stronger model here does not buy proportionally better routing |
| Framing, writing, L1 review | a stronger reasoning model | These are the stages where a wrong call is expensive to detect later and directly shapes what the reader gets — the model-drift regression gate in `schemas/MODEL-DRIFT-CONTRACT.md` exists specifically to protect these roles |
| Image/audio rendering | only after cheap preflight passes | Rendering is the most expensive step per unit of work; see §4 |

This mirrors `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §7's per-role
approval model: routing, writing, and rendering are different roles that may
run different models at different tiers, and a role's tier choice is
recorded in that role's own lineage (`renderer` block in
`visual-job.schema.json`, `render` block in `audio-plan.schema.json`) rather
than asserted once for "the system."

## 4. Cost is measured per accepted artifact

The tracked figure is **cost per accepted artifact**, not raw generation or
render count (V2 §9). `schemas/audio-plan.schema.json`'s `cost` block
(`renders_attempted`, `renders_accepted`, `cost_per_accepted_artifact`) is
the existing convention; a visual pipeline computes the equivalent from
`visual-job.schema.json`'s `attempts`/`status` history the same way, without
a third parallel field. Do not report call volume as if it were a quality or
efficiency signal on its own — ten cheap rejected renders and one accepted
one is a worse outcome than two attempts and one accepted one, even though
the raw count says otherwise.

## 5. Bounded retry: a bad direction routes back to planning

`visual-job.schema.json` and `audio-plan.schema.json` already carry
`attempts`/`max_attempts` — this document does not restate their mechanics.
The policy bounded retry exists to enforce: when a compiled job/plan fails
its cheap preflight (information-gain gate, density check, script L1) or its
post-render QA, the next attempt re-enters **planning** (a new
`semantic_spec` / recompiled `spoken_script`), not a same-input reroll of the
expensive render step. A `status` of `qa_fail` or `script_l1_fail` routes to
the layer named by the routing table
(`../editorial/feedback-routing.json` — `semantic_spec`, `composition`,
`spoken_script`, etc.), exactly as any other feedback would, rather than
simply re-invoking the renderer/TTS engine on the same compiled input and
hoping for a different roll. Once `attempts` reaches `max_attempts`, the job
stops (`status: "rejected"`) and becomes evidence for the experiment ledger
or a `DRIFT_CANDIDATE`, not an unbounded loop of premium reroll cost.

## 6. What this document does not do

It does not define a new schema, a new record type, or a new health score —
`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §11 and its system
evaluation surface (owned by a concurrent package, `evals/system/**`) are the
place aggregate cost/quality judgement is made. This document only fixes
*what loads, when, and at what model tier* so that judgement has honest
inputs to work from.
