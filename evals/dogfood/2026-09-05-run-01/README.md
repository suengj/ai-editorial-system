<!--
SUE-569 dogfood run — AGENT-PRODUCED, NOT OWNER EVIDENCE.

Everything under this directory was produced by an autonomous agent
(provider anthropic, model claude-sonnet-5, runtime claude-code) operating
the V2 machinery end to end, on 2026-09-05. No human reviewed any output
before, during, or after this run. Every owner_verdict in every record here
is `unknown`, and stays `unknown` until a human actually says otherwise —
silence is not acceptance (V2-EDITORIAL-LEARNING-CORE.md §11). Nothing here
is provenance_class anything but `generated_output`; nothing here is
promoted to reference authority; nothing here is published or approved.
This is dogfood evidence that the loop runs, not a claim that its output is
good.
-->

# Dogfood run — 2026-09-05-run-01 (SUE-569)

**What this is.** V2 was fully built and gate-verified, but the loop had
never actually executed once — every record anywhere else in this
repository (`schemas/examples/`, `feedback/records/`'s two seed entries,
`evals/real-output-corpus/`'s five entries) is a synthetic fixture written
to prove a schema shape. This run operates the system as an agent, for
real, and keeps the real records that fell out. It does not simulate a
human, does not fabricate a human verdict, and does not claim more than it
did.

**Who produced it.** One agent (provider `anthropic`, model
`claude-sonnet-5`, runtime `claude-code`), no human in the loop at any step.
Every `evaluator`/`reviewer` field in every record below says so explicitly.

## What actually ran

| Step | Ran | Real machinery exercised |
|---|---|---|
| 1. Intake | Yes | `node scripts/validate-intent.mjs` against `01-intake/intent.json` — real result: **PASS**, 1 note (`text/article` is a declared-planned artifact id, not yet built — an existing, known gap, not something this run caused) |
| 2. Visual — compile | Yes | `node scripts/compile-visual-prompt.mjs --compile 02-visual/visual-job.json` — real `compiled_prompt` + `compiled_from` lineage, deterministically assembled from the job's own declared inputs |
| 2. Visual — gates | Yes | Both pre-render gates run for real inside the job record: `information_gain` (verdict `proceed`), `density_check` (`match: true` against `visual/evidence-visual`'s own profile) |
| 2. Visual — render | Yes | `renderChart()` from `scripts/lib/chart-renderer.mjs` (the same deterministic renderer the V1 PoC already uses, reused rather than rebuilt) — real SVG written to `02-visual/rendered.svg` |
| 2. Visual — QA | Yes | The rendered SVG was actually read and inspected (not assumed correct). Two real, independently-confirmed defects recorded — see below. |
| 2. Visual — cross-field validation | Yes | `validateVisualJobFile()` from `scripts/lib/visual-job-core.mjs` against `02-visual/visual-job.json` — real result: **0 issues** (structurally sound job; the defects found are QA-level, not schema-level) |
| 3. L1 comparative review | Yes | Manually executed against `skills/review-l1/SKILL.md`'s procedure, comparing two real prose texts already in this repository — `evals/fixtures/golden/G-04-research-native-korean.md` (subject) vs `evals/fixtures/golden/G-01-synthesis.md` (reference) — with real quoted evidence spans. `node` check against `scripts/lib/l1-core.mjs#validateL1RecordFile` — real result: **0 issues** |
| 4. Feedback | Yes | One real observation from step 3 (an uncited specific figure in G-04, found during the L1 review) was classified and persisted as `feedback/records/dogfood-2026-09-05-g04-uncited-figure.json`. `node scripts/registry.mjs --rebuild && --validate && --check` all pass; `npm run validate` (which includes `validate:routing`) picks the new record up and passes it against the real routing table. |
| 5. System evidence | Considered, not written — see below | — |

## What did NOT run, and why

- **No article was actually drafted or verified.** Intake resolved to
  `status: ready`, but `frame-article` / `write-article` / `verify-claims`
  were never invoked. There is no real article body anywhere in this run —
  only the intent that would drive one. The one named source
  (`evals/fixtures/golden/G-01-synthesis.md`) is itself a synthetic V1
  golden fixture, so even a drafted article from this intent would still
  need real, independently verifiable sourcing before it could be
  publishable — this run does not claim otherwise.
- **The two chart values (c1/c2, `02-visual/claims.json`) were never run
  through `verify-claims`.** They are illustrative index numbers invented
  for this run so the deterministic renderer would have real numbers to
  plot, and the chart's own `source_note` says so on the rendered asset
  itself (`rendered.svg`, visible in the image, not just in this README).
  This is the run's most important honest limitation, not a detail to
  bury — see "Real defects found" below.
- **No human reviewed anything.** Every `owner_verdict` in this run is
  `unknown`. No feedback record's `basis` is `explicit_human_feedback`.
- **No calibration was touched.** `calibration_ref` is `null` everywhere in
  this run; the one feedback record produced stays `scope: task_local` —
  there is exactly one independent observation here, nowhere near the
  repeated-evidence bar `evidence_links` would need to justify
  `calibration_candidate`.
- **No commit was made by this Writer.** The Manager commits.

## Rendered asset

`02-visual/rendered.svg` — **2,737 bytes** (well under the 512 KB image
ceiling `validate:boundary` enforces). `viewBox="0 0 720 360"`, two line
series (`발표 단가 지수`, `보고 마진 지수`), no embedded fonts or binary
data — pure SVG markup, matching the same deterministic-renderer pattern
already used by `evals/poc/cost-stack.svg`.

## Real defects found (from actually inspecting the rendered asset)

Both were found by reading the rendered SVG and the artifact profile's own
acceptance criteria, not invented to have something to report.

1. **Renderer defect (cosmetic, reproducible), found and fixed.**
   `scripts/lib/chart-renderer.mjs` line 105 unconditionally emitted
   `(${spec.y.unit})` in the chart's note line even when `y.unit` was an
   empty string — wrong here, since the plotted series are unitless
   indices. The rendered SVG's note line literally read
   `...기준 대비 변화율 (2025 Q1=100) ()` — a trailing empty parenthesis
   pair. This was deterministic (every job with an empty `y.unit` would
   reproduce it identically), so it did not cleanly fit
   `editorial/feedback-routing.json`'s `visual/renderer` layer definition,
   which is specifically scoped to non-reproducible, one-off render
   artifacts ("a re-render of the same spec would not reproduce"). It is
   recorded here, in `02-visual/visual-job.json#qa.notes`, as an honest
   engineering observation rather than forced into a feedback-routing
   record it does not fit. This same commit patched the renderer at the
   source (the smallest correct place) and regenerated the affected
   committed artifact, `evals/poc/cost-stack.svg`, which had carried the
   same defect since it was certified.
2. **Data-provenance gap (the real QA fail).** The artifact profile
   `visual/evidence-visual`'s own `acceptance` list requires "every value is
   traceable to verified claims or source data." This job's two claims were
   never verified (see "What did NOT run" above), so this acceptance
   criterion is genuinely **not met**. `02-visual/visual-job.json` is
   therefore marked `status: qa_fail`, not `accepted` — this run does not
   paper over the gap by marking the job accepted because the render itself
   looked fine.

## Real defect found via L1 review (fed into step 4)

`03-l1-review/l1-review.json`'s `integrity` finding: the subject text
(G-04) states "한 보존 프로그램은 2001년 이후 약 20년에 걸쳐 550만 권가량을
처리했고" with no footnote, named institution, or source note anywhere in
the fixture to support the "약 20년" / "550만 권" figures — `integrity.status:
"concern"`, with the quoted span as evidence. This became the observation
`feedback/records/dogfood-2026-09-05-g04-uncited-figure.json` classifies
and routes to the `verification` layer (class 1: one durable feedback
record appended, nothing higher).

## Step 5 — system evidence: deliberately not touched, and why

`evals/system/current.json` is explicitly a **derived** file
(`node scripts/system-scorecard.mjs --rebuild` regenerates it from the
newest file under `evals/system/snapshots/`, never hand-edited
independently — see `evals/system/README.md`). A new snapshot is
authored **only** on one of four declared triggers: `owner_request`,
`evidence_threshold`, `architecture_change`, `v3_readiness_gate`
(`evals/system/README.md`, "Evidence accumulates automatically; the
scorecard does not run automatically"). None of those four apply to this
run — it is exactly the "normal generation/feedback" case the same section
says should let evidence "accumulate as a side effect" **without** a new
scorecard review. Manufacturing a trigger to justify touching
`evals/system/` would itself be the vanity-health failure §11 warns
against, so this run leaves `evals/system/` untouched.

What *is* true, and durable, without needing a new snapshot: the real
records this run produced (`01-intake/intent.json`,
`02-visual/visual-job.json`, `03-l1-review/l1-review.json`,
`feedback/records/dogfood-2026-09-05-g04-uncited-figure.json`) are now
themselves sitting in the repository as exactly the kind of evidence a
future real system review (SUE-570 pilot or later) would cite under
`quality_lift`, `operator_friction`, and `routing_effectiveness`'s
`evidence_sources`. One run is not enough to move any of the ten
dimensions off `INSUFFICIENT_EVIDENCE` — `evals/system/current.json`'s own
`insufficient_evidence_when` text for those dimensions is unchanged by this
run and remains the honest read. **No file under `evals/system/` was
modified by this run.**

One honest note on this run's own footprint: `scripts/certify-v2.mjs`'s
area 1 narrative said `feedback/records/` held records that were "both
synthetic seed examples" — that sentence predated this run and was stale the
moment this run's real, non-synthetic, agent-authored observation landed in
`feedback/records/`. This Writer *did* edit `scripts/certify-v2.mjs` in this
same commit to update that prose accordingly, alongside the renderer fix and
the regenerated `evals/poc/cost-stack.svg`. (That prose has since been
revised again by later work, to stay current as more records were added —
see `docs/architecture/V2-CERTIFICATION.md` and `scripts/certify-v2.mjs`
directly for the current count.)

## Files in this run

```text
01-intake/intent.json           real Editorial Intent, status: ready, PASSes validate-intent.mjs
02-visual/claims.json           the two illustrative (unverified) data claims plotted
02-visual/chart-spec.json       the chart-renderer.mjs input spec
02-visual/rendered.svg          the actual rendered asset (2,737 bytes)
02-visual/visual-job.json       compiled visual job, status: qa_fail, real compiled_prompt/compiled_from
03-l1-review/l1-review.json     real L1 comparative review, G-04 vs G-01, outcome FACT_REWORK -> verification
```

(`feedback/records/dogfood-2026-09-05-g04-uncited-figure.json` lives in the
canonical `feedback/records/` store, not under this directory, per
`skills/record-feedback/SKILL.md`'s own output location.)

## What a human would still have to do

- Actually read `01-intake/intent.json`'s source (G-01) and decide whether
  this request is even worth drafting — nothing here implies it is.
- Run `verify-claims` against real source material before any chart like
  `02-visual/rendered.svg` could carry real numbers instead of the
  explicitly-labelled illustrative ones.
- Nothing further on the renderer's empty-unit defect (finding 1 above): it
  was already patched at the source in this same commit, and the affected
  committed artifact was regenerated. No outstanding human decision here.
- Read `feedback/records/dogfood-2026-09-05-g04-uncited-figure.json` and
  decide whether G-04, as an existing V1 golden fixture, should itself be
  patched with a citation or a disclaimer — this run has no authority to
  edit V1 fixtures and did not.
- Everywhere an `owner_verdict` field appears in this run's records, a
  human still has to actually look and say `accepted` / `rejected` /
  `needs_rework` — every one of them is `unknown` right now, honestly.
