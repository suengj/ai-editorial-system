# Benchmark brief — SUE-1726 round 6

- Target: `signalytics-news`; artifact: `visual/prediction-market-carousel`.
- October contract: `KXFED-26OCT-T4.00` = 15%; total volume 245,526.39 contracts; 24-hour volume 434.36; open interest 72,019.73. PMC observed 2026-10-21T05:00:00Z, retrieved 2026-10-21T11:21:22.939885Z.
- December contract: `KXFED-26DEC-T4.00` = 81%; total volume 56,056.35 contracts; 24-hour volume 557.58; open interest 19,255.76. PMC observed 2026-10-21T05:00:00Z, retrieved 2026-10-21T11:21:22.939885Z.
- December raw history: 90% at 2026-10-14T13:00:00Z → 81% at 2026-10-21T05:00:00Z; 48 observations; −9%p. Generated curve direction and overlay pass raw endpoint parity.
- 24-hour liquidity comes from Kalshi public market API at 2026-10-21T11:33:49.673997+00:00; total volume and 24-hour volume are stored separately.
- Exact contract titles, resolution rules, PMC history and source URLs are in `source-sidecar.json`. Market prices are not confirmed Fed decisions.
- Publication: `NOT_AUTHORIZED`.
