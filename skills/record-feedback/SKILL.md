---
name: record-feedback
version: 0.1.0
description: Classify one natural-language complaint or compliment about a generated output against the routing layers, decide its write-authority class, and persist a validated feedback record — or correctly persist nothing.
when_not_to_use: Do not use to judge whether a claim is true — that is verify-claims, and a feedback record is never read as factual authority. Do not use to evaluate third-party craft material — that is evaluate-reference. Do not use to write, revise, or regenerate the flagged output; this Skill classifies and records, it does not fix. Do not use to activate a calibration version — the most this Skill may do is raise a class-3 DRIFT_CANDIDATE.
inputs:
  - the human's (or agent's) utterance about a generated output, verbatim
  - editorial/feedback-routing.json (the layer routing table)
  - the subject identity this feedback is about (article_ref, artifact_profile, or package_ref)
  - schemas/feedback-record.schema.json
outputs:
  - zero feedback records, when the correction is task-local and nothing durable is warranted (the default outcome)
  - or exactly one feedback record (schemas/feedback-record.schema.json), persisted under feedback/records/ and reflected in a rebuilt feedback/index.json
requires:
  - editorial/feedback-routing.json, to know the layer vocabulary this Skill classifies against
  - a resolvable subject ref for the output the utterance is about
  - enough of the utterance to attempt a signal and verdict; an utterance carrying no evaluative content at all is refused, not guessed at
authority:
  may:
    - classify an utterance against the layer vocabulary in editorial/feedback-routing.json
    - decide, per utterance, the write-authority class it actually warrants (spine §10) and take no class above what is needed
    - persist a class-1 feedback record when the correction is more than task-local
    - record routing.abstained true with a rationale when the layer genuinely cannot be told
    - ask exactly one clarifying question distinguishing "이번 글만" from "앞으로" when that reading is materially ambiguous, defaulting to task-local when unanswered
    - raise a class-3 DRIFT_CANDIDATE when a record's evidence_links show repeated independent corroboration
    - decide that no durable record is warranted at all and stop having written nothing
  may_not:
    - publish, approve, or finalize anything — nothing this Skill produces is or implies human approval
    - activate a new calibration version, or otherwise take class 4 or above
    - set scope to calibration_candidate on a single record with no evidence_links to corroborating records
    - write, revise, regenerate, or apply a correction to the flagged output — that belongs to the Skill that owns the piece
    - infer owner_verdict "accepted" from publication, an L1 pass, or silence
    - edit a profile, the routing table, or any calibration file directly — this Skill appends a record, it does not become the layer it routes to
    - name a file, schema, or routing layer to the human — classification is this Skill's job, not the reader's
governed_by:
  - docs/architecture/V2-EDITORIAL-LEARNING-CORE.md
  - editorial/feedback-routing.json
  - editorial/FEEDBACK-ROUTING.md
  - schemas/feedback-record.schema.json
  - feedback/README.md
allowed_tools:
  - file_read
  - file_write
evidence:
  acceptance:
    - a persisted record validates against schemas/feedback-record.schema.json
    - node scripts/registry.mjs --validate passes after persisting, and node scripts/registry.mjs --rebuild leaves feedback/index.json unchanged (no stale index)
    - routing.layer is either one of editorial/feedback-routing.json's layer ids or null with abstained true and a non-empty rationale
    - scope is task_local unless evidence_links names other corroborating records, and no single record sets scope calibration_candidate on its own
    - the majority of run traces in evidence.fixtures produce zero durable records — class 0 is exercised and is not treated as an incomplete run
  fixtures:
    - feedback/records/paragraph-order-2026-09-05.json
    - feedback/records/routing-unclear-2026-09-05.json
---

# record-feedback

## Purpose

