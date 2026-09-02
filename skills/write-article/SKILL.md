---
name: write-article
version: 0.3.0
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
    - evals/fixtures/golden/G-04-research-native-korean.md
    - evals/fixtures/negative/N-04-translationese-prose.md
    - evals/fixtures/negative/N-05-overapplied-voice.md
---

# write-article

## Purpose

Turn an approved frame and a verified claim set into a draft worth a human's
review. The draft argues the thesis; it does not tour the sources and it does
not reproduce the surface shape of the reference corpus.

## Inputs

The frame, the verified claim set, the content-type profile, and any evidence
visuals produced during research. Only these — the constitution, the voice,
and the one relevant profile. Not every profile, and not the source bodies
again as prose exemplars.

Sources supply evidence. They do **not** supply the sentence order the Writer
should translate into Korean.

## Outputs

A review draft in Markdown with citation anchors intact, plus a list of any
connective claims the draft turned out to need and the claim set does not
contain.

## Preconditions

The frame exists and carries a thesis. The claim set exists and has been
through `verify-claims`. The profile is loaded, because it sets both the
structure default, the register, and the evidence burden.

## Procedure

1. **Enter the actual argument, not the first source.** The opening starts at
   the problem, observation, tension, event, or position the piece is about.
   The thesis becomes legible early, but `voice.md` does not require every
   content type to announce it in the first sentence.
2. **Load the profile's register before choosing prose shape.** Research is
   evidence-led, View owns its judgment, News is compressed and event-led,
   Note may be loose, and Project is decision-oriented. Shared voice does not
   mean shared sentence architecture.
3. **Build around the work the argument actually needs.** A mechanism,
   boundary, consequence, comparison, chronology, example, or clarification
   may organise a passage. A distinction is one possible move, not the default.
   Do not create `A is not B` constructions to imitate a recognisable house
   style.
4. **Compose in the publication language.** For Korean pieces, write the
   reasoning in Korean rather than translating source-language discourse order.
   Keep an English term only when it is the domain-native professional usage or
   when translation loses precision. Remove English noun accumulation that
   exists only to make the prose look technical.
5. **Mark the epistemic register.** Sourced fact, our interpretation, and
   hypothesis are distinguishable sentence by sentence, in wording as well as
   structure.
6. **Let explanation earn space.** Density is not compression. A paragraph may
   slow down to make a difficult inference legible without adding another
   citation, number, or rhetorical contrast.
7. **Let the evidence visuals argue.** A chart built during research may
   reorder the piece or expose a problem in the frame. If a visual contradicts
   a drafted claim, report the claim problem; do not smooth around it.
8. **Carry the anchors.** Every claim keeps its citation from the claim set.
   Anchors are copied, never re-derived.
9. **Use an analogue only if it sharpens the thesis** and is itself verified.
   An unverified analogue is a decorative claim.
10. **Report the gaps.** A connective claim the argument needs and the claim
    set lacks goes back to `verify-claims`. It is not written as though
    supported, and it is not smoothed into a hedge.
11. **Optionally assign semantic roles.** Where a passage's information
    function is not prose — a comparison, a caution, an ordered procedure — it
    may carry a role from the presentation vocabulary. This is optional, never
    required by length, and the plan must satisfy the losslessness rule:
    removing every block leaves the canonical Markdown complete.

    Roles only. No colour, no CSS, no component name — the schema cannot
    express them and the validator rejects them in the text.
12. **Hand off** to `editorial-polish` in `drafted` state.

## Invariants

- The thesis is the frame's thesis. Drafting never introduces a new one.
- No assertion outside the verified claim set, except explicitly marked
  interpretation.
- Every citation anchor present in the claim set survives into the draft.
- The article state after this Skill is `drafted`. Never `final`.
- The profile's evidence burden holds in the finished draft, not just in the
  frame.
- The profile's register remains recognisable; content types do not converge on
  one generic analytical voice.
- No rhetorical move has a quota. A Writer that repeats a corpus tendency to
  signal authorship has failed `voice-fit` even when each sentence is locally
  acceptable.
- For Korean output, grammatical correctness alone is insufficient if the
  discourse skeleton remains visibly translated from English.
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
- The frame can be satisfied only by turning challenge evidence into a fake
  binary opposition or by overstating what one side establishes.

## Evidence

- `npm run check:gates` — no reject-severity finding on the draft.
- `npm run check:profile` — the profile's burden is met.
- `npm run validate:presentation` — when a plan is produced: renderer-neutral,
  and every block's fallback lossless.
- `npm run test:eval` — includes `G-04` alternate Research prose, `N-04`
  translationese, and `N-05` style-overfit fixtures.
- Every citation anchor resolves to a `verified` claim.
- Resulting state is `drafted`.

## Authority

This Skill writes. It does not decide what is true, does not finalize, and
does not publish. A draft it produces has not been reviewed, and nothing in
its output may suggest otherwise.
