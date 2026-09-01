# Security policy

## Scope

This repository contains editorial rules, schemas, Skills, and validation
tooling. It contains no credentials, no user data, and no production service.

## Reporting a vulnerability or an exposure

If you find a secret, private source material, or personal data committed here:

1. **Do not open a public issue with the material in it.**
2. Report privately via GitHub Security Advisories on this repository, or
   contact the maintainer through https://suengj.com.
3. Include the file path and commit, not the secret value.

Exposed credentials are treated as compromised: rotate first, then scrub.

## Preventive controls

- `scripts/validate-repo-boundary.mjs` fails the build on secret patterns,
  source-corpus files, private-research markers, and oversized binaries.
- `.gitignore` blocks the common ingestion paths by default.
- Contract: `docs/architecture/REPOSITORY-CONTRACT.md`, "Never committed".

These are defence in depth, not a guarantee. Review diffs before pushing.
