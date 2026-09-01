# Source contract (AES-P0.2 / SUE-435)

Intake contract for the AI Editorial System. Turns the Drive/GitHub source
estate into something an agent can reason about without guessing from
filenames.

Machine contract: [`source.schema.json`](source.schema.json).
Enforcement: `npm run validate:source`.

**This repository stores no source bodies.** A manifest entry is a pointer
plus metadata. See `../docs/architecture/SSOT-BOUNDARIES.md`.

## Identity

`source_id` is the stable identity. It is derived from the origin system's own
immutable handle, never from the display filename or folder:

| Origin | `source_id` form | Immutable handle |
|---|---|---|
| `google_drive` | `src:drive:<file_id>` | Drive file ID — survives rename and move |
| `github` | `src:github:<owner>/<repo>` | Repository identity; `origin_ref.ref` pins the commit |
| `web` | `src:web:<host>/<stable-path>` | Canonical URL |
| `local` | `src:local:<stable-slug>` | Explicitly assigned |

`origin_ref.path_hint` may record where the file was last seen, for humans.
It carries no authority: two entries with the same Drive file ID must carry
the same `source_id` regardless of where they now live.

### `origin_ref` shape by origin

```yaml
google_drive: { file_id: "1AbC...", path_hint: "Article/YouTube Summaries/2026-08-30.md" }
github:       { repo: "suengj/p05_finance", ref: "a1b2c3d", path: "docs/strategy.md" }
web:          { url: "https://example.com/report" }
local:        { path: "evals/fixtures/synthetic-01.md" }
```

## Source classes

| `kind` | Estate today |
|---|---|
| `youtube_summary` | Drive daily YouTube summary Markdown corpus |
| `market_brief` | Drive daily market brief Markdown |
| `research_draft` | ChatGPT-produced research/draft Markdown in the Article area |
| `project_repo` | Project GitHub repositories as technical/project SSOT |
| `web_reference` | External published work cited as evidence |
| `dataset` | Structured data used for evidence visuals |

The vocabulary is finite. Adding a class is a contract change, not a
convention.

## Lifecycle — source, not publication

`disposition` describes what has happened to a *source*. It deliberately
shares no term with `suengj-com`'s article `status`, so the two can never be
confused:

| `disposition` | Meaning |
|---|---|
| `active` | In the estate, available for triage |
| `candidate` | Proposed for an article frame; nothing decided |
| `used` | Contributed to at least one article |
| `superseded` | A newer revision or a better source replaced it |
| `archived` | A human moved it out of the active area |
| `rejected` | Triaged out with a reason |

### Authority

`disposition_authority` records who set it.

- AI may set `active`, `candidate`, `used`, `superseded` with
  `ai_recommended`.
- `archived` and `rejected` **require `human`**. Drive housekeeping is a human
  lifecycle action, not a step in an ingestion pipeline.
- No tool in this system moves or deletes a source file.

### Prohibited inference

An agent must not infer approval, quality, or publication from:

- folder location or filename,
- presence in the "Article" Drive area,
- a `disposition` value.

`published` and `approved` are not in the vocabulary and never will be.
Publication authority belongs to `suengj-com` alone.

## Dates are not interchangeable

| Field | Answers |
|---|---|
| `source_created_at` | When was the source authored/published? `null` when unknown |
| `ingested_at` | When did we first record it? |
| `content_observed_at` | When did we last hash its content? |
| `used_by[].first_used_at` | When did an article first draw on it? |

Never fabricate `source_created_at`. `null` is the correct answer when the
Drive file carries no authored date. Article publication dates live in
`suengj-com` and appear nowhere in this manifest.

## Duplicates, updates, and staleness

`content_hash` (sha256 over the normalised source body) is computed at
ingestion and stored; the body is not.

| Situation | Representation |
|---|---|
| Two entries, identical hash | The later carries `duplicate_of: <earlier source_id>` |
| Same `source_id`, new hash | `revision` increments; `content_observed_at` updates |
| Replaced by a different source | Old: `disposition: superseded` + `superseded_by`; new: `supersedes` |
| Source changed after an article used it | Detected by comparing the article's recorded source hash against the current one — see `ARTICLE-ARTIFACT-CONTRACT.md` |

## Lineage — `used_by`

```yaml
used_by:
  - article_id: art:ai-inference-pricing
    role: primary          # primary | supporting | contradicting | background
    first_used_at: 2026-08-30T09:00:00Z
```

`contradicting` is a first-class role: a source that undercuts the thesis is
part of the lineage, not an omission.

Invariant: a non-empty `used_by` requires `disposition` ∈ `used`,
`superseded`, `archived`. A source cannot be `candidate` and already used.

## Rights

Every entry declares `quotable` and `redistributable`. `redistributable:
false` (the norm for third-party material) means the body may never be copied
into this repository or into a published artifact — only cited. See `NOTICE`.

## Validation

`scripts/validate-source-manifest.mjs` is fail-closed. It enforces the schema
plus the cross-field invariants above:

1. Structural conformance, including `additionalProperties: false`
2. `origin_ref` shape matches `origin`
3. `source_id` prefix matches `origin`; unique within the manifest
4. Same Drive file ID ⇒ same `source_id`
5. `archived` / `rejected` require `disposition_authority: human`
6. Publication-flavoured disposition values are rejected by name
7. `superseded` requires a resolvable `superseded_by`
8. `duplicate_of` resolves and hashes match
9. `used_by` non-empty ⇒ disposition ∈ `used | superseded | archived`
10. `source_created_at` ≤ `ingested_at` ≤ `content_observed_at`

An unparseable manifest is a failure, not an empty pass.
