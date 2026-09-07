# Visual job contract (AES-V2.7 / SUE-565)

A **visual job** is the compiled, machine-checkable record of one visual
artifact request. It exists so that a bad result is routable to the layer
that produced it — artifact profile, semantic spec, reference selection,
brand profile, or renderer — instead of triggering a reroll or a prompt
patch that nobody can trace back to a rule.

Machine schema: [`visual-job.schema.json`](visual-job.schema.json).
Compiler: `scripts/compile-visual-prompt.mjs`. Fixtures:
`scripts/test-visual-job.mjs`, `schemas/examples/visual-job-*.example.json`.

## Schema versions

Schema `1.1.0` is additive: it introduces `visual_brief`, `render_spec`,
`compiled_prompt_adapter`, `brand_conflicts`, `requires_owner_gate`, and
`article_title`. The schema accepts both `1.0.0` and `1.1.0`; every valid
`1.0.0` job remains valid. `requires_owner_gate` is optional for compatibility
and absent means false, but core requires it to be present and true when
`brand_conflicts` is non-empty, and rejects true with no conflict.

The version is coupled to the fields it introduces: a `1.0.0` job may not
carry any of those V1.1 fields; a `1.1.0` job may carry them but may not carry
`visual_production`; and a `1.2.0` job is the only version that may carry
`visual_production`. Legacy deterministic jobs with both VisualBrief and
RenderSpec absent remain valid.

Schema `1.2.0` adds optional `visual_production`, the declared SUE-645/648
control-plane state documented in [VISUAL-PRODUCTION-CONTRACT.md](VISUAL-PRODUCTION-CONTRACT.md).
It accepts `1.0.0`, `1.1.0`, and `1.2.0`; a V1 job has no production telemetry
requirement. This state never replaces the SUE-638/639 approval-lock path.

## The prompt is a compiled output, not the source of truth

The durable knowledge is the state the job cites: the semantic spec, the
artifact profile (`editorial/profiles/artifact/visual-*.json`), the selected
reference traits, and the versioned brand profile
(`editorial/profiles/brand/suengj-com.v1.json`). `compiled_prompt` is a
deterministic string assembly over that state, recorded with `compiled_from`
so it can be regenerated or audited — never hand-edited independently of the
state that produced it.

Supported prompt adapters are `generic-v1` and `generic-v2`. When a compiled
prompt is present, the validator reassembles it with the recorded adapter (or
legacy `generic-v1` when the adapter field is absent) and requires exact
equality of both `compiled_prompt` and `compiled_from`.

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

## The human-approval lock (SUE-639)

A prompt produces candidates; human approval produces an asset. Once a human
accepts a rendered candidate, the job records that as machine state rather
than conversational memory:

```text
approved_asset.state          candidate | human_approved_locked
approved_asset.master_ref     the approved artifact itself, not a description of it
approved_asset.master_digest  sha256:<64 hex> — what a derivative must trace back to
approved_asset.native_geometry  width/height, or view_box for a vector master
approved_asset.format         png | webp | jpeg | avif | svg
approved_asset.renderer_lineage  the runtime that drew the master, kept auditable after the lock
```

A lock that names no digest and no native geometry is not a lock — it cannot
say which artifact was approved, and a later derivative cannot prove it came
from that artifact. `scripts/lib/visual-job-core.mjs` fails it
(`approved-master-missing-immutable-identity`).

Every post-approval request is classified before any renderer is consulted
(`editorial/APPROVED-VISUAL-ASSET-LIFECYCLE.md` §3):

```text
revision.intent                 publication_only | fidelity_only | format_only | layout_only
                                | local_edit | concept_change
revision.preserve_visual_identity
revision.regeneration_allowed
revision.request                the human's words, so a misclassification is reviewable
revision.authorization          who reopened generation, and for what
```

