# ai-editorial-system

**Editorial Learning Core.** A portable, reviewable definition of **how**
natural-language editorial requests become framed, verified, audience-fit
text/visual/audio output — and how the system gets better from what actually
came out, without a human ever having to edit a JSON file by hand.

[suengj.com](https://suengj.com) is this Core's **default publication
profile**, not its identity. It is one entry in
`editorial/profiles/surface/`, alongside `academic-paper`, `newsletter`,
`notebooklm`, and `youtube-script` — swappable data, never core logic.

This repository holds the *rules, contracts, Skills, profiles, and
evaluations*. It holds no sources, no article archive, and no publication
machinery.

## What this repository is

```
Source / Reference
        ↓
Natural-language intake  →  Editorial Intent (five axes: transformation,
        ↓                   content type, audience, surface, artifact)
Frame / Plan
        ↓
Generate  —  text (V1 Skills) · visual (profiles + brand + pre-render gates)
        ↓    · audio (planning + script, rendering deferred)
L0 / L1 / Human evaluation
        ↓
Failure routing  →  targeted tuning  →  versioned calibration
        ↓
suengj.com · NotebookLM · academic · newsletter · …   (adapters)
```

Every axis, gate, and routing decision above is an executable contract, not
prose. `suengj.com` is one adapter this Core hands articles off to; it is not
where the Core's authority lives. See
[`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
for the full architecture.

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

## Running it

Every contract in this repository is executable. Nothing here is enforced by
convention alone.

```bash
npm run validate         # every V1 + V2 contract: boundary, source, article,
                         # rights, skills, plan, presentation, HITL, package,
                         # registry, visual, intent, routing, corpus, audio
npm test                 # V1 + V2 regression suites
npm run eval             # editorial scorecard over the fixture corpus
npm run matrix           # three source classes through one control plane
npm run certify          # the V1 certification matrix
node scripts/certify-v2.mjs        # the V2 certification matrix (on demand)
node scripts/system-scorecard.mjs --validate   # evals/system/ — is the Core itself improving?
```

`npm run certify` and `node scripts/certify-v2.mjs` are the ones to read
first. Each runs every gate for its generation and maps the results onto a
certification matrix, reporting what cannot be proved from this repository
as **BLOCKED**/**NOT_RUN** with a reason rather than passing it quietly. V2's
certification is honestly a mix of `PASS`, `PARTIAL`, `DEFERRED`, and
`NOT_RUN` — see
[`docs/architecture/V2-CERTIFICATION.md`](docs/architecture/V2-CERTIFICATION.md).

Absence of a finding is a PASS only when the check demonstrably ran.

## Licensing

- **Code** (`scripts/`, tooling): MIT — see [`LICENSE`](LICENSE).
- **Documentation and editorial rules** (`editorial/`, `docs/`, `schemas/`,
  `templates/`, `skills/`): CC BY 4.0 — see [`LICENSE-DOCS`](LICENSE-DOCS).
- **Third-party material** referenced in `references/` and `benchmarks/`
  retains its own license. Nothing here relicenses it. See [`NOTICE`](NOTICE).

## Where the pieces are

| | |
|---|---|
| Principles, voice, gates, profiles, presentation, HITL | [`editorial/`](editorial/) |
| The five Skills and their format | [`skills/`](skills/) |
| Source, Article, Artifact, Skill, plan, receipt schemas | [`schemas/`](schemas/) |
| Fixtures, rubric, matrix, PoC artifacts | [`evals/`](evals/) |
| Benchmarks and the reference catalog | [`benchmarks/`](benchmarks/), [`references/`](references/) |
| Architecture decisions | [`docs/architecture/`](docs/architecture/) |

Start with [`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
for the architecture, and
[`docs/architecture/V2-CERTIFICATION.md`](docs/architecture/V2-CERTIFICATION.md)
for what is proved, what is partial, what is deferred, and what has not run
yet. [`docs/architecture/V1-CERTIFICATION.md`](docs/architecture/V1-CERTIFICATION.md)
remains the record for V1, which V2 builds on rather than replaces.

## Status

V1 is complete on every item that can be certified from this repository. V2
(the Editorial Learning Core) is architecturally complete and
fixture-exercised, honestly certified as a mix of partial, deferred, and
not-yet-run — real operating evidence is the subject of the adoption
milestone that follows (owner playbook and real pilot evidence land there,
not here). Work, scope, and acceptance are tracked in Linear under
*Suengj.com · AI Editorial System*.
