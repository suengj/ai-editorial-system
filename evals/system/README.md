# evals/system/ — evaluating the Editorial Learning Core itself (AES-V2.14 / SUE-573)

This is not another quality gate for an article or an image. The owner judges
whether one piece of content is good — that authority is untouched and lives
in `editorial/HITL-PROTOCOL.md`, `schemas/feedback-record.schema.json`, and
`skills/review-l1/`. This surface answers a different question: **is the
system — V2, the Editorial Learning Core — getting better, or merely getting
bigger?**

Two axes, always read together (`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`
§11):

1. **Outcome value** — does V2 materially improve accepted output quality and
   adaptability?
2. **System cost and entropy** — how much complexity, context, owner effort,
   calibration churn, and governance risk does that quality cost?

A system that produces slightly better outputs by becoming dramatically
harder to operate is not an improvement. Neither axis is read alone.

## The reviewer this surface is written for

**A future independent reviewer — a different model, months from now, with no
access to the conversation that built any of this — must be able to start at
this README, follow the evidence references in `current.json` and the
snapshot under `snapshots/`, and reach a defensible judgement.** If reaching
that judgement would require context that lives only in someone's chat
history, this surface has failed at its one job. Every claim on this surface
either cites a real repository path/field or says explicitly that the
evidence does not exist yet.

## Layout

```text
evals/system/
  README.md      this file — the evaluation contract
  current.json   the latest dimension-level state; a summary and index,
                 never a raw event store; always identical to the newest
                 snapshot's judgement (see "current.json vs snapshots")
  snapshots/     one immutable, dated file per periodic review
  reviews/       human-readable, evidence-backed prose review reports
```

Machine contract: [`../../schemas/system-snapshot.schema.json`](../../schemas/system-snapshot.schema.json).
Engine: [`../../scripts/lib/system-eval-core.mjs`](../../scripts/lib/system-eval-core.mjs).
Run: `node scripts/system-scorecard.mjs --validate|--rebuild|--check`.

### `current.json` vs `snapshots/`

A **snapshot** (`snapshots/<date>-<slug>.json`) is authored directly — a
human or agent reviewer declares the state of all ten dimensions as of one
evaluation event, and it is never edited afterward. **`current.json`** is
purely derived: `node scripts/system-scorecard.mjs --rebuild` regenerates it
deterministically as the newest snapshot's content with `kind`, `snapshot_id`,
and `derived_from_snapshot` swapped to the "current" shape. It carries
`generated`-like status implicitly through `kind: "current"` and
`derived_from_snapshot` pointing at its source — there is no independent
judgement in `current.json` that does not already exist in a snapshot.
`--check` fails when `current.json` on disk differs from a fresh rebuild, the
same staleness gate `scripts/registry.mjs --check` runs for
`references/index.json` / `feedback/index.json`.

## Evidence accumulates automatically; the scorecard does not run automatically

```text
normal generation / feedback
  → lightweight evidence accumulates as a side effect, in records that
    already exist (feedback/, references/evaluations/,
    evals/real-output-corpus/, calibration/, job/plan records)
  → enough evidence exists
  → periodic or on-demand system review
  → a new snapshot is authored; current.json is rebuilt from it
```

The full scorecard **never** runs after every article or asset, and it is
**not** wired into `npm run validate` or `npm run test` as a per-change gate —
`package.json` does not call `scripts/system-scorecard.mjs` from either
script, by design. A new snapshot is authored only when one of
`evaluation_trigger`'s four legal values applies:

| Trigger | When |
|---|---|
| `owner_request` | The owner explicitly asks for a system review. |
| `evidence_threshold` | A declared evidence window (see "Activation" below) has been reached. |
| `architecture_change` | A major model/profile/architecture change warrants a before/after comparison. |
| `v3_readiness_gate` | SUE-574 is being considered. |

`initial_seed` is a fifth, bootstrapping-only value used exactly once — for
the seed snapshot in this directory, authored before any of the four real
triggers could yet apply.

## Capture piggybacks — no parallel telemetry