**The lock is closed by default.** A `human_approved_locked` master is sealed
against generation unless an explicitly authorized reopen is on the record —
not merely "unless one of the four non-generative intents is declared". This
distinction is the whole mechanism, and getting it wrong is how the first
version of this contract shipped with the lock wide open: `revision` is an
optional field, so a locked master with *no declared intent* validated clean
and compiled a generative prompt. Silence is not authorization. Whether or not
a revision is declared, a locked master must route `renderer_route:
deterministic` and must not carry a `compiled_prompt`, and `compileVisualPrompt`
throws `RegenerationSealedError` — so a caller cannot obtain a fresh prompt by
skipping validation, nor by omitting the classification.

The first four intents are derivative/media work, and on a locked master they
must additionally carry `preserve_visual_identity: true` /
`regeneration_allowed: false`. "Make it high quality", "convert it to WebP",
"upload it", and "bust the cache" are all in this set — none of them is a
request for a different image.

**Approval is not demotable.** A record carrying any approved-master identity
(`master_ref`, `master_digest`, `native_geometry`, `format`, or any approval
attribution) must be `human_approved_locked`. Writing `state: candidate` beside
the master it points at is approval laundering, not candidacy, and fails as
`approved-master-identity-without-approval-lock`. A genuine candidate names no
master.

Generation reopens only through an explicit authorization record:

- `local_edit` — needs a non-empty `authorization.bounded_delta` (exactly what
  may change) and `authorization.protected_invariants` (what must survive
  unchanged), and keeps `preserve_visual_identity: true`. An unbounded "edit"
  is a `concept_change` wearing a smaller name.
- `concept_change` — needs `authorization.authorized_by` and `statement`, and
  sets `preserve_visual_identity: false`, so the record never claims to
  preserve an identity it is about to discard.

`revision` without `approved_asset` is rejected: there is one authority for
post-approval routing, not a second one alongside it.

Authorization has to be complete, not merely declared — an intent word is a
claim, the authorization record is the evidence for it. Whitespace does not
satisfy it: the schema's `minLength: 1` stops the empty string and stops there,
so `authorized_by: " "` would otherwise reopen a renderer. And the declared
`format` must agree with the extension `master_ref` actually points at, so
`svg` cannot be used to walk past the raster geometry requirement on a `.png`.

## What the lock does not do

It does not make approval unforgeable. Every field here is written by whatever
process writes the job record, so an agent that can author the file can author
`state: human_approved_locked` and a digest it computed itself. Requiring
`approved_by`, `approved_at`, and `approval_context` on a locked asset does not
change that; it removes the *silent* path, so a fabricated approval has to name
an approver and a context that a human can check, rather than appearing from
nowhere. Binding the lock to a verifiable human act — a signature, an external
approval record, an out-of-band token — is a real gap and is not solved here.

A digest written here names bytes this repository does not hold — there is no
asset store in the editorial control plane, so `master_ref` is never resolved
and `master_digest` is never recomputed against anything. Verifying a digest
against real bytes is publication-side work, and
[`editorial/ARTICLE-VISUAL-PUBLICATION-HANDOFF.md`](../editorial/ARTICLE-VISUAL-PUBLICATION-HANDOFF.md)
§4 is where that boundary is stated. Whether a given publication path actually
performs that check is that path's contract to make and to prove, not a
guarantee this document can offer on its behalf.

Both enforcement points agree, and deliberately so: `compileVisualPrompt`
refuses whenever the job is sealed **or** carries any unresolved approval-lock
finding. So a record that launders the lock instead of tripping it — a demoted
`candidate` still naming its master, or a reopening intent whose identity flags
contradict it — cannot obtain a prompt by compiling without validating.

The lock is additive to the SUE-565 gates, not a replacement for them —
context isolation, renderer-runtime exclusion, density, and brand resolution
all still apply to a locked job. Fixtures:
`schemas/examples/visual-job-approved-format-derivative.example.json` (the
deterministic derivative path) and
`schemas/examples/visual-job-approved-concept-change.example.json` (the
authorized reopen), plus the prohibited paths in `scripts/test-visual-job.mjs`.

The media operations themselves — decode, digest, HQ derivative, receipt,
article wiring — belong to `suengj-com`, per the boundary below.

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
