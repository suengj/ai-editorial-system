# Approved Visual Asset Lifecycle — approval lock, derivatives, and publication handoff

This contract governs what happens **after a rendered visual has been explicitly accepted by a human**. A hybrid production record may distinguish a semantic master, deterministic factual overlay, and publication composite; that is lineage vocabulary only. This document's human lock remains the only approval authority.

It closes a gap between [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md), the compiled visual-job contract, and [`ARTICLE-VISUAL-PUBLICATION-HANDOFF.md`](ARTICLE-VISUAL-PUBLICATION-HANDOFF.md): generation owns candidates, but once one candidate is approved, later fidelity/format/publication work must not silently reopen generation.

Core rule:

> **Human approval converts a rendered candidate into an immutable visual master. After that boundary, high-resolution delivery, format conversion, compression, cache busting, repository upload, and site publication are derivative/media operations — not new image-generation jobs.**

---

## 1. Lifecycle

```text
visual brief / semantic spec
→ renderer
→ rendered candidate
→ visual QA
→ HUMAN_APPROVED_LOCKED
→ derivative materialization
→ publication handoff
→ repository / media store
→ deploy
→ live/browser QA
```

The `HUMAN_APPROVED_LOCKED` state closes the normal edge back to a generative renderer.

```text
HUMAN_APPROVED_LOCKED
  ├─→ fidelity derivative
  ├─→ format derivative
  ├─→ responsive/crop derivative
  ├─→ publication handoff
  └─X→ full regeneration
```

The renderer may be re-entered only for an explicitly authorized `local_edit` or `concept_change`.

---

## 2. Approval lock record

A production workflow must retain enough identity to prove which artifact was approved. The machine form of this record is `approved_asset` in [`schemas/visual-job.schema.json`](../schemas/visual-job.schema.json) (§8 below); a lock with no digest and no native geometry fails validation, because it cannot say which artifact was approved or let a derivative prove it came from that artifact.

`approved_by`, `approved_at`, and `approval_context` are required on a locked asset, and a record that carries master identity while claiming `state: candidate` is rejected — approval is not demotable by rewriting one field while keeping the master it points at.

**Honest limit.** None of this makes approval unforgeable. The record is written by whatever process writes the job, so an agent can assert a lock it was never given. Requiring attribution removes the silent path — a fabricated approval must name an approver and a context a human can check — but binding the lock to a verifiable human act is an open gap, not a solved problem. Treat these fields as an audit trail, not as authority.

```yaml
approved_asset:
  state: human_approved_locked
  master_ref: <artifact/file/blob reference>
  master_digest: <sha256 or equivalent when available>
  native_geometry: <width x height / vector viewBox>
  format: <png|webp|jpeg|svg|...>
  visual_job_id: <job id>
  renderer_lineage: <tool/provider/model/version when applicable>
  approval_context: <article/package/version>
```

Default after approval:

```text
preserve_visual_identity = true
regeneration_allowed = false
```

The approved pixels/vectors become authority for visual identity. A later prompt, style tendency, model default, or publication convenience cannot silently replace them.

---

## 3. Revision intent classification

Every post-approval request must be classified before any renderer is called.

| Intent | Meaning | Generative renderer |
|---|---|---:|
| `publication_only` | attach, upload, route, CMS/site wiring, cache-bust | forbidden |
| `fidelity_only` | use higher-resolution master, reduce compression, preserve detail | forbidden |
| `format_only` | PNG/WebP/AVIF conversion, metadata normalization | forbidden |
| `layout_only` | responsive sizing/container/crop behavior | forbidden |
| `local_edit` | bounded defect correction with protected invariants | allowed only for stated delta |
| `concept_change` | composition/style/message/subject materially changes | allowed |

Natural-language examples:

```text
"use this exact image"
"upload this"
"make this high-resolution"
"keep the image but reduce file size"
"convert it to WebP"
"put it on the website"
"bust the cache"

→ generation forbidden
```

```text
"make a different image"
"change the composition"
"draw it again"
"change the visual concept"

→ concept_change
```

Ambiguity fails closed toward preservation.

---

## 4. `High resolution` is not a concept-change instruction

For an approved visual, `make it high quality / high resolution` means:

```text
1. use the highest-resolution approved master that already exists
2. derive a less-compressed production representation
3. apply deterministic resize/upscale only when necessary
4. preserve composition, text, numbers, colors, subject identity, and spatial relationships
```

A generative redraw/upscaler may invent or mutate local detail. It therefore requires explicit edit authority and cannot be the default meaning of `high resolution`.

If only a low-resolution master exists, deterministic upscale preserves identity but cannot recreate lost factual detail. That limitation must be reported rather than hidden behind regeneration.

---

## 5. Master vs derivative

**Master**

- human-approved visual identity;
- never silently overwritten;
- retained at highest available quality;
- renderer lineage preserved when generated.

**Derivative**

- same visual identity;
- surface-specific format/size/crop/compression;
- reproducible from master + transform spec;
- carries source-master lineage.

Recommended derivative record:

