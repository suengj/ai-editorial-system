---
name: verify-claims
version: 0.1.0
description: Check the claims that matter against evidence, classify each by outcome, and surface disagreement rather than averaging it away.
when_not_to_use: Do not use to improve writing — that is editorial-polish. Do not use to decide whether a thesis is worth publishing; this Skill checks truth, not worth.
inputs:
  - article frame or draft
  - source manifest entries
  - current date
outputs:
  - claim set with per-claim status and evidence
  - contradictions, stated at full strength on both sides
  - required corrections or qualifications
requires:
  - the article frame, containing the thesis the claims support
  - the current date, for any freshness judgement
  - fresh retrieval capability when a time-sensitive claim is present
authority:
  may:
    - mark a claim verified, unverified, contradicted, or not applicable
    - require a correction or a qualification
    - block finalization on an unsupported material claim
  may_not:
    - judge whether the thesis is worth an article
    - rewrite prose
    - set an article to status published
    - record human approval
    - resolve a contradiction by averaging or by choosing the convenient side
governed_by:
  - editorial/constitution.md
  - editorial/quality-gates.json
allowed_tools:
  - web_search
  - file_read
references:
  - path: references/claim-classes.md
    load_when: classifying claims, or deciding whether fresh retrieval is required
evidence:
  acceptance:
    - every material claim carries a status and, when verified, at least one piece of evidence
    - no time-sensitive claim is verified against a stale source alone
    - contradictions appear in the output rather than being resolved silently
    - interpretive claims are never marked verified
  fixtures:
    - evals/fixtures/negative/N-01-sue-417-shape.md
---

# verify-claims

## Purpose

An independent pass over what the piece asserts. Not proofreading: the
question is whether each claim is true and adequately supported, and that
question is separate from whether the sentence reads well.

## Inputs

The frame or draft, the source manifest entries behind it, and the current
date.

## Outputs

A claim set. Each entry: the claim, its class, its status, its evidence, and —
when the status is not `verified` — the correction or qualification required.

Statuses: `verified`, `needs qualification`, `unsupported`, `contradictory`,
`stale`.

## Preconditions

- The frame is present. Claims are verified against the thesis they support,
  not in isolation.
- The current date is known.
- Fresh retrieval is available when any claim is time-sensitive. If it is not,
  this Skill refuses rather than falling back to the stale source.

## Procedure

1. **Extract** material claims: numbers, dates, quotations, causal assertions,
   and current-state statements. A claim is material when the thesis changes
   if it is wrong.
2. **Classify** each — stable, time-sensitive, primary-source-preferred, or
   interpretation. Load `references/claim-classes.md`.
3. **Retrieve.** Time-sensitive claims require current verification. A Drive
   summary from last month does not establish what is true now.
4. **Weight.** Primary and official evidence above derivative commentary,
   where a primary source exists for that claim.
5. **Check the anchor, not just the link.** A citation must support the
   specific claim beside it. A citation that resolves but does not support is
   a phantom citation, and it fails.
6. **Record contradictions.** Both sides, at full strength, with what each is
   authoritative for.
7. **Return** the claim set with required corrections.

## Invariants

- An interpretation is never marked `verified`. Our reading of the facts is
  not itself a fact.
- A time-sensitive claim is never verified against a stale source alone.
- A contradiction appears in the output. It is never averaged, split, or
  resolved by picking the convenient side.
- Every `verified` claim carries at least one piece of evidence with a
  retrieval date.
- The claim set is the input to `claims_hash`; changing it changes artifact
  staleness downstream.

## Refusal conditions

This Skill stops and reports rather than producing a claim set when:

- The frame is absent — there is no thesis to verify claims against.
- The current date is unknown and any claim is time-sensitive.
- Fresh retrieval is required and unavailable. **Falling back to the stale
  summary is not an option**; the correct output is a refusal that names the
  claim that could not be checked.

An unsupported material claim blocks finalization. It may be removed or
explicitly qualified — it may not be quietly kept.

## Evidence

- Every material claim has a status; every `verified` claim has evidence.
- No `verified` claim of class `interpretation`.
- Contradictions present in the output where sources disagree.

Run: `npm run validate:article` (claim structure), `npm run check:gates`
(citation integrity).

## Authority

This Skill decides what is true and supported. It does not decide what is
worth writing, does not rewrite prose, and does not publish. It can block a
finalization; it cannot grant one.
