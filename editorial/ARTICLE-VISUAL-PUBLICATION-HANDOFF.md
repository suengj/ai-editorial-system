# Article visual publication handoff

This document governs the boundary **after an article visual has been planned and rendered** and before the publication repository integrates it into the canonical article. An optional `visual_production_lineage` carries semantic-master, factual-overlay, composite digests and `requires_owner_gate` as lineage only; suengj-com materialises and verifies bytes.

It does not replace [`ARTICLE-ILLUSTRATION-ROUTING.md`](ARTICLE-ILLUSTRATION-ROUTING.md), [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md), or the deterministic evidence-media contracts. Those documents decide why a visual exists, which renderer is appropriate, and how the result is evaluated. This document defines the semantic handoff to the publication layer.

```text
Canonical / stable article
        ↓
Article Illustration Routing
        ↓
visual brief + renderer
        ↓
render + visual QA
        ↓
ARTICLE VISUAL PUBLICATION HANDOFF  ← this document
        ↓
publication repository
        ↓
asset integration + article placement + site validation
```

## 1. Publication text and artifact-local text are different states

Generated artwork must not become the source of truth for **parent-publication copy** that can change independently of the visual.

Keep the following outside generated raster artwork:

- parent article title or section heading used as publication chrome;
- publication/update date;
- content type/status/badge/CTA or other site UI copy;
- long citations, long qualifiers, definitions, legal/editorially sensitive wording, or other copy that is better represented accessibly in the publication layer.

These belong to Markdown/HTML or another deterministic publication layer because they may change independently of the visual.

A **Family B body infographic / explanatory research graphic** may, however, be a self-contained knowledge artifact. When intrinsic to the artifact and verified, it may include:

- a separately authored visual-local title/subtitle;
- stable semantic labels and module headings;
- axes, units, chronology, declared-and-verified values, and bounded factual payload;
- short source attribution for independent circulation;
- an optional restrained publisher signature for a distribution-capable artifact.

Short source attribution inside the raster supplements rather than replaces canonical page-level citation/provenance. Exact evidence, values, axes, chronology, and source-derived geometry remain deterministic, declared-and-verified, or otherwise traceable.

The operational rule is:

```text
ARTWORK
= semantic visual structure
+ bounded artifact-local information when the visual family requires it

PUBLICATION LAYER
= parent-publication copy
+ accessibility
+ full citation/provenance
+ placement metadata
```

Family A thumbnail/cover/intro visuals remain sparse and should not use this allowance to become title cards or miniature reports.

## 2. Placement is semantic, not positional

Do not define article placement by fragile line number.

Prefer a semantic anchor such as:

```text
after_heading: "Spreadsheet의 가장 위험한 순간은 숫자가 맞을 때다"
after_paragraph_contains: "모델이 현실을 만드는 장치가 된다"
before_heading: "그렇다면 AI가 바꾸는 것은 무엇인가"
```

A publication adapter may compile that anchor into a concrete Markdown edit, but the editorial handoff should preserve **why that location exists**.

The nearby prose must still make sense if the visual is removed. The image may improve comprehension; it must not become the only place where a load-bearing claim exists.

## 3. Minimal handoff contract

A material article visual should be handable to the publication layer with a compact renderer-neutral object.

```yaml
article_visual_handoff:
  article_ref: canonical article slug/path/version
  semantic_role: evidence_visual | explanatory_diagram | architectural_system | conceptual_illustration
  visual_function: explain | compare | compress | frame
  visual_family: thumbnail | body_infographic | other
  renderer: deterministic | generative | hybrid
  placement:
    relation: after | before | replace_placeholder
    semantic_anchor: stable heading / paragraph / beat reference
  asset:
    format: svg | png | jpg | webp | other
    identity: stable asset id or intentional filename
    path_or_reference: publication-layer target or returned reference
  accessibility:
    alt: concise description of what the visual communicates
    caption: optional; only when it adds interpretation/provenance
  text_policy:
    parent_publication_text_inside_artwork: false
    artifact_local_text: none | bounded_verified | self_contained_verified
    artifact_local_title: optional stable visual-local title
    source_attribution_inside_artwork: none | short_verified
    publisher_signature_inside_artwork: none | restrained
    canonical_page_provenance_required: true
  presentation:
    mobile_first_read: required
    detail_access: none | full_size | open | expand | lightbox
  lineage:
    source_article_ref: version/hash when available
    generator_or_renderer: execution lineage, not editorial authority
    reference_assets: optional
  acceptance:
    - thesis fit
    - no fabricated evidence
    - intended crop / scale works
    - parent-publication text remains external
    - artifact-local text is intrinsic, bounded, and verified when present
    - canonical page provenance remains available
    - mobile first-read structure survives
```

