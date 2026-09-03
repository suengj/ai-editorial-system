---
name: plan-artifacts
version: 0.3.1
description: Decide which derived artifacts an article actually warrants and emit generator-neutral plans with lineage attached.
when_not_to_use: Do not use to render anything — this Skill plans, generators render. Do not use to decide what the article argues.
inputs:
  - article frame or final article
  - verified claim set
  - content-type profile
  - editorial/artifact-priority.json
outputs:
  - artifact plan conforming to artifact-plan.schema.json
  - a recommended / optional / skip verdict per artifact kind
requires:
  - the article, with its version_number, content_hash, and claims_hash
  - the verified claim set, for any artifact that will assert a fact
  - the content-type profile, which decides artifact fit
authority:
  may:
    - recommend, mark optional, or skip any artifact kind
    - specify what an artifact must accomplish and which claims it carries
    - decline every artifact for an article that warrants none
  may_not:
    - render or generate an artifact
    - assign a claim an artifact may carry that the claim set does not contain as verified
    - plan a distribution artifact for an article that is not final or published
    - set an article to status published
    - record human approval
governed_by:
  - editorial/constitution.md
  - editorial/profiles/
  - editorial/MEDIA-STRATEGY.md
  - editorial/VISUAL-INFORMATION-GAIN.md
  - editorial/VISUAL-STORY-COMPILATION.md
  - editorial/AUDIO-SCRIPT.md
  - editorial/artifact-priority.json
allowed_tools:
  - file_read
evidence:
  acceptance:
    - the plan validates against artifact-plan.schema.json
    - every non-skipped fact-bearing artifact lists claim_ids that are verified on the article
    - no planned kind is listed inappropriate by the content-type profile
    - every planned article-body visual names concrete information gain beyond the adjacent representation or explicitly replaces/repositions that representation
    - the plan carries article_ref with both hashes
  fixtures:
    - schemas/examples/artifact-plan.example.json
---

# plan-artifacts

## Purpose

Decide what is worth building from an article, and describe it precisely
enough that any competent downstream compiler/renderer can build it — without
naming one.

The plan is the versioned artifact. The rendered output is a build product.
That is what keeps generators replaceable: swapping one changes
`generator.tool` in the lineage and nothing in the editorial semantics.

This Skill owns **whether and why** an artifact exists. It does not independently
write the full slide sequence, infographic modules, spoken narration, or video
storyboard.

## Inputs

The article (frame during research, final article afterwards), the verified
claim set, the content-type profile, and the priority order.

## Outputs

An artifact plan (`schemas/artifact-plan.schema.json`): one decision per
artifact kind, each with a verdict, a reason, and — when not skipped — a
generator-neutral spec and the claims the artifact will carry.

## Preconditions

The article carries `version_number`, `content_hash`, and `claims_hash`. The
claim set is available. The profile is loaded, because it decides which kinds
are appropriate at all.

## Procedure

1. **Split by stage.** Evidence media — `evidence_visual`, `sources` — is
   planned during research, from a framed article. Distribution media is
   planned only for a `final` or `published` article.
2. **Apply the profile.** Kinds the profile lists `inappropriate` are skipped
   with that as the reason. No further reasoning needed.
3. **Decide per kind**, in priority order, and record a reason for every
   verdict including `skip`. An article that warrants nothing gets a plan of
   skips, and that is a correct output.
4. **For every article-body visual candidate, run the visual information-gain
   gate before choosing a renderer.** Inspect the adjacent semantic blocks —
   prose, list, code block, table, equation, or existing visual — and name what
   the proposed visual adds that those blocks do not already expose. Classify
   the integration as `add`, `replace`, `reposition`, or `skip`. A diagram that
   merely redraws an immediately preceding sequence, matrix, pairing, or
   hierarchy is not approved just because it is accurate. If there is no
   concrete marginal information gain, skip it or replace the redundant
   existing representation rather than stacking both. Follow
   `editorial/VISUAL-INFORMATION-GAIN.md`.
5. **For an evidence visual**, state the single question it must answer, the
   claims and data behind it, the form, and **where it feeds back** — what it
   would mean if the visual does not show what was expected. A visual with no
   question is decoration; a visual with no feedback point is being planned
   too late. Evidence can legitimately overlap the prose conclusion when the
   chart/table adds inspectable source-derived data rather than merely
   re-typesetting the claim.
6. **For a brief**, state the information hierarchy, most load-bearing first,
   and the claims it carries.
