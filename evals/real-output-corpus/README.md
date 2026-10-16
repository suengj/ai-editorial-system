# evals/real-output-corpus/ — the real-output corpus (AES-V2.6 / SUE-564)

Extends the completed V1 synthetic fixture system
([`../fixtures/`](../fixtures/), [`../RUBRIC.md`](../RUBRIC.md)) with real,
owner-reviewed outputs, without duplicating canonical content or replacing
human authority.

**V1 is preserved exactly.** The golden/negative fixtures and the L0
rubric/regression method stay the fast known-failure baseline. This directory
adds a second, slower corpus alongside it — it does not touch, move, or
recreate the fixtures under `../fixtures/`.

## Canonical content stays in its SSOT

An entry is a compact record: refs, a commit or content hash, and evaluation
metadata. **Never an article or artifact body.** The repository boundary
validator (`npm run validate:boundary`) already rejects publishable
front-matter archives, and it is right to — this corpus does not try to work
around that, it is designed not to need to.

Machine contract: [`../../schemas/corpus-entry.schema.json`](../../schemas/corpus-entry.schema.json).
Engine: [`../../scripts/lib/corpus-core.mjs`](../../scripts/lib/corpus-core.mjs).
Run: `npm run validate:corpus`.

## Published does not mean reference-quality

`reference_eligible` is a separate, explicit judgement from `owner_verdict`.
An accepted or published output is not automatically eligible to be selected
later as a comparison GOOD reference for `review-l1`, and an L1 `PASS` does
not grant eligibility either — see `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`
§11. Every entry with `reference_eligible: true` must carry a
`reference_eligible_rationale` that names why, not merely that the piece was
accepted.

## Silence is not acceptance

`owner_verdict` is `unknown` whenever no owner acceptance or rejection has
actually been expressed. It is never inferred from publication, from an L1
pass, or from the absence of complaint. Agents recording an entry may set
`unknown`; they may never write `accepted` on the owner's behalf.

## Provenance, reused

`provenance_class` reuses the vocabulary already pinned by
[`../../schemas/reference-evaluation.schema.json`](../../schemas/reference-evaluation.schema.json)
— `external`, `owner_created`, `generated_output` — rather than inventing a
second one. This matters beyond consistency: as this system generates more,
its own outputs become the most plentiful and most semantically relevant
material, so an evaluation loop that ignores origin quietly converges on its
own tics. A `generated_output` entry that will ever be used as an L1
comparison reference should carry `lineage_ref` so the anti-collapse rule in
`schemas/l1-review.schema.json` can detect a monoculture of one lineage
standing in for an independent standard.

## Seed entries

The five entries under [`entries/`](entries/) are **synthetic or clearly
marked placeholders**, not real owner verdicts on real `suengj.com` articles.
They demonstrate the entry shape — every required field, every edge case
(`unknown` verdict, `generated_output` provenance, a rejected entry retained
as evidence) — ahead of the real corpus, which fills during the SUE-570 pilot
(`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §13). Fabricating an owner
verdict on a real article to make this corpus look populated would be a worse
failure than an honestly small one.

| Entry | Demonstrates |
|---|---|
| `corpus:placeholder-research-accepted` | `reference_eligible: true` with an explicit rationale beyond acceptance |
| `corpus:placeholder-news-needs-rework` | `needs_rework` never implies `reference_eligible` |
| `corpus:placeholder-view-unknown` | `unknown` is recorded, never inferred |
| `corpus:placeholder-generated-output-lineage` | `generated_output` + `lineage_ref`, for the L1 anti-collapse rule |
| `corpus:placeholder-academic-rejected` | a rejected entry is retained as evidence, not deleted |

## Owner-selected personal excerpts (2026-10-14)

The owner chose ten exact sentences from historical personal social posts as preferred voice evidence. They are **not** entire accepted outputs and therefore are deliberately **not put in this global L1 corpus**; otherwise unrelated account reviews could select them as universal GOOD examples.

The metadata-only `editorial/approved-examples.json` includes `kind: owner_selected_excerpt` rows, restricted to `personal-linkedin` and `personal-instagram`. Original excerpts and the private Google Docs source reference live solely in commit-pinned private `suengj/intelligence-library/docs/owner-approved-personal-style-2026-10-14.md`.

Normal generation stays `style_description_only`. On ambiguity/failure/quality_comparison the selected 2–3 references are **locators only**, and the calling authorized agent must fetch the specific private excerpts. `source_text_read:false` explicitly prevents a selected locator from claiming a successful private read. With the current deterministic selector, the first three references are question opening, accessible definition, and case-to-issue transition; the remaining seven stay in the approved index but are not dynamically relevance-ranked.

The proposed style *interpretation* is at `editorial/SUENGJ-STYLE-20261014-PROPOSAL.md`; it was promoted into canonical `SUENGJ-STYLE.md` on 2026-10-16 as an owner-approved trial.

## Growth plan

The acceptance target is 10–20 real owner-reviewed outputs across useful
categories (content type × transformation × audience × surface), gathered
opportunistically as real work is reviewed — never manufactured to hit a
count. Until the SUE-570 pilot produces real material, this directory stays
honestly small. `evals/README.md`'s L0 corpus keeps running at full speed
regardless of how many real entries exist here; this corpus is deliberately
the slower, second layer, not a replacement for it.

## Relationship to L1

`skills/review-l1/` selects GOOD references from this corpus (and from
`references/evaluations/`) for pairwise comparison. It compares like with
like — Research to Research, News to News — using `content_type` here as the
match key, and treats a cross-type match as legitimate only for a genuinely
cross-cutting dimension such as language-native prose.
