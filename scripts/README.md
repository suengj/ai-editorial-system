# scripts/

Validation and evaluation tooling. Node ESM, no build step, no dependencies.

| Script | Purpose |
|---|---|
| `validate-repo-boundary.mjs` | Fail-closed charter enforcement (AES-P0.1) |
| `test-repo-boundary.mjs` | Allow/deny regression for the above |
| `lib/boundary-core.mjs` | Rule engine shared by both |

Rejects: credentials, deploy logic, imports from `suengj-com`.
