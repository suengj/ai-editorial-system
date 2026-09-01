# Article + Artifact contract (AES-P0.3 / SUE-436)

Process-level contracts for the editorial system. They describe how an article
is *made*; `suengj-com` remains the sole authority on how it is *published*.

Machine contracts: [`article.schema.json`](article.schema.json),
[`artifact.schema.json`](artifact.schema.json).
Enforcement: `npm run validate:article`.

## Content type vs artifact — orthogonal

| Axis | Values |
|---|---|
| **Content type** (what the piece is) | `research`, `view`, `news`, `note`, `project` |
| **Artifact kind** (what was compiled from it) | `brief`, `full`, `sources`, `evidence_visual`, `slides`, `infographic`, `audio`, `video` |

A `research` article and a `news` article can both have a `brief` and
`slides`. Neither axis constrains the other, and no artifact kind is ever
written into `suengj-com`'s `type` field.

## Article Frame comes first

No prose exists before a frame. The frame requires all eight fields — thesis,
article-worthiness, audience, source weighting, verification needs, original
value-add, uncertainty, structure — and `uncertainty` may not be empty.

When the thesis will not hold, `state: no_article` with a
`no_article_reason` is a correct outcome. It is a terminal state, not a
failure to be worked around.

## Article lifecycle, reconciled with suengj-com

```
candidate → framed → drafted → verified → polished → reviewed → final
          → published → revised → archived
                    ↘ no_article (terminal, from framed)
```

| Process `state` | Meaning | `suengj-com` `status` |
|---|---|---|
| `candidate` … `reviewed` | Pre-finalization | *not materialized* |
| `final` | Human finalized the draft | `draft` |
| `published` | Separate human approval granted | `published` |
| `revised` | Materially changed after publication | `draft` (new version) |
| `archived` | Retired | `archived` |
| `no_article` | Thesis did not hold | *never materialized* |

Two rules the validator enforces by name:

1. **Human finalization is not publication.** `final` maps to `status: draft`.
   Nothing in this system may produce `target_status: published`; only a
   separate human approval in `suengj-com` can.
2. **`final` and `published` require `lifecycle_authority: human`.** An AI may
   move an article up to `reviewed` and no further.

### Mapping to the canonical Markdown contract

Deterministic; same Article in → same front matter out. Authority for the
target shape is `suengj-com/docs/content/CONTENT_CONTRACT.md` (SBM-03 /
SUE-358, hardened by SUE-410).

| Process Article | Canonical front matter |
|---|---|
| `article_id` (slug segment) | file basename — the global slug |
| `content_type` | `type` — see the type map below |
| `frame.thesis` | body lead; never a front matter field |
| `state` | `status` via the table above |
| `source_set` | `source_references` |
| `verification.claims[].evidence` | `citations` |
| `version.commit`, `version.content_hash` | `provenance` |
| `frame.*` (the rest) | **not emitted** — process metadata stays here |

Content type does not map to `type` by identity. `news` materializes into the
`editorial` collection, matching the existing site model where the folder is
`content/editorial/` and the UI label is *News*:

| Process `content_type` | Collection | `suengj-com` `type` |
|---|---|---|
| `research` | `content/research/` | `research` |
| `view` | `content/views/` | `view` |
| `news` | `content/editorial/` | `editorial` |
| `note` | `content/notes/` | `note` |
| `project` | `content/projects/` | `project` |

`publication.target_path` must match
`content/{notes,research,views,projects,editorial}/<slug>.md` and
`canonical_url` must be `/content/<slug>`, matching the AEO V1 route contract.

## Artifact lineage

Every artifact records exactly which article version produced it:

```yaml
article_ref:
  article_id: art:ai-inference-pricing
  version_number: 3
  content_hash: <sha256 of normalised canonical Markdown>
  claims_hash: <sha256 of the ordered verified-claim set>
  commit: a1b2c3d
generator:
  skill: { name: plan-artifacts, version: 0.1.0 }
  tool:  { name: <generator>, version: <version>, model: <optional> }
```

`generator` is vendor-neutral by construction: a Skill is the orchestration
contract, the tool is a replaceable worker, and no field is specific to any
provider. Swapping generators changes `tool`, not the contract.

## Staleness — decidable, not guessed

The article carries two hashes. Artifacts record both, so a change can be
classified without reading the diff:

| Comparison against the current article | `staleness.level` | Consequence |
|---|---|---|
| both hashes match | `fresh` | nothing to do |
| `content_hash` differs, `claims_hash` matches | `cosmetic` | prose moved; regeneration optional |
| `claims_hash` differs | `material` | the factual substance changed — the artifact **must** be regenerated before it may remain published |

`claims_hash` is computed over the ordered verified-claim set (id, text,
status), so a typo fix does not invalidate a deck while a corrected number
does.

Source-side drift is separate and equally explicit: `source_set[].content_hash_at_use`
records what each source looked like when the article drew on it. When the
manifest's current hash differs, the article — not just its artifacts — is due
for re-verification.

## Evidence media vs distribution media

| `media_stage` | Kinds | May be generated when |
|---|---|---|
| `evidence` | `evidence_visual`, `sources` | article state ≥ `framed` — these support the research and the writing |
| `distribution` | `brief`, `full`, `slides`, `infographic`, `audio`, `video` | article state ∈ `final`, `published` — never from an unreviewed draft |

Distribution artifacts may be *published* only when the article itself is
`published`. Priority order for build-out: evidence visual → brief → slides →
infographic → audio → video.

## Factual artifacts carry their sources

`brief`, `slides`, `infographic`, `audio`, `video`, and `evidence_visual`
assert facts on their own. Each must carry `source_references` tying its
claims back to `verification.claims[].claim_id`. An artifact that makes a
claim the article never verified is a contract violation, not a stylistic
choice.

## Validation

`scripts/validate-article-contract.mjs` is fail-closed and enforces:

1. Structural conformance of both schemas (`additionalProperties: false`)
2. Frame completeness; non-empty `uncertainty`
3. `no_article` requires a reason; any other state forbids one
4. `final` / `published` require `lifecycle_authority: human`
5. State → `target_status` mapping; `published` target requires `approved_by`
6. `target_path` collection matches `content_type`; `canonical_url` matches slug
7. Artifact `media_stage` matches its `kind`
8. Distribution artifacts require an article in `final` or `published`
9. Fact-bearing artifacts require `source_references` resolving to verified claims
10. Staleness level is consistent with the two hashes — it cannot be asserted by hand
