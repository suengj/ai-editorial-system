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
| `test-repo-boundary.mjs` | Allow/deny regression for the charter |
| `test-source-contract.mjs` | Mutation regression over the source example |
| `test-article-contract.mjs` | Mutation regression over the article/artifact example |
| `test-rights-policy.mjs` | Catalog, transformation, and visual-rights regression |
| `test-quality-gates.mjs` | Negative/golden fixtures and polish invariants |
| `test-profiles.mjs` | Profiles differ by type; media strategy holds |
| `test-skill-format.mjs` | Skill structure, authority boundary, vendor neutrality |
| `lib/boundary-core.mjs` | Charter rule engine |
| `lib/source-contract-core.mjs` | Source schema + cross-field invariants |
| `lib/article-contract-core.mjs` | Article/Artifact invariants + staleness classifier |
| `lib/rights-core.mjs` | Reference catalog rights engine |
| `lib/quality-gates-core.mjs` | Mechanical editorial gates |
| `lib/polish-invariants.mjs` | Protected-span diff — what makes polish not rewrite |
| `lib/profile-core.mjs` | Content-type evidence burden, fields, and artifact fit |
| `lib/skill-core.mjs` | Skill contract rules and authority boundary |
| `lib/yaml-lite.mjs` | Fail-loud YAML subset parser for SKILL.md front matter |
| `lib/json-schema-lite.mjs` | Dependency-free JSON Schema subset validator |

```bash
npm run validate       # boundary + source + article + rights + skills
npm run check:gates    # editorial gates over the golden fixture
npm run check:profile  # worked example against its profile
npm test               # all seven regression suites
```

Rejects: credentials, deploy logic, imports from `suengj-com`.
