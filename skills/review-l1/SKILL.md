---
name: review-l1
version: 0.1.0
description: Compare a text output pairwise against a relevant GOOD reference on a small set of high-value dimensions, with mandatory evidence, and route any rework to an AES-V2.5 layer. Advisory only — never publication or preference authority.
when_not_to_use: Do not use for a single opaque quality score — this Skill exists specifically to replace that pattern. Do not use to accept, publish, or finalize an article; that is human/L2 authority under editorial/HITL-PROTOCOL.md. Do not use when no relevant GOOD reference of a comparable content type exists and no genuinely cross-cutting dimension applies — abstain instead of comparing against a mismatched reference.
inputs:
  - the subject output (article or artifact) and its content_type
  - one or more candidate GOOD references, drawn from evals/real-output-corpus/ and references/evaluations/
  - the reference's provenance_class and, when generated_output, its lineage_ref
outputs:
  - one l1-review record (schemas/l1-review.schema.json) per subject
  - a routing outcome naming an AES-V2.5 layer, or PASS/TIE/ABSTAIN
requires:
  - the subject's content_type, to select a comparable reference
  - at least one candidate reference of the same content_type, or an explicit case for a cross-cutting dimension
authority:
  may:
    - compare a subject against a GOOD reference on the five required dimensions
    - record a PASS, a REWORK outcome routed to a named layer, a TIE, or an ABSTAIN
    - flag an integrity concern found incidentally during comparison
  may_not:
    - accept, publish, or finalize anything — that is human/L2 authority, and it remains final on publication and preference regardless of this Skill's outcome
    - record human approval of any kind
    - let a stylistic advantage override an integrity failure; integrity always dominates
    - infer reference_eligible or owner_verdict on a corpus entry from this review's own outcome
    - rewrite the subject's prose; this Skill judges, it does not edit
governed_by:
  - editorial/constitution.md
  - editorial/voice.md
  - editorial/HITL-PROTOCOL.md
  - editorial/FEEDBACK-ROUTING.md
  - evals/RUBRIC.md
  - evals/real-output-corpus/README.md
allowed_tools:
  - file_read
evidence:
  acceptance:
    - every dimension finding carries a non-empty evidence_span, including tie and abstain
    - an integrity status of fail never coexists with outcome PASS
    - routes_to always resolves against editorial/feedback-routing.json's layer ids
    - a comparison across content types names its cross_cutting_dimension
    - an all-generated-output, same-lineage reference set declares anti_collapse
  fixtures:
    - schemas/examples/l1-review.example.json
    - evals/real-output-corpus/entries/corpus-placeholder-research-accepted.json
---

# review-l1

## Purpose

A deliberately small, high-value second opinion on a text output: not "is
this good" as one number, but "is this better, worse, or a tie against a
piece we already know is good, on the handful of dimensions that actually
predict whether an editor will need to rework it." L0 (`evals/RUBRIC.md`)
stays the fast mechanical gate; this Skill is the first judgement layer above
it, and it is still advisory — see `editorial/HITL-PROTOCOL.md` for the
authority that stays above both.

## Inputs

The subject (an article or artifact, with its `content_type`) and one or more
candidate GOOD references selected from `evals/real-output-corpus/` (entries with
`reference_eligible: true`) or `references/evaluations/`. Each candidate
carries its `provenance_class`, and, when `generated_output`, its
`lineage_ref`.

## Outputs

One record conforming to `schemas/l1-review.schema.json`: per-dimension
findings with evidence, an integrity read, and a routing outcome.

## Preconditions

- The subject's `content_type` is known, so a comparable reference can be
  selected.
- At least one reference of the same `content_type` exists, or the comparison
  is limited to a dimension genuinely cross-cutting enough to justify a
  cross-type reference (in practice: `language-native-prose`).

## Procedure

1. **Select the reference set.** Same content type as the subject wherever
   possible — Research to Research, News to News. A cross-type reference is
   used only for a declared cross-cutting dimension; every other dimension
   then abstains rather than deciding against a mismatched register.
2. **Check for a reference monoculture.** If every candidate reference is
   `generated_output` and shares one `lineage_ref`, set
   `comparison.anti_collapse.triggered: true` with a note. Do not silently
   let the system's own prior output stand in for an independent standard.
3. **Score five dimensions**, each `better` / `worse` / `tie` / `abstain`
   relative to the reference, each with a quoted or named `evidence_span`:
   - `thesis-worth` — article-worthiness and a falsifiable position.
   - `synthesis-independence` — does the argument path depend on source
     order, or does it connect what the sources do not connect themselves?
   - `language-native-prose` — Korean naturalness where applicable; cite
     `editorial/voice.md` rather than restating its rules.
   - `formulaic-ai-shaped` — prompt-echo, repetition, or a signature move
     repeated until the house style becomes visible instead of the argument.
   - `audience-fit` — depth, jargon, and purpose against the audience profile
     both pieces were written for.
4. **Read for integrity incidentally.** This Skill is not `verify-claims` and
   does not re-run it, but an obvious phantom citation or fabricated figure
   noticed during comparison sets `integrity.status` to `concern` or `fail`
   with its own evidence span.
5. **Decide the outcome.** If `integrity.status` is `fail`, the outcome is
   always `FACT_REWORK → verification`, regardless of every stylistic
   finding. Otherwise: `PASS` when nothing outweighs the reference,
   `ARGUMENT_REWORK → frame` / `PROSE_REWORK → writing or polish` /
   `AUDIENCE_REWORK → audience or frame` for the corresponding dimension
   losses, or `TIE` / `ABSTAIN` when the comparison genuinely does not
   decide. Layer ids are exactly `editorial/feedback-routing.json`'s.
6. **Record `final_authority: "human"`.** Always. This field exists so no
   downstream reader can mistake an L1 outcome for acceptance.

## Invariants

- Every dimension finding, including `tie`, carries observable evidence. A
  verdict with none is not recorded.
- `tie` and `abstain` are first-class outcomes, not failures to reach a
  verdict — a genuine tie is not forced into a preference, and a genuinely
  underspecified comparison abstains rather than guessing.
- Integrity dominates. A better-written subject that is less true than the
  reference always loses, and the outcome is always `FACT_REWORK`.
- Comparison stays within content type unless the dimension is declared
  cross-cutting.
- Nothing this Skill produces is publication, approval, or a preference
  update. `final_authority` is always `human`.

## Refusal conditions

This Skill stops and reports rather than producing a review when:

- No reference of the subject's `content_type` exists and no dimension here
  is genuinely cross-cutting for the material at hand. The correct output is
  `comparison.mode: "abstain"` with every dimension recording `abstain` and
  the missing-reference reason as its evidence.
- The subject's `content_type` is unknown. There is nothing to compare like
  with like against.

## Evidence

`schemas/l1-review.schema.json` plus `scripts/lib/l1-core.mjs` enforce every
invariant above mechanically: missing evidence, integrity overridden by
style, an undeclared cross-type comparison, an undeclared reference
monoculture, and a `routes_to` that does not resolve against
`editorial/feedback-routing.json` are all rejected, not merely discouraged.
Run: `node scripts/validate-corpus.mjs`, `node scripts/test-l1.mjs`.

## Authority

This Skill compares and routes. It does not accept, publish, finalize, or
speak for the owner's preference — those stay with human/L2 review under
`editorial/HITL-PROTOCOL.md`, unconditionally, regardless of how many
dimensions favor the subject. A `PASS` from this Skill is a recommendation
that nothing here needs rework before human review, never a substitute for
that review.
