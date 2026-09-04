# feedback/

Append-only records of human or agent feedback on something this system
produced — an artifact, an article, or a package. Distinct from
[`../references/`](../references/): a reference evaluation judges third-party
material for craft evidence; a feedback record judges our own output.

Governed by [`../schemas/feedback-record.schema.json`](../schemas/feedback-record.schema.json)
and the write protocol in
[`../references/REFERENCE-EVALUATION-PROTOCOL.md`](../references/REFERENCE-EVALUATION-PROTOCOL.md)
(§7, "Feedback (rung 1)"). The change-scope ladder that decides *whether* a
piece of feedback becomes a file at all lives in
[`../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
§9 — most feedback is rung 0 and never reaches this directory.

```
feedback/
  README.md      this file
  records/       one JSON file per feedback record, append-only, never edited or deleted
  index.json     DERIVED — rebuilt byte-identically from records/, never hand-edited
```

Enforcement:

```bash
node scripts/registry.mjs --validate    # every record valid, index fresh, no embedded bodies
node scripts/registry.mjs --rebuild     # regenerate index.json deterministically
node scripts/registry.mjs --check       # fail if index.json is stale relative to records/
```

Four things every record keeps separate, per the V2 core doc §6:

- **one signal at a time** — `objective_quality`, `audience_fit`,
  `publication_fit`, or `owner_preference`, never blended into one score;
- **a named layer, or an explicit abstention** (`routing.abstained: true`) —
  never a guessed layer;
- **`scope: task_local` by default** — `calibration_candidate` requires
  `evidence_links` to other corroborating records, and a `model_inference`
  record may never claim `calibration_candidate` on its own;
- **the human's own words**, kept verbatim in `statement` where possible.

`verdict` (the evaluator's read of quality) and `owner_verdict` (whether the
owner actually accepted the output) are also kept separate — see
`REFERENCE-EVALUATION-PROTOCOL.md` §7 step 4. `owner_verdict` defaults to,
and must explicitly state, `unknown` unless the record is grounded in an
actual human statement (`evaluator.type: human` or
`basis: explicit_human_feedback`); publication, an L1 pass, silence, and time
passing are never grounds for `accepted`. This exists so that a later,
separate system-evaluation package (AES-V2.14) can read real acceptance
evidence out of these records instead of inferring health from the absence of
complaint — it is not itself that evaluation, and this directory adds no
scorecard, snapshot, or aggregate health score.

Feedback records are evidence for AES-V2.5 (failure routing) and AES-V2.10
(calibration versioning). They do not themselves change a profile or a
calibration snapshot — that promotion is rungs 3+ of the change-scope ladder
and is out of this package's scope.
