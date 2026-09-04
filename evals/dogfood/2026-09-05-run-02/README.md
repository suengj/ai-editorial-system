<!--
SUE-569 dogfood run — AGENT-PRODUCED, NOT OWNER EVIDENCE.

Everything under this directory was produced by an autonomous agent
(provider anthropic, model claude-sonnet-5, runtime claude-code) operating
the V2 text-path machinery end to end, on 2026-09-05. No human reviewed any
output before, during, or after this run. Every owner_verdict in every
record here is `unknown`, and stays `unknown` until a human actually says
otherwise — silence is not acceptance (V2-EDITORIAL-LEARNING-CORE.md §11).
Nothing here is provenance_class anything but `generated_output`; nothing
here is promoted to reference authority; nothing here is published or
approved. This is dogfood evidence that the text path runs, not a claim
that its output is good.
-->

# Dogfood run — 2026-09-05-run-02 (SUE-569, text-path follow-up)

**What this is.** `2026-09-05-run-01` explicitly did not run the text path:
`frame-article`, `write-article`, and `verify-claims` were never invoked, and
certification area 1 stayed `PARTIAL` for exactly that reason. This run
closes that specific gap — for real, with real public sources, actually
verified — while staying inside the same SSOT boundary run-01 respected: no
publishable article file, no `content/` path, no front matter. What this
repository legitimately keeps is the contract instances (Editorial Intent,
source manifest, Article Frame + verification block, L0 gate result, L1
review, feedback record) plus a short, clearly-labelled draft excerpt — not
a finished article pretending to be a draft.

**Who produced it.** One agent (provider `anthropic`, model
`claude-sonnet-5`, runtime `claude-code`), no human in the loop at any step.
Every `evaluator`/`reviewer` field in every record below says so explicitly.

## What actually ran

| Step | Ran | Real machinery exercised |
|---|---|---|
| 1. Intake | Yes | `node scripts/validate-intent.mjs` against `01-intake/intent.json` — real result: **PASS**, 1 note (same known `text/article`-is-planned note run-01 got, not something this run caused) |
| 2. Sources | Yes | `node scripts/validate-source-manifest.mjs` against `02-sources/source-manifest.json` — **PASS**. Six real, live, public URLs, fetched with `curl`/`WebFetch` on 2026-09-05, each `content_hash` a real sha256 over the fetched HTML (bodies discarded after hashing, never committed) |
| 3. `frame-article` | Yes | A real Article Frame with a falsifiable thesis, non-empty `uncertainty`, and the research profile's required fields, hand-assembled from the actually-read sources and validated structurally — see below |
| 4. `verify-claims` | Yes | Six claims actually checked against the fetched sources: 4 `verified`, 1 `contradicted`, 1 `unverified` — **this is the step run-01 could not do** |
| 5. `write-article` + `editorial-polish` | Yes, partially by design | A short, explicitly-labelled excerpt (`04-draft-excerpt/excerpt.md`) covering 3 of the frame's 5 structure points — not a full article, per the SSOT constraint on this run |
| 6. L0 | Yes | `node scripts/check-quality-gates.mjs --bundle ... --type research 04-draft-excerpt/excerpt.md` — real result: **REJECT** (citation-integrity), see below |
| 7. L1 | Yes | Manual comparative review per `skills/review-l1/SKILL.md`, subject vs `evals/fixtures/golden/G-01-synthesis.md`, validated with `scripts/lib/l1-core.mjs` — **0 schema/invariant issues** |
| 8. Feedback + routing | Yes | One real observation from the L1 review, routed to layer `frame`, persisted at `feedback/records/dogfood-2026-09-05-run-02-chaindrop-synthesis-gap.json`, picked up by `node scripts/registry.mjs --rebuild/--validate/--check` and `node scripts/validate-routing.mjs`, all passing |

## The topic and why it was chosen

**npm supply-chain hardening vs. the CHAINDROP worm (August 2026).** GitHub
announced a multi-part npm hardening plan in September 2025 (trusted
publishing, short-lived tokens, FIDO 2FA) and shipped its most concrete piece
— install-time lifecycle scripts (`preinstall`/`install`/`postinstall`)
disabled by default — as npm v12 on July 8, 2026. On August 4, 2026, a worm
called CHAINDROP compromised the maintainer of `keyv` and backdoored
hundreds of co-owned packages using exactly a `preinstall` hook. This was
chosen because it is current, technical, and genuinely load-bearing for
`synthesize`: the mitigation-timeline sources and the incident-report
sources never address each other, so connecting them is real synthetic work,
not restating either side. It does **not** flatter the system either way —
the honest reading, laid out below, is that neither the defenders' nor the
attackers' public documentation answers the obvious question this run set
out to check.