There is no new per-output record type and no analytics database anywhere in
this package. Every `evidence_sources` entry across the ten dimensions points
at a field on a record that already exists, per the mapping in
`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §11:

| Evidence | Lives in |
|---|---|
| intent, transformation, content type, audience, surface, artifact | `schemas/editorial-intent.schema.json` |
| sources and selected references | intent inputs + `schemas/reference-evaluation.schema.json` |
| profile and calibration versions | intent, package, and job records |
| provider, model, version, role | job/record runtime lineage (e.g. `schemas/visual-job.schema.json#renderer`) |
| L0 / L1 outcome | `evals/rubric.json` (L0), `schemas/l1-review.schema.json` (L1) |
| feedback and routing target | `schemas/feedback-record.schema.json#routing` |
| revision / replan / rerender lineage | **gap** — see below |
| owner verdict | `schemas/feedback-record.schema.json#owner_verdict`, `schemas/corpus-entry.schema.json#owner_verdict` |
| cost / context proxy | **partial gap** — see below |

If a dimension has no real evidence source yet, its `current.json` entry says
so explicitly and is marked structurally `INSUFFICIENT_EVIDENCE` — this
package never invents a field or a file to make a dimension look measurable.

### Evidence ref convention

Every `evidence_sources` and `evidence_refs` string follows one shape:

```text
<repo-relative-path>[#<field-or-key>][ — <human note>]
```

`scripts/lib/system-eval-core.mjs`'s `resolveEvidenceRef` checks that the path
exists on disk, and — when a `#field` pointer is given — that the field's
name literally appears as a token in that file. This is a lightweight,
honest check, not a full JSON-Pointer engine: it catches a nonexistent path
or a typo'd field name, in the same "mechanical where mechanical is honest"
spirit as `scripts/lib/json-schema-lite.mjs` and
`scripts/lib/routing-core.mjs`. It does not prove the field means what the
prose claims — a human reviewer still reads the cited path.

### Two identified gaps this package does not fill

Both are recorded as `known_gaps` entries on every snapshot, not silently
patched with a new field of this package's own invention:

1. **No revision/replan/rerender lineage.** `schemas/feedback-record.schema.json`
   records a routing decision at the moment feedback is given; nothing links
   it forward to whether the repair it triggered actually worked, or how many
   attempts it took. This limits `routing_effectiveness` and
   `cost_per_accepted`. Per §11's evidence table, this belongs on job/package
   lineage — most likely AES-V2.10 (SUE-568) or a later job-record contract.
