---
name: editorial-polish
version: 0.3.0
description: Apply preservation-first, language-native polish to an already coherent target draft, accepting only bounded edits that clearly beat the incumbent.
when_not_to_use: Do not use to fix a factual problem or to perform audience/genre/depth reconstruction. Do not use to make text read as less machine-written; that is not the objective.
inputs:
  - review draft
  - verified claim set
  - content-type profile
  - source-target delta plan / intervention ceiling when available
outputs:
  - one action: KEEP, LOCAL_POLISH, or UPSTREAM_REPLAN_REQUIRED
  - polished draft when LOCAL_POLISH survives pairwise review
  - edit/revert summary for every proposed soft edit
  - verification, drafting, audience, genre, or terminology findings exposed by the pass
requires:
  - the review draft
  - the verified claim set, to check that no protected span moved
authority:
  may:
    - preserve the incumbent without proposing an edit
    - propose bounded changes to rhythm, connectives, local ordering, and word choice outside the protected set
    - remove local scaffolding, formulaic transitions, and rhetorical inflation when the candidate is clearly better
    - identify translationese and produce a bounded candidate when meaning is preserved
  may_not:
    - alter a fact, number, unit, date, citation, quotation, or protected technical term
    - alter the thesis or the direction of the argument
    - weaken or strengthen stated uncertainty
    - blur the marked line between fact and interpretation
    - re-run audience, genre, depth, or structural transformation
    - set an article to status published
    - record human approval
governed_by:
  - editorial/constitution.md
  - editorial/voice.md
  - editorial/profiles/
  - editorial/quality-gates.json
  - docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md
  - docs/architecture/SOURCE-TARGET-DELTA-PLANNING.md
  - docs/architecture/WRITER-MODEL-ROUTING.md
allowed_tools:
  - file_read
evidence:
  acceptance:
    - KEEP is accepted as a successful outcome when no material defect is evidenced
    - every accepted soft edit clearly beats the incumbent under pairwise review
    - polish invariants hold — protected spans are identical multisets before and after
    - no reject-severity gate finding remains
    - the draft still satisfies its content-type profile and register
    - edit/revert rationale exists for every proposed soft edit
  fixtures:
    - evals/fixtures/golden/G-01-synthesis.md
    - evals/fixtures/golden/G-04-research-native-korean.md
    - evals/fixtures/negative/N-04-translationese-prose.md
    - evals/fixtures/negative/N-05-overapplied-voice.md
---

# editorial-polish

## Purpose

The last language-quality decision before a human reads the piece. It improves
how an already coherent target draft lands **only when a bounded candidate is
clearly better than the incumbent**.

The default is preservation, not activity. `KEEP` is a first-class success.

This is **not a humanizer** and not a general rewrite engine. The objective is
language-native, publication-fit prose with factual and technical integrity
preserved. No rule here exists to defeat a detector, and no soft rule earns an
edit merely by firing.

## Inputs

The review draft, verified claim set, content-type profile, and — when the task
came through SUE-610 routing — the Source→Target Delta plan and intervention
ceiling.

## Outputs

Exactly one execution result:

```text
KEEP
LOCAL_POLISH
UPSTREAM_REPLAN_REQUIRED
```

`LOCAL_POLISH` additionally returns the accepted draft plus the candidates that
were accepted/reverted and why. `UPSTREAM_REPLAN_REQUIRED` names the owning
layer instead of silently re-authoring the article.

## Preconditions

The draft exists and is already a coherent target for its intended genre and
audience. The claim set is available. Without the claim set the protected spans
cannot be checked, and an unchecked polish is a rewrite.

If genre, audience, knowledge depth, information structure, or terminology has
a MATERIAL/LARGE unresolved delta owned upstream, stop and return
`UPSTREAM_REPLAN_REQUIRED`. Language Polish never hides an unfinished P2/P3
transformation.

For owner-facing or publication-intent prose, the runtime must provide
high-quality native-language judgment (`PROSE_HIGH` or equivalent under
`WRITER-MODEL-ROUTING.md`). A small edit surface is not evidence that the
judgment is easy.

## Capability contract

A detailed Manager prompt cannot compensate for weak local language judgment.
Polish often requires deciding **not** to change a sentence that matches a soft
pattern. The SUE-610 `…신호로 읽힌다` example is canonical: replacing it with
`…신호다` removed an interpretive hedge even though the passive detector fired.

Therefore:

- use capability sufficient to compare incumbent and candidate holistically;
- if the model cannot establish a clear gain, return KEEP/revert rather than
  manufacture activity;
- repeated inability to repair a bounded native-fluency defect is a
  Writer-capability escalation signal, not a reason to add more mandatory
  rules;
- a stronger model still receives only polish authority. Capability does not
  widen scope.

## Procedure

1. **Read the delta plan first.** Confirm the draft is at P0/P1 for the axes
   Language Polish is allowed to touch. If not, route upstream.
