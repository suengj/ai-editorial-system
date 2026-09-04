# Model / provider drift contract (AES-V2.10 / SUE-568)

`../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §7 states the
principle: output quality can change while prompts, profiles, references,
and calibration are all unchanged, because the model underneath moved, and
that is an editorial quality event, not a transparent implementation
detail. This document makes that operable. It routes into
[`experiment-record.schema.json`](experiment-record.schema.json)'s
`kind: "model_drift"` records; it does not define a second ledger.

## 1. Lineage fields, recorded wherever the runtime exposes them

Every material generation or review already has a home for this — this
contract does not add a parallel record type:

| Field | Recorded in |
|---|---|
| provider, model, model version / dated alias | `visual-job.schema.json` `renderer` block; `audio-plan.schema.json` `render` block; `feedback-record.schema.json` / `reference-evaluation.schema.json` / `l1-review.schema.json` `evaluator.agent` block |
| reasoning/quality tier | `renderer.quality_tier` (visual), `render.quality_tier` (audio); `experiment-record.schema.json` `model_drift.previous/candidate.quality_tier` |
| profile version | the profile file's own version field, referenced by `profile_ref` on the job/plan/intent record |
| calibration version | `calibration_ref` on `editorial-intent.schema.json`, `visual-job.schema.json`, `audio-plan.schema.json`, `reference-evaluation.schema.json` |
| reference set or its hash | `selected_reference_traits` (traits only, never a body — V2 §2) on job/plan records; `evidence_refs` on a calibration version |
| task/output identity | `job_id` / `plan_id` / `article_ref` / `intent_ref` already on each record |

"Where available" is the standing qualifier: a deterministic tool (e.g. an
SVG compiler) still records its own `tool`/`tool_version` identity so the
field is never blank, per `visual-job.schema.json`'s `runtime` `$defs`
description — the same principle extends to every lineage field here. A
runtime that genuinely exposes no version identifier records what it can and
does not fabricate the rest.

## 2. A default-model change is a quality-change event

Changing the default model or provider for **framing, writing, L1 review, or
high-value visual/audio planning** is never a transparent upgrade. Before it
ships as the default for a role:

1. Run a **small fixed regression sample** drawn from existing L0 fixtures
   (`evals/fixtures/`) and, where available, real corpus entries
   (`evals/real-output-corpus/`) — fixed and reused across drift checks so
   results are comparable run to run, not a fresh cherry-picked sample each
   time.
2. Compare, at minimum: **integrity** (does the candidate model preserve
   factual support and stated uncertainty), **the target editorial
   dimensions** for that role (thesis-worth / prose quality for writing,
   `l1-review.schema.json`'s five required dimensions for L1, information
   gain / density match for visual planning, script-naturalness for audio
   planning), **audience fit**, and **cost/context** (§`../editorial/CONTEXT-BUDGET.md`
   §3-4).
3. Record the comparison as a `calibration/ledger/*.json` record with
   `kind: "model_drift"`: `model_drift.previous`, `model_drift.candidate`,
   and `model_drift.role_outcomes`.

A model change that has not run this gate never becomes the silent default
for one of these roles — it stays pinned to the previous model until the
regression record exists.

## 3. Per-role approval — "newer" is not a reason to replace every role

```text
new model  →  routing PASS  ·  Writer HOLD  ·  Reviewer PASS
```

is a legal, expected outcome, not a partial failure. `role_outcomes` is a
list precisely so one role's PASS never implies another role's PASS. A model
that regresses on `writer` while passing on `routing` and `reviewer_l1` is
approved for those two roles and held for the third — the experiment record
says so explicitly, and the previous model keeps serving the held role until
its own regression record clears it.

The role vocabulary has exactly one owner: the `model_drift.role_outcomes[].role`
enum in [`experiment-record.schema.json`](experiment-record.schema.json). It is
deliberately not repeated here — a copied enum drifts from the one that is
actually enforced, and a drifted copy silently overrides the original. Read it
there. A role held
at `FAIL` is not deleted from the roster — it is a standing record that this
model/role pairing has not cleared the gate, revisited when either the model
or the gate's fixed sample changes materially.

## 4. The decision lives in the experiment ledger

Every model-drift gate run — pass, hold, or fail, for any role — is a
`calibration/ledger/*.json` record. This is the same ledger material tuning
changes use (`schemas/experiment-record.schema.json`), not a second
drift-specific ledger: `kind` distinguishes `"targeted_tuning"` from
`"model_drift"` on one shared record shape, per `calibration/README.md`.
`decision: "insufficient_evidence"` applies here exactly as it does for a
tuning change — a regression sample too small or too ambiguous to clear a
role is recorded as such, not silently rounded to a PASS.

## 5. Neither vendor lock-in nor forced churn

The goal is **controlled portability with detectable drift**, not a frozen
vendor relationship in either direction:

- No role is pinned to one provider "forever" as a matter of principle — a
  model change that clears the gate for a role is adopted for that role.
- No role adopts a newer model merely because it is newer, or because
  another role already adopted it — each role's regression record stands on
  its own evidence.
- A provider or model that regresses is held, not silently kept as the
  default while a worse-performing successor quietly replaces it elsewhere
  in the pipeline.

## 6. Restating the learning boundary

This contract governs **which model runs a role and how that choice is
lineage-tracked and gated** — it is not, and may never become, a path to
changing what a model *is*. `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`
§7 already fixes this; restated here because model-drift work is exactly the
place this boundary is easiest to blur:

- **No model-weight training.** A model-drift regression record compares
  candidate models as they are shipped by their provider. It never produces
  a fine-tuned or otherwise weight-modified variant.
- **No hidden fine-tuning.** No Skill, job, or ledger record may treat
  training as a side effect of a generation or regression run. If
  fine-tuning is ever justified, V2 §7 already requires it to arrive as a
  separate program with its own data-rights, evaluation, rollback, and cost
  decision — this contract does not create a back door around that
  requirement.
- **No training on owner content as a side effect.** Regression samples draw
  from `evals/fixtures/` and `evals/real-output-corpus/` under their own
  governance (real-output-corpus entries are compact records, never
  article/artifact bodies — see `evals/real-output-corpus/README.md`); a
  model-drift gate run is an evaluation call, not a training call, and never
  becomes one implicitly.
- **Durable learned state is files.** Everything this contract governs that
  is meant to persist — a role's approved model, a calibration version, an
  experiment decision — lives as an inspectable, versioned, revertible file.
  Reverting a model-drift decision is reverting a commit, exactly as
  reverting a calibration version is (`calibration/CALIBRATION-PROTOCOL.md`
  §5) — never an un-trainable, opaque model state.