## Real sources used

All six fetched directly (`curl` for hashing, `WebFetch`/`WebSearch` for
reading) on 2026-09-05. Full manifest: `02-sources/source-manifest.json`.

| Source | Published | Role | What it's authoritative for |
|---|---|---|---|
| [GitHub Blog — "Our plan for a more secure npm supply chain"](https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/) | 2025-09-22 | primary | GitHub's own stated hardening plan |
| [GitHub Changelog — "Upcoming breaking changes for npm v12"](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/) | 2026-06-09 | primary | What was announced to change, and when |
| [GitHub Changelog — "npm install-time security and GAT bypass2fa deprecation"](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/) | 2026-07-08 | primary | Confirms npm v12 shipped with the defaults live |
| [Elastic Security Labs — "Shai-Hulud strikes again: CHAINDROP worm hits 400+ npm packages"](https://www.elastic.co/security-labs/shai-hulud-chaindrop-npm-supply-chain) | 2026-08-06 | contradicting | The incident itself; the source that tests the hardening narrative |
| [StepSecurity — "ChainDrop npm Worm"](https://www.stepsecurity.io/blog/chaindrop-npm-worm) | 2026-08-04 | supporting | Independent cross-check on package count and vector |
| [Unit 42 (Palo Alto Networks) — "ChainDrop: Inside a Self-Propagating npm Worm"](https://unit42.paloaltonetworks.com/chaindrop-npm-worm-analysis/) | 2026-08-06 | background | Third independent cross-check |

One practical, real finding from this step, worth recording: re-fetching the
Unit 42 URL twice in the same session produced **two different sha256
hashes** over the raw HTML (dynamic page content — ads, timestamps, or
similar — changes between fetches even when the substantive text does not).
The manifest records the most recent fetch's hash. This is a genuine
limitation of "sha256 over the normalised source body" (`schemas/SOURCE-CONTRACT.md`)
applied to a live web page rather than a stable file — the contract was
written with Drive/GitHub-file sources in mind, where content is
addressable, not with dynamically-served HTML. Recorded here rather than
smoothed over.

## Claims verified — and one that did not check out

`03-frame-and-article/article-bundle.json#verification.claims`, six claims:

| Claim | Status | Note |
|---|---|---|
| `c1` — GitHub's Sept 2025 hardening plan (trusted publishing, short-lived tokens, FIDO 2FA) | **verified** | Directly quoted from the primary GitHub Blog post |
| `c2` — npm v12 (July 8, 2026) made install-time lifecycle scripts opt-in, as announced June 9, 2026 | **verified** | Two primary GitHub Changelog posts |
| `c3` — CHAINDROP compromised packages via a `preinstall` hook starting Aug 4, 2026 | **verified**, with a recorded disagreement | Elastic says "over 400" packages; StepSecurity says "444 packages, 2,212 versions in under four hours." Both numbers are kept, not averaged or picked — per `verify-claims`' own invariant that a contradiction is recorded, not resolved by choosing the convenient side |
| `c4` — Elastic's own per-package download figures for the compromised packages | **verified** | Direct quote: keyv 600M+/mo, flat-cache ~580M, cacheable-request 137M+, cacheable 30M+, cache-manager 16M+ — sums to ≈1.36B |
| `c5` — a "2 billion downloads at risk" figure that appeared only in **search-result titles** this run did not fetch or read the body of | **contradicted** | This is the deliberate negative case. The run tested a number it saw circulating rather than inventing one, checked it against Elastic's own primary, itemized figures (≈1.36B), found it did not reconcile, and did **not** cite the unfetched secondary article as support for anything. This is the run's version of `N-06`'s and `N-02`'s cautionary shape, applied honestly rather than avoided |
| `c6` — whether npm v12's default would have applied to (or was bypassed in) CHAINDROP's actual victim environments | **unverified** | Checked directly: none of Elastic, StepSecurity, or Unit 42 address it. This is not a hedge — it is a specific, named gap in three independent primary incident reports, carried into the frame's `uncertainty` and into the draft itself rather than smoothed into a confident sentence either way |

4 of 6 claims verified, meeting the research profile's `min_verified_claims:
4` floor exactly — not padded above it.

## L0 — real result: REJECT

```
$ node scripts/check-quality-gates.mjs --bundle 03-frame-and-article/article-bundle.json --type research 04-draft-excerpt/excerpt.md
gates: REJECT — 04-draft-excerpt/excerpt.md (1 finding(s))
  ✗ [reject] citation-integrity — citation URL repeated 3 times, inflating the apparent evidence base
      https://www.elastic.co/security-labs/shai-hulud-chaindrop-npm-supply-chain
```

Full output: `05-l0-gates/l0-result.txt`. This is a real, mechanical REJECT,
not a passed run reported honestly as clean. The cause: claims `c3`, `c4`,
and `c5` all cite the same Elastic post as evidence — because Elastic is the
one primary incident responder that reported those specific numbers first-
hand, not because the citation was padded to look well-sourced. `verify-claims`'
own "weight primary above derivative commentary" instruction and this
mechanical gate's "duplicate citation inflates the evidence base" rule are in
real tension here, and this run did not resolve that tension by adding a
weaker secondary source just to diversify the URL list — that would have
been gaming the gate, not fixing the draft. **The correct read of this run
is: the citation-integrity gate correctly caught that a real draft leaned on
one source for three of six claims**, whether or not that reliance was
individually justified. `04-draft-excerpt/excerpt.md`'s own header records
this outcome; it is not a full article that could plausibly be
materialized, so `article.state` was left at `polished`, never advanced
toward `final`.

## L1 — real result: `ARGUMENT_REWORK → frame`

`06-l1-review/l1-review.json`, subject vs. `evals/fixtures/golden/G-01-synthesis.md`
(same reference run-01 used, `provenance_class: owner_created`, so
`anti_collapse.triggered: false`). Validated with `node` against
`scripts/lib/l1-core.mjs#validateL1RecordFile` — **0 issues**.

- `thesis-worth`: **tie** — both open with a falsifiable position before any citation.
- `synthesis-independence`: **worse** — G-01 derives a positive causal mechanism (seat-billing as a cost amplifier); this run's subject only names a gap (three reports' shared silence on a specific question), which is a real but weaker synthetic move.
- `language-native-prose`: **tie** — comparable domain-native English-term retention in both (G-01: gross margin, list price; subject: trusted publishing, preinstall).
- `formulaic-ai-shaped`: **tie** — one non-repeated contrast construction in each, below `voice.md` §3's repetition threshold.
- `audience-fit`: **abstain** — the reference carries no declared audience, same structural reason run-01 abstained on this dimension.
- `integrity`: **clear** — every citation marker resolves to a claim whose source was actually fetched and read; no phantom citation. This is explicitly a different question from the L0 REJECT above, and both are recorded rather than reconciled into one score, per `l1-review.json`'s own `notes`.

Outcome: `ARGUMENT_REWORK`, `routes_to: "frame"` — a real routable defect, not
a fabricated one for the sake of having something to route.

## Feedback + routing

`feedback/records/dogfood-2026-09-05-run-02-chaindrop-synthesis-gap.json`:
the L1 `synthesis-independence: worse` finding, routed to layer `frame`
(`editorial/feedback-routing.json`'s `owns`: "Thesis, argument path, or
article-worthiness"), `authority_class: 0`, `confidence: "medium"` (single
reference, single dimension, not repeated independent evidence — the same
honest caveat run-01's `anti_collapse.note` carried). `owner_verdict:
"unknown"`. `scope: "task_local"` — one observation, nowhere near the
repeated-evidence bar `evidence_links` would need for
`calibration_candidate`. `node scripts/registry.mjs --rebuild/--validate/--check`
and `node scripts/validate-routing.mjs` all pass with this record persisted.

## What did NOT run, and why

- **No full article was drafted.** `04-draft-excerpt/excerpt.md` covers 3 of
  the frame's 5 structure points and says so in its own header comment. This
  is deliberate: the task's SSOT constraint asks for evidence the text path
  runs, not a finished piece, and a full draft would not have changed what
  the L0/L1 steps could demonstrate.
- **No `full`/`brief`/`slides` distribution artifact was produced.**
  `article.state` never reached `final`, and `ARTICLE-ARTIFACT-CONTRACT.md`
  restricts distribution-stage artifacts to `final`/`published` states.
- **No human reviewed anything.** Every `owner_verdict` in this run is
  `unknown`. No feedback record's `basis` is `explicit_human_feedback`.
- **No calibration was touched.** `calibration_ref` is `null` everywhere in
  this run; `scope: task_local` on the one feedback record produced.
- **`evals/system/` was not touched**, for the same reason run-01 gave: no
  `owner_request`, `evidence_threshold`, `architecture_change`, or
  `v3_readiness_gate` trigger applies (`evals/system/README.md`). This run's
  own records are exactly the kind of evidence a future real system review
  would cite, not a reason to manufacture a snapshot now.
- **No commit was made by this Writer.** The Manager commits.

## A caveat this run is leaving for the Manager, same shape as run-01's

`scripts/certify-v2.mjs`'s area-1 narrative (`npm run certify:v2`, area 1)
still reads: *"No real owner-reviewed article has gone through intake →
intent → frame/write → L0/L1 → routed feedback in this repository... 3
records exist; two are synthetic seed examples and one is a real agent
dogfood record."* That sentence is now stale in a second, more specific way
than run-01 already flagged: `frame-article`, `write-article`, and
`verify-claims` **have** now actually run once, end to end, with real
sources and a real L0 REJECT and a real L1 `ARGUMENT_REWORK`, and
`feedback/records/` now holds a second real (non-seed) agent record from
this run. That still does not make area 1 `PASS` — no human has reviewed
any of it, and one run is one data point, not "operating evidence" in the
sense `certify-v2.mjs`'s own caveat language means. But the specific claim
"no real owner-reviewed article has gone through [the text path]" was never
this run's claim to begin with; the accurate update is "the text path has
now actually run once, for real, unreviewed." This Writer did not edit
`scripts/certify-v2.mjs`, for the same reason run-01's Writer gave: that
script's narrative deserves a deliberate edit, not an incidental one riding
on this run. Flagging it here for the Manager or the next reviewer.

## Certification areas with genuine non-fixture evidence after this run

- **Area 1 (text path)** gains its first real, non-fixture, non-human-reviewed
  execution: a real Article Frame, real `verify-claims` output (including a
  real contradiction and a real unverified gap), a real L0 REJECT, and a
  real L1 `ARGUMENT_REWORK`. It is still not `PASS` — see the caveat above.
- **Everything else certify-v2.mjs already listed as PARTIAL/DEFERRED**
  (visual rendering QA, audio TTS, P03→package live run, non-suengj.com
  surface end-to-end, calibration keep-or-change under real pressure,
  cross-agent portability's remaining routes) is **unchanged by this run**.
  This run is scoped to the text path only.

## What a human would still have to do

- Read `02-sources/source-manifest.json`'s six URLs directly and decide
  whether this run's reading of them is fair — an agent verified claims
  against agent-fetched content, which is not the same as independent human
  verification.
- Decide whether the L0 citation-integrity REJECT is a defect in the draft
  (spread the sourcing thinner) or a defect in the gate (it cannot currently
  distinguish "one deeply-relevant primary source cited three times for
  three distinct facts" from "one link padded for apparent volume") — this
  run deliberately did not resolve that tension by editing either the draft
  to game the gate or the gate itself.
- Decide whether `c6`'s unresolved question (did npm v12's script default
  apply to CHAINDROP's actual victims?) is worth pursuing further — e.g. by
  contacting Elastic, StepSecurity, or Unit 42 directly, which this run's
  tools cannot do.
- Everywhere an `owner_verdict` field appears in this run's records, a human
  still has to actually look and say `accepted` / `rejected` /
  `needs_rework` — every one of them is `unknown` right now, honestly.

## Files in this run

```text
01-intake/intent.json                  real Editorial Intent, status: ready, PASSes validate-intent.mjs
02-sources/source-manifest.json        6 real web sources, real sha256 hashes, PASSes validate-source-manifest.mjs
03-frame-and-article/article-bundle.json  Article Frame + verification.claims, state: polished, PASSes validate-article-contract.mjs + check-profile.mjs
04-draft-excerpt/excerpt.md            short, explicitly-labelled draft excerpt (3 of 5 structure points), not a publishable article
05-l0-gates/l0-result.txt              real check-quality-gates.mjs output: REJECT (citation-integrity)
06-l1-review/l1-review.json            real L1 comparative review vs G-01, outcome ARGUMENT_REWORK -> frame, 0 issues against l1-core.mjs
```

(`feedback/records/dogfood-2026-09-05-run-02-chaindrop-synthesis-gap.json`
lives in the canonical `feedback/records/` store, not under this directory,
per `skills/record-feedback/SKILL.md`'s own output location — same as
run-01's feedback record.)
