# Instagram numeric-visual policy (SUE-1330)

A small, bounded profile for Instagram probability trend cards (prediction
markets first). It reuses the existing lanes and adds nothing general:

- brand/profile priority: [`profiles/brand/suengj-com.v1.json`](profiles/brand/suengj-com.v1.json) (SUE-565);
- deterministic chart/infographic evidence lane: [`INFOGRAPHIC-AND-POSTER.md`](INFOGRAPHIC-AND-POSTER.md),
  [`../schemas/VISUAL-BRIEF-AND-RENDER-SPEC-CONTRACT.md`](../schemas/VISUAL-BRIEF-AND-RENDER-SPEC-CONTRACT.md) (SUE-628 / SUE-667);
- pixel review: [`../scripts/validate-visual-review.mjs`](../scripts/validate-visual-review.mjs).

Machine profile: [`numeric-visual/instagram-numeric-visual.v1.json`](numeric-visual/instagram-numeric-visual.v1.json).
Checker: [`../scripts/lib/numeric-visual-core.mjs`](../scripts/lib/numeric-visual-core.mjs) (`checkNumericCard`).
Tests: `npm run test:numeric-visual` (part of `npm test` and `npm run validate`).

The data contract, interpolation and renderer are implemented in
prediction-market-crawler (SUE-1331). This policy is neither implementation
completion nor permission to post on social media.

요약: 미감은 AI가 설계하고, 수치·그래프·최종 합성은 코드가 책임진다.

## 1. Two lanes

| AI art direction (may) | Deterministic rendering (must) |
|---|---|
| grounded title, layout, palette choice, hierarchy, optional decorative assets | exact numbers, axes, chart geometry, endpoint labels, footer, final composition |

- The AI never changes or invents numbers, dates, quotes, sources, coverage or market conditions.
  A number in the AI title must be a value the deterministic lane displays (`TITLE_NUMBER_UNGROUNDED`).
- An image model never draws or redraws the data chart. `rendering.image_ai_role` is `none` or
  `decorative_only`, and decorative assets never overlap the plot or carry data.

## 2. Approved visual direction

- 1080 × 1350 portrait, or the same ratio at 2×.
- Off-white `#F7F5F0` background with navy `#14213D` text.
- Polymarket cobalt `#2E5BFF` and Kalshi coral `#FF6B5B`, used for those providers only.
- Single market: one hero number plus the chart. Dual comparison: two equal number cards and two distinct lines.
- Smooth lines from real observations, direct endpoint labels, and a period / coverage / source / as-of footer.
- A `suengj.com` watermark sits **behind the plot** at about 7% opacity (0.05–0.09) and never covers
  lines, axes or labels. This background layer is specific to this profile. It is not the SUE-1303
  overlay, which keeps its exclusion zones.
- Approved mockups: `libfile_971c250507d88191829fd4b23a43cece` (dual-market-watermark.png) and the
  earlier version without a watermark, `libfile_ee0b381f05908191a08bb9b21e10f89f`. They approve the
  **visual direction only**.

## 3. Fact rules

- The last point of the history is not the current quote, and `retrieved_at` is not `as_of`. Never
  append a quote to the history. Endpoint labels come from the last history observation, and the
  footer `as_of` is an actual observation or quote time.
- Show the actual observed period. If 7 days were requested but only 3 exist, label it 3 days, and
  never write "7-day change" without a valid 7-day baseline.
- Values use `%` and deltas use `%p`. A delta is the last raw value minus a raw baseline
  observation, never a value taken from the resampled display curve. Rounding is fixed at 1 decimal.
- Manifold / MANA is `play_money`. Never use cash, return or payout wording for it.
- The axis defaults to the full 0–100%. A zoom is deterministic: pad by 5 points, round to 5, keep a
  minimum span of 20 points and clamp to 0..100. A zoom label must state its actual range, and a
  dual comparison uses one shared axis.
- Interpolation is shape-preserving (monotone), linear or step, and keeps every raw point. A moving
  average is allowed only when requested and labeled. Gaps longer than `max_gap_hours` (default 24)
  are drawn as separate segments, never bridged. No forward-fill and no synthetic points.

## 4. QA and approval

- Numeric validation (raw data against displayed values) and visual review are separate records.
  Pixels alone never pass numeric QA.
- Visual review covers full size and phone size, with these cases: long Korean title, endpoint
  collision, watermark contrast, sparse data, flat data, 0% and 100%.
- Publication requires passed numeric QA, passed visual QA and the owner's explicit production
  approval. This repeats the existing owner gate. It adds no new approval layer.
- A fictional mockup carries a visible "illustrative / 가상" label. It can approve visual direction
  only, and it is never factual, never production approval and never published.

## 5. Cross-provider comparison (later phase)

- `exact` requires the same event, outcome direction, deadline, resolution rules and currency
  context. Anything less is `related`: label each series separately and never merge them.
- Aligned windows, independent as-of and coverage for each provider, no forward-fill, and no
  invented consensus.
- The spread is the difference between raw endpoints, shown in `%p` and only for exact matches.
  It is never profit or arbitrage.

## 6. Worked example

[`../scripts/fixtures/numeric-visual/worked-example-illustrative-mockup.json`](../scripts/fixtures/numeric-visual/worked-example-illustrative-mockup.json)
is the approved dual direction as a spec:

- AI lane: title 「두 시장이 보는 같은 질문」, layout `two-equal-cards-over-shared-chart`, hierarchy title → cards → chart → footer.
- Deterministic lane: Polymarket 40.0→55.5% and Kalshi 38.0→51.0%, over 7 days of actual observations
  on a shared 0–100% axis, with endpoint labels `55.5%` / `51.0%`, deltas `+15.5%p` / `+13.0%p`, the
  watermark behind the plot at 0.07 and a footer.
- Status: `illustrative: true`, so owner approval has `scope: visual_direction`. Numeric QA is not
  applicable and publication is blocked.

Fixture/QA cases in `scripts/fixtures/numeric-visual/`:

| Case | Fixture |
|---|---|
| smooth valid observations | `single-smooth` |
| sparse / gapped data (segmented) | `single-sparse-gapped` |
| shorter than requested (7 requested, 3 observed) | `single-short-history` |
| explicit labeled zoom | `single-zoom` |
| flat / 100% boundary | `single-flat-zero-hundred` |
| Manifold play-money | `single-manifold-play-money` |
| exact dual with %p spread | `dual-exact` |
| related, separately labeled | `dual-related` |

`scripts/test-numeric-visual.mjs` mutates these fixtures so that each rule above fails with its own code.

## 7. Enforced vs documented

The checker enforces the spec. Rendered pixels are judged by the visual review records, and this
repository does not inspect them. The checker cannot verify the following, which stay documented
only: whether the PNG matches the spec, actual watermark contrast and collisions (visual review),
whether the five `exact` criteria are factually true (reviewer attestation), and SUE-1331 renderer
conformance.
