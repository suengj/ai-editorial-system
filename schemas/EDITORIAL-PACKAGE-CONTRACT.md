# Editorial Package contract (AES-V2.9 / SUE-567)

The destination-neutral handoff object. It exists so one verified body of
work can reach several surfaces — `suengj.com`, NotebookLM, an academic
export, a promotional channel — without duplicating source truth, and
without a second Article contract growing up beside the first.

Machine contract: [`editorial-package.schema.json`](editorial-package.schema.json).
Enforcement: `node scripts/validate-editorial-package.mjs`.
Worked examples: [`examples/`](examples/) (`package-*.example.json`).

## What this is not

| Not | Because |
|---|---|
| A second Article | Where an Article exists, the package sets `article_ref` and cites it — it does not restate `frame`, `verification.claims`, or `title`. |
| A source store | `sources[]` carries refs and provenance only (`source_id`, `uri`, `retrieved_at`, `hash`, `role`). No field on a source ref can hold a body. A package with a source body is a schema violation, not a style choice. |
| A second claim model | `verified_claims[]` mirrors `article.schema.json#/$defs/verification/properties/claims` field-for-field: same `claim_id`, `text`, `kind`, `status`, `evidence`. It is the same contract expressed at package scope, not a parallel one. |
| A publication decision | The package carries no `status` field and cannot set one. Publication authority is unchanged: it belongs to `suengj-com` for `suengj.com` surfaces, and to the adapter for every other surface. |

## The article-vs-package decision rule

Ask in this order:

