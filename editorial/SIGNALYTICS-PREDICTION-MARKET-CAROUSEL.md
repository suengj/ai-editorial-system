# Signalytics prediction-market carousel (SUE-1726)

Applies only to the registered `signalytics-news` target and the
`visual/prediction-market-carousel` artifact. The series is five content cards:
hook and PMC hero value; the requested 30-day trend chart; dated inflection
points; market pricing beside current news; and the next resolution date and
triggers. The existing PMC binder owns the chart card and its numeric lineage.

## Copy rules

- Keep the platform's original market name. The first card states the question
  and the current hero value copied from PMC.
- Market values, dates, period labels, deltas, and chart points come only from
  the selected, hash-verified PMC bundle. Do not recompute, extend, smooth, or
  interpolate values in card copy. Preserve PMC's observed window; if the local
  PMC contract clamps the request, label the actual window and report the limit.
- Build the chart card from `scripts/bind-pmc-bundle.mjs`; copy the emitted
  `chart.spec.json` path and SHA-256 into the series chart block. Never render
  the template's placeholder hash as if it verified a real bundle.
- Separate what the contract price says from what a dated news source says.
  A market price is a market signal, not confirmation that an event occurred.
- Tie every inflection point to a dated event and a source. If that source is
  not verified, write `[편집자 확인 필요: 날짜·사건·출처 확인]` in the draft.
  Use the same convention for unverified resolution rules or triggers.
- Write short, human-edited Korean headline lines. Avoid summary scaffolding,
  `~에 대해 알아보겠습니다`, list-like report cadence, and generic
  transitions. Each card must say something useful even when an editor-check
  placeholder remains.
- No betting or investment CTA. Do not add an investment disclaimer, a
  standalone timestamp card, generic legal copy, or a boilerplate footer.
  Chart card may show one compact provider/source credit; keep run IDs, hashes,
  API details, and provenance in the handoff files.
- Card 4 must label any analysis as interpretation and leave unresolved news
  as an editor-check placeholder. Card 5 names the exact resolution date and
  triggers only when contract rules or primary sources verify them.

## Five-card order

1. `hook`: verbatim platform market name + PMC hero value; explain the
   question's time boundary in one short line.
2. `trend`: PMC-bound 30-day chart, copied source values, with one source credit
   at most. Use the actual observed period if PMC cannot supply 30 days.
3. `inflections`: dated changes in the curve paired with sourced events; use
   visible editor-check placeholders when sources are missing.
4. `pricing-news`: what the contract price indicates beside what verified news
   reports; distinguish signal, fact, and editorial reading.
5. `watch-next`: contract resolution date and source-verified triggers. No
   action prompt.

## Visual direction

Use the established carousel compositor at 1080×1350. R4 is the default when a
strong, rights-cleared editorial photograph is provided. Use the existing R7
illustration fallback when there is no suitable photo. Keep text, labels,
citations, and charts deterministic; artwork cannot carry data or overlap the
chart. Avoid pseudo-terminal dashboards and decorative market numbers.
