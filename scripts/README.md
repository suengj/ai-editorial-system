# scripts/

Validation and evaluation tooling. Node ESM, no build step, no dependencies.

| Script | Purpose |
|---|---|
| `validate-repo-boundary.mjs` | Fail-closed charter enforcement (AES-P0.1) |
| `validate-source-manifest.mjs` | Source manifest conformance (AES-P0.2) |
| `validate-article-contract.mjs` | Article + Artifact bundle conformance (AES-P0.3) |
| `test-repo-boundary.mjs` | Allow/deny regression for the charter |
| `test-source-contract.mjs` | Mutation regression over the source example |
| `test-article-contract.mjs` | Mutation regression over the article/artifact example |
| `lib/boundary-core.mjs` | Charter rule engine |
| `lib/source-contract-core.mjs` | Source schema + cross-field invariants |
| `lib/article-contract-core.mjs` | Article/Artifact invariants + staleness classifier |
| `lib/json-schema-lite.mjs` | Dependency-free JSON Schema subset validator |

```bash
npm run validate   # boundary + source + article contracts
npm test           # all three regression suites
```

Rejects: credentials, deploy logic, imports from `suengj-com`.