2. **Extract protected spans** before editing: numbers with units, dates,
   citation markers, quotations, URLs, and protected technical terms.
3. **Start from KEEP.** Do not create a candidate unless a concrete local
   defect is evidenced.
4. **Treat soft language traits as detectors.** Translationese, nominalization,
   passive/causative tendency, connective density, subject omission, rhythm,
   report compression, and similar traits may identify a location to inspect.
   They are not rewrite instructions.
5. **Propose the smallest candidate.** Prefer a phrase, sentence, or short
   passage. Preserve surrounding information order and rhythm unless the defect
   itself requires that local change.
6. **Pairwise-review ORIGINAL vs CANDIDATE.** Explicitly judge continuous
   readability, native naturalness, sentence/paragraph rhythm, repetition,
   over-explication, stiffness, information loss, semantic integrity, genre
   preservation, audience preservation, and domain-terminology preservation.
   Rule compliance is not an acceptance criterion.
7. **Revert ambiguity.** The candidate survives only when the improvement is
   clear enough to justify churn. A trade-off or `same` judgment returns the
   incumbent.
8. **Preserve completed audience work.** A child-facing draft whose vocabulary,
   explanation order, and scaffolding were already reconstructed upstream is
   not re-authored because child-language traits exist.
9. **Cut local scaffolding only when it is actually scaffolding.** Repeated
   `이 구분은`, `이 관점에서`, `따라서`, `반대로`, or similar forms are not
   banned. Remove them when the relation is already clear and the phrase is
   carrying no meaning.
10. **Let rhythm follow the thought.** There is no preferred sentence length or
    point→mechanism→consequence quota. Split/merge only when pairwise reading
    improves.
11. **Preserve the profile register.** Research may remain analytical, View
    personally owned, News compressed, Note loose, and Project
    decision-oriented. Polish must not converge them onto one generic report
    voice.
12. **Re-extract protected spans and compare.** Identical multisets, or the
    candidate fails.
13. **Record edit surface and rationale.** A large edit surface is an escalation
    signal, not automatically a failure; explain why the task is still polish
    or route it upstream.
14. **Return the final action**: KEEP, LOCAL_POLISH, or
    UPSTREAM_REPLAN_REQUIRED.

## When language repair is not a polish edit

Some problems are structural or sit inside the protected set.

- Wrong audience depth → Audience / Transformation.
- Wrong News/Report hierarchy → Genre / Frame / Transformation.
- Missing explanation → Audience / Frame.
- Wrong claim/source status → Verification / Frame.
- Wrong domain concept → Domain terminology / Source integrity.
- Accurate but awkward protected technical term → terminology/drafting finding,
  not a silent substitution.

This boundary is intentionally conservative. Naturalness is not permission to
mutate verified content or to redo upstream authorship.

## Invariants

Across an accepted LOCAL_POLISH pass, these are identical before and after:

facts · numbers and units · dates · citations and citation ids · quotations ·
URLs · protected technical terminology · thesis and argument direction · stated
uncertainty/confidence · marked fact/interpretation distinction · target genre ·
target audience

Direction matters both ways: a removed number is lost evidence; an added one is
fabrication. Both fail.

Natural prose is not regular prose. Sentence-length randomisation, paragraph
quotas, and detector-oriented variation are out of scope.

## Refusal / escalation conditions

Return `UPSTREAM_REPLAN_REQUIRED` rather than editing when:

- the claim set is unavailable;
- a wanted edit would change a protected span;
- the draft's audience, genre, knowledge depth, or structure is not yet the
  requested target;
- making the Korean natural requires changing thesis, factual qualification,
  or domain concept;
- the local edit would grow into broad re-authoring;
- multiple review cycles identify the same prose failure and the current Writer
  cannot produce a clearly better bounded candidate — escalate Writer
  capability or regenerate from `write-article` instead of looping.

Return `KEEP` when no material defect is evidenced or when every candidate is
ambiguous/worse.

## Evidence

- `scripts/lib/polish-invariants.mjs` — protected spans identical before and
  after, checked in both directions.
- `evals/dogfood/2026-09-05-sue610-conservative-polish/` — 7 proposed, 3
  accepted, 4 reverted; includes churn, child no-double-authoring, unseen-topic,
  and zero-candidate KEEP cases.
- `evals/dogfood/2026-09-05-strong-writer-routing/README.md` — owner evidence for
  treating prose capability/context as a routing variable; not a controlled
  provider/model benchmark.
- `npm run check:gates` — no reject-severity finding remains.
- `npm run check:profile` — the piece still fits its type.
- `npm run test:eval` — N-04/N-05 preserve prose failures a mechanical gate must
  not pretend to solve.

## Authority

This Skill changes how bounded spans read, or decides to change nothing. It
changes nothing about what the article asserts. It does not verify, finalize,
publish, or record human approval.