```yaml
derivative:
  source_master_ref: <ref>
  source_master_digest: <digest>
  transform:
    resize: <none|geometry>
    crop: <none|box>
    format: <webp|png|...>
    quality: <value when applicable>
  output_ref: <ref/path>
  output_digest: <digest>
```

If the output is no longer visually equivalent to the master, it is not a derivative; reclassify it as `local_edit` or `concept_change`.

---

## 6. Renderer failure and publication failure are different layers

Do not use a renderer to repair a delivery problem.

```text
binary upload unavailable
asset path wrong
cache stale
MIME wrong
WebP payload corrupt
mobile CSS wrong

!=
visual concept failed
```

Correct routing:

```text
publication / binary failure
→ publication adapter / binary-capable transport / cache / CSS repair

renderer / artwork failure
→ bounded edit or new visual job
```

Forbidden pattern:

```text
cannot upload approved PNG
→ ask image model to recreate something similar
```

That destroys approval identity and makes a transport defect look like a creative revision.

---

## 7. Binary-capability handoff

If the current agent/tool cannot carry raw binary safely, it must hand off to a binary-capable publication path rather than mutate the artwork.

Allowed examples, subject to project authority:

```text
Git Data blob/tree adapter
repository-local media upload script
object/media storage adapter
another authorized execution environment with binary file support
```

The editorial system does not prescribe the storage provider. It prescribes the invariant:

> **missing delivery capability never grants image-regeneration authority.**

---

## 8. Relationship to the visual-job contract

The compiled visual job preserves renderer lineage for candidate generation, and approval introduces a new downstream state on the same record. This is not a recommendation — it is enforced by [`schemas/visual-job.schema.json`](../schemas/visual-job.schema.json) and `scripts/lib/visual-job-core.mjs`:

```yaml
approved_asset:
  state: candidate | human_approved_locked
  master_ref: <ref>
  master_digest: sha256:<64 hex>
  native_geometry: { width, height }   # or { view_box } for a vector master
  format: png | webp | jpeg | avif | svg
  renderer_lineage: <the runtime that drew the master>

revision:
  intent: publication_only | fidelity_only | format_only | layout_only | local_edit | concept_change
  preserve_visual_identity: true
  regeneration_allowed: false
  request: <the human's words>
  authorization: <required for local_edit and concept_change>
```

`renderer` remains lineage. It does not receive a new prompt for `publication_only`, `fidelity_only`, `format_only`, or `layout_only` work: on a locked master those intents must route `renderer_route: deterministic`, must not carry a `compiled_prompt`, and `compileVisualPrompt` refuses to produce one for them. Generation reopens only for a `local_edit` with a bounded delta and protected invariants, or a `concept_change` the human explicitly asked for. The generative origin of the approved master itself stays auditable in `approved_asset.renderer_lineage`, so closing the route does not erase the lineage.

See [`schemas/VISUAL-JOB-CONTRACT.md`](../schemas/VISUAL-JOB-CONTRACT.md) § "The human-approval lock" for the field-level contract and the fixtures that prove both the prohibited and the authorized paths.

---

## 9. Hybrid body-infographic implication

For body infographics with exact values/labels, the existing routing preference remains:

```text
deterministic
→ hybrid
→ generative
```

A useful production architecture is:

```text
generative illustrative layer when needed
+
deterministic typography / exact values / arrows / evidence
→ composed master
→ human approval lock
→ derivatives only
```

This reduces sensitivity to model drift and prevents an approved infographic's numbers, labels, or layout from changing during later publication work.

---

## 10. Acceptance and stop rule

Post-approval visual publication is complete only when the following relevant gates pass:

```text
APPROVED_MASTER_IDENTITY=PASS
DERIVATIVE_LINEAGE=PASS
VISUAL_EQUIVALENCE=PASS
QUALITY=PASS
BINARY_INTEGRITY=PASS
PUBLICATION_HANDOFF=PASS
DEPLOYMENT=PASS
TARGET_RENDER=PASS when required
```

A broken delivery stage does not reopen creative iteration.

If all authorized binary/publication routes are unavailable:

```text
RESULT = HUMAN_REQUIRED / CAPABILITY_BLOCKED
```

—not `regenerate image`.

---

## Worked failure pattern

Observed anti-pattern:

```text
human approves infographic
→ upload path is inconvenient
→ wrapper/reconstruction introduced
→ browser/render defect
→ low-resolution workaround promoted
→ user asks for high quality
→ new generative render called
→ visual identity changes
```

Correct diagnosis:

```text
primary = approval-preservation / orchestration-boundary failure
secondary = publication capability routing + derivative-quality failure
not primary = prompt quality or renderer quality
```

Corrected flow:

```text
approved candidate
→ lock master
→ choose binary-capable publisher
→ compile HQ derivative from exact master
→ integrity/read-back
→ deploy
→ browser QA
```

---

## One-line rule

> **A prompt produces candidates; human approval produces an asset. Once approved, preserve that asset as the immutable master and solve fidelity, format, transport, cache, and publication problems without reopening generation unless the human explicitly asks to change the image itself.**
