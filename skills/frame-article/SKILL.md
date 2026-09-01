---
name: frame-article
version: 0.1.0
description: Triage a source set and produce either an Article Frame or an explicit NO_ARTICLE decision, before any prose exists.
when_not_to_use: Do not use once a frame exists — revising a frame is a new framing run, and drafting from one is write-article. Never use to produce prose.
inputs:
  - source manifest entries (schemas/source.schema.json)
  - candidate content type
  - current date
  - optional human angle or intent
outputs:
  - article frame conforming to article.schema.json $defs/frame
  - or NO_ARTICLE with a reason and the missing evidence
  - claims flagged for verification
  - evidence-visual opportunities
requires:
  - at least one source manifest entry with a resolvable source_id
  - the content-type profile for the candidate type
  - the current date, for any freshness judgement
authority:
  may:
    - decide that the corpus does not support an article
    - propose a thesis, a working title, and a structure
    - assign source weights and flag claims for verification
  may_not:
    - write prose beyond a working title and dek
    - set an article to status published
    - record human approval
    - treat a human-supplied angle as exempt from verification
governed_by:
  - editorial/constitution.md
  - editorial/profiles/
  - editorial/quality-gates.json
allowed_tools:
  - file_read
  - web_search
references:
  - path: references/weighting.md
    load_when: the source set mixes authority levels or contains sources that disagree
evidence:
  acceptance:
    - the frame validates against article.schema.json $defs/frame
    - uncertainty is non-empty
    - the article satisfies its content-type profile's required frame fields
    - every time-sensitive claim appears in verification_needs
  fixtures:
    - evals/fixtures/golden/G-01-synthesis.md
    - evals/fixtures/negative/N-01-sue-417-shape.md
---

# frame-article

## Purpose

Convert a heterogeneous source set into an explicit editorial decision *before*
prose exists. The decision is binary: there is an article here, and this is its
frame — or there is not, and here is why.

This Skill exists because the failure it prevents is invisible later. A draft
written without a thesis can be polished indefinitely and never become good.

## Inputs

Source manifest entries (`schemas/source.schema.json`), a candidate content
type, the current date, and optionally a human angle.

A human angle shapes what the piece is *about*. It does not exempt any claim
from verification.

## Outputs

Exactly one of:

**`NO_ARTICLE`** — with the reason, and specifically what is missing: the
thesis that did not hold, or the evidence that would have supported it.

**An Article Frame** — content type, working title and dek, thesis or research
question, why it is worth writing now, audience, source inventory with
weighting, claims requiring verification, planned original value-add,
counterarguments and uncertainties, proposed structure, and evidence-visual
opportunities.

## Preconditions

- At least one source entry resolves. An unresolvable `source_id` is not a
  source.
- The content-type profile is loaded — its evidence burden decides whether the
  set is sufficient.
- The current date is known. Freshness cannot be judged without it.

## Procedure

1. **Inventory.** List each source with its kind, origin, authored date, and
   disposition. Note what each one is actually authoritative *for* — a vendor
   page is primary for its own prices and weak for anyone's margins.
2. **Weight.** Rank by authority for the claims in question, then by
   freshness. Load `references/weighting.md` if the set mixes authority levels
   or disagrees with itself.
3. **Look for the disagreement.** Where two sources conflict, that conflict is
   usually the article. Record it before looking for anything else.
4. **Propose a thesis.** One sentence, falsifiable, that the sources support
   and that none of them states outright.
5. **Test it.** Against the profile's evidence burden, and against the two
   questions below. If it fails, return `NO_ARTICLE`.
6. **Flag verification needs.** Every number, date, quotation, and
   current-state claim the thesis depends on.
7. **Identify evidence-visual opportunities** — the comparisons and series
   worth plotting *while* the argument is being made, not after.
8. **Hand off** to `verify-claims` with the frame and the flagged claims.

## Invariants

- No prose beyond a working title and dek.
- `uncertainty` is never empty. A frame that admits none is not a frame.
- Every time-sensitive claim appears in `verification_needs`.
- Source weighting is recorded per claim type, not as one global ranking.
- A human-supplied angle is recorded as an angle, never as a verified premise.

## Refusal conditions

This Skill **stops and returns `NO_ARTICLE`**, or refuses outright, when:

- No source resolves, or the content-type profile is unavailable — it refuses;
  it does not proceed on an assumption about what the sources probably say.
- The current date is unknown and any claim is time-sensitive.
- The only available thesis is a restatement of one source. Summarising a
  source more briefly is not an article.
- The source set is large but says one thing. **A high source count is not
  evidence of article-worthiness**; ten summaries of one event are one source.
- The thesis would require a claim no available source supports and no
  verification could reach.

`NO_ARTICLE` is a successful outcome of this Skill, not a failure of it.

## Evidence

- The frame validates against `article.schema.json` `$defs/frame`.
- `uncertainty` is non-empty.
- The profile's `required_frame_fields` are all present.
- A `NO_ARTICLE` result carries a reason (`no_article_reason`).

Run: `npm run validate:article`, `npm run check:profile`.

## Authority

This Skill decides whether an article exists and what it argues. It does not
write it, does not verify it, and does not publish it. Nothing it produces
constitutes human approval, and a human angle it was given does not become a
fact by passing through it.
