---
name: write-article
version: 0.5.0
description: Draft a review-state article from an approved frame and a verified claim set, arguing the thesis rather than walking the sources.
when_not_to_use: Do not use without a frame — inventing a thesis while drafting is the failure this Skill exists to prevent. Do not use for voice polishing, which is editorial-polish.
inputs:
  - article frame
  - verified claim set
  - content-type profile
  - source-target delta plan when the task adapts an incumbent/source into a materially different target
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
  - docs/architecture/SOURCE-TARGET-DELTA-PLANNING.md
  - docs/architecture/WRITER-MODEL-ROUTING.md
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
    - evals/fixtures/negative/N-06-source-tour.md
---

# write-article

## Purpose

Turn an approved frame and a verified claim set into a draft worth a human's
review. The draft argues the thesis; it does not tour the sources and it does
not reproduce the surface shape of the reference corpus.

A source-rich draft can still be editorially empty. Reading twelve files does
not create an obligation to mention twelve files, and understanding every
module in a repository does not make the repository tree a narrative. The
Writer is rewarded for the minimum set of material that earns the thesis, not
for demonstrating coverage.

The Writer is also a **load-bearing quality surface**. A Manager can specify the
thesis, audience, evidence burden, and prohibited moves, but it does not choose
every collocation, particle, omission, sentence boundary, connective, or
paragraph rhythm. Those decisions are realised here. For owner-facing or
publication-intent prose, the orchestration layer must therefore satisfy the
`PROSE_HIGH` capability contract in
`docs/architecture/WRITER-MODEL-ROUTING.md`; a stronger Manager or Reviewer is
not a reason to downgrade the Writer.

## Inputs

The frame, the verified claim set, the content-type profile, the source→target
delta plan when material adaptation is involved, and any evidence visuals
produced during research. Only the context needed to make the target coherent —
the constitution, the voice, the relevant profiles, and the load-bearing source
truth. Not every profile, and not source bodies reloaded as prose exemplars.

Sources supply evidence. They do **not** supply the sentence order, section
order, or coverage target the Writer should reproduce.

## Outputs

A review draft in Markdown with citation anchors intact, plus a list of any
connective claims the draft turned out to need and the claim set does not
contain.

## Preconditions

The frame exists and carries a thesis. The claim set exists and has been
through `verify-claims`. The profile is loaded, because it sets both the
structure default, the register, and the evidence burden.

When the task transforms an incumbent/source into a different genre, audience,
depth, register, or information structure, the Source→Target Delta plan exists
and the owning upstream layer has already performed any required P2/P3 work.
This Skill must not silently turn a P2/P3 transformation into prose-level
polish.

For owner-facing or publication-intent prose, the orchestration route identifies
a Writer capable of native long-context prose judgment (`PROSE_HIGH` or an
equivalent runtime class). Capability class is provider-neutral; the rule is
about the work, not a model brand.

The frame must be able to answer the reader contract: who the piece is for,
what understanding changes, what one sentence should survive, and the minimum
argument path that earns it. If drafting reveals that these are not actually
clear, return to framing rather than improvise an outline from the sources.

## Capability contract

`Manager`, `Writer`, and `Reviewer` are authority roles, not a model-quality
ranking.

- A strong Manager does not make Writer realization quality interchangeable.
- A strong Reviewer can diagnose weak prose but does not improve the accepted
  artifact unless a capable Writer is invoked again.
- One coherent prose pass has one Writer authority. Parallel alternatives are
  allowed, but paragraph-level outputs are not mechanically stitched together.
- Context is part of capability. The Writer receives the approved frame,
  verified source truth, target profile, relevant delta plan, and applicable
  owner evidence rather than reconstructing them from a long chat transcript.
- Cost optimisation may use cheaper models for SUPPORT work around drafting;
  it must not automatically demote the final prose Writer.

If repeated review cycles return the same native-fluency/readability/register
failure, the Manager must consider Writer-capability escalation instead of
adding more style rules or looping the same weak realization indefinitely.

## Procedure

1. **Enter the actual argument, not the first source.** The opening starts at
   the problem, observation, tension, event, or position the piece is about.
   The thesis becomes legible early, but `voice.md` does not require every
   content type to announce it in the first sentence.
2. **Write from the reader contract.** The draft should move the intended
   reader from their starting understanding to the frame's core message. A
   section exists only when that movement needs it.
3. **Respect the delta plan.** Preserve axes already at LOW/P0. Realise the
   upstream P2/P3 decisions that have already been made; do not re-expand scope
   simply because the Writer is capable of doing so.
4. **Ignore source topology while composing.** README headings, repository
   directories, report chapters, search-result order, interview order, and
   research-note order are not draft scaffolds. Use them only when the
   relationship they encode is itself part of the thesis.
5. **Load the profile's register before choosing prose shape.** Research is
   evidence-led, View owns its judgment, News is compressed and event-led,
   Note may be loose, and Project is decision-oriented. Shared voice does not
   mean shared sentence architecture.
6. **Build around the work the argument actually needs.** A mechanism,
   boundary, consequence, comparison, chronology, example, or clarification
   may organise a passage. A distinction is one possible move, not the default.
   Do not create `A is not B` constructions to imitate a recognisable house
   style.
