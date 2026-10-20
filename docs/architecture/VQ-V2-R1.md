# Visual Quality V2 — Round 1 design and evidence plan

Date: 2026-10-20
Scope: SUE-1691 baseline, SUE-1700 one-card HTML/CSS + Playwright PoC, and cost-free SUE-1701 capability review only.

## Objective and decision boundary

Measure whether semantic HTML/CSS layout improves the rendered visual quality and editing behavior of one representative Signalytics/M1 card against the current AES compositor. Keep the existing compositor and native-card paths available. A single positive result does not authorize a default change, batch adoption, Studio integration, publishing, or aesthetic acceptance. Expand to a second and third card type only after a clear, pixel-reviewed improvement on the first.

## Reuse map

| Existing source | Reuse in this round | Explicitly out of scope |
| --- | --- | --- |
| `editorial/entry-manifest.json`, `editorial/STRUCTURED-VISUAL-EXECUTION.md` | Resolve Signalytics visual scope, current compositor contract, and 1080×1350 output requirements. | Replacing editorial routing or inventing a new brand profile. |
| SUE-643 reference registry and authority contract | Select at most 1–3 actually accessible references with provenance and bounded authority; if no relevant approved card reference exists, record `NO_APPROVED_REFERENCE`. | A parallel reference database, copying another brand's text, people, logos, imagery, or literal template. |
| SUE-1614 typography implementation (`scripts/lib/typography-core.mjs`, bundled AES Sans KR, font inventory/preferences) | Use the already resolved, locally available font files and record exact font hashes and actual browser font readiness. | Reimplementing typography contracts or changing global font defaults. |
| SUE-1616 hybrid compositor/native-card path (`scripts/lib/carousel-core.mjs`, `scripts/lib/hybrid-card-core.mjs`, native-card review contract) | Retain current renderer as A and preserve deterministic text/facts and native-card review boundary. | Rebuilding native-card or compositor behavior. |
| SUE-646/647/648 review and failure taxonomy | Separate technical facts from visual assessment and classify failures using existing categories. | Treating machine QA as aesthetic approval or fabricating an owner verdict. |
| Shorts Gen current asset/render/QA route | Read current image-provider adapter and existing video artifacts as baseline only. | Modifying the video engine, consuming paid APIs, or creating a second video generator. |
| Editorial Studio provider catalog/handoff | Verify whether image-provider selection actually invokes a provider. | Adding an adapter or claiming provider execution from a selection intent. |

## Phase 0 — frozen baseline

Record actual bytes and hashes for the owner-rejected M1 set, one existing blog/information visual, and one existing video plus representative frames. Missing assets or receipts stay `NOT_AVAILABLE`. Do not rerender, regenerate, edit, or infer approvals during baseline collection. Classify observed issues as `ART_DIRECTION`, `MODEL`, `COMPOSITOR`, `TYPOGRAPHY`, `SOURCE`, `MOTION`, `REVIEW`, or `UNKNOWN`; distinguish owner-reported findings from direct pixel observations.

## Phase 1 — one-card A/B

- Fix one M1 card's original photo bytes, exact title/body/source/page copy, canvas, account profile, reference authority, and font files.
- A: current AES compositor rendered from its current code path. B: local HTML/CSS rendered by Playwright, using content-driven Flexbox/Grid and normal document flow; do not translate the old normalized coordinates into CSS absolute positions.
- Render both at 1080×1350 and make 390px-wide mobile derivatives. Open and inspect all PNGs directly, then produce a same-scale side-by-side comparison.
- Record source/output/font hashes, browser/Playwright/OS/runtime versions, elapsed render time, CPU/RAM observations, exact text checks, image crop/focal treatment, and technical versus aesthetic findings.
- Expand only if the first actual PNG comparison shows a clear quality improvement. Otherwise stop at one card and report `NO_PROMOTION`.

## Phase 2 — cost-free portion only

Consult current official OpenAI and Google image API documentation and current adapters/capability manifests. Compare candidate model identity, generation/edit/reference/mask support, quality/resolution options, and published prices with source URL and checked date. Keep Studio's declared-but-not-invoked choices distinct from Shorts Gen's executable adapter. If approved existing generated assets can be held byte-identical, document feasible 2×2 cells without generating assets. Any paid call remains `HUMAN_REQUIRED` unless an existing approval, budget, key authority, and applicable unit price are verifiably present in code or Linear.

## Rollback and adoption

The PoC is isolated and opt-in. `KEEP` means preserve the experiment without promoting it; `ADOPT` requires a separate owner decision and future opt-in adapter work; `REVISE` means one scoped correction and rerender; `REJECT` means stop. No global recipe/default, operational routing, Studio deployment, batch job, Drive policy, or publication changes are part of this round.

## Round 1 execution result (2026-10-20)

- Phase 0 baseline is recorded in `reports/visual-quality-v2-round1-phase0.md`; original renderer and source bytes were frozen.
- Phase 1 retained the current compositor as A, replayed from archived M1 plans with local path/font compatibility mapping, and added an isolated HTML/CSS + Playwright B experiment for M1 cover, money-flow, and JustPark evidence card. Copy, palette, source photo/data, layer order, and A layout were kept fixed; final captures and receipts are archived under `/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase1/`.
- Pixel review favored B for the cover and evidence-card layout; the money-flow card remained mixed. This justified testing three types but did not justify production adoption. The report records exact inputs, hashes, checks, costs, and open owner-review boundary.
- Phase 2 was limited to official documentation and code/capability inspection. No provider call or asset generation occurred. Current findings and cost references are in the Phase 1 report.
- Decision remains `KEEP` the opt-in PoC; `OWNER_AESTHETIC_REVIEW_PENDING`. SUE-1701 API generation remains `HUMAN_REQUIRED` until existing authorization and budget are verifiable.
