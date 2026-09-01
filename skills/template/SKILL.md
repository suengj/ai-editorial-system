---
name: template
version: 0.0.0
description: Canonical shape for a Skill in this system. Copy this directory, rename it, and replace every field.
when_not_to_use: Never invoke the template itself. It is a shape, not a capability.
inputs:
  - the-thing-this-skill-consumes
outputs:
  - the-thing-this-skill-produces
requires:
  - context-that-must-be-present-or-the-skill-refuses
authority:
  may:
    - what this Skill is allowed to decide
  may_not:
    - set an article to status published
    - record human approval
    - alter a verified fact, number, citation, or quotation
governed_by:
  - editorial/constitution.md
  - editorial/profiles/
  - editorial/quality-gates.json
allowed_tools:
  - capability-class-not-a-vendor-product
references:
  - path: references/detail.md
    load_when: the stated condition holds and the body alone is not enough
evidence:
  acceptance:
    - the check that proves a run of this Skill did its job
  fixtures:
    - evals/fixtures/golden/G-01-synthesis.md
---

# template

## Purpose

One paragraph. What this Skill is for, stated so that someone deciding
between two Skills can tell them apart.

## Inputs

What arrives, and in what shape. Name the contract (`source.schema.json`,
`article.schema.json`) rather than restating it.

## Outputs

What leaves, and in what shape. Same rule.

## Preconditions

What must be true before this Skill runs. Each entry in `requires` appears
here with the reason it matters.

## Procedure

Numbered steps. Bounded — one task with an explicit handoff at the end. If a
step would need a different authority than the one declared above, it belongs
in another Skill.

## Invariants

What must remain true across the run, regardless of the path taken. These are
the statements the acceptance checks test.

## Refusal conditions

When this Skill stops and says so, rather than producing something.

Missing required context is always a refusal. A Skill that improvises around
absent input is how a fabrication enters the system with a clean audit trail.

## Evidence

How a run is proved: which validator, which fixture, which recorded output.
The Skill name and version are recorded in artifact lineage
(`generator.skill`) so a result can be traced to the contract that produced
it.

## Authority

Restate the boundary in prose, and name what this Skill defers to. It does
not decide publication. Nothing it produces constitutes human approval.
