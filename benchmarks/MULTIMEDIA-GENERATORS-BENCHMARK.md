# Benchmark — multimedia generators, APIs, and artifact workflows (AES-P1.2 / SUE-439)

Observed 2026-09-01. The question is not "which vendor", it is **which worker
fits which artifact kind, behind a Skill contract that can replace it**.

Read with `../schemas/ARTICLE-ARTIFACT-CONTRACT.md`: every artifact records
`generator: {skill, tool}` and the article version it derives from. A
generator swap changes `tool` and nothing else. That is the property being
protected here.

Evidence media and distribution media are evaluated separately throughout,
because they have different requirements. An evidence visual must be
*deterministic and auditable*; a distribution artifact must be *attractive and
regenerable*. Those pull in opposite directions.

---

## 1. Product capability ≠ API capability — Gemini Notebook (formerly NotebookLM)

`ref:gemini-notebook-api-status` · verdict: **monitor**

The single most important finding, and the one most likely to be got wrong.

| Surface | Status as observed |
|---|---|
| Consumer product (Gemini Notebook, ex-NotebookLM) | Rich artifact generation in the UI — including audio overviews |
| Consumer **public API** | **None.** No self-serve API key for the consumer product |
| Gemini Notebook **Enterprise** | REST endpoints documented via Gemini Enterprise — create/retrieve/list/share/delete notebooks, manage sources, audio-overview operations; multi-region |

**What this means for us.** The impressive demo is a *product* capability. An
automated pipeline cannot call it on a consumer plan. Any plan that assumes
"NotebookLM generates our audio brief automatically" is assuming an enterprise
contract, not an API key.

Third-party services exist that offer NotebookLM-style podcast generation over
an API. They are not Google, they are not the product, and routing article
content through an unaffiliated intermediary is a provenance and rights
question before it is a technical one.

**Decision.** `audio` stays last in the priority order, exactly as the goal
already sequences it. No P4 work depends on this surface.

*Limit:* this was read from secondary coverage, not from Google's own
enterprise documentation. Before any commitment, verify against Google Cloud
documentation directly. Nothing downstream depends on it, which is why the
pass stops here.

---

## 2. Gemini API media generation — a real automation surface

`ref:gemini-api-media` · https://ai.google.dev/gemini-api/docs/pricing ·
verdict: **adapt**

Unlike Notebook, the Gemini API *is* a programmable surface for image, speech,
and video.

| Capability | Models observed | Indicative cost |
|---|---|---|
| Image | Gemini 3.1 Flash Image ("Nano Banana"), 3.1 Flash Lite Image, Gemini 3 Pro Image, Imagen 4 | ~$0.02–0.06/image (Imagen 4 tiers); ~$0.034–0.24 for Gemini image tiers by resolution |
| Speech | Gemini 3.1 Flash TTS, Pro TTS | ~$10 / 1M audio output tokens (Flash), ~$20 (Pro) |
| Video | Veo 3.1 (+ Fast), Gemini Omni Flash | ~$0.15–0.60 per second of video by tier and resolution |

**Fit by artifact kind.**

- **Not for evidence visuals.** A generative image model cannot be trusted to
  render a number correctly, and an evidence visual whose axis is
  hallucinated is worse than no visual. Evidence media goes to deterministic
  renderers (§3), without exception.
- **Plausible for infographic and illustration** — decorative or conceptual
  work carrying no load-bearing figures, still subject to the `visual` rights
  record.
- **Plausible for audio**, later, and cheap enough that cost is not the
  blocker. The blocker is editorial: an audio brief asserts facts and must
  carry `source_references` like any other distribution artifact.
- **Video is out of scope for V1.** Per-second pricing makes iteration
  expensive, and no editorial need currently justifies it.

*Limit:* the figures above come from third-party pricing summaries observed on
one date. They are order-of-magnitude inputs to a sequencing decision, not a
budget. Re-read the official pricing page before committing spend.

---

## 3. Deterministic renderers — where evidence media belongs

`ref:vega-lite` · `ref:mermaid-headless-renderers` · verdict: **adopt**

Evidence visuals need a property generative models cannot offer: **the same
input produces the same output, and the output is inspectable.**

| Need | Candidate | Why |
|---|---|---|
| Charts from data | **Vega-Lite** | Visualization *grammar* in JSON: the chart spec is a text artifact that can be diffed, reviewed, versioned, and hashed. Renders to SVG. Kroki renders Vega/Vega-Lite server-side to PNG/SVG/PDF |
| Diagrams, timelines | **Mermaid** | Text source, ubiquitous, renders inline on many surfaces. Headless renderers now exist outside the Node/Chromium path (e.g. a Rust implementation rendering to SVG/PNG/PDF without Puppeteer), and at least one project claims byte-identical geometry across architectures |
| Tables | Markdown | Already in the article; no generator needed |

