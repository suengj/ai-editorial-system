# SUE-1334 NOT_RUN verification + SUE-1336 PMC bundle binding — evidence, 2026-10-18

Branch `sue-1334-1336-visual` (local only; nothing pushed, no PR, CI **NOT_RUN**).
Runtime: Node.js 22.23.0, rsvg-convert 2.60.0, macOS shared laptop; suites were run
serially. No paid/model/provider-authenticated call, upload or publication. The
private intelligence-library clone was not fetched.

## SUE-1334 — items its record listed as NOT_RUN

`PHASE0-3-EVIDENCE.md` listed the full `npm test`, the boundary suite and the
article/claim compiler E2E as not run. They now ran against a full checkout:

| Command | Result |
|---|---|
| `ALLOW_LIBRARY_SKIP=1 npm test` (whole chain, incl. `test:boundary`, `test:article`, `test:gates`, `test:skills`, `test:visual*`, `test:schema-parity`, `test:numeric-visual`, `test:web-catalog`, `test:pmc-binding`) | **EXIT 0** on fix commit `5952433` (run on that tree; `test:pmc-binding` 24 passed, 0 not_run; `test:library-input` 1 skipped, its real-command smoke NOT_RUN under `ALLOW_LIBRARY_SKIP=1`) |
| `ALLOW_LIBRARY_SKIP=1 npm run validate` (incl. `web-catalog:check`, `validate:boundary`, `validate:article`, `validate:visual*`, `registry:check`) | **EXIT 0** |
| `npm run check:gates` (article bundle + golden fixture E2E) | `gates: PASS` |
| `npm run test:visual-execution` (**not** in the `npm test` chain; run separately) | 45 assertions PASS after fix 4 below (it failed before) |
| `node scripts/test-carousel.mjs --render` (**not** in the chain either; plain `npm run test:carousel` is planner-only) | 69 assertions PASS after fix 4 below (the `--render` run failed before) |

`npm test` is an `&&` chain, so the first run stopped at each failure below. Four
pre-existing defects were found, none caused by SUE-1334's own code; each was fixed
at the source with the existing test as the regression check (items 1–3 in commit `ba6aa41`, item 4 in commit `9d4d049`):

1. `test:skills` — `skills/compile-slide-deck` listed "approved beats" under
   `authority.may`; the linter's forbidden-authority rule rejects "approved".
   Reworded to "Visual Story Plan beats". The linter was not loosened.
2. `test:schema-parity` — `schemas/reference-evaluation.schema.json` `surfaces`
   enum lacked `instagram`, `linkedin`, `report-deck`, which exist as surface
   profiles. Added the three ids.
3. `test:web-catalog` — the test's hard-coded schema list predated
   `video-critique` / `video-genre-preset` (SUE-1645). The committed catalog was
   already current; the expectation was updated.

4. `test-visual-execution.mjs` ("exact image slot preserves unscaled source
   pixels") and `test-carousel.mjs --render` ("photo cannot change pixels outside
   its slot") hard-coded a 4-byte pixel stride. `rsvg-convert` (the default
   rasterizer here, 2.60.0) writes opaque 3-channel PNGs, ImageMagick `PNG32`
   writes 4, so both tests compared the wrong bytes and failed on rsvg. The
   renderer was not wrong; the tests now index by the decoded `channels`.
   `PHASE0-3-EVIDENCE.md` ran under ImageMagick only, which is why this was
   not seen before. These two scripts are not part of `npm test`; that gap is
   left as is (adding them is a decision for the owner).

**Still NOT_RUN:** the library smoke (`ALLOW_LIBRARY_SKIP=1` is the documented
opt-in; the real-command smoke needs the private intelligence-library clone and is
reported as NOT_RUN, not as pass). `certify-v2.mjs` has a prose list of five surface
profiles that is now out of date; left unchanged (not part of any failing check).
Phase 4 / native-generation UAT and owner visual review remain open.

## SUE-1336 — real PMC bundle through the deterministic chart binding

Added `scripts/lib/pmc-bundle-binding.mjs`, `scripts/bind-pmc-bundle.mjs`,
`scripts/test-pmc-binding.mjs` (`npm run test:pmc-binding`: 24 assertions with a
rasterizer; without one, the 6 render assertions print NOT_RUN and the other 18
still run),
`editorial/PMC-BUNDLE-BINDING.md`, fixtures under `scripts/fixtures/pmc-bundle/`
(explicitly fictional run through PMC's real `pmc chart`; no real market data
or PNG committed). A local PMC checkout (read-only) was used; its outputs went to a
temp dir, since removed.

Test coverage (real SVG→PNG render, no fakes): PMC `plot_data_sha256` reproduced
(Python float spelling preserved); edited value rejected; snapshot and multi-outcome
bundles refused; spec values/x-order/gap nulls equal the bundle; rendered endpoint,
hero, delta, axis and observation count equal PMC's; the gap is two sub-paths;
theme-only change leaves data/spec/displayed numbers identical; ungrounded title
`%` rejected; long Korean title fits or fails `TEXT_OVERFLOW`, never truncated;
general (non-probability) counts >100 are unaffected; a tampered endpoint label is
caught by `verify`; CLI `bind` refusals and `verify` PASS.

Real-data runs (free public Manifold API only, zero API keys, `api_calls: 0`).
Manifold returned HTTP 503 earlier in the session and recovered later; of several
public queries only one market had a chartable history:

| Run | Source | plot_data_sha256 | Render `image.png` sha256 | Numeric lineage QA |
|---|---|---|---|---|
| fixture (fictional) | `manifold-illustrative-gap-1ec91c13` | `5c830bb0…be16` | `a4fdf00b…48b7` (identical across two runs) | PASS |
| **live public** | Manifold `CO0N90hQdd`, as_of 2026-10-18T01:22:48Z, 6 observations over ~1 day, `history_type: event`, PMC chart hash matched | `4e5aea8f…850e` | `38874ce2…2d63` | PASS |

The flow `bind → resolve-editorial --plan (READY) → render-visual (RENDERED_NEEDS_REVIEW)
→ verify` ran for both. Outputs are under the git-ignored `out/pmc-binding/` and
`out/pmc-binding-live/` (the latter also holds PMC's own PNG for comparison); they
are not committed. A search that found only a one-observation market was correctly
refused (`PLOT_NOT_CHARTABLE`).

Defects found by the first real render and fixed: hero text slot too short (150px
glyph in a 175px slot → `TEXT_OVERFLOW`); `--out` directory not created by the
CLI; a dangling "Manifold ·" series title when the market has no outcome label
(regression test added).

## What the owner must still judge

Numeric lineage QA is `PASS` only for numbers and lineage; **visual QA is
`NOT_RUN_OWNER_REVIEW_REQUIRED` and nothing here is publication or approval.**
Review per `editorial/PMC-BUNDLE-BINDING.md` §5. Specifically from the live run:

- This panel joins event observations with straight segments; PMC draws the same
  data as a step curve, so the shapes differ (compare the two PNGs).
- Dates are UTC; PMC's PNG uses KST, so the day labels differ.
- The title check covers `%` numbers only; `checkNumericCard` (title date/period
  claims, footer `as_of`/coverage) is not applied. The live title contains a date
  and a dollar figure that the card does not display.
- The 1-day, 6-point series reads as a flat line; whether such a card is worth
  posting is an editorial decision.

CI: **NOT_RUN** (no workflow was triggered; nothing was pushed).
