---
name: write-article
version: 0.2.0
description: Draft a review-state article from an approved frame and a verified claim set, arguing the thesis rather than walking the sources.
when_not_to_use: Do not use without a frame — inventing a thesis while drafting is the failure this Skill exists to prevent. Do not use for voice polishing, which is editorial-polish.
inputs:
  - article frame
  - verified claim set
  - content-type profile
  - evidence visuals produced during research
outputs:
  - review draft in Markdown, with citation anchors intact
  - claims that drafting exposed as unsupported
  - optional presentation plan (semantic roles only, never appearance)
requires:
  - the article frame, including its thesis and structure
  - the verified claim set from verify-claims
  - the content-type profile
authority:
  may:
    - choose paragraph order, emphasis, and where evidence lands
    - reorder or merge the frame's proposed structure when the argument calls for it
    - report that a connective claim the draft needs is unsupported
  may_not:
    - introduce a thesis the frame does not contain
    - emit HTML, CSS, colour values, or renderer component names
    - assert a claim absent from the verified claim set
    - set an article to status published
    - record human approval
    - imply that a draft has been reviewed
governed_by:
  - editorial/constitution.md
  - editorial/voice.md
  - editorial/profiles/
  - editorial/quality-gates.json
  - editorial/presentation.md
allowed_tools:
  - file_read
evidence:
  acceptance:
    - the draft passes the mechanical quality gates with no reject-severity finding
    - every citation anchor in the draft resolves to a verified claim
    - the article satisfies its content-type profile
    - the resulting article state is drafted, never final
  fixtures:
    - evals/fixtures/golden/G-01-synthesis.md
    - evals/fixtures/negative/N-01-sue-417-shape.md
---

# write-article

## Purpose

Turn an approved frame and a verified claim set into a draft worth a human's
review. The draft argues the thesis; it does not tour the sources.

## Inputs

The frame, the verified claim set, the content-type profile, and any evidence
visuals produced during research. Only these — the constitution, the voice,
and the one relevant profile. Not every profile, and not the source bodies
again.

## Outputs

A review draft in Markdown with citation anchors intact, plus a list of any
connective claims the draft turned out to need and the claim set does not
contain.

## Preconditions

The frame exists and carries a thesis. The claim set exists and has been
through `verify-claims`. The profile is loaded, because it sets both the
structure default and the evidence burden.

## Procedure

1. **Start from the thesis**, not from the first source. The opening paragraph
   states the position or the question, per `voice.md`.
2. **Build sections around moves in the argument** — a distinction, a
   mechanism, a consequence — not around sources. Where a paragraph draws on
   more than one source, that is usually the paragraph doing the real work.
3. **Mark the register.** Sourced fact, our interpretation, and hypothesis are
   distinguishable sentence by sentence, in wording as well as structure.
4. **Let the evidence visuals argue.** A chart built during research may
   reorder the piece or change its conclusion; that is what it was for. If a
   visual contradicts the drafted claim, the claim is wrong, not the visual.
5. **Carry the anchors.** Every claim keeps its citation from the claim set.
   Anchors are copied, never re-derived.
6. **Use an analogue only if it sharpens the thesis** and is itself verified.
   An unverified analogue is a decorative claim.
7. **Report the gaps.** A connective claim the argument needs and the claim
   set lacks goes back to `verify-claims`. It is not written as though
   supported, and it is not smoothed into a hedge.
8. **Optionally assign semantic roles.** Where a passage's information
   function is not prose — a comparison, a caution, an ordered procedure — it
   may carry a role from the presentation vocabulary. This is optional, it is
   never required by length, and the plan must satisfy the losslessness rule:
   removing every block leaves the canonical Markdown complete.

   Roles only. No colour, no CSS, no component name — the schema cannot
   express them and the validator rejects them in the text.
9. **Hand off** to `editorial-polish` in `drafted` state.

## Invariants

- The thesis is the frame's thesis. Drafting never introduces a new one.
- No assertion outside the verified claim set, except explicitly marked
  interpretation.
- Every citation anchor present in the claim set survives into the draft.
- The article state after this Skill is `drafted`. Never `final`.
- The profile's evidence burden holds in the finished draft, not just in the
  frame.
- If a presentation plan is produced, the canonical Markdown is complete
  without it. Presentation metadata never hides or substitutes for a fact, a
  citation, a qualification, or a stated uncertainty.

## Refusal conditions

This Skill stops rather than drafting when:

- The frame is missing, or its thesis is absent. **Inventing a thesis while
  drafting is exactly the failure this Skill exists to prevent.**
- The claim set is missing, or claims material to the thesis are
  `unsupported` or `contradictory` and unresolved. Missing critical evidence
  fails visibly; it is not papered over with a hedge.
- The evidence available cannot meet the profile's burden. The correct
  response is to return to framing, not to write a thinner piece.

## Evidence

- `npm run check:gates` — no reject-severity finding on the draft.
- `npm run check:profile` — the profile's burden is met.
- `npm run validate:presentation` — when a plan is produced: renderer-neutral,
  and every block's fallback lossless.
- Every citation anchor resolves to a `verified` claim.
- Resulting state is `drafted`.

## Authority

This Skill writes. It does not decide what is true, does not finalize, and
does not publish. A draft it produces has not been reviewed, and nothing in
its output may suggest otherwise.
