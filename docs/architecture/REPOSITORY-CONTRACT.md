# Repository contract (AES-P0.1 / SUE-434)

Directory-level ownership, admission rules, and the exclusion list that
`scripts/validate-repo-boundary.mjs` enforces.

## Top-level shape

```
editorial/     Constitution, Suengj voice, content-type profiles, quality gates
skills/        Portable Skill definitions — orchestration contracts
schemas/       Source / Article / Artifact schemas, lineage and staleness rules
templates/     Frame, article, brief, evidence-visual, slide templates
benchmarks/    Findings on external editorial systems, generators, workflows
references/    Attributed pointers to third-party material (links + notes)
evals/         Golden corpus refs, negative fixtures, rubric, regression method
scripts/       Validation and evaluation tooling
docs/          Architecture decisions and contracts
```

## Admission rules per directory

| Path | Admits | Rejects |
|---|---|---|
| `editorial/` | Markdown rules, YAML gate definitions | Article prose, examples containing private material |
| `skills/` | Skill manifests + instructions | Vendor SDK code, API keys, model-specific hardcoding |
| `schemas/` | JSON Schema, contract docs | Populated instance data from real private sources |
| `templates/` | Skeletons with placeholder content | Filled-in real articles |
| `benchmarks/` | Our own analysis, quoted excerpts within fair use, citations | Copied third-party documents or datasets |
| `references/` | URL + title + attribution + our notes | Mirrored copies of referenced works |
| `evals/` | Fixtures that are synthetic or publicly sourced and attributed | Raw transcript corpus, private research working set |
| `scripts/` | Node ESM tooling, tests | Credentials, deploy logic, `suengj-com` build imports |

## Never committed

The validator fails the run on any of these.

1. **Secrets** — API keys, tokens, private keys, `.env` files, credential JSON.
2. **Raw source corpus** — YouTube transcripts, bulk captions, scraped bodies,
   `*.vtt` / `*.srt`, transcript dumps.
3. **Private research working set** — anything marked `confidential`,
   `private`, or `internal-only`; personal or corporate sensitive data.
4. **Canonical article archive** — finished articles belong in `suengj-com`.
5. **Large binaries** — generated audio, video, decks, rendered images, or any
   file over the size ceiling (default 2 MB; 512 KB for images).
6. **Unlicensed third-party content** — verbatim copies of works we only have
   the right to cite.

## Vendor-neutrality rule

A Skill is an *orchestration contract*; a generator is a *replaceable worker*.
Skill definitions in `skills/` must state their inputs, outputs, invariants,
and acceptance checks without naming a required vendor. Where a specific
generator was evaluated, that belongs in `benchmarks/`, not in the Skill.

## Evidence rule

Documentation alone never closes an issue. Every contract that can be checked
must ship with a validator and a fixture pair (allow + deny), and the Linear
issue must carry the execution output. **Absence of a failure is a PASS only
when the check demonstrably ran.**
