# Signalytics prediction-market carousel (SUE-1726)

Scope: registered `signalytics-news` target, artifact
`visual/prediction-market-carousel`. Output is five editorial cards by default,
with a sixth card when the story needs it (owner request may set six), plus a
separate `caption.md` and source sidecar. This document governs copy and visible
card content; PMC continues to own market history and numeric lineage.

## Copy rules

- Choose a Korean-relevant market with a useful verified history. Use the exact
  question and resolution rule in the sidecar; do not force a probability band
  that changes the strongest verified story.
- Open with a natural Korean statement or question. Make the current PMC hero
  probability the largest type on card 1, followed by one short reader-facing
  reason it matters. Keep the exact platform market name in the sidecar.
- Use short, human-edited Korean. Each card has one point and 1–3 supporting
  lines containing concrete values and dates where the evidence supports them.
  Avoid report cadence, translated phrasing, abstract filler and repeated setup.
- Market values, dates, period labels, deltas and chart points come only from
  the selected hash-verified PMC bundle. Do not recompute, extend, smooth or
  manually interpolate them. If the available history covers a week, describe
  it as `이번 주`; never mention an internal history cap or unavailable request.
- Default chart cards use `scripts/bind-pmc-bundle.mjs`; copy the emitted
  `chart.spec.json` reference and SHA-256 into the rendered series. By explicit
  owner decision, a chart may instead use `illustrative_trend_image`: one
  generated smooth continuous curve with no text or numbers, whose direction
  matches the first and last raw PMC observations. The renderer overlays those
  exact start/end values and their `%p` change; parity is required. Missing PMC
  history blocks this mode. For deterministic chart cards, show actual y-axis
  ticks and range when zoomed.
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

## Card order

1. `hook`: strong Korean headline, huge PMC probability, and a clear reason it
   matters.
2. `how-to-read`: explain contract cents as payout probability and give the
   sourced trading volume in one tight explainer.
3. `trend`: chart of the actual available window, reader-facing dates, and one
   sentence of insight.
4. `why`: dated, sourced inflation, employment, and Fed-policy evidence woven
   into the observed PMC path. Keep chronology distinct from proven causation.
5. `korea-impact`: verified USD/KRW, Korea-US rate differential, Bank of Korea
   context, and concrete transmission to Korean readers.
6. `watch-next`: verified next date and plain scenario impacts on the market
   price. The series may use five cards when an explainer is unnecessary.

## Visual direction

Reuse the existing `r4-photo-fullbleed` recipe, `hero`/`visual` layouts,
`business-magazine-core` and `carousel-core`. Keep prediction-market work as a
content variant. If the owner opts in to generated imagery, use the existing
generated-image evidence path for text-free scenes with no logos, fake
screenshots or real-person likenesses. `illustrative_trend_image` may replace
the plotted chart pixels only under the source and parity rules above. Use Noto
Serif KR headlines and AES Sans KR body copy. Give every card the same grid,
margins and text baseline; keep each text block inside its container with
padding. Contact sheets contain only the five or six cards in a centered
3-column arrangement. Cards are content-only; a deterministic chart may carry a
tiny provider credit.
