# scripts/

Validation and evaluation tooling. Node ESM, no build step, no dependencies.

| Script | Purpose |
|---|---|
| `validate-repo-boundary.mjs` | Fail-closed charter enforcement (AES-P0.1) |
| `test-repo-boundary.mjs` | Allow/deny regression for the above |
| `validate-source-manifest.mjs` | Source manifest conformance (AES-P0.2) |
| `test-source-contract.mjs` | Mutation regression over the canonical example |
| `lib/boundary-core.mjs` | Charter rule engine |
| `lib/source-contract-core.mjs` | Source schema + cross-field invariants |
| `lib/json-schema-lite.mjs` | Dependency-free JSON Schema subset validator |

```bash
npm run validate   # boundary + source contract
npm test           # both regression suites
```

Rejects: credentials, deploy logic, imports from `suengj-com`.
