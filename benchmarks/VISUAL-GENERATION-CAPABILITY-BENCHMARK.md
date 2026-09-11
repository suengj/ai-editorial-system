# Visual generation capability benchmark (AES-V2.17 / SUE-668)

**Source snapshot retrieved:** 2026-09-08 (Asia/Seoul)
**Status:** provider-neutral benchmark and evidence ledger; no renderer was
invoked for this snapshot.

This document separates three kinds of statement:

- **(A) Provider-observed documented behavior:** what a current first-party
  source says. This is not a pixel result from this repository.
- **(B) Reusable production principle:** a provider-neutral rule that remains
  meaningful after replacing the renderer. These are design conclusions, not
  provider promises.
- **(C) Provider-specific/non-transferable detail:** a model name, endpoint,
  parameter, limit, or workflow syntax. It belongs in a disposable adapter or
  source ledger, never in VisualBrief, RenderSpec, or another durable
  provider-neutral contract.

The benchmark does not rank providers, infer quality from a feature list, or
make a renderer the publication authority. A documented capability is an
admission hypothesis until the frozen fixture produces bytes and those bytes
pass the existing digest-bound full/mobile review. A proposed test case is
labelled **proposed** below; it is not an observed capability.

## Current primary-source ledger

Re-open these pages at the start of every benchmark run. Model IDs, limits,
availability, safety behavior, and documentation can change.

The catalog entries own the exact canonical source URLs and retrieval metadata;
the benchmark cites their stable `ref:` pointers and append-only `eval:` records
so a raw URL cannot bypass source ownership or rights validation.
These six provider-documentation records are marked
`reference_role: documentation_evidence` in the catalog: they remain benchmark
evidence and are categorically ineligible for visual craft resolver,
RenderSpec-reference, or compiled-prompt selection.

| Owned source/evaluation and retrieval date | What the source actually documents (A) | Non-transferable details (C) |
| --- | --- | --- |
| `ref:openai-image-generation` · `eval:openai-image-generation-2026-09-08-01` — retrieved 2026-09-08 | The Image API and Responses API expose image generation; the guide documents output controls, image references, and explicit limitations: precise text placement/clarity and layout-sensitive composition can still fail. It also documents moderation and user-correctable generation errors. | GPT Image model selection, `gpt-image-2`, `size`, `quality`, `format`, `compression`, moderation values, request/response fields, and endpoint syntax. |
| `ref:openai-gpt-image-2` · `eval:openai-gpt-image-2-2026-09-08-01` — retrieved 2026-09-08 | The current model page describes image input/output, image generation and editing endpoints, flexible image sizes, and high-fidelity image inputs. | The model ID, snapshot ID, endpoint names, rate-limit table, and model lifecycle are adapter metadata. |
| `ref:google-gemini-image-generation` · `eval:google-gemini-image-generation-2026-09-08-01` — retrieved 2026-09-08 | The guide documents Gemini 3 image generation/editing, 1K/2K/4K output, advanced text rendering, optional Search grounding, thinking, reference images, aspect-ratio response configuration, and prompting examples. It also describes model-specific reference-image counts and roles. | “Nano Banana Pro”, Gemini model IDs, Interactions API fields, response-format syntax, thinking settings, Search grounding, and per-model reference limits. |
| `ref:google-nano-banana-pro` · `eval:google-nano-banana-pro-2026-09-08-01` — retrieved 2026-09-08 (page says updated 2026-09-03) | The page names Gemini 3 Pro Image as a supported image-generation model and describes it for complex graphic design, product mockups, and factual data visualizations; it also lists image/text inputs and outputs and Search grounding support. | The “Nano Banana Pro” label, model code, token limits, and capability matrix are source-specific. They do not establish factual correctness or hierarchy fidelity for this benchmark. |
| `ref:adobe-firefly-image5` · `eval:adobe-firefly-image5-2026-09-08-01` — retrieved 2026-09-08 | The guide documents text-to-image when references are empty, image-to-image instruct editing when references are supplied, aspect-ratio input, and a quality/speed prompt-reasoning option. | `referenceBlobs`, `modelId`, `aspectRatio`, `modelSpecificPayload`, async endpoint paths, and `altText` response behavior. |
| `ref:adobe-firefly-reference-roles` · `eval:adobe-firefly-reference-roles-2026-09-08-01` — retrieved 2026-09-08 | The guide documents style references as a way to guide look and feel, a separate structure-reference concept, and a tunable reference strength. | Firefly upload IDs, `style.imageReference`, strength ranges, and service authentication/request syntax. |

The previously listed AWS Bedrock image-models URL is intentionally removed from
this benchmark. It was not a stable current source for this snapshot, so this
document makes no current AWS capability claim. A stale link is weaker evidence
than an explicit omission.

