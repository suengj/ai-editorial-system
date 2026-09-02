---
name: frame-article
version: 0.3.0
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
    load_when: the source set mixes authority levels, contains disagreement, or includes evidence that could materially narrow the thesis
evidence:
  acceptance:
    - the frame validates against article.schema.json $defs/frame
    - uncertainty is non-empty
    - the article satisfies its content-type profile's required frame fields
    - every time-sensitive claim appears in verification_needs
  fixtures:
    - evals/fixtures/golden/G-01-synthesis.md
    - evals/fixtures/golden/G-04-research-native-korean.md
    - evals/fixtures/negative/N-01-sue-417-shape.md
    - evals/fixtures/negative/N-06-source-tour.md
---

# frame-article

## Purpose

Convert a heterogeneous source set into an explicit editorial decision *before*
prose exists. The decision is binary: there is an article here, and this is its
frame — or there is not, and here is why.

This Skill exists because the failure it prevents is invisible later. A draft
written without a thesis can be polished indefinitely and never become good.
That does **not** mean research starts with a fixed answer. For Research in
particular, discovery may begin from a question or competing explanations; the
thesis becomes mandatory at the Article Frame boundary.

A second failure is subtler: a Writer can read a large corpus correctly and
still produce a bad article because the corpus becomes the outline. A frame
must compress research into a reader-facing argument before drafting begins.

## Inputs

Source manifest entries (`schemas/source.schema.json`), a candidate content
type, the current date, and optionally a human angle.

A human angle shapes what the piece is *about*. It does not exempt any claim
from verification and it is not a thesis the evidence is required to defend.

## Outputs

Exactly one of:

**`NO_ARTICLE`** — with the reason, and specifically what is missing: the
thesis that did not hold, or the evidence that would have supported it.

**An Article Frame** — content type, working title and dek, thesis or research
question, why it is worth writing now, audience, source inventory with
weighting, claims requiring verification, planned original value-add,
counterarguments and uncertainties, proposed structure, and evidence-visual
opportunities.

The frame must also make four reader-contract questions answerable in one
sentence each, using existing frame fields rather than adding ceremonial
metadata:

1. **Purpose** — what understanding, judgement, or decision should change after reading?
2. **Audience** — who is this for, and what do they already know?
3. **Message** — what single sentence should survive if the reader remembers only one?
4. **Minimum argument path** — what is the shortest conceptual route that earns that message?

If these cannot be answered, the research may be useful but the article is not
framed.

## Preconditions

- At least one source entry resolves. An unresolvable `source_id` is not a
  source.
- The content-type profile is loaded — its evidence burden decides whether the
  set is sufficient.
- The current date is known. Freshness cannot be judged without it.

## Procedure

1. **State the reader contract before the source inventory becomes structure.**
   Record audience, purpose, the one-sentence takeaway, and the minimum argument
   path. A repository, report, or folder tree may be the subject of research;
   it is not automatically the article's table of contents.
2. **Inventory.** List each source with its kind, origin, authored date, and
   disposition. Note what each one is actually authoritative *for* — a vendor
   page is primary for its own prices and weak for anyone's margins.
3. **Assign an argumentative role.** For the candidate article, mark a source
   as load-bearing support, challenge/boundary evidence, context, example, or
   verification-only. A consulted source with no load-bearing role is allowed
   to disappear from the article. Coverage is not an acceptance criterion.
4. **Weight.** Rank by authority for the claims in question, then by
   freshness. Load `references/weighting.md` when the set mixes authority
   levels or contains material challenge evidence.
5. **Map the challenge.** Look for anything that could change the eventual
   claim: direct contradiction, a different measurement boundary, a narrower
   population or period, a missing variable, or a source that lowers
   confidence. Do **not** manufacture a binary disagreement merely because the
   Research profile carries a `contradicting` lineage role.
6. **Compress the research into one core insight.** The insight must be useful
   to the intended reader even if the source filenames, repository paths, and
   document section names are removed. For a Project piece, project internals
   may be the subject; even then, structure follows the decision or mechanism
   being explained rather than directory order.
7. **Propose a thesis.** Only after the evidence map. One sentence,
   falsifiable, that the sources support and that none of them states outright.
   For Research, an angle formed before this point is provisional, not a premise.
8. **Test it against the strongest challenge.** Ask what becomes false,
   narrower, or less certain if that evidence is right. Then test the resulting
   thesis against the profile's evidence burden. If it fails, return
   `NO_ARTICLE` rather than weakening the standard.
9. **Derive the structure from the argument.** Sections earn their place by
   advancing the thesis through mechanism, evidence, boundary, consequence, or
   another necessary conceptual move. Do not allocate a section merely because
   a source, README, report chapter, or repository directory exists.
10. **Flag verification needs.** Every number, date, quotation, and
    current-state claim the thesis depends on.
11. **Identify evidence-visual opportunities** — the comparisons and series
    worth plotting *while* the argument is being made, not after.
12. **Hand off** to `verify-claims` with the frame and the flagged claims.

## Invariants

- No prose beyond a working title and dek.
- `uncertainty` is never empty. A frame that admits none is not a frame.
- Every time-sensitive claim appears in `verification_needs`.
- Source weighting is recorded per claim type, not as one global ranking.
- A human-supplied angle is recorded as an angle, never as a verified premise.
- Research does not satisfy its challenge burden by inventing an opposing camp;
  boundary evidence that materially narrows the thesis is legitimate challenge
  evidence.
- Source count and source coverage are never quality targets.
- The proposed structure is explainable from the thesis without reference to
  source order, search order, repository topology, or document topology.
- A source may be important to research and absent from the final prose.

## Refusal conditions

This Skill **stops and returns `NO_ARTICLE`**, or refuses outright, when:

- No source resolves, or the content-type profile is unavailable — it refuses;
  it does not proceed on an assumption about what the sources probably say.
- The current date is unknown and any claim is time-sensitive.
- The only available thesis is a restatement of one source. Summarising a
  source more briefly is not an article.
- The source set is large but says one thing. **A high source count is not
  evidence of article-worthiness**; ten summaries of one event are one source.
- The only proposed structure is a source tour, repository tour, README tour,
  or report-chapter tour. Reframe around the reader contract before drafting.
- The thesis survives only by ignoring or mislabelling material challenge
  evidence.
- The thesis would require a claim no available source supports and no
  verification could reach.

`NO_ARTICLE` is a successful outcome of this Skill, not a failure of it.

## Evidence

- The frame validates against `article.schema.json` `$defs/frame`.
- `uncertainty` is non-empty.
- The profile's `required_frame_fields` are all present.
- A `NO_ARTICLE` result carries a reason (`no_article_reason`).
- `N-06-source-tour.md` remains mechanically plausible while failing the
  editorial synthesis/original-reasoning test; framing must prevent that shape
  before prose exists.

Run: `npm run validate:article`, `npm run check:profile`.

## Authority

This Skill decides whether an article exists and what it argues. It does not
write it, does not verify it, and does not publish it. Nothing it produces
constitutes human approval, and a human angle it was given does not become a
fact by passing through it.
