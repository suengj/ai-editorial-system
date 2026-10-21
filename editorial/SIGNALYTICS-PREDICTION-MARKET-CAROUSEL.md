# Signalytics prediction-market carousel (SUE-1726)

Scope: registered `signalytics-news` target, artifact
`visual/prediction-market-carousel`. Output is five editorial cards with a
separate `caption.md` and source sidecar. This document governs copy and visible
card content; PMC continues to own market history and numeric lineage.

## Copy rules

- Select a Korean-relevant market with genuine uncertainty (roughly 20–80%) and
  a visible move in the available observation window. Prefer Fed/FOMC, US
  politics, AI/technology or macro topics on Polymarket or Kalshi. Avoid flat,
  near-expiry markets.
- Open with a natural Korean question. Put the exact platform market name in
  small type below it. Make the current PMC hero probability the largest type
  on card 1, followed by one short Korean takeaway.
- Use short, human-edited Korean. Each card has one point and 1–3 supporting
  lines containing concrete values and dates where the evidence supports them.
  Avoid report cadence, translated phrasing, abstract filler and repeated setup.
- Market values, dates, period labels, deltas and chart points come only from
  the selected hash-verified PMC bundle. Do not recompute, extend, smooth or
  manually interpolate them. If the available history covers a week, describe
  it as `이번 주`; never mention an internal history cap or unavailable request.
- Build the chart card with `scripts/bind-pmc-bundle.mjs`; copy the emitted
  `chart.spec.json` reference and SHA-256 into the rendered series. Verify the
  render against the same bundle. If movement is small, use an honest axis and
  a delta callout; only use a zoomed axis when the numeric-visual policy permits
  it and the actual range is plainly labeled.
- Separate contract pricing from verified news. A price is a market signal,
  not evidence that an event happened. Cite every news claim in the sidecar
  JSON, with its date and direct source URL. Do not put research URLs on cards.
- Use a dated event only when a reliable source confirms it. If the event or
  trigger cannot be verified, rewrite the card around verified PMC movement or
  published contract rules so that it no longer depends on that fact. Never
  render editorial placeholders.
- No betting/investment CTA, disclaimer, as-of or timestamp boilerplate,
  process/meta language, footer caption, page number, run ID, hash or API detail.
  The only permitted on-card source credit is one tiny `출처 Kalshi` or
  `출처 Polymarket` inside the chart panel.

## Five-card order

1. `hook`: natural Korean question, exact market name in small type, huge PMC
   probability and one-line takeaway.
2. `trend`: chart of the actual available window. Label the dates visible in the
   chart; for a seven-day history call it `이번 주`.
3. `inflections`: one to three dated price turns from raw PMC values. Add event
   context only when it has a dated, sidecar-cited source.
4. `pricing-news`: contract price beside one to three independently verified
   facts, each dated and linked in the sidecar. Keep interpretation concise.
5. `watch-next`: next contract-relevant date and trigger, only when the exact
   settlement rule or official schedule is verified. Otherwise use a verified
   market-history takeaway that does not imply a trigger.

## Visual direction

Use the R4 Korean business-magazine language: Noto Serif KR headlines,
Pretendard body, ivory background, navy type and a provider accent. Give every
card a clear typographic grid and a deliberate chart, numeric block, comparison
panel or simple geometric composition. Use a dominant hero number on card 1.
Do not use paid image generation, empty beige layouts, faux data, dashboards,
process language, pagination or footer copy. Cards are content-only; only the
chart may carry a tiny provider credit.