**Nano Banana Pro primary observation.** The Google Gemini 3 Pro Image model
page is the first-party source for the Nano Banana Pro label in this snapshot.
It documents complex graphic design, high-fidelity product mockups, factual data
visualizations, image/text input and output, and Search grounding. This is an
(A) documented provider observation, not a local pixel benchmark and not proof
that any generated hierarchy, label, or fact is correct. The proposed protocol
below is the separate test lane for turning that documented capability into an
observed result.

## Evidence findings: A / B / C

### Integrated scene and type hierarchy

**(A) Documented behavior.** The Google guide describes professional asset
production, complex instructions, thinking, and prompt templates for scenes;
the OpenAI guide separately warns that structured or layout-sensitive placement
can still be difficult. Neither source defines this repository's artifact types
or proves that a generated scene preserves a declared primary/supporting/detail
hierarchy.

**(B) Reusable production principle.** Freeze artifact type, primary thesis,
reading path, and integrated information hierarchy in VisualBrief/RenderSpec
before a renderer is called. Review the rendered full and mobile pixels against
that frozen authority. A renderer's “complex instructions” or “professional”
description is an input hypothesis, not hierarchy evidence.

**(C) Non-transferable detail.** A model's reasoning mode, prompt-template
grammar, or named “professional” tier cannot enter the durable hierarchy or
become a renderer-independent acceptance criterion.

### Short text and factual text

**(A) Documented behavior.** Google documents advanced text rendering for
infographics, menus, diagrams, and marketing assets. OpenAI's current guide
explicitly says that, although improved, precise text placement and clarity can
still fail. Adobe's examples document generated image workflows and returned
descriptions, not a guarantee that exact in-image text or factual values are
correct. These are documentation observations, not this benchmark's pixel
results.

**(B) Reusable production principle.** Exact titles, citations, dense/sensitive
copy, numbers, axes, and other factual invariants stay on the deterministic
external-text route. A declared verified-generative-fact route must carry a
canonical payload, source lineage, authoritative claim identity, and mandatory
asset-digest-bound factual post-render check. Grounding, a text-rendering claim,
or a clean byte receipt never makes a fact authoritative.

**(C) Non-transferable detail.** A provider's text-rendering mode, grounding
switch, prompt wording, or image-edit field is adapter syntax. It cannot replace
the source-bound payload or the review contract.

### Reference role and authority

**(A) Documented behavior.** The OpenAI guide accepts one or more image
references. Google's guide documents multiple reference images with model-
specific object, character, and style roles. Adobe documents style and structure
references and a style-strength control. These sources document conditioning
mechanisms, not editorial authority or permission to copy a source's skin.

**(B) Reusable production principle.** Select references through the existing
evaluation registry. Record which craft dimensions are authoritative and which
are explicitly not authoritative. A reference is craft evidence, never an
article fact source; literal copying, unselected traits, and arbitrary injected
references fail before rendering.

**(C) Non-transferable detail.** Reference counts, role labels, strength values,
upload IDs, and image-input encoding are provider adapter concerns. The durable
contract names only the resolved reference authority and its traits.

### Localized `KEEP` / `CHANGE` / `DO_NOT_CHANGE` routing

**(A) Documented behavior.** The cited primary pages document image generation,
editing, references, and error/moderation responses. They do not define this
repository's localized repair routing or claim that an API patch preserves a
semantic region.

**(B) Reusable production principle.** The existing visual review owns localized
routing: a passing, observed check maps to `KEEP`; an observed defect maps to
`CHANGE`; an abstention or unavailable observation maps to `DO_NOT_CHANGE` and a
non-pass route. Every decision is bound to the exact full or mobile digest and
never becomes machine approval. A provider edit/mask operation is eligible only
as a disposable repair implementation after the review route names the intended
change.

**(C) Non-transferable detail.** Inpainting, masks, style strength, edit prompts,
job IDs, and asynchronous status URLs do not establish semantic locality or
preservation. They belong in the adapter receipt and cannot be durable repair
authority.

### Aspect ratio and publication-display surfaces

**(A) Documented behavior.** Google documents aspect-ratio response configuration
and multiple output resolutions. OpenAI documents flexible `size` values and
explicit pixel/ratio constraints. Adobe documents an `aspectRatio` request
field. These demonstrate request controls, not that the returned pixels match a
publication's operative CSS geometry or survive a mobile derivative.

**(B) Reusable production principle.** RenderSpec declares publication-display
surfaces, including the desktop 672 CSS-pixel article body, mobile derivative
relationship, viewport geometry, and semantic crop anchors. The adapter maps
those declarations to a disposable request. Post-render review measures the
actual full/mobile displays and binds both observations to their asset digests;
it does not trust a prompt or a provider response field.

**(C) Non-transferable detail.** Aspect-ratio strings, size tokens, resolution
names, output formats, and request fields vary by renderer and must not appear
in VisualBrief, RenderSpec, or review authority.

