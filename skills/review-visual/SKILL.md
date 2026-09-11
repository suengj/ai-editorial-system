---
name: review-visual
version: 0.1.0
description: Inspect a rendered editorial image against its VisualBrief and record advisory visual routing.
when_not_to_use: Do not use without actual rendered pixels or to approve, lock, publish, or finalize an asset.
inputs:
  - rendered asset and mobile derivative
  - VisualBrief RenderSpec selected reference authority and production lineage
outputs:
  - visual review record for an external append-only feedback producer
requires:
  - actual rendered pixels
  - visual job context
authority:
  may:
    - inspect rendered pixels and classify visual defects
    - recommend a routed next action
  may_not:
    - approve publish or finalize an asset
    - record human approval or a lock
governed_by:
  - editorial/HITL-PROTOCOL.md
  - editorial/FEEDBACK-ROUTING.md
  - schemas/VISUAL-BRIEF-AND-RENDER-SPEC-CONTRACT.md
allowed_tools:
  - file_read
  - vision_inspection
evidence:
  acceptance:
    - every dimension has observed evidence
    - output never grants approval
  fixtures:
    - evals/prototypes/sue629/plate-a.svg
---

# review-visual

V2.17 extension (SUE-670): this keeps the existing visual review authority and
adds digest-bound post-render text/fact/readability/mobile checks with observed
actual-display geometry. These checks are mandatory for verified generative
facts.

## Purpose

Inspect actual pixels and produce advisory routing, never approval.

## Inputs

Use the declared inputs only.

## Outputs

Write a `visual-review.schema.json` record. Feedback projection is not produced here until a registry-owned producer is implemented.

## Preconditions

Resolve the asset, VisualBrief, RenderSpec, and selected authority.

## Procedure

Inspect full and mobile images; record each dimension with evidence; classify one primary defect; use the shared PR-B action mapping; and, when `post_render_checks` is present, bind textual, factual, and readability checks to the full asset and the mobile check to the mobile derivative. A verified-fact review must bind to a validator-clean job/RenderSpec artifact by repository identity and digest; select `crop_anchor` only from its declared semantic anchors, and copy neither desktop nor mobile geometry from an unbound review assertion. Record every declared payload/external item as structured `observed_text_items`; free-text evidence is context, not the transcription. Record observed desktop geometry at exactly 672 CSS px article-body width, plus the mobile viewport/derivative relationship and preserved crop anchor. The mobile check records detail role, load-bearing status, display-size legibility, detail-access path, and whether topic, dominant relation, major module boundaries, and main conclusion survive first read. Route each check to `KEEP`, `CHANGE`, or `DO_NOT_CHANGE`; hand `PASS_TO_HUMAN_REVIEW` to a human only when every required check is an observed pass.

## Invariants

Reference evidence is craft evidence, not fact. Abstain is fail-closed and may not become `PASS_TO_HUMAN_REVIEW`; route it to an existing non-pass action. A clean post-render set may use only `PASS_TO_HUMAN_REVIEW`; that verdict is not approval. Do not manufacture a renderer result when no approved renderer produced the pixels.

## Refusal conditions

Stop and refuse to produce a review if pixels, mobile derivative, or job context are missing.

## Evidence

Use the schema and negative fixtures; do not infer pixels from metadata.

## Authority

This Skill may inspect and route. It may not approve, lock, publish, or finalize.