2. **No cost/context proxy on most records.** Only
   `schemas/audio-plan.schema.json#cost` carries
   `renders_attempted`/`renders_accepted`/`cost_per_accepted_artifact`.
   `feedback-record`, `editorial-intent`, and `visual-job` carry none. This
   limits `cost_per_accepted` and `context_efficiency`. Per §9/§11, this
   belongs on job/review record schemas (e.g. a `visual-job` cost block
   mirroring `audio-plan`'s) — not on this evaluation surface.

A third, smaller gap is also recorded: there is no durable, committed store
of real per-task Editorial Intent records (only the schema and illustrative
examples under `schemas/examples/`), which limits `operator_friction` until
AES-V2.1/V2.2 intake or the SUE-570 pilot leaves real records behind.

## Silence is not acceptance

`owner_verdict: unknown` is the required state whenever no owner acceptance
or rejection has actually been expressed
(`schemas/feedback-record.schema.json`, `schemas/corpus-entry.schema.json`).
It is never inferred from publication, an L1 `PASS`, or the absence of
complaint. This surface enforces the rule two ways, not merely states it:

- **Structurally**: `scripts/lib/system-eval-core.mjs`'s
  `checkOwnerVerdictMiscount` resolves every `evidence_refs` entry that
  points at a real record; if that record's own `owner_verdict` field reads
  `"unknown"`, the citing dimension's `interpretation`/`recommended_action`
  may not claim acceptance without acknowledging the verdict is unknown.
- **Textually**: a keyword gate (`findSilenceMisuse`, same style as
  `scripts/lib/registry-core.mjs`'s `FACTUAL_CLAIM_RE`) rejects any dimension
  prose that reads as "published/no complaints/silence → accepted", while
  deliberately not tripping on prose that states the rule itself (e.g. this
  README's own sentences survive it — see `scripts/test-system-eval.mjs`).

Neither check is a complete classifier; both are mechanical backstops for a
rule a human reviewer is still expected to honor when authoring a snapshot.

## Judgement, not a score

Each of the ten dimensions carries exactly one of four states:

```text
HEALTHY   WATCH   STRUCTURAL_RISK   INSUFFICIENT_EVIDENCE
```

**No aggregate number is authoritative.** There is no `82/100`, no weighted
total, no `overall_health` field anywhere on this surface.
`schemas/system-snapshot.schema.json` sets `additionalProperties: false` on
every object, so an invented field is already rejected by schema; on top of
that, `scanForAggregateScore` in `scripts/lib/system-eval-core.mjs` walks the
whole document independently, looking for score-shaped keys
(`score`, `*_score`, `*_percentage`, `*_rating`, `overall_health`, …) so a
future schema edit cannot loosen this rule silently. `--validate` fails a
snapshot that trips either check.

`INSUFFICIENT_EVIDENCE` is a legitimate, expected outcome — the seed snapshot
in `snapshots/2026-09-05-seed.json` (mirrored in `current.json`) reads
`INSUFFICIENT_EVIDENCE` on **all ten** dimensions, and that is the honest
answer today. There is essentially no real operating history yet: the SUE-570
pilot has not run, and every record currently sitting in `feedback/`,
`references/evaluations/`, and `evals/real-output-corpus/entries/` is
synthetic or an explicitly-marked placeholder used to prove a schema shape,
not a real owner judgement. Claiming health before that evidence exists is
exactly the vanity failure this package exists to prevent, and it would
poison the eventual V3 decision (SUE-574).

## The ten dimensions

Verbatim SUE-573 ids. Full `asks` / `evidence_sources` / `judgement_rules` /
`insufficient_evidence_when` live on every dimension object in
`current.json` and each snapshot — this table is a map, not a substitute for
reading them there.

| id | asks (short) | primary evidence today |
|---|---|---|
| `quality_lift` | Does V2 materially improve accepted output quality/adaptability? | `feedback/records`, `evals/real-output-corpus/entries`, `schemas/l1-review.schema.json` |
| `operator_friction` | Is natural-language operation staying simple as the system grows? | `schemas/editorial-intent.schema.json#clarification` |
| `context_efficiency` | Does progressive disclosure hold as the repo grows? | `schemas/visual-job.schema.json#context_isolation` (boundary only, no size measurement yet) |
| `reference_health` | Do references improve quality without self-reinforcing? | `references/index.json#by_provenance_class`, `schemas/l1-review.schema.json#anti_collapse` |
| `calibration_health` | Is preference change versioned and bounded, not accumulating silently? | `calibration/versions`, `calibration/ledger` |
| `routing_effectiveness` | Is bad output repaired at the correct layer, first try? | `feedback/records#routing`, `editorial/feedback-routing.json#authority_matrix` |
| `portability` | Does behavior stay consistent across agents/models without large forks? | `schemas/visual-job.schema.json#renderer`, `schemas/feedback-record.schema.json#evaluator` |
| `governance_safety` | Are write-authority boundaries actually holding? | `schemas/feedback-record.schema.json#scope`, `scripts/lib/registry-core.mjs#checkOwnerVerdict` |
| `cost_per_accepted` | Is cost optimized per accepted result, not per raw call? | `schemas/audio-plan.schema.json#cost` (visual has no equivalent field yet) |
| `maintainability` | Does the repo stay understandable months later? | `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §12/§13, `editorial/`, `schemas/` file counts |

## Activation — when a full review is worth running

`activation.sufficiency_conditions` on each snapshot declares, per SUE-573,
the conditions a reviewer checks before treating a review as more than a
seed declaration. This is **not a rigid quota** — it is a declared, revisable
judgement about whether repeated patterns can be distinguished from one-off
incidents:

- SUE-570 (real multi-audience text + visual pilot) complete
- multiple owner-reviewed text outputs beyond the pilot
- multiple accepted/rejected visual outputs
- several real feedback → routing → revision cases
- at least one durable calibration decision, or enough evidence to confirm
  none was needed
- cross-agent/model comparison evidence
- enough operation to observe real reference-selection behavior

`activation.overall` is `not_yet_sufficient` on the seed snapshot. A future
reviewer should re-declare this judgement, not silently extend the seed's.

## Running it

```bash
node scripts/system-scorecard.mjs --validate   # snapshots + current.json conform; no aggregate score; every evidence ref resolves
node scripts/system-scorecard.mjs --rebuild    # regenerate current.json deterministically from the newest snapshot
node scripts/system-scorecard.mjs --check      # staleness gate: does current.json match a fresh rebuild?
node scripts/test-system-eval.mjs              # allow/deny regression suite for this surface's own logic
```

None of these run as part of `npm run validate` or `npm run test` — this
surface is evaluated on-demand, per the triggers above, not on every commit.

## Reviews

[`reviews/`](reviews/) holds prose, evidence-backed review reports — the
human-readable companion to a snapshot's machine state. See
[`reviews/2026-09-05-seed-review.md`](reviews/2026-09-05-seed-review.md) for
the format, which honestly reports that the system is almost entirely
un-evaluated at this stage.
