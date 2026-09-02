---
name: editorial-polish
version: 0.2.0
description: Improve rhythm, language-native prose, density, and editorial fit while leaving every fact, number, citation, quotation, and protected technical term exactly as it was.
when_not_to_use: Do not use to fix a factual problem — a wanted change to a protected span is a verification finding, not an edit. Do not use to make text read as less machine-written; that is not the objective.
inputs:
  - review draft
  - verified claim set
  - content-type profile
outputs:
  - polished draft
  - edit summary for every meaning-adjacent change
  - verification or drafting findings the polish pass exposed
requires:
  - the review draft
  - the verified claim set, to check that no protected span moved
authority:
  may:
    - change rhythm, connectives, ordering within a paragraph, and word choice outside the protected set
    - remove scaffolding, formulaic transitions, and unearned headings
    - reduce rhetorical inflation and unsupported certainty
    - remove translationese when the correction does not alter a protected span
  may_not:
    - alter a fact, number, unit, date, citation, quotation, or protected technical term
    - alter the thesis or the direction of the argument
    - weaken or strengthen stated uncertainty
    - blur the marked line between fact and interpretation
    - set an article to status published
    - record human approval
governed_by:
  - editorial/constitution.md
  - editorial/voice.md
  - editorial/profiles/
  - editorial/quality-gates.json
allowed_tools:
  - file_read
evidence:
  acceptance:
    - polish invariants hold — protected spans are identical multisets before and after
    - no reject-severity gate finding remains
    - the draft still satisfies its content-type profile and register
    - an edit summary exists for every meaning-adjacent change
  fixtures:
    - evals/fixtures/golden/G-01-synthesis.md
    - evals/fixtures/golden/G-04-research-native-korean.md
    - evals/fixtures/negative/N-04-translationese-prose.md
    - evals/fixtures/negative/N-05-overapplied-voice.md
---

# editorial-polish

## Purpose

The last editorial pass before a human reads the piece. It improves how the
argument lands. It does not touch what the argument claims.

This is **not a humanizer.** The objective is language-native, publication-fit
prose with factual and technical integrity preserved — never "reads as less
machine-written". No rule in this Skill, or in `voice.md`, exists to defeat a
detector.

## Inputs

The review draft, the verified claim set, and the content-type profile.

## Outputs

The polished draft, an edit summary covering every meaning-adjacent change,
and any verification or drafting findings the pass exposed.

## Preconditions

The draft exists and the claim set is available. Without the claim set the
protected spans cannot be checked, and an unchecked polish is a rewrite.

## Procedure

1. **Extract the protected spans** from the draft before editing anything:
   numbers with units, dates, citation markers, quotations, URLs, technical
   terms.
2. **Cut scaffolding.** Remove headings that announce rather than divide,
   paragraphs that preview the next one, and connective phrases that merely
   narrate the logic.
3. **Check the language as language.** For Korean, ask whether the sentence
   sounds composed in Korean or whether an English discourse skeleton is still
   visible underneath it. Repeated "이 구분은", "이 관점에서", "따라서",
   "반대로", or similar connectives are not banned; remove or rewrite them when
   the relation is already clear and the phrase is carrying scaffolding rather
   than meaning.
4. **Let rhythm follow the thought.** There is no target of three-to-six
   sentences, no preferred sentence length, and no required
   point→mechanism→consequence pattern. Split or merge only when the reader's
   understanding improves.
5. **Check for signature-move overfit.** A distinction, concession, or contrast
   can be characteristic without becoming a quota. If successive paragraphs
   repeat the same `A is not B` move, rewrite the surface relation where the
   material supports a different structure. Do not preserve repetition merely
   because it resembles the reference corpus.
6. **Preserve the profile register.** Research may remain analytical, View
   personally owned, News compressed, Note loose, and Project
   decision-oriented. Polish must not converge them onto one generic report
   voice.
7. **Reduce listification** where prose carries the argument better. A list is
   right for genuinely parallel items and wrong for a chain of reasoning.
8. **Remove rhetorical inflation** — unsupported certainty, absolutes, and
   openings or closings banned by `voice.md`.
9. **Re-extract the protected spans and compare.** Identical multisets, or the
   pass has failed.
10. **Write the edit summary** for anything a reader could call
    meaning-adjacent: a removed qualifier, a reordered claim, a merged
    paragraph, or a connective whose removal changes perceived emphasis.
11. **Hand off** to human review.

## When language repair is not a polish edit

Some language problems sit inside the protected set. For example, a Korean
draft may contain an English technical term that is accurate but unnatural for
that domain. If replacing it would alter a protected technical term,
`editorial-polish` must **not** silently fix it. Record a terminology/drafting
finding and return it to the appropriate earlier step.

This boundary matters: the system should improve Korean prose, but it should
not use "naturalness" as permission to mutate verified technical content.

## Invariants

Across the whole pass, these are identical before and after:

facts · numbers and units · dates · citations and citation ids · quotations ·
URLs · protected technical terminology · the thesis and the direction of the
argument · stated uncertainty and confidence · the marked distinction between
fact and interpretation

Direction matters in both cases: a removed number is a lost fact, an **added**
one is a fabrication. Both fail.

A verified draft cannot become unverified through stylistic editing. If it
could, the edit was not stylistic.

Natural prose is not regular prose. Sentence-length randomisation, paragraph
quotas, and detector-oriented variation are explicitly out of scope.

## Refusal conditions

This Skill stops rather than editing when:

- The claim set is unavailable — the protected spans cannot be checked.
- **A wanted edit would change a protected span.** The pass does not make the
  change. It reports the finding; when the protected span is factual or
  technical, it hands it to `verify-claims`, while a register-only problem goes
  back to `write-article`. Wanting to change a number or technical term is not
  permission to change it.
- The draft's meaning cannot be preserved under the profile's register — that
  is a drafting problem and goes back to `write-article`.
- The only way to make the Korean read naturally is to change the thesis,
  technical terminology, or factual qualification. That is not polish.

## Evidence

- `scripts/lib/polish-invariants.mjs` — protected spans identical before and
  after, checked in both directions.
- `npm run check:gates` — no reject-severity finding remains.
- `npm run check:profile` — the piece still fits its type. Different profiles
  must still sound different after polish; convergence on one register is a
  failure of this Skill.
- `npm run test:eval` — `N-04` and `N-05` preserve prose failures that a
  mechanical gate must not pretend to solve.
- An edit summary exists for every meaning-adjacent change.

## Authority

This Skill changes how sentences read. It changes nothing about what they
assert. It does not verify, does not finalize, and does not publish; its output
goes to a human, who decides.
