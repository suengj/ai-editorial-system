# calibration/ — versioned calibration, drift, and the experiment ledger (AES-V2.10 / SUE-568)

Makes the learning loop durable over time without treating old feedback as
timeless truth. See `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §6
(learning without overfitting), §7 (the learning boundary and model drift),
§9 (context and cost budgets), §10 (write-authority ladder) — this directory
is the executable form of those sections, not a restatement of them.

Machine contracts: [`../schemas/calibration-version.schema.json`](../schemas/calibration-version.schema.json),
[`../schemas/experiment-record.schema.json`](../schemas/experiment-record.schema.json).
Engine: [`../scripts/lib/calibration-core.mjs`](../scripts/lib/calibration-core.mjs).
Run: `node scripts/calibration.mjs --validate|--rebuild|--check` and
`node scripts/test-calibration.mjs`.

Write protocol: [`CALIBRATION-PROTOCOL.md`](CALIBRATION-PROTOCOL.md).

## Layout

```text
calibration/
  README.md                     this file
  CALIBRATION-PROTOCOL.md       the write protocol: drift trigger, promotion, ledger discipline
  versions/<scope-slug>.v<N>.json   one calibration snapshot per version, append-only
  ledger/<experiment-slug>.json     one experiment/model-drift decision record, append-only
  current.json                  DERIVED — the active snapshot per scope. Never hand-edited.
```

## A calibration version is a snapshot with lineage, never a mean

`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §6: "Preference is
temporal. Calibration is a **versioned snapshot with lineage**, not the mean
of all feedback ever recorded." Each file in `versions/` carries
`effective_from`, `supersedes`/`superseded_by`, the `scope` it governs, the
`evidence_refs` that motivated it, and four signals kept structurally
separate — `objective_quality`, `audience_fit`, `publication_fit`,
`owner_preference` — so a change in owner preference can never rewrite
factual-quality or audience-fit history.

**Historical records are immutable evidence.** Superseding a version writes a
**new** file and sets `superseded_by` on the old one; it never edits the old
version's substantive fields. `scripts/lib/calibration-core.mjs` enforces
this against the committed history (`diffSubstantive` / `checkHistoricalImmutability`),
not merely by convention.

## `current.json` is derived, never hand-edited

Same discipline as `references/index.json` / `feedback/index.json`
(`scripts/registry.mjs`): `current.json` is rebuilt byte-identically from
`versions/*.json` by `node scripts/calibration.mjs --rebuild`, and `--check`
fails the moment it drifts from that rebuild. It carries only the **active**
version per scope — never the history — so a consumer that loads
`current.json` gets the current snapshot without the archive by construction.
See `../editorial/CONTEXT-BUDGET.md` §1 for what is and is not actually
enforced about context loading beyond this one file.

## DRIFT_CANDIDATE: an agent may raise, never activate

A calibration version with `status: "candidate"` is a `DRIFT_CANDIDATE`
(write-authority class 3, automatic — §10). It carries `conflicting_evidence`
and cannot promote itself: `scripts/lib/calibration-core.mjs` rejects a
candidate authored or activated by an agent, a promotion resting on a single
feedback record without an explicit owner declaration, and any
`model_inference`-basis record used as drift evidence. See
`CALIBRATION-PROTOCOL.md` §3 for the trigger and §4 for promotion.

## The experiment ledger answers "why does this exist?"

`ledger/*.json` records material tuning changes and model-drift regression
decisions against `schemas/experiment-record.schema.json`. `decision:
"insufficient_evidence"` is a first-class outcome — "we looked and could not
yet justify a change" is exactly the record this ledger exists to keep. See
`../schemas/MODEL-DRIFT-CONTRACT.md` for the model/provider drift half of
this ledger's job.

## Seed records are shape demonstrations, not real history

`versions/audience-beginner-learner.v1.json` (active),
`versions/audience-domain-expert.v1.json` (candidate), and
`ledger/reference-selection-2026-09-05.json` (`insufficient_evidence`) each
say so explicitly in their own `notes` field. They demonstrate the record
shape ahead of real SUE-570 pilot evidence; they are not a fabricated
history of owner decisions that never happened. One real feedback record
(`feedback:paragraph-order-2026-09-05`) is cited where it genuinely applies;
placeholder ids (e.g. `feedback:demo-illustrative-domain-expert-second-signal`)
are marked as fabricated and are deliberately never enough, alone, to
activate anything.
