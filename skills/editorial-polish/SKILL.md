---
name: editorial-polish
version: 0.1.0
description: Improve rhythm, density, and editorial fit while leaving every fact, number, citation, quotation, and technical term exactly as it was.
when_not_to_use: Do not use to fix a factual problem — a wanted change to a protected span is a verification finding, not an edit. Do not use to make text read as less machine-written; that is not the objective.
inputs:
  - review draft
  - verified claim set
  - content-type profile
outputs:
  - polished draft
  - edit summary for every meaning-adjacent change
  - verification findings the polish pass exposed
requires:
  - the review draft
  - the verified claim set, to check that no protected span moved
authority:
  may:
    - change rhythm, connectives, ordering within a paragraph, and word choice outside the protected set
    - remove scaffolding, formulaic transitions, and unearned headings
    - reduce rhetorical inflation and unsupported certainty
  may_not:
    - alter a fact, number, unit, date, citation, quotation, or technical term
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
    - the draft still satisfies its content-type profile
    - an edit summary exists for every meaning-adjacent change
  fixtures:
    - evals/fixtures/golden/G-01-synthesis.md
---

# editorial-polish

## Purpose

The last editorial pass before a human reads the piece. It improves how the
argument lands. It does not touch what the argument claims.

This is **not a humanizer.** The objective is Suengj editorial fit with
factual and technical integrity preserved — never "reads as less
machine-written". No rule in this Skill, or in `voice.md`, exists to defeat a
detector.

## Inputs

The review draft, the verified claim set, and the content-type profile.

## Outputs

The polished draft, an edit summary covering every meaning-adjacent change,
and any verification findings the pass exposed.

## Preconditions

The draft exists and the claim set is available. Without the claim set the
protected spans cannot be checked, and an unchecked polish is a rewrite.

## Procedure

1. **Extract the protected spans** from the draft before editing anything:
   numbers with units, dates, citation markers, quotations, URLs, technical
   terms.
2. **Cut scaffolding** — formulaic transitions, headings that announce rather
   than divide, paragraphs that only preview the next one.
3. **Tighten rhythm and density** per `voice.md`. Three to six sentences a
   paragraph; the point, then the mechanism, then the consequence.
4. **Reduce listification** where prose carries the argument better. A list is
   right for parallel items and wrong for a chain of reasoning.
5. **Remove rhetorical inflation** — unsupported certainty, absolutes,
   openings and closings banned by `voice.md`.
6. **Re-extract the protected spans and compare.** Identical multisets, or the
   pass has failed.
7. **Write the edit summary** for anything a reader could call
   meaning-adjacent: a removed qualifier, a reordered claim, a merged
   paragraph.
8. **Hand off** to human review.

## Invariants

Across the whole pass, these are identical before and after:

facts · numbers and units · dates · citations and citation ids · quotations ·
URLs · technical terminology · the thesis and the direction of the argument ·
stated uncertainty and confidence · the marked distinction between fact and
interpretation

Direction matters in both cases: a removed number is a lost fact, an **added**
one is a fabrication. Both fail.

A verified draft cannot become unverified through stylistic editing. If it
could, the edit was not stylistic.

## Refusal conditions

This Skill stops rather than editing when:

- The claim set is unavailable — the protected spans cannot be checked.
- **A wanted edit would change a protected span.** The pass does not make the
  change. It reports a verification finding and hands it to `verify-claims`.
  Wanting to change a number is not permission to change it.
- The draft's meaning cannot be preserved under the profile's register — that
  is a drafting problem and goes back to `write-article`.

## Evidence

- `scripts/lib/polish-invariants.mjs` — protected spans identical before and
  after, checked in both directions.
- `npm run check:gates` — no reject-severity finding remains.
- `npm run check:profile` — the piece still fits its type. Different profiles
  must still sound different after polish; convergence on one register is a
  failure of this Skill.
- An edit summary exists for every meaning-adjacent change.

## Authority

This Skill changes how sentences read. It changes nothing about what they
assert. It does not verify, does not finalize, and does not publish; its
output goes to a human, who decides.
