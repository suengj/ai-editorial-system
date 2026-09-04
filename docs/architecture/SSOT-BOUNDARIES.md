# SSOT boundaries (AES-P0.1 / SUE-434)

Authoritative ownership matrix for the AI Editorial System. Every artifact in
the pipeline has exactly one system of record. When two systems hold the same
information, one of them is a **cache** and must say so.

## Matrix

| Concern | System of record | Replicas allowed | Notes |
|---|---|---|---|
| Raw source material (YouTube, market/finance, GitHub project state) | Google Drive + project GitHub repos | Reference only (URI + hash) | Never copied into this repo |
| Source manifest / lifecycle state | Drive-side manifest (AES-P0.2) | Manifest *schema* lives here | This repo owns the schema, not the data |
| Editorial Constitution, voice, content-type profiles | **ai-editorial-system** | — | `editorial/` |
| Skills (frame / write / verify / polish / artifacts) | **ai-editorial-system** | — | `skills/` |
| Source / Article / Artifact schemas, lineage rules | **ai-editorial-system** | — | `schemas/` |
| Eval fixtures, rubric, regression method | **ai-editorial-system** | — | `evals/` |
| Benchmarks and external references | **ai-editorial-system** | — | Attributed pointers only |
| Draft articles under review | HITL working area (Drive) | — | Not committed here |
| **Canonical article** | `suengj-com` (`content/**`) | — | Git merge is materialization |
| Publication status / gating | `suengj-com` content contract | — | `status: draft \| published \| archived` |
| Rendering, routing, build, deploy | `suengj-com` | — | Never duplicated here |
| Derived artifacts (brief, visual, slides) | `suengj-com` alongside the article | Generator config lives here | Lineage fields defined here (AES-P0.3) |
| Editorial Intent (five axes, clarification state) | **ai-editorial-system** | — | `schemas/editorial-intent.schema.json` (AES-V2.1/V2.2) |
| Editorial Package (destination-neutral handoff) | **ai-editorial-system** | Adapter-side renders are outputs, not replicas | `schemas/editorial-package.schema.json`, `schemas/EDITORIAL-PACKAGE-CONTRACT.md` (AES-V2.9) |
| Reference evaluations (craft evidence, never claims) | **ai-editorial-system** | — | `references/`, `editorial/profiles/reference/` (AES-V2.3/V2.4) |
| Calibration (versioned owner preference snapshot) | **ai-editorial-system** | — | `calibration/` (AES-V2.10); never the mean of all feedback, never rewritten in place |
| Work, dependency, acceptance, evidence | Linear | — | Project *Suengj.com · AI Editorial System* |

## Directional rules

1. **Sources flow in by reference.** This repo may name a source (URI, id,
   hash, retrieval date). It may not contain the source body.
2. **Articles flow out by handoff.** This repo produces the rules and the
   validation that a candidate article must satisfy; `suengj-com` decides
   whether it is materialized and whether it is published.
3. **Publication authority is not shared.** `suengj-com`'s content contract
   (`docs/content/CONTENT_CONTRACT.md`, SBM-03 / SUE-358) is binding.
   This repo must stay consistent with it and must never re-implement it.
4. **Human finalization ≠ publication.** AI draft → human review → final →
   `status: draft` → separate human approval → `status: published`. No path in
   this repo may set `published`.
5. **Linear is the acceptance authority.** A phase is complete when Linear says
   so, backed by execution evidence — not when a document exists.

## Consistency anchors in `suengj-com`

The following are treated as fixed external contracts. Changes there are
breaking changes here.

| Anchor | Location in `suengj-com` |
|---|---|
| Unified content contract | `docs/content/CONTENT_CONTRACT.md` |
| Fail-closed status rules | same, "Publication status (fail-closed)" |
| Canonical URL shape `/content/{slug}` | `docs/architecture/AEO-V1-IA-ROUTES.md` |
| Global slug uniqueness | `scripts/validate-content-contract.mjs` |
| Editorial front matter + provenance block | `CONTENT_CONTRACT.md`, `type: editorial` |
| Human approval gate | `docs/architecture/SUE-398-HUMAN-APPROVAL.md` |

## Prohibited couplings

- Importing `suengj-com` build or loader code into this repo.
- Writing directly to `suengj-com` `content/**` from tooling in this repo
  without passing that repo's own validators and review gate.
- Introducing a new database, vector store, or multi-agent framework as a
  system of record for anything in the matrix above.
