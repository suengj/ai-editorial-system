---
name: plan-artifacts
version: 0.2.0
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
  - editorial/AUDIO-SCRIPT.md
  - editorial/artifact-priority.json
allowed_tools:
  - file_read
evidence:
  acceptance:
    - the plan validates against artifact-plan.schema.json
    - every non-skipped fact-bearing artifact lists claim_ids that are verified on the article
    - no planned kind is listed inappropriate by the content-type profile
    - the plan carries article_ref with both hashes
  fixtures:
    - schemas/examples/artifact-plan.example.json
---

# plan-artifacts

## Purpose

Decide what is worth building from an article, and describe it precisely
enough that any competent generator can build it — without naming one.

The plan is the versioned artifact. The rendered output is a build product.
That is what keeps generators replaceable: swapping one changes
`generator.tool` in the lineage and nothing in the editorial semantics.

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
4. **For an evidence visual**, state the single question it must answer, the
   claims and data behind it, the form, and **where it feeds back** — what it
   would mean if the visual does not show what was expected. A visual with no
   question is decoration; a visual with no feedback point is being planned
   too late.
5. **For a brief**, state the information hierarchy, most load-bearing first,
   and the claims it carries.
6. **For slides**, state the argument beat per page and a page target. The
   deck follows the argument, not the article's section order.
7. **For audio**, decide whether listening adds a useful consumption surface,
   identify audience/listening context and carried claims, and declare whether
   the downstream narration is `free` or genuinely `timed`. Do not write the
   spoken script here. A non-skipped audio decision hands off to
   `compile-audio-script`, which owns the Article → listener-first rewrite.
8. **For video and infographic**, justify against the priority order or skip.
   These are low-ranked for reasons already recorded; a plan that promotes one
   states why.
9. **Attach lineage.** `article_ref` with both hashes, so anything built from
   this plan can be classified fresh, cosmetically stale, or materially stale
   without inspecting it.

## Invariants

- Every kind considered appears in `decisions`, including the skipped ones. A
  silent omission is indistinguishable from an oversight.
- `carries_claims` contains only `claim_id`s that are `verified` on the
  article. An artifact may not introduce a claim the article does not make.
- A distribution artifact is never planned for an article below `final`.
- An audio plan describes purpose, carried claims, listening context, and any
  real timing constraint; it does not contain provider syntax or a finished
  narration script.
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
- `article_ref` carries both hashes.

Run: `npm run validate:plan`.

## Authority

This Skill plans. It does not render, does not decide what the article argues,
and does not publish. A plan is not an artifact, and an artifact is not an
approval. For audio, it decides **whether and why** to build; `compile-audio-script`
decides **how the finalized article becomes spoken structure**.
