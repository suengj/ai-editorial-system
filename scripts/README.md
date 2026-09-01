# scripts/

Validation and evaluation tooling. Node ESM, no build step, no dependencies.

| Script | Purpose |
|---|---|
| `validate-repo-boundary.mjs` | Fail-closed charter enforcement (AES-P0.1) |
| `validate-source-manifest.mjs` | Source manifest conformance (AES-P0.2) |
| `validate-article-contract.mjs` | Article + Artifact bundle conformance (AES-P0.3) |
| `validate-rights.mjs` | Reference catalog rights + citation cross-check (AES-P0.4) |
| `check-quality-gates.mjs` | Editorial gates over an article body (AES-P1.3) |
| `check-profile.mjs` | Article against its content-type profile (AES-P1.4/P1.5) |
| `validate-skills.mjs` | Skill contract conformance (AES-P2.1) |
| `validate-artifact-plan.mjs` | Artifact plan conformance and claim carry-through (AES-P2.6) |
| `validate-presentation.mjs` | Semantic block grammar and renderer neutrality (AES-P1.6) |
| `run-eval.mjs` | Scorecard over the fixture corpus (AES-P3.2) |
| `generate-poc-artifacts.mjs` | Compile the PoC artifacts; `--check` asserts determinism (AES-P4) |
| `validate-hitl.mjs` | Review record and finalization receipt (AES-P5.1) |
| `run-matrix.mjs` | Cross-source acceptance matrix (AES-P5.2) |
| `generate-handoff.mjs` | Build and validate the suengj-com handoff receipt (AES-P6.1) |
| `test-repo-boundary.mjs` | Allow/deny regression for the charter |
| `test-source-contract.mjs` | Mutation regression over the source example |
| `test-article-contract.mjs` | Mutation regression over the article/artifact example |
| `test-rights-policy.mjs` | Catalog, transformation, and visual-rights regression |
| `test-quality-gates.mjs` | Negative/golden fixtures and polish invariants |
| `test-profiles.mjs` | Profiles differ by type; media strategy holds |
| `test-skill-format.mjs` | Skill structure, authority boundary, vendor neutrality |
| `test-skills-pipeline.mjs` | The Skill set as a pipeline: closed authority, aligned handoffs |
| `test-presentation.mjs` | Renderer neutrality, lossless fallbacks, role fit |
| `test-eval.mjs` | The evaluation method's own regression suite |
| `test-poc-artifacts.mjs` | Determinism, generator refusals, lineage and staleness |
| `test-hitl.mjs` | Approval boundary, re-verification, Final ≠ Published |
| `test-matrix.mjs` | Three source classes, one control plane |
| `test-handoff.mjs` | Sidecar anchoring, safe degradation, version compatibility |
| `lib/boundary-core.mjs` | Charter rule engine |
| `lib/source-contract-core.mjs` | Source schema + cross-field invariants |
| `lib/article-contract-core.mjs` | Article/Artifact invariants + staleness classifier |
| `lib/rights-core.mjs` | Reference catalog rights engine |
| `lib/quality-gates-core.mjs` | Mechanical editorial gates |
| `lib/polish-invariants.mjs` | Protected-span diff — what makes polish not rewrite |
| `lib/profile-core.mjs` | Content-type evidence burden, fields, and artifact fit |
| `lib/skill-core.mjs` | Skill contract rules and authority boundary |
| `lib/plan-core.mjs` | Artifact plan rules and claim carry-through |
| `lib/presentation-core.mjs` | Semantic grammar, renderer-leak detection, fallback losslessness |
| `lib/eval-core.mjs` | Rubric scoring and the integrity-dominates comparison |
| `lib/chart-renderer.mjs` | Deterministic SVG chart and Mermaid diagram emitters |
| `lib/brief-generator.mjs` | Brief compiler with claim-carry-through refusals |
| `lib/deck-generator.mjs` | Marp deck compiler |
| `lib/lineage.mjs` | Staleness classification, relocation, regeneration |
| `lib/hitl-core.mjs` | Human approval boundary and re-verification rules |
| `lib/handoff-core.mjs` | Article → front matter mapping and presentation sidecar |
| `lib/yaml-lite.mjs` | Fail-loud YAML subset parser for SKILL.md front matter |
| `lib/json-schema-lite.mjs` | Dependency-free JSON Schema subset validator |

```bash
npm run validate       # boundary + source + article + rights + skills
npm run check:gates    # editorial gates over the golden fixture
npm run check:profile  # worked example against its profile
npm run eval           # scorecard over the fixture corpus
npm run poc:check      # PoC artifacts regenerate byte-identically
npm run matrix         # three source classes through one control plane
npm run handoff        # build the suengj-com handoff receipt
npm test               # all fourteen regression suites
```

Rejects: credentials, deploy logic, imports from `suengj-com`.