7. **Treat the subject as evidence when the larger claim demands it.** In a
   project-introduction or source-derived essay, the project may be the case
   through which a broader problem becomes concrete. Do not turn that into a
   feature inventory unless the Project profile and the reader's question
   genuinely require one.
8. **Let consulted material disappear.** A source that shaped the research but
   does no load-bearing work in the final argument need not appear in a
   paragraph or heading. Citation completeness means every used claim is
   traceable, not every consulted source is displayed.
9. **Compose in the publication language.** For Korean pieces, write the
   reasoning in Korean rather than translating source-language discourse order.
   Keep an English term only when it is the domain-native professional usage or
   when translation loses precision. Remove English noun accumulation that
   exists only to make the prose look technical.
10. **Mark the epistemic register.** Sourced fact, our interpretation, and
    hypothesis are distinguishable sentence by sentence, in wording as well as
    structure.
11. **Let explanation earn space.** Density is not compression. A paragraph may
    slow down to make a difficult inference legible without adding another
    citation, number, or rhetorical contrast.
12. **Let the evidence visuals argue.** A chart built during research may
    reorder the piece or expose a problem in the frame. If a visual contradicts
    a drafted claim, report the claim problem; do not smooth around it.
13. **Carry the anchors.** Every claim keeps its citation from the claim set.
    Anchors are copied, never re-derived.
14. **Use an analogue only if it sharpens the thesis** and is itself verified.
    An unverified analogue is a decorative claim.
15. **Run the section-necessity test.** For every section, ask: if this section
    disappears, does the thesis lose evidence, mechanism, boundary, consequence,
    or necessary explanation? If not, cut it. "It was in the repository" and
    "we researched it" are not reasons to keep it.
16. **Run the topology test.** Read only the headings. If they could plausibly
    be a README table of contents, source list, product feature list, or report
    chapter list, the draft is probably a tour. Rebuild the structure around
    the argument before polish.
17. **Report the gaps.** A connective claim the argument needs and the claim
    set lacks goes back to `verify-claims`. It is not written as though
    supported, and it is not smoothed into a hedge.
18. **Optionally assign semantic roles.** Where a passage's information
    function is not prose — a comparison, a caution, an ordered procedure — it
    may carry a role from the presentation vocabulary. This is optional, never
    required by length, and the plan must satisfy the losslessness rule:
    removing every block leaves the canonical Markdown complete.

    Roles only. No colour, no CSS, no component name — the schema cannot
    express them and the validator rejects them in the text.
19. **Hand off** to `editorial-polish` in `drafted` state.

## Invariants

- The thesis is the frame's thesis. Drafting never introduces a new one.
- No assertion outside the verified claim set, except explicitly marked
  interpretation.
- Every citation anchor present in the claim set survives into the draft when
  its claim is used; unused verified claims need not be forced into the prose.
- The article state after this Skill is `drafted`. Never `final`.
- The profile's evidence burden holds in the finished draft, not just in the
  frame.
- The profile's register remains recognisable; content types do not converge on
  one generic analytical voice.
- A stronger Manager/Reviewer never widens the Writer's authority and never
  removes the final-prose capability floor.
- One accepted coherent prose pass has one identifiable Writer authority.
- No rhetorical move has a quota. A Writer that repeats a corpus tendency to
  signal authorship has failed `voice-fit` even when each sentence is locally
  acceptable.
- For Korean output, grammatical correctness alone is insufficient if the
  discourse skeleton remains visibly translated from English.
- Source coverage is not a quality metric. Argument coverage is.
- Headings and paragraph order are defensible from the thesis without needing
  the source list, repository tree, or research chronology as explanation.
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
- A material source→target gap is still owned by Audience/Genre/Transformation
  and has not been resolved upstream. Prose realization cannot substitute for
  an absent P2/P3 decision.
- The orchestration route explicitly assigns publication-intent prose to a
  SUPPORT-only Writer lane. Re-route instead of pretending a detailed Manager
  prompt removes the capability gap.
- The frame can be satisfied only by turning challenge evidence into a fake
  binary opposition or by overstating what one side establishes.
- The only available outline mirrors source order, repository topology, or a
  feature inventory. Return to `frame-article`; prose cannot repair a missing
  synthesis decision.

## Evidence

- `npm run check:gates` — no reject-severity finding on the draft.
- `npm run check:profile` — the profile's burden is met.
- `npm run validate:presentation` — when a plan is produced: renderer-neutral,
  and every block's fallback lossless.
- `npm run test:eval` — includes `G-04` alternate Research prose, `N-04`
  translationese, `N-05` style overfit, and `N-06` source-tour failure.
- `evals/dogfood/2026-09-05-strong-writer-routing/README.md` — owner evidence
  that Writer capability/context remains load-bearing even under strong
  orchestration; explicitly not a controlled vendor/model benchmark.
- Every citation anchor resolves to a `verified` claim.
- Resulting state is `drafted`.

## Authority

This Skill writes. It does not decide what is true, does not finalize, and
does not publish. A draft it produces has not been reviewed, and nothing in
its output may suggest otherwise.
