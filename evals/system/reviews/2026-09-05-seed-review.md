# System evaluation review — 2026-09-05 (seed)

Snapshot: [`../snapshots/2026-09-05-seed.json`](../snapshots/2026-09-05-seed.json)
(`system-eval:2026-09-05-seed`). Trigger: `initial_seed` — the one-time
bootstrapping declaration for this evaluation surface itself
(AES-V2.14 / SUE-573), authored before any of the four real triggers
(`owner_request`, `evidence_threshold`, `architecture_change`,
`v3_readiness_gate`) could yet apply.

## What this review is, and is not

This is **not** a judgement that any article, image, or audio output is
good — that stays the owner's call, made through
`schemas/feedback-record.schema.json` and `skills/review-l1/`. This is a
judgement about whether the Editorial Learning Core, as a system, shows signs
of getting better or merely getting bigger. See
[`../README.md`](../README.md) for the full contract this review follows.

## Headline finding

**The system is almost entirely un-evaluated at this stage, and that is the
correct, honest state to report.** All ten SUE-573 dimensions read
`INSUFFICIENT_EVIDENCE` in this snapshot. This is not a placeholder default —
each dimension's `evidence_refs` names the real, thin evidence actually
checked before reaching that conclusion (see the snapshot file). The
alternative — declaring `HEALTHY` on any dimension today — would be exactly
the vanity-health failure `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`
§11 warns against, and it would corrupt the evidence base the eventual V3
readiness decision (SUE-574) depends on.

## Why there is (almost) nothing to evaluate yet

As of this review:

- `feedback/index.json` lists 2 records. Both are synthetic seed examples
  (`feedback:paragraph-order-2026-09-05`,
  `feedback:routing-unclear-2026-09-05`) demonstrating the record shape, not
  real owner feedback on real output.
- `evals/real-output-corpus/entries/` holds 5 entries, all explicitly marked
  synthetic or placeholder in `evals/real-output-corpus/README.md` — one
  `unknown` verdict, one `needs_rework`, one rejected, one
  `generated_output`-with-lineage, one `reference_eligible: true`. They prove
  every required field and edge case exists; none is a real owner verdict.
- `references/index.json` lists 3 evaluations, all `provenance_class:
  external`. Zero `owner_created`, zero `generated_output`, zero promotions.
  The self-reinforcement risk this evaluation exists partly to catch
  (`reference_health`) cannot be observed because the condition that would
  produce it — generated output entering the reference pool — has not
  happened yet.
- `calibration/versions` and `calibration/ledger` (AES-V2.10 / SUE-568) are
  concurrent, in-progress work as of this review. Whatever exists there
  reflects initial authoring, not a preference decision that has survived
  real use, reversion pressure, or contradiction with another active
  preference.
- No populated `visual-job` or `audio-plan` record exists anywhere in the
  repository. `cost_per_accepted` and `portability` have no instance data to
  read, only the schema fields that would eventually carry it.
- No durable, committed store of real per-task Editorial Intent records
  exists outside `schemas/examples/` illustrative examples.
  `operator_friction` cannot be measured from repository evidence alone yet.
- AES-V2.11 (SUE-569) certification — the primary intended evidence source
  for `portability` — has not run.
- The SUE-570 pilot, which the activation conditions (below) are keyed to,
  has not started.

None of this is a defect in this package. It is the expected state of an
evaluation surface declared before the system it evaluates has done any real
work.

## Activation judgement

`activation.overall: not_yet_sufficient`. All seven SUE-573 sufficiency
conditions read `met: false` in the snapshot, each with a concrete note on
why. This is a declared, revisable judgement, not a rigid quota — a future
reviewer should re-declare it against the evidence available at that time,
not silently extend this one.

## Two structural gaps flagged, not resolved here

Per `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §11's evidence table,
this package identifies two gaps it deliberately does not fill by inventing a
field of its own:

1. **No revision/replan/rerender lineage** on `feedback-record` — limits
   `routing_effectiveness` and `cost_per_accepted`. Owner: job/package
   lineage, most likely AES-V2.10 (SUE-568) or a later job-record contract.
2. **No cost/context proxy** outside `audio-plan.schema.json#cost` — limits
   `cost_per_accepted` and `context_efficiency`. Owner: job/review record
   schemas (e.g. a `visual-job` cost block mirroring `audio-plan`'s).

A third, narrower gap is also recorded: no durable per-task Editorial Intent
record store exists yet, limiting `operator_friction`. Owner: AES-V2.1/V2.2
intake (SUE-559/560) or the SUE-570 pilot's own evidence capture.

## Recommended action

Do not re-run this scorecard as a matter of routine. Re-run it (a new dated
snapshot, not an edit to this one) when:

- the SUE-570 pilot completes and leaves real feedback/corpus/visual
  evidence behind, or
- a major model/profile/architecture change warrants a before/after
  comparison, or
- the owner explicitly asks for a system review, or
- the V3 readiness gate (SUE-574) is being considered.

Until then, `current.json` should continue to read `INSUFFICIENT_EVIDENCE`
across all ten dimensions. A reviewer who finds it reporting anything else
without a new snapshot behind it should treat that as a defect in this
surface, not as good news about the system.
