# Article visual publication handoff

This document governs the boundary **after an article visual has been planned and rendered** and before the publication repository integrates it into the canonical article.

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

## 1. Publication text is not artwork state

Generated artwork must not become the source of truth for mutable publication copy.

Keep the following outside generated raster artwork by default:

- article title;
- section heading;
- publication/update date;
- caption;
- citation or source note;
- site/category label;
- status, badge, CTA, or other UI copy.

These belong to Markdown/HTML or another deterministic publication layer because they may change independently of the visual.

Stable semantic labels that are intrinsic to an explanatory diagram may appear inside the visual only when they are necessary to understand the relationship and are explicitly inspected for correctness. Exact evidence, values, axes, chronology, and source-derived geometry remain deterministic/traceable.

The operational rule is:

```text
ARTWORK
= semantic visual structure

PUBLICATION LAYER
= mutable copy + accessibility + citation + placement metadata
```

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
    mutable_publication_text_inside_artwork: false
    intrinsic_diagram_labels: none | bounded_verified
  lineage:
    source_article_ref: version/hash when available
    generator_or_renderer: execution lineage, not editorial authority
    reference_assets: optional
  acceptance:
    - thesis fit
    - no fabricated evidence
    - intended crop / scale works
    - publication text remains external
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

A generative raster can support explanation, framing, identity, or atmosphere. It must not impersonate computed evidence.

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
- mutable article/section title text was not baked into generated artwork;
- exact evidence remains deterministic/traceable;
- desktop/mobile scale or crop is usable;
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
site typography/caption
performance
build/runtime validation
commit/publish mechanics
```

An image-generation backend owns neither editorial meaning nor publication authority.

## One-line rule

> **Hand off article visuals by semantic role, semantic placement, accessibility, lineage, and explicit text/evidence boundaries; keep mutable publication copy outside generated artwork, and let the publication repository own storage and integration mechanics.**
