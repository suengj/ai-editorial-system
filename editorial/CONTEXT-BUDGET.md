# Context and cost budgets (AES-V2.10 / SUE-568)

Concretizes `../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §9 ("Context
and cost are budgeted") one level down. This document was previously written
as a load/never-load table, a context-size recording contract, and a
cost-per-accepted-artifact policy — most of which described intent rather
than something a validator checks. It was cut down (V2 tuning review, I5) to
what this repository actually enforces today, with the rest moved to §2 and
named honestly as not yet enforced, rather than deleted outright, so the
intent is not lost and the gap is not hidden either.

## 1. What is actually enforced

**Bounded retry: a failed job re-enters planning, not a reroll.**
`schemas/visual-job.schema.json` and `schemas/audio-plan.schema.json` both
require `attempts`/`max_attempts`, and `scripts/lib/visual-job-core.mjs`
(`ATTEMPTS_EXCEEDED` check) and `scripts/lib/audio-plan-core.mjs` (the same
check) both fail a job/plan whose `attempts` exceeds `max_attempts`. When a
compiled job/plan fails its cheap preflight or post-render QA, the next
attempt is expected to re-enter planning (a new `semantic_spec` / recompiled
`spoken_script`) rather than reroll the same expensive render on the same
input — that routing goes through `editorial/feedback-routing.json` like any
other feedback. Once `attempts` reaches `max_attempts`, the job stops
(`status: "rejected"`) rather than looping.

**A visual job's context isolation boundary.**
`schemas/visual-job.schema.json`'s `context_isolation.excluded` must declare
`"renderer_runtime_identity"` — checked by `visual-job-core.mjs` — so
provider/model/model_version/quality_tier lineage can never leak into a
compiled prompt as if it were content. This is a real, validated boundary,
narrower than "nothing outside this task's source material ever loads":
it constrains one field on one record type, not what an orchestrating agent
actually reads into its own context window.

## 2. Not yet enforced

The following describe real intent from AES-V2.10 / SUE-568 and
`V2-EDITORIAL-LEARNING-CORE.md` §9, but nothing in this repository currently
computes, records, or validates them. Each row names the contract that would
own the check if and when it is built, so a future implementer is not
starting from nothing — and so this document does not claim they already
run.

| Not yet enforced | What it would need | Contract that would own it |
|---|---|---|
| A load/never-load table per pipeline stage (intake, profile selection, calibration, reference, feedback, task/source) | Runtime instrumentation of what an agent actually loaded into context per stage — nothing in this repo observes that today | A new field on whichever record already marks stage completion, or a dedicated telemetry contract if none fits (see V2 §11 on not adding a new record type casually) |
| A context-size proxy recorded per stage | `schemas/experiment-record.schema.json`'s `cost_result.context_tokens_before`/`context_tokens_after` exist as optional, nullable fields, but no code path populates them and nothing requires they be set | `schemas/experiment-record.schema.json` (already the right home; needs a writer, not a new field) |
| Cost routed by model tier (cheap model for routing/extraction, stronger model for framing/writing/L1, rendering gated behind preflight) | This is prose guidance for how a human or orchestrator picks a model; no validator checks which tier was actually used for a given task | Would sit alongside `renderer`/`render` runtime-lineage blocks in `visual-job.schema.json` / `audio-plan.schema.json`, which already record *which* model ran, just not whether the tier choice was cost-appropriate |
| Cost per accepted artifact, computed and checked | `renders_attempted`/`renders_accepted`/`cost_per_accepted_artifact` are required schema fields on `audio-plan.schema.json`'s `cost` block (and a visual equivalent is described as computable from `visual-job.schema.json`'s `attempts`/`status` history), so a plan **must** carry the keys — but `cost_per_accepted_artifact` accepts `null`, and no code verifies the value is arithmetically consistent with attempts/status, so a wrong or placeholder number currently passes | `scripts/lib/audio-plan-core.mjs` / a visual equivalent would need an added check computing the ratio from `attempts`/`status` and comparing it to the recorded value |

None of these are silently assumed elsewhere in this repository — anywhere
a document referenced "context budget" enforcement beyond §1 above, that
reference should be treated as pointing at this table, not at a running
check.
