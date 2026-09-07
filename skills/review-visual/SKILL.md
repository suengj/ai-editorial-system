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

## Purpose

Inspect actual pixels and produce advisory routing, never approval.

## Inputs

Use the declared inputs only.

## Outputs

Write a `visual-review.schema.json` record. Feedback projection is not produced here until a registry-owned producer is implemented.

## Preconditions

Resolve the asset, VisualBrief, RenderSpec, and selected authority.

## Procedure

Inspect full and mobile images; record each dimension with evidence; classify one primary defect; use the shared PR-B action mapping; hand PASS_TO_HUMAN_REVIEW to a human.

## Invariants

Reference evidence is craft evidence, not fact. PASS_TO_HUMAN_REVIEW is not approval.

## Refusal conditions

Stop and refuse to produce a review if pixels, mobile derivative, or job context are missing.

## Evidence

Use the schema and negative fixtures; do not infer pixels from metadata.

## Authority

This Skill may inspect and route. It may not approve, lock, publish, or finalize.