`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §10 describes two automatic
paths the owner's natural language drives without ever naming a file: one
generates, one learns. `intake-request` owns the first. This Skill owns the
first three steps of the second — classify, identify the target layer,
persist where persistence is warranted — for one piece of feedback about one
generated output. It stops before validation and commit, which run the same
way any other append does (`node scripts/registry.mjs --validate`).

**Class 0 is the default outcome, not a fallback.** Most complaints and
compliments are about *this* piece and correct it in place; treating them as
durable evidence is the overfitting failure `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`
§6 already names. A run of this Skill that writes nothing has not failed —
it has correctly recognized a task-local correction.

This Skill never fixes the flagged output. It reads the utterance, decides
what kind of signal it is, and — only when warranted — writes one append-only
record. The Skill that owns the piece (writing, `compile-visual-story`, etc.)
applies any task-local correction itself.

## Inputs

The utterance, verbatim, in whatever language it was given. The subject it is
about (an article, artifact, or package ref — `intent_ref` where known).
`editorial/feedback-routing.json` for the layer vocabulary. Nothing else is
loaded to classify one utterance: not the full corpus, not calibration
history, not other feedback records, unless the human's utterance itself
cites them as corroboration.

## Outputs

Zero records (the common case) or exactly one `schemas/feedback-record.schema.json`
record, written to `feedback/records/<slug>.json` and folded into
`feedback/index.json` by the registry rebuild. Never more than one record per
utterance; a compound utterance about two different failures is two runs.

## Preconditions

- The utterance carries some evaluative content about a generated output —
  praise, a correction, a complaint, or a stated preference.
- The subject the utterance is about is resolvable to a ref this Skill can
  cite (`subject.ref` on the record). An utterance about nothing identifiable
  is not classifiable.
- `editorial/feedback-routing.json` loads.

## Procedure

1. **Read the whole utterance before classifying anything.** A single
   sentence can carry a signal (`objective_quality` / `audience_fit` /
   `publication_fit` / `owner_preference`), a verdict (`good` / `bad` /
   `mixed`), and a layer all at once. Do not force these into independent
   passes.

2. **Decide whether anything durable is warranted at all.** Most feedback
   about one piece is a task-local correction: it changes this output and
   nothing else. When that is the whole of it, this is class 0 — apply no
   record, hand the correction back to the Skill that owns the piece (or note
   it for the human to apply), and stop. Do not manufacture a record to prove
   the run did something.

3. **When the correction is more than task-local, classify the layer.**
   Match the utterance against `editorial/feedback-routing.json`'s layer
   table (`shared`, plus the `text`/`visual`/`audio` groups for the relevant
   modality) using each layer's `owns` and `symptoms`, and check the `do_not`
   entries for the layers this utterance is adjacent to — those exist
   precisely to catch the misroute this utterance looks like at first read.
   Do not restate the routing table; select from it. `routing.layer` is
   always the layer's exact id (`information_density`), never a description
   of it (`"VISUAL / density"`) — a portability probe
   (`evals/system/portability/2026-09-05-intra-family-capability.md`, P4)
   found a paraphrased layer breaks any downstream consumer keying on the id.

4. **Abstain rather than guess.** When two or more layers fit equally well,
   or the utterance does not contain enough to decide, set `routing.layer`
   to `null` and `routing.abstained` to `true`, with a rationale naming what
   specifically could not be told apart. An abstained record is a complete,
   correct outcome — see `feedback/records/routing-unclear-2026-09-05.json`
   for a worked example.

5. **Resolve "이번 글만" vs "앞으로" with at most one question.** This is the
   single clarification this Skill may ask. If the utterance already answers
   it ("이번 글만 그렇게 해줘", "앞으로는 항상 이렇게"), do not ask. If it is
   genuinely ambiguous, ask one question offering both readings, and default
   to task-local (`scope: task_local`) if the human does not answer before
   this run needs to conclude.

6. **Set `basis`, `evaluator`, `verdict`, and `owner_verdict` independently.**
   `owner_verdict` is `unknown` unless this run is grounded in an actual
   human statement — never inferred from publication, an L1 pass, or
   silence. `verdict` is the evaluator's read of quality and is a separate
   field from whether the owner accepted the piece.

7. **Default `scope` to `task_local`.** Set `scope: calibration_candidate`
   only when this record's `evidence_links` name other, already-persisted
   records it corroborates — never on this record's evidence alone, and
   never when `basis` is `model_inference` with no human record among the
   links.

8. **A repeated, independently-evidenced pattern may raise a drift
   candidate, never activate one.** Where the routing layer is `calibration`
   or a genuine pattern is corroborated by `evidence_links`, this Skill's
   ceiling is a class-3 append (a `DRIFT_CANDIDATE` on the calibration side,
   per `calibration/README.md`). It never creates or edits a `versions/*.json`
   calibration snapshot — that is class 4, human-only.

9. **Persist, validate, stop.** Write the record to
   `feedback/records/<slug-after-feedback:>.json`, run
   `node scripts/registry.mjs --validate` and `node scripts/registry.mjs
   --rebuild`, and stop. This Skill does not commit, does not chain into
   another Skill, and does not re-open the flagged output.

## Invariants

- Class 0 (no durable mutation) is the majority outcome across real runs; a
  Skill run that always produces a record has misclassified the common case.
- `routing.abstained: true` is a first-class outcome and is never silently
  converted into a guessed layer under time pressure.
- No record sets `scope: calibration_candidate` without `evidence_links` to
  other corroborating records.
- No record this Skill produces activates, supersedes, or edits a
  calibration version, a profile, or the routing table itself.
- `owner_verdict` is never inferred as `accepted` from publication, an L1
  pass, or the mere passage of time.
- At most one clarifying question is asked, and only to distinguish
  task-local from durable scope.

## Refusal conditions

This Skill **stops and asks the one permitted clarifying question, or
declines outright**, when:

- `editorial/feedback-routing.json` does not load — this Skill does not
  classify against a routing table it cannot read.
- The utterance carries no evaluative content about an identifiable output at
  all (small talk, or feedback with no resolvable subject ref).
- The utterance asks this Skill to do something in `authority.may_not` —
  refuse the forbidden part (publish, approve, activate a calibration
  version, rewrite the output here) and classify the rest if anything
  classifiable remains.
- "이번 글만" vs "앞으로" is materially ambiguous and the human has not yet
  answered — ask once, offer both readings, default to task-local rather
  than blocking indefinitely.

## Evidence

- A persisted record validates against `schemas/feedback-record.schema.json`.
- `node scripts/registry.mjs --validate` passes and `node scripts/registry.mjs
  --check` shows no stale index after a rebuild.
- `feedback/records/paragraph-order-2026-09-05.json` and
  `feedback/records/routing-unclear-2026-09-05.json` demonstrate the two
  non-class-0 shapes this Skill produces: a confidently routed `frame`
  failure, and a genuine abstention.

## Authority

This Skill classifies and persists; it never decides that a piece should be
republished, approved, or finalized, and it never edits the layer it routes
feedback to. Its ceiling is a class-3 `DRIFT_CANDIDATE` append. Activating a
calibration version (class 4) and any change at class 5 or 6 belong to a
human and the Skills/process spine §10 already names for that authority —
this Skill has none of it.