1. **Does a V1 Article already carry the verified frame and claims for this
   content?** If yes: the package sets `article_ref` and copies nothing —
   `thesis`, `key_concepts`, and `verified_claims` are null/empty on the
   package. `summary` may still be present: it is the package's own
   destination-specific compression (a dialogue script's cold open, a study
   bundle's abstract), not a restatement of the article body.
2. **Is there no Article, and none is warranted?** (a P03 YouTube summary
   destined for an internal note; a NotebookLM-only research bundle that
   will never be a `suengj.com` page.) Then the package is the sole carrier:
   `article_ref` is `null` and `thesis` / `key_concepts` / `summary` /
   `verified_claims` hold the actual content, at the package's own
   verification burden.
3. **Does one verified body need to reach more than one surface, or more
   than one artifact shape on the same surface?** That is what
   `target_surfaces[]` and `proposed_artifacts[]` being arrays are for. A
   package with `article_ref` set may fan the same cited article out to
   `youtube` (adapt → audio dialogue), `notebooklm` (summarize → study
   bundle), and `academic-paper` (recreate → manuscript) as three separate
   packages, each pointing at the same `article_ref` and the same
   `lineage.claims_hash` — see `examples/package-adapt-audio.example.json`,
   `examples/package-notebooklm-handoff.example.json`, and
   `examples/package-academic-or-promotional.example.json`, which do exactly
   this.

An Article is never optional when one is warranted. The package is not a way
to skip framing and verification for `suengj.com` content — it is what
carries the same discipline to the cases an Article was never meant to cover.

## What each transformation class implies

Semantics belong to `editorial/profiles/transformation/<value>.json`
(AES-V2.9's other half, owned separately) — this contract only names the
fields those semantics constrain. Read the cited profile for the actual
rule; this table is a field-level index into it, not a restatement.

| `transformation.value` | Typically | `article_ref` | `thesis` / `summary` when no `article_ref` | `uncertainty` |
|---|---|---|---|---|
| `extract`, `translate`, `compress` | Preserve the full claim set at a different size or language | often absent | usually null — nothing new is asserted | may be empty |
| `summarize`, `rewrite` | Select or reword within what the source supports | either | `summary` present if this package is the sole carrier | may be empty |
| `adapt` | Change modality/surface, claims fixed | usually set (the source article) | null — adapt forbids new claims (`editorial/profiles/transformation/adapt.json`) | may be empty |
| `recreate` | Same subject, argument rebuilt for a new audience/surface | often set | `summary` present when standing alone | may be empty |
| `synthesize` | New argument across sources the sources do not make individually | usually absent (the package often *becomes* the article) | **required non-null** when `article_ref` is absent | **required non-empty** |
| `original` | New material, no source obligation | absent | **required non-null** | **required non-empty** |

## Validator rules the schema cannot express

`json-schema-lite` has no `oneOf`/`if`/`minItems`. These are enforced by
`scripts/lib/editorial-package-core.mjs` and checked in
`scripts/test-editorial-package.mjs`:

| Rule | Code | Reason |
|---|---|---|
| `uncertainty` non-empty when `transformation.value` ∈ `{synthesize, original}` | `uncertainty-empty` | These transformations assert a new argument; "we know everything" is never a true statement about one. |
| `article_ref` set ⇒ `thesis` is `null`, `key_concepts` is empty, `verified_claims` is empty | `article-vs-inline` | Cite, don't copy — the single rule this whole contract exists to keep. |
| `article_ref` set ⇒ `lineage.claims_hash === article_ref.claims_hash` | `claims-hash-mismatch` | The package does not compute a second claims_hash for claims it does not hold. |
| `article_ref` absent ⇒ `lineage.claims_hash` matches the recomputed hash of `verified_claims` | `claims-hash-mismatch` | Same invariant, other direction: an asserted hash is never taken on faith. |
| `article_ref` absent and `transformation.value` ∈ `{synthesize, original}` ⇒ `thesis` and `summary` are non-null | `no-article-no-content` | No article to cite and no content of its own is an empty package. |
| `lineage.package_hash` matches the recomputed hash of the package (minus `lineage` itself) | `package-hash-mismatch` | Computed, never asserted by hand — same discipline as `article.schema.json`'s `content_hash`/`claims_hash`. |
| `target_surfaces` non-empty | `no-target-surface` | A package with no destination is not yet a package. |
| `transformation.profile_ref` resolves to a file on disk | `transformation-profile-missing` | Reported, not silently accepted — but see below: tolerated as SKIP, not FAIL, when the file is owned by a concurrent Writer who has not landed it yet. |

`scripts/validate-editorial-package.mjs` reports a missing
`transformation.profile_ref` as **SKIP** rather than **FAIL**: this
contract does not gate on `editorial/profiles/transformation/**`, which this
package is a consumer of, not the owner of.

## Lineage and staleness

Same rule as `ARTICLE-ARTIFACT-CONTRACT.md`, restated at package scope, not
reinvented:

| Comparison | Meaning |
|---|---|
| `lineage.claims_hash` unchanged across a package revision | cosmetic — prose or framing moved, the verified claim set did not |
| `lineage.claims_hash` changed | material — anything downstream (`proposed_artifacts`, an adapter's rendered output) is stale and must be reconsidered before it may remain presentable |
| `lineage.supersedes` set | this package replaces an earlier one; the earlier package's approved artifacts inherit nothing — see `ARTIFACT-LINEAGE-PROCEDURE.md`'s "regeneration resets human judgement" |

`lineage.package_hash` is the package's own analogue of an artifact's
identity hash: it changes whenever the package's content changes, so a
consumer can detect drift without a diff. It is computed over everything
except the `lineage` block itself (a hash cannot include its own container).

## Rights

`rights` carries forward `source.schema.json`'s rights fields
(`quotable`, `redistributable`, `license`, `attribution`) and
`article.schema.json#/$defs/transformation`'s provenance fields
(`transcript_shaped`, `original_framing`, `synthesis_note`) rather than
inventing a third model. `transcript_shaped: true` should be treated the same
way it is on an Article: not fit to hand to any adapter.

## Validation

`node scripts/validate-editorial-package.mjs` is fail-closed and enforces:

1. Structural conformance of `editorial-package.schema.json`
   (`additionalProperties: false` throughout)
2. Non-empty `uncertainty` for `synthesize` / `original`
3. `article_ref` vs. inline content mutual sensibility
4. `lineage.claims_hash` consistency with `article_ref` or with
   `verified_claims`
5. `lineage.package_hash` consistency with the package's own content
6. At least one `target_surfaces` entry
7. `transformation.profile_ref` resolution (SKIP, not FAIL, when absent)

`node scripts/test-editorial-package.mjs` regression-tests all seven against
an allow/deny fixture pair built from the worked examples.
