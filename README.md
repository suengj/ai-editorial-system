# ai-editorial-system

**Editorial Control Plane** for [suengj.com](https://suengj.com).

This repository holds the *rules, contracts, skills, and evaluations* that turn
reviewed sources into verifiable articles and derived artifacts. It holds no
sources, no article archive, and no publication machinery.

## What this repository is

An editorial control plane: the portable, reviewable definition of **how** an
article gets framed, verified, written, polished, finalized by a human, and
compiled into derived artifacts.

```
Source → Framing → Research/Verification → Writing → Polish
       → HITL Final → Canonical Article → Brief / Visual / Slides → suengj.com
```

The pipeline stages live here as **contracts and Skills**. The things flowing
through them live elsewhere, by design.

## What this repository is NOT

- **Not a content store.** No canonical article archive, no drafts, no
  publication history.
- **Not a source corpus.** No raw YouTube transcripts, no private research
  working set, no scraped third-party bodies.
- **Not a publication engine.** No build, deploy, routing, or rendering logic.
  `suengj-com` owns publication and must not be duplicated here.
- **Not a runtime service.** No database, no vector store, no agent framework,
  no long-lived process.
- **Not a media library.** No large generated binaries (audio, video, decks,
  rendered images).

## SSOT boundaries

See [`docs/architecture/SSOT-BOUNDARIES.md`](docs/architecture/SSOT-BOUNDARIES.md)
for the authoritative matrix. Summary:

| Authority | Owner | This repo's relationship |
|---|---|---|
| Source material | Google Drive + project GitHub repos | Consumes by reference only |
| Editorial rules, Skills, schemas, evals | **this repo** | Owns |
| Canonical content + publication | `suengj-com` | Hands off to; never writes build logic |
| Work, dependencies, acceptance | Linear | Records evidence into |

## Directory contract

See [`docs/architecture/REPOSITORY-CONTRACT.md`](docs/architecture/REPOSITORY-CONTRACT.md).

| Path | Owns |
|---|---|
| `editorial/` | Constitution, voice, content-type profiles, quality gates |
| `skills/` | Portable Skill definitions (orchestration contracts) |
| `schemas/` | Source / Article / Artifact schemas and lineage rules |
| `templates/` | Frame, article, brief, and artifact templates |
| `benchmarks/` | Benchmark findings on external editorial systems and generators |
| `references/` | Attributed pointers to third-party material — links and notes, never copies |
| `evals/` | Golden + negative fixtures, rubric, regression method |
| `scripts/` | Validation and evaluation tooling |
| `docs/architecture/` | Architecture decisions and contracts |

## Boundary enforcement

Charter rules are executable, not advisory:

```bash
npm run validate:boundary   # fail-closed scan for forbidden content
npm test                    # boundary validator regression over allow/deny fixtures
```

`scripts/validate-repo-boundary.mjs` fails the build on secrets, source corpus
files, canonical article archives, oversized binaries, and private-research
markers. Absence of a finding is only a PASS when the validator actually ran.

## Licensing

- **Code** (`scripts/`, tooling): MIT — see [`LICENSE`](LICENSE).
- **Documentation and editorial rules** (`editorial/`, `docs/`, `schemas/`,
  `templates/`, `skills/`): CC BY 4.0 — see [`LICENSE-DOCS`](LICENSE-DOCS).
- **Third-party material** referenced in `references/` and `benchmarks/`
  retains its own license. Nothing here relicenses it. See [`NOTICE`](NOTICE).

## Status

V1 in progress. Work, scope, and acceptance are tracked in Linear under
*Suengj.com · AI Editorial System*.