7. **For slides/carousel or infographic/poster**, state intended audience,
   consumption surface, rough scope/page-module target when useful, carried
   claims, and what the artifact must accomplish. Do not independently write
   the full surface sequence here. When one or more visual/spoken surfaces are
   approved for the same article, hand this plan to `compile-visual-story` so
   they share one beat graph.
8. **For audio**, decide whether listening adds a useful consumption surface,
   identify audience/listening context and carried claims, and declare whether
   downstream narration is `free` or genuinely `timed`. Do not write the
   spoken script here. A non-skipped audio decision ultimately hands off to
   `compile-audio-script`, which owns the Article → listener-first rewrite. If
   audio participates in a multi-surface story, `compile-visual-story` may
   first provide the shared beat/dependency map; it does not replace the audio
   compiler.
9. **For video**, justify it against the priority order, state the intended
   consumption context and carried claims, and identify whether the video is an
   assembled visual story over planned static/audio artifacts. Do not create a
   separate video outline here. Approved multi-surface video hands off through
   `compile-visual-story` → visual/audio surface compilation →
   `VIDEO-STORYBOARD.md` temporal assembly.
10. **Attach lineage.** `article_ref` with both hashes, so anything built from
    this plan can be classified fresh, cosmetically stale, or materially stale
    without inspecting it.

## Visual information-gain notes

For a non-trivial article-body visual, the planner should be able to record the
following renderer-neutral state, even when the current schema stores part of
it in prose/spec fields rather than dedicated properties:

```yaml
visual_information_gain:
  adjacent_representation:
    type: prose | code_block | table | list | visual | mixed
    summary: what the nearby article already communicates
  proposed_visual_payload: what the visual communicates on first read
  new_information:
    - the specific structure / relationship / comparison added
  redundancy_risk: low | medium | high
  integration_strategy: add | replace | reposition | skip
  replacement_target: optional semantic anchor
```

This is a semantic gate, not a target image count. `2–3 visuals` may be a
planning ceiling or rough heuristic for a particular publication, but it is
never a quota. Once high-gain opportunities are exhausted, the remaining
visual decisions are `skip`.

## Invariants

- Every kind considered appears in `decisions`, including the skipped ones. A
  silent omission is indistinguishable from an oversight.
- `carries_claims` contains only `claim_id`s that are `verified` on the
  article. An artifact may not introduce a claim the article does not make.
- A distribution artifact is never planned for an article below `final`.
- An article-body visual may not be approved merely because the adjacent text
  is visualizable. It must name marginal information gain or explicitly
  replace/reposition the equivalent visible representation.
- A code/list/table immediately followed by a diagram with the same first-read
  semantic payload is a regression unless the duplicate representation has a
  documented reason.
- An audio plan describes purpose, carried claims, listening context, and any
  real timing constraint; it does not contain provider syntax or a finished
  narration script.
- A multi-surface artifact decision is not a shared storyboard; beat sequencing
  belongs to `compile-visual-story` when that Skill is needed.
- The spec describes what the artifact must accomplish, never how a named tool
  should do it.
- The plan carries `article_ref` with `content_hash` and `claims_hash`.

## Refusal conditions

This Skill stops rather than planning when:

- The article lacks a version identity — without both hashes, nothing built
  from the plan can ever be classified stale.
- The claim set is unavailable and any candidate artifact would assert a fact.
- A distribution artifact is requested for an article that is not `final` or
  `published`. The request is refused, not deferred quietly.

`skip` is a first-class verdict. Nothing here forces media onto an article
that does not need it, and no content type is obliged to produce any artifact.

## Evidence

- The plan validates against `schemas/artifact-plan.schema.json`.
- Every non-skipped fact-bearing artifact's `carries_claims` resolve to
  verified claims.
- No planned kind is `inappropriate` for the content type.
- Every planned article-body visual has a concrete information-gain rationale
  or an explicit replacement/reposition strategy for overlapping content.
- `article_ref` carries both hashes.

Run: `npm run validate:plan`.

## Authority

This Skill plans. It does not render, does not decide what the article argues,
and does not publish. A plan is not an artifact, and an artifact is not an
approval. For audio, it decides **whether and why** to build;
`compile-audio-script` decides **how the finalized article becomes spoken
structure**. For approved multi-surface visual/video work,
`compile-visual-story` decides **how those approved surfaces share one semantic
beat graph**.
