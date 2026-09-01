# Contributing

## Before you open a PR

```bash
npm run validate:boundary
npm test
```

Both must pass. A PR that adds a contract without a validator and an
allow/deny fixture pair is incomplete.

## Ground rules

1. **Respect the SSOT matrix.** `docs/architecture/SSOT-BOUNDARIES.md` decides
   what belongs here. Source bodies, canonical articles, and publication logic
   do not.
2. **Never commit forbidden content.** See "Never committed" in
   `docs/architecture/REPOSITORY-CONTRACT.md`. When in doubt, reference it
   instead of copying it.
3. **Vendor neutrality.** Skills declare inputs, outputs, invariants, and
   acceptance checks. Generator-specific findings go in `benchmarks/`.
4. **Evidence over prose.** Documentation alone does not close work. Attach
   execution output — validator runs, fixture results, eval scores.
5. **No new infrastructure by default.** New databases, vector stores, or agent
   frameworks require an explicit architecture decision in `docs/architecture/`.
6. **Publication is out of bounds.** Nothing here may set an article to
   `status: published`. Human approval in `suengj-com` is the only path.

## Work tracking

Scope, dependencies, and acceptance live in Linear under
*Suengj.com · AI Editorial System*. Reference the issue id (`SUE-###`) in the
branch name and PR title.

## Commit and PR shape

- One contract or Skill per PR where practical.
- PR body states: what contract changed, what validator proves it, and which
  Linear acceptance criterion it satisfies.