The publication repository may add delivery metadata such as dimensions, file size, cache path, responsive variants, or build receipts. Those are implementation details rather than editorial semantics.

## 4. Storage is not editorial authority

Whether the binary currently lives in Git, object storage, a CDN-backed bucket, or another publication store must not change the article's editorial meaning.

```text
semantic role + placement + accessibility + lineage
!=
storage backend
```

For a small static publication, a Git-native asset can be the simplest correct implementation. If later media volume, audio/video, lifecycle controls, private/public separation, transformations, or repository growth justify object storage, that is a publication-architecture change. Do not redesign this editorial contract merely because transport changes.

Once a visual is `human_approved_locked` ([`APPROVED-VISUAL-ASSET-LIFECYCLE.md`](APPROVED-VISUAL-ASSET-LIFECYCLE.md)), the handoff carries the approved master's identity, not a new render. The publication side implements this as a deterministic materialization — approved master → digest → immutable master → HQ derivative → receipt → article src — and reports a media-boundary failure rather than substituting artwork. suengj.com's implementation of that half is `scripts/materialize-approved-visual.mjs` / `npm run media:materialize` (`docs/design/APPROVED-VISUAL-MATERIALIZATION.md`); the storage convention there is an implementation choice, while the invariant — production asset traces to the approved master's digest and geometry, `regenerated: false` — is this contract's.

## 5. Renderer routing remains unchanged

The handoff layer must not collapse the existing routing rules.

```text
DATA / EXACT VALUES
→ deterministic evidence visual

RELATIONSHIP / PROCESS / BOUNDARY
→ explanatory editorial diagram

SYSTEM / ARCHITECTURE / LAYERS
→ architectural / layered diagram

ABSTRACT THESIS / IDENTITY
→ restrained conceptual illustration
```

Integrated multimodal generation may own bounded Family-B structural text/factual payload only under the declared text-ownership and post-render verification contracts. A generative raster must not impersonate computed evidence.

## 6. Atomic integration preference

When the publication transport allows it, prefer integrating the asset and the article reference as one causal change.

```text
rendered asset
+ canonical article patch
+ required metadata
→ one reviewable publication change
```

Avoid intentionally landing an article reference to a missing asset, or an orphaned production asset with no canonical use, unless an explicit staged workflow requires it.

## 7. Publication acceptance

The publication layer should verify as applicable:

- the referenced asset actually exists and is decodable/renderable;
- the article references the intended asset, not a temporary generation path;
- alt text is meaningful and separate from the artwork;
- parent article/section title text was not baked into generated artwork as mutable publication chrome;
- artifact-local title/subtitle/labels/source attribution/signature, when present, are intrinsic, bounded, and verified under the family contract;
- short in-art source attribution does not replace canonical page citation/provenance;
- exact evidence remains deterministic/declared-and-verified/traceable;
- desktop/mobile first-read scale or crop is usable;
- for dense Family-B detail, an appropriate full-size/open/expand path exists when secondary labels/evidence are not intended to be legible inline;
- load-bearing detail is not hidden behind an unavailable detail-access path;
- asset size/performance is within the publication budget;
- canonical URL, structured metadata, accessibility, and text-first reading do not regress;
- post-write evidence identifies the actual article/asset version committed or published.

## 8. Agent ownership boundary

The AI Editorial System owns:

```text
why the visual exists
what it must explain / compare / compress / frame
renderer class
visual family
text/evidence boundary
semantic placement
editorial visual QA
```

The publication repository owns:

```text
actual file/reference
binary transport
article syntax
responsive rendering
detail-access interaction
site typography/caption
performance
build/runtime validation
commit/publish mechanics
```

An image-generation backend owns neither editorial meaning nor publication authority.

## Owner-approved calibration case — 2026-09-09

The `standard-vs-provider-adapter-harness` Family-B infographic for `ai-agent-harness-over-model` is approved as-is. Its visual-local title/subtitle, short source attribution, verified comparison values, and restrained `suengj.com` signature are accepted artifact-local information. The raster does not require regeneration solely to externalize those elements. Secondary fine print is difficult at ~390px, but the dominant comparison remains a first-read structure; this is a bounded calibration case, not a blanket waiver of progressive mobile readability.

## One-line rule

> **Hand off article visuals by semantic role, family-aware text ownership, semantic placement, accessibility, lineage, and explicit evidence boundaries: keep parent-publication copy outside artwork, allow verified artifact-local text for self-contained Family-B infographics, and preserve mobile first-read structure plus appropriate access to dense detail.**
