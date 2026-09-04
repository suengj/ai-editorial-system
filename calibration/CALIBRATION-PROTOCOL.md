# Calibration protocol — versioning, drift, promotion, ledger (AES-V2.10 / SUE-568)

How an agent turns accumulated feedback into a calibration change — or,
correctly, into no change at all. Governing model:
[`../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
§6 (learning without overfitting), §7 (the learning boundary and model
drift), §10 (write-authority ladder). This document routes into
`schemas/calibration-version.schema.json` and
`schemas/experiment-record.schema.json`; it does not redefine either.

## 1. One disliked output is evidence. It is not a rule.

The default outcome of feedback is **no calibration change at all** — a
task-local override (class 0) that expires with the task, per
`editorial/FEEDBACK-ROUTING.md` §5. Calibration only moves when the anti-
overfitting bar in V2 §6 is actually met:

- **repeated independent evidence** — multiple records, from separate tasks
  or evaluators, pointing at the same scope and the same failure shape; or
- an **explicit owner declaration** that the preference itself has changed,
  not merely that one output missed it.

Anything less stays task-local. This bar is not new here — it is the same
one `editorial/FEEDBACK-ROUTING.md` §5 and `feedback-record.schema.json`
already state; this protocol is what actually applies it to a calibration
file.

## 2. Four signals, never averaged

`objective_quality`, `audience_fit`, `publication_fit`, `owner_preference`
each get their own field on a calibration version
(`schemas/calibration-version.schema.json` `signals`), each with its own
`evidence_refs`. A change to `owner_preference` never touches the other
three's `evidence_refs` or `statement` — that is the concrete meaning of "a
change in owner preference must not rewrite factual quality or audience-fit
history" (V2 §6). `objective_quality` dominates and may not be traded for
any of the other three, in a calibration version exactly as it does in a
feedback record's `signal` field.

## 3. The drift trigger — declared, not dogma

An agent may raise a `DRIFT_CANDIDATE` (`status: "candidate"`,
write-authority class 3, automatic) when either:

- **repeated independent recent signals** — at least **two** `explicit_human_feedback`
  records (never `model_inference`), from separate tasks, naming the same
  scope and pointing the same direction against the currently active
  calibration for that scope; or
- **one explicit owner declaration** that the preference itself has changed
  ("이제부터는 이렇게 해줘" / "from now on"), recorded verbatim.

**Why two, and why this is not meant to be permanent dogma:** two is the
smallest number that distinguishes a pattern from a single bad day, and it
matches the "repeated independent evidence" bar already fixed by
`editorial/FEEDBACK-ROUTING.md` §5 and the non-self-promotion rule already
enforced on feedback records (`feedback-record.schema.json`: "a single
record ... never promotes itself"). It is **not** claimed to be the
statistically correct number — there is no operating history yet to derive
one from (V2 §11: most system-health dimensions are honestly
`INSUFFICIENT_EVIDENCE` before the SUE-570 pilot). Revisit this threshold
from real operating evidence once the pilot and real usage produce enough
drift candidates to say whether two is too eager, too conservative, or about
right — that revision is itself a class-5 change to this document, backed by
the accumulated experiment-ledger evidence, not a silent tuning of a
constant.

`conflicting_evidence` on a candidate must resolve to `explicit_human_feedback`
records where they resolve at all: a `model_inference`-basis record can
never itself constitute drift evidence, because that would let agent
consensus stand in for human preference — the same firewall
`registry-core.mjs` already enforces on `scope: calibration_candidate`
feedback records (`SCOPE_BASIS` check), applied here to the calibration side
of the same boundary.

## 4. Promotion: candidate → active is always human

An agent may **create** a candidate. It may **never** set `status: "active"`
on one. `scripts/lib/calibration-core.mjs` enforces this structurally:

- `status: "active"` or `"superseded"` requires `authorized_by.type: "human"`.
  A version authored by an agent can never carry either status.
- A `promotion` block (candidate → active) requires `promotion.authorized_by`
  to be a human identity.
- A promotion cannot rest on a single feedback record unless `promotion.basis`
  names an **explicit owner declaration** — mirroring
  `reference-evaluation.schema.json`'s promotion block rather than inventing
  a second shape. `"published"` or `"L1 pass"` alone is never sufficient
  promotion evidence, exactly as it is not for a reference.

This is class 4 on the write-authority ladder (§10): "explicit human intent;
clarification when ambiguous." There is no field on a candidate that can
express its own activation — the same structural ceiling
`editorial/FEEDBACK-ROUTING.md` §4 already describes for feedback records
("There is no field on a feedback record that can express class 4, 5, or
6") applies here by the same construction.

## 5. Superseding never mutates history

Writing a new active version for a scope:

1. Create `calibration/versions/<scope-slug>.v<N+1>.json` with `supersedes`
   pointing at the old `calibration_id`.
2. Set `superseded_by` on the **old** file to the new `calibration_id`. This
   is the only field, alongside `status`, the old file may ever change after
   it is first committed.
3. Rebuild `calibration/current.json` (`node scripts/calibration.mjs --rebuild`).

`scripts/lib/calibration-core.mjs`'s `checkHistoricalImmutability` compares
each version file against its committed `HEAD` copy (ignoring only `status`
and `superseded_by`) and fails validation the moment anything else differs —
evidence_refs, signals, scope, effective_from, or supersedes. A version that
needs correcting gets a new version, not an edit.

## 6. The experiment ledger

For a material tuning change or a model-drift regression decision, append
one `calibration/ledger/<experiment-id-slug>.json`
(`schemas/experiment-record.schema.json`) recording: `hypothesis`,
`failure_evidence`, `target_layer` (must be a declared layer id from
`../editorial/feedback-routing.json` — cross-checked mechanically, not by
convention), `smallest_change`, `evaluation_set` (at least one of fixtures /
references / real outputs actually rerun), `quality_result`, `cost_result`,
and `decision`.

`decision: "insufficient_evidence"` is not a failure to decide — it is the
honest record that the evidence available did not justify a change, and it
answers exactly the question this ledger exists to answer months later: "why
does this rule/profile/model choice still look the way it does?" The seed
record `ledger/reference-selection-2026-09-05.json` is one worked example of
this outcome.

## 7. Model drift shares this ledger

A default-model change for framing, writing, L1 review, or high-value
visual/audio planning is `kind: "model_drift"` on the same schema, carrying
`model_drift.previous`, `model_drift.candidate`, and `model_drift.role_outcomes`
(per-role PASS/HOLD/FAIL). See
[`../schemas/MODEL-DRIFT-CONTRACT.md`](../schemas/MODEL-DRIFT-CONTRACT.md)
for what triggers this record and how the regression gate is run; this
protocol only owns where the decision is recorded once it is made.

## 8. Precedence this protocol does not override

`editorial/FEEDBACK-ROUTING.md` and
`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` remain the stronger
authority wherever they already govern the same ground: the layer vocabulary,
the write-authority ladder, and the four-signal discipline are cited here,
not restated as if this document owned them.
