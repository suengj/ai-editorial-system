# SUE-1417 — Business magazine compiler evidence

2026-10-08. Base main: `3f0ca3718921980f67bbfa8a5220469542f81055`.

## Implemented

One selected Korean five-frame editorial/visual preset, bounded evidence/case
mapping checks, source-vs-copy separation, a compiler into the **unchanged**
carousel planner, a CLI producing source-linked series + sidecar + caption +
native generation brief, and a focused local regression suite.

The existing Instagram personal-voice defaults, shared recipe catalog,
carousel/image/chart engines, publication code and workflows are unchanged.
No rendered production images, scraped bodies or canonical article copy are
committed. The only test content is explicitly synthetic and inline in the test.

## Actually run

Node `v22.16.0`, local targeted source subset, not a full checkout. Container
GitHub cloning was unavailable, so the two existing planner dependencies were
read through the GitHub connector and their complete bytes were reconstructed
and checked with `git hash-object`:

- `scripts/lib/carousel-core.mjs`: `98d36bbeee6e09a2fbf8d878e6d8e2d7953a5857`.
- `editorial/visual-recipes.v1.json`: `3d354d71b27db7584729f12de18d8a9856b65f92`.

`node scripts/test-business-magazine.mjs`: **40 checks PASS**.

Includes real existing `planCarousel` compatibility, actual CLI writes and source
file hashing, nonexistent/stale output protection, two-case vs single-case deep
dive, evidence/ID/date/reference errors, visible hypothesis/adjacent-case labels,
missing payer/cost/alt, no mutation, and a headline change preserving the other
four **compiled plans** byte-for-byte at JSON comparison level.

Syntax checks for both new modules passed. The renderer was NOT called by these
tests. Plan preservation is not rendered-byte replay evidence.

## Not claimed

- Full checkout, `npm test`, full repository boundary/legacy regression: **NOT_RUN**.
- Actual source reading/truth, semantic citation entailment, company profitability:
  not established by the compiler. Its sidecar explicitly says so.
- Actual raster/render/photo protection/font fit/five-image output: **NOT_RUN in
  this local test suite**. Native samples are a separate execution and must not
  retroactively change this result.
- Independent semantic/vision reviewer and user visual acceptance: **NOT_REVIEWED**.
- GitHub Actions: no dispatch, workflow change or CI execution requested. PR/main
  workflow readback and merge SHA belong in the Linear/PR delivery record.
- Automatic uploading, Instagram publishing, scheduler or account setup: not done.

A native five-card demonstration may follow main merge in the delivery session.
Its source references, actual outputs and review limits belong to that session
and the existing external content/evidence store, not this public rules repo.