**Why this matters for lineage.** A Vega-Lite spec or a Mermaid source *is*
the artifact; the rendered SVG is a build product. That means an evidence
visual can be regenerated byte-for-byte from the recorded spec plus the
recorded renderer version — which is precisely what `generator.tool.version`
in the artifact contract is for. A PNG returned by a generative model has no
such property: it cannot be regenerated, only re-rolled.

**Korean typography** is a real constraint and favours this path: with SVG
output we control the font stack directly (Pretendard, matching
`suengj-com`), rather than accepting whatever a hosted renderer embeds.

*Limit:* the byte-identical-geometry claim belongs to a third-party project
and has not been verified here. It is a reason to shortlist, not a guarantee
to design around. The P4 PoC (SUE-453) should test it and record the result.

---

## 4. Slides — Markdown in, deck out

`ref:markdown-deck-tools` · verdict: **adapt**

| Tool | Export | Notes |
|---|---|---|
| **Marp** | Built-in PDF and PPTX | Reportedly reliable PPTX export and widely used in Korean developer practice — relevant because Korean-font templates are a known pain point |
| **Slidev** | Playwright-driven export | More capable, heavier; the deck becomes an app |
| **reveal.js** | External tool (decktape) | Most flexible for web behaviour, most machinery for a static deck |

**Recommendation:** Marp for the 6–8 page social deck PoC (SUE-454). The
reason is not features; it is that the deck source stays Markdown. A deck
generated from the canonical article's Markdown, with a theme we own, keeps
the whole chain textual: article → deck source → rendered deck, each step
diffable and re-runnable, with the theme carrying the `suengj-com` role
matrix.

Slidev is the fallback if the deck genuinely needs interactivity. It is not
needed for a social deck.

---

## 5. Skill-driven planning vs. generation

No external reference; a design position from §1–§4 plus the P0 contracts.

The generators above all *render*. None of them decides **what a brief should
say, which three numbers belong on a chart, or which six claims make a deck**.
That decision is editorial, it depends on the verified claim set, and it is
what the `plan-artifacts` Skill (SUE-448) owns.

This gives a clean two-layer split, and it is what keeps generators
replaceable:

```
Skill (ours)        decides content, structure, and which claims are carried
   ↓ typed plan
Generator (theirs)  renders the plan; swappable; recorded as generator.tool
```

The typed plan is the artifact worth versioning. A chart spec, a deck outline,
a brief structure — each is a text artifact tied to `claims_hash`, so
staleness detection already works on it without any generator cooperation.

---

## Tool matrix — preferred candidate by artifact kind

| Artifact kind | Stage | Preferred | Fallback | Why |
|---|---|---|---|---|
| `evidence_visual` (chart) | evidence | **Vega-Lite spec → SVG** | Plotting library with pinned versions | Spec is text; deterministic; font control |
| `evidence_visual` (diagram/timeline) | evidence | **Mermaid source → SVG** | Hand-authored SVG | Text source; regenerable |
| `sources` | evidence | **Our own template** | — | Pure data from the manifest |
| `brief` | distribution | **Text generator behind `plan-artifacts`** | Any LLM API | Vendor-neutral by construction |
| `slides` | distribution | **Marp from Markdown** | Slidev | Deck source stays text; PPTX/PDF export built in |
| `infographic` | distribution | **Vega-Lite/SVG composition** | Generative image model | Load-bearing figures must not be generated |
| `audio` | distribution | **Gemini TTS** (later) | Any TTS API | Programmable; cheap; not a V1 need |
| `video` | distribution | **Deferred** | — | Per-second cost, no editorial need yet |

**No single provider is required anywhere in this matrix**, and no artifact
kind depends on a surface we cannot call programmatically.

## P4 PoC shortlist — concrete and bounded

| PoC | Issue | Bound |
|---|---|---|
| Brief generator behind `plan-artifacts`, with claim carry-through | SUE-452 | One article, one brief, claims traced |
| Vega-Lite chart + Mermaid diagram from a recorded spec | SUE-453 | Two visuals; verify regeneration reproduces the same SVG |
| Marp deck, 6–8 pages, from canonical Markdown | SUE-454 | One deck; theme carries the role matrix |
| Lineage and staleness across all of the above | SUE-455 | Edit prose → cosmetic; edit a number → material |

Not in the PoC: audio, video, Gemini Notebook Enterprise, any hosted
intermediary service.

## Method and limits

Four external references, read at capability level on one date. Two classes of
claim here are secondhand and marked as such in place: **API availability**
(§1) and **pricing** (§2) were read from third-party coverage rather than
vendor documentation. Both feed sequencing decisions that are already
conservative — audio late, video deferred — so the pass stops rather than
spending more on figures that will change.

Nothing was forked or mirrored; every entry is link-only. See
`../editorial/RIGHTS-AND-PROVENANCE.md`.
