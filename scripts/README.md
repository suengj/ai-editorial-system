# scripts/

Validation and evaluation tooling. Node ESM, no build step, no dependencies.

| Script | Purpose |
|---|---|
| `validate-repo-boundary.mjs` | Fail-closed charter enforcement (AES-P0.1) |
| `validate-source-manifest.mjs` | Source manifest conformance (AES-P0.2) |
| `validate-article-contract.mjs` | Article + Artifact bundle conformance (AES-P0.3) |
| `validate-rights.mjs` | Reference catalog rights + citation cross-check (AES-P0.4) |
| `check-quality-gates.mjs` | Editorial gates over an article body (AES-P1.3) |
| `test-repo-boundary.mjs` | Allow/deny regression for the charter |
| `test-source-contract.mjs` | Mutation regression over the source example |
| `test-article-contract.mjs` | Mutation regression over the article/artifact example |
| `test-rights-policy.mjs` | Catalog, transformation, and visual-rights regression |
| `test-quality-gates.mjs` | Negative/golden fixtures and polish invariants |
| `lib/boundary-core.mjs` | Charter rule engine |
| `lib/source-contract-core.mjs` | Source schema + cross-field invariants |
| `lib/article-contract-core.mjs` | Article/Artifact invariants + staleness classifier |
| `lib/rights-core.mjs` | Reference catalog rights engine |
| `lib/quality-gates-core.mjs` | Mechanical editorial gates |
| `lib/polish-invariants.mjs` | Protected-span diff — what makes polish not rewrite |
| `lib/json-schema-lite.mjs` | Dependency-free JSON Schema subset validator |

```bash
npm run validate     # boundary + source + article + rights
npm run check:gates  # editorial gates over the golden fixture
npm test             # all five regression suites
```

Rejects: credentials, deploy logic, imports from `suengj-com`.