### Factual reliability and safety limits

**(A) Documented behavior.** Google documents Search grounding as a way for its
image models to use current information, while OpenAI documents moderation,
blocked-request errors, and the remaining limits on text, consistency, and
layout-sensitive composition. No cited source guarantees that generated pixels
contain correct article facts, exact labels, or complete chronology. Adobe's
reference/edit documentation likewise does not make a factual-verification
claim.

**(B) Reusable production principle.** Treat grounding and model knowledge as a
candidate-generation aid only. Factual truth comes from the article claims
authority and deterministic external text, or from the declared verified-fact
route plus mandatory post-render factual inspection. Unknown, blocked, stale, or
unobserved checks remain `UNVERIFIED`/non-pass at the existing boundary. When no
raster exists, the truthful boundary is `RENDER_REQUIRED`; neither state becomes
`PASS_TO_HUMAN_REVIEW` by implication.

**(C) Non-transferable detail.** Search-grounding availability, moderation
settings, safety error codes, and model-specific consistency claims are not
portable guarantees and do not alter the durable contract.

## Internal negative evidence (not provider capability)

These are repository observations from the existing owner/consumer path, not
claims about any external renderer:

- `npm run test:visual-review` rejects all-abstain post-render evidence,
  mobile checks bound to the full asset, wrong/missing 672 CSS-pixel geometry,
  and a mobile crop whose declared anchor is not observed.
- The same natural `npm run validate:visual-review` path rejects a stale bound
  job digest, an arbitrary mobile anchor, and observed geometry that disagrees
  with the authoritative RenderSpec publication surface.
- The current SUE-671 D2 fixture records `RENDER_REQUIRED` when no approved
  renderer has produced pixels; it does not synthesize a renderer result:
  [`evals/visual-review/SUE-671-D2-RENDER-REQUIRED.md`](../evals/visual-review/SUE-671-D2-RENDER-REQUIRED.md)
  and [`sue671-d2-render-required.json`](../evals/visual-review/sue671-d2-render-required.json).

No external capability is inferred from these controls. They are negative
evidence for unsafe acceptance paths.

## Proposed benchmark protocol (proposed, not observed capability)

1. Freeze one validator-clean VisualBrief/RenderSpec/job fixture, including
   ownership classes, article claim authority, selected reference traits,
   publication-display surfaces, crop anchors, and full/mobile target bytes.
2. Compile one provider-neutral semantic prompt and one disposable adapter
   request per renderer. Record request bytes, adapter/runtime lineage, refusal
   or safety responses, returned bytes, dimensions, and full/mobile digests.
3. Run every renderer against the same adversarial cases:
   - external title injection;
   - exact factual label/number;
   - declared generated structural label;
   - hierarchy/reference-authority mismatch;
   - dense text that remains byte-valid but fails readability;
   - mobile derivative that drops the primary reading path;
   - changed full/mobile bytes after review;
   - no renderer available, which must stop at `RENDER_REQUIRED`.
4. Use one mutation at a time and positive controls. A feature/API probe is
   not a pixel pass. A provider quality label is not an editorial verdict.
5. Require the existing review consumer to observe full/mobile text, factual,
   readability, and crop checks. Only all observed passes may produce
   `PASS_TO_HUMAN_REVIEW`; that verdict remains a human handoff, never approval.

## Concrete contract deltas retained by the current implementation

These deltas are provider-neutral and are already represented by the current
V2.17 implementation; this benchmark does not add provider syntax or provider
names to those contracts:

- Keep the exact three ownership classes:
  `generative_structural_text`, `verified_generative_fact`, and
  `deterministic_external_text`; keep the article title external.
- Keep integrated `information_hierarchy` aligned between VisualBrief and
  RenderSpec, with selected reference authority for hierarchy.
- Keep source-bound verified facts: canonical payload, authoritative claim set,
  lineage, and mandatory factual post-render verification.
- Keep RenderSpec `crop_anchors` and authoritative desktop/mobile
  `publication_display_surfaces`; bind review geometry and crop anchors to the
  resolved job/RenderSpec identity and digest.
- Keep asset-digest-bound review checks and localized repair routing. A clean
  result is `PASS_TO_HUMAN_REVIEW`; no renderer remains `RENDER_REQUIRED`.

The renderer adapter may carry provider-specific request fields and runtime
identity in an ephemeral receipt. It must not rewrite these semantic or review
authorities.

## Recheck and decision boundary

At each benchmark run, record the retrieval date and exact canonical URLs above,
then record what the source still documents before interpreting any output.
Only captured pixels, their digests, the actual full/mobile display inspection,
and the existing review validator can establish a capability observation for this
system. Until a human reviews the result, the strongest successful state remains
`PASS_TO_HUMAN_REVIEW`; with no approved renderer, the truthful D2 state remains
`RENDER_REQUIRED`.
