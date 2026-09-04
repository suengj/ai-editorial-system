# Visual job contract (AES-V2.7 / SUE-565)

A **visual job** is the compiled, machine-checkable record of one visual
artifact request. It exists so that a bad result is routable to the layer
that produced it — artifact profile, semantic spec, reference selection,
brand profile, or renderer — instead of triggering a reroll or a prompt
patch that nobody can trace back to a rule.

Machine schema: [`visual-job.schema.json`](visual-job.schema.json).
Compiler: `scripts/compile-visual-prompt.mjs`. Fixtures:
`scripts/test-visual-job.mjs`, `schemas/examples/visual-job-*.example.json`.

## The prompt is a compiled output, not the source of truth

The durable knowledge is the state the job cites: the semantic spec, the
artifact profile (`editorial/profiles/artifact/visual-*.json`), the selected
reference traits, and the versioned brand profile
(`editorial/profiles/brand/suengj-com.v1.json`). `compiled_prompt` is a
deterministic string assembly over that state, recorded with `compiled_from`
so it can be regenerated or audited — never hand-edited independently of the
state that produced it.

```text
semantic_spec + artifact_profile + selected_reference_traits + brand_profile
        ↓ scripts/compile-visual-prompt.mjs --compile
compiled_prompt (+ compiled_from lineage)
```

## Two gates run BEFORE rendering (cost ordering, §8)

Rendering is the expensive step. Both gates are cheap semantic preflight and
both re-run post-render against the actual output.

1. **`information_gain`** — the marginal-information-gain gate
   (`editorial/VISUAL-INFORMATION-GAIN.md` §2, §4). Records the adjacent
   article content the visual was tested against, the four redundancy-test
   answers, the `integration_strategy` (`add | replace | extend | reposition
   | skip`), and a `verdict`. `verdict: skip` is a correct, first-class
   outcome — not a failed job. A job with `verdict: skip` never compiles a
   prompt: `compiled_prompt` must be absent.
2. **`density_check`** — mechanical enforcement of
   `editorial/SUENGJ-ARTICLE-IMAGE-FAMILIES.md` and
   `editorial/SUENGJ-INFOGRAPHIC-CALIBRATION.md` §2. The job's
   `compiled_semantic_density` / `compiled_visual_density` must equal the
   artifact profile's `semantic_density.level` / `visual_density.level`. A
   body infographic compiled at thumbnail density has `match: false` and
   FAILS, regardless of how the render looks.

## Context isolation is required, not optional

Known production failure (Linear SUE-531): built-in generative image attempts
repeatedly leaked unrelated recent project/conversation context into
dashboard artwork. `context_isolation` is an explicit allowlist:

- `permitted_inputs` enumerates what may reach the compiled prompt —
  `semantic_spec`, `artifact_profile`, `audience`, `selected_reference_traits`,
  `brand_profile`. Nothing else.
- `excluded` asserts that `ambient_conversation`, `unrelated_project_state`,
  and `prior_unrelated_jobs` were kept out.

`scripts/compile-visual-prompt.mjs --validate` FAILS a compiled prompt that
contains a token not derivable from `compiled_from`'s declared inputs. This is
the mechanical form of the SUE-531 fix: a leak is a schema violation, not a
matter of prompt-engineering taste.

## Model/provider drift is a `renderer`-layer event, not a brand or spec event

Image quality can regress while `semantic_spec`, `artifact_profile`, `audience`,
`selected_reference_traits`, and `brand_profile` are all unchanged, because the
model underneath moved. `renderer` therefore carries full runtime lineage, not
just a tool name:

```text
renderer.tool            — the rendering pipeline (e.g. a deterministic SVG compiler)
renderer.tool_version
renderer.provider        — e.g. anthropic, in-house
renderer.model
renderer.model_version   — exact version or dated alias, so a silent model swap is diagnosable
renderer.quality_tier    — reasoning/quality tier, where the provider exposes one
```

This is the same `renderer` id already named in the V2 visual routing-layer
vocabulary (`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §5:
`artifact_route · semantic_spec · information_density · composition ·
brand_profile · renderer`). A defect attributable to a model/version change
routes to `renderer`, never to `brand_profile` or `semantic_spec` — that
routing only works if the runtime identity was recorded in the first place.

**Runtime identity is lineage, not an input.** It must never reach
`compiled_prompt`: `context_isolation.excluded` must include
`renderer_runtime_identity` on every job, and
`scripts/compile-visual-prompt.mjs --validate` fails a compiled prompt that
contains the renderer's `provider`/`model` string verbatim. A model name in a
prompt is contamination; the same name in `renderer` is evidence.

## Priority order for conflicting visual instructions

From `editorial/profiles/brand/suengj-com.v1.json`:

```text
semantic/evidence requirement
  > artifact-function requirement
  > explicit task/reference override
  > publication brand default
  > renderer/model default
```

A reference's colour or style may not silently override the brand profile.
It may only outrank the brand default when the job lists it under
`selected_reference_traits.authoritative_override` — an explicit selection,
never an implicit inheritance from "the reference looked like this."

## Lineage fields

| Field | Answers |
|---|---|
| `intent_ref` | Which Editorial Intent asked for this |
| `calibration_ref` | Which calibration version (AES-V2.10) was active when this compiled, or `null` before calibration versioning is active |
| `article_ref` / `package_ref` | Which article or package this visual serves |
| `artifact_profile` + `profile_ref` | Which of the eight visual families, and where its rules live |
| `audience` + `traits_applied` | Which audience, and which concrete adjustments were actually used |
| `selected_reference_traits` | Which reference traits were adopted/avoided — traits only, never a reference body |
| `brand_profile` + `brand_profile_version` | Which versioned brand snapshot this compiled against |
| `renderer_route` + `renderer` (tool/tool_version/provider/model/model_version/quality_tier) | Which lane and which exact runtime rendered it |
| `attempts` / `max_attempts` | Whether this is within its bounded-revision budget (`editorial/IMAGE-GENERATION.md` §9) |
| `job_id` | The output's own identity, for QA and reroll tracking |

## Renderer route vs evidence

`renderer_route: generative` may never be selected for `artifact_profile:
visual/evidence-visual`. Exact values, axes, dates, and citations must not
ride on a generative raster model (`editorial/IMAGE-GENERATION.md` §1-2;
`editorial/ARTICLE-ILLUSTRATION-ROUTING.md` §2.1). The validator enforces
this as a hard cross-field rule, not a style preference.

## Boundary

This repository owns why the job exists, what it must communicate, which
profile and gates apply, and what the compiled prompt lineage records.
`suengj-com` owns the actual rendering backend, binary storage, and
publication wiring (`docs/architecture/SSOT-BOUNDARIES.md`;
`editorial/ARTICLE-VISUAL-PUBLICATION-HANDOFF.md`).
