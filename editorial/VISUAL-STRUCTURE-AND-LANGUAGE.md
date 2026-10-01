# Visual Structure and Visual Language — orthogonal composition contract

This document defines the boundary between **how information is structured** and
**how that structure is visually expressed**.

It exists so a useful layout grammar learned from one project, report corpus, or
benchmark can be absorbed into the Editorial Core without importing that
source's visual identity wholesale.

The governing principle is:

> **Structure answers how the message is organized. Visual Language answers how
> that approved structure feels and looks. A renderer realizes both, but owns
> neither.**

This contract applies across visual artifacts. Surface-specific structure remains
owned by the relevant artifact/surface contract.

## 1. Four layers

~~~text
Canonical claims / argument
        ↓
Semantic structure
        ↓
Artifact structure
        ↓
Visual language
        ↓
Renderer realization
~~~

### Layer A — semantic authority

Owns what is true, claim/evidence/interpretation/hypothesis boundaries,
uncertainty and provenance, and the argument beat that must survive
transformation. This layer is not visual styling.

### Layer B — artifact structure

Owns the **message arrangement required by the artifact**.

Examples:

~~~text
body infographic
→ one primary question
→ spatial modules
→ explicit reading path
→ comparison / mechanism / hierarchy / causal structure

report slide
→ slide necessity / split-merge
→ one dominant slide function
→ information topology
→ headline / evidence / implication / caveat roles
→ slide sequence
~~~

Structure may constrain hierarchy, grouping, density, and reading order because
those change comprehension.

Structure does **not** own a publication palette, house tone, illustration
medium, or decorative surface treatment.

### Layer C — visual language

Owns reusable expressive dimensions after structure is stable.

The canonical dimensions are:

~~~text
tone_manner
palette
typography_character
line_shape
materiality
depth
whitespace
~~~

These dimensions are independent enough to resolve separately.

Examples:

~~~text
structure = report-slide / evidence_to_implication
tone_manner = suengj editorial
palette = suengj default
~~~

or:

~~~text
structure = report-slide / comparison
tone_manner = restrained executive analytical
palette = explicitly authorized reference-derived palette
~~~

Changing palette must not silently change information topology. Changing a slide
from comparison to roadmap must not silently change palette.

### Layer D — renderer realization

Owns exact font files and installed font availability, exact color values after
token resolution, absolute coordinates, drawing primitives, image-generation
provider details, PPTX/SVG/PNG implementation, and responsive/export mechanics.

The renderer may refuse an impossible realization, but it may not rewrite the
approved structure or visual-language authority to make rendering easier.

## 2. Structure is artifact-specific

A body infographic and a report slide may express the same argument but do not
share the same information geometry.

~~~text
same verified argument
        ↓
Visual Story Plan
        ├─ infographic structure
        │    spatial / single-canvas
        │
        └─ slide/report structure
             sequential / multi-frame
~~~

Therefore infographic module count is not a slide module-count rule; slide
split/merge is not an infographic split rule; working-report density is not a
body-infographic density default; mobile infographic first-read requirements
are not presentation-slide geometry; and slide reference layouts do not become
infographic templates.

Cross-artifact reuse happens at the semantic layer and visual-language layer,
not by sharing a layout template.

## 3. Visual Language uses defaults plus selective resolution

The existing brand profile remains the publication's **default bundle and
ceiling**. It is not a mandatory monolith.

For each visual-language dimension, resolve authority independently:

~~~text
artifact / evidence constraints
        ↓
explicit task instruction
        ↓
explicitly authorized reference trait
        ↓
brand default
        ↓
renderer default
~~~

The first applicable authority wins **for that dimension only**.

This means a task can borrow a palette without borrowing a layout, or borrow
information hierarchy without borrowing the palette.

A reference trait may outrank a brand default only through the existing
explicit reference-authority / authoritative-override path. Merely looking
similar is not authority.

## 4. Brand is a bundle, not Structure

A brand profile may provide default tone and manner, palette roles, typography
character, line and shape character, materiality/depth ceilings, whitespace
preference, and prohibited visual treatments.

A brand profile does not decide whether information belongs on one slide or
two; whether a canvas is a comparison, matrix, mechanism, roadmap, or
hierarchy; what evidence a claim may visually imply; whether an infographic
should have two or four modules; or which factual values appear.

Those decisions stay upstream in semantic/artifact structure.

## 5. Reference dimensions are classified by layer

Visual reference evaluation contains both structural and visual-language craft
evidence. Keep them distinct.

Typical **Structure** dimensions:

- semantic density;
- visual density as an artifact-comprehension constraint;
- hierarchy;
- composition / information grouping;
- label-text strategy;
- artifact suitability;
- audience suitability.

Typical **Visual Language** dimensions:

- tone and manner;
- spacing / whitespace;
- palette / colour role;
- typography character;
- line / shape character;
- materiality / depth.

A reference may receive mixed authority. One reference can control hierarchy
while another controls palette, without either reference owning the whole
artifact.

## 6. Digest rule for external/project-specific knowledge

Project repositories and external benchmarks are discovery surfaces. They do
not automatically become Editorial Core authority.

When useful knowledge is found in a project such as a report generator:

~~~text
project-specific observation
        ↓
identify why it worked
        ↓
separate Structure from Visual Language
        ↓
remove brand/vendor/source-specific identity
        ↓
encode the transferable principle
        ↓
retain project-specific realization downstream
~~~

Example:

~~~text
Observed:
a corporate report corpus repeatedly uses
topic → lead message → evidence → implication

Do NOT promote:
exact corporate font, coordinates, palette, logo,
reference page ids, proprietary wording

May promote:
a report-slide structure where topic, head message,
evidence and implication are distinct semantic roles
~~~

This is the **digest rule**: promote transferable reasoning, not source identity.

If the lesson cannot be stated without naming the source's exact layout,
palette, wording, or proprietary assets, it is probably a project adapter rule,
not Core doctrine.

## 7. Infographic contract

Body infographic structure continues to own one primary question per plate,
semantic module coverage, comparison/mechanism/process/hierarchy relationships,
reading path, split conditions, mobile first-read structure, and the
artifact-local text boundary.

Its visual treatment is resolved separately.

For the default suengj.com publication, the current brand/taste profile normally
resolves to warm off-white, muted forest/sage, restrained sand/camel, quiet
charcoal, thin linework, and generous functional whitespace.

Those are **visual-language defaults**, not infographic structure.

Therefore a body infographic remains a body infographic if an explicitly
authorized task changes only its palette.

## 8. Slide / report-deck contract

Slide/report structure continues to own slide necessity/split-merge, slide
function, information topology, primary message, content roles, semantic
fit/density preflight, evidence authority, and sequential continuity.

A working report may carry greater semantic density than a narrated
presentation.

None of those requirements imply navy, blue, green, cream, a consulting
template, or a particular typography family.

The same approved SlideDeckPlan can therefore be realized with suengj.com
visual language, another explicitly requested palette, a project-specific
corporate design adapter, or a different renderer without recompiling the
article argument or changing slide boundaries unless the new realization
exposes a genuine fit defect.

## 9. Tone & manner is cross-artifact by default

When multiple artifacts belong to the same publication/package, the default is
to share tone and manner unless the task explicitly needs a different one.

This allows an article body infographic, report slide deck, and social card to
feel authored by the same publication even though their internal structures
differ.

Shared tone does not require identical density, module count, aspect ratio, or
layout.

## 10. Palette is selectively overridable

Palette is explicitly a **visual-language dimension**, not a structural
decision.

Default behavior:

~~~text
no explicit palette authority
→ brand palette

explicit task palette
→ task palette, subject to factual/accessibility/brand ceiling constraints

explicit reference palette authority
→ adopted reference palette role
→ only when authoritative_override is recorded
~~~

Changing palette never grants permission to copy logos, proprietary wording, or
factual content from the reference.

## 11. Two-pass review

Review visual artifacts in two passes.

### Pass A — Structure

Judge argument fidelity, module/slide coverage, hierarchy, information topology,
reading order, density, evidence/interpretation boundaries, and split/merge
decisions.

Do not reject a structurally correct artifact because the color is not yet
preferred.

### Pass B — Visual Language

Judge tone and manner, palette, typography character, line/shape treatment,
materiality/depth, whitespace, visual restraint, and coherence.

Do not repair a visual-language problem by deleting semantic structure.

## 12. Failure routing

| Failure | Repair layer |
|---|---|
| two independent conclusions on one slide | slide/report Structure |
| infographic reading path forks | infographic Structure |
| comparison encoded as an unrelated roadmap | Structure |
| correct structure but wrong palette | Visual Language / palette |
| correct palette but feels like generic SaaS UI | Visual Language / tone/materiality |
| text too small because one slide is overloaded | Structure first, renderer second |
| exact metric is wrong | factual/evidence authority |
| corporate reference copied too literally | reference authority / rights |
| correct plan but PPT export clips text | renderer |

## 13. Compatibility with the existing Core

This contract does not add a new Editorial Intent axis.

It uses the existing system:

- **artifact profiles** own information geometry and density;
- **surface profiles** add consumption constraints;
- **brand profiles** provide default visual-language bundles and ceilings;
- **visual reference evaluations** provide dimension-level craft evidence;
- **selected reference traits / authoritative override** selectively outrank
  brand defaults;
- **RenderSpec** realizes geometry/materiality after semantic planning;
- **project adapters** own source-specific style systems and renderers.

This keeps the Core digestible and avoids a parallel style framework that means
the same thing as the existing brand/reference system.

## One-line rule

> **First decide what the visual must communicate and how that artifact should
> structure it; only then resolve tone, palette, typography character, line,
> materiality, depth, and whitespace independently from brand/task/reference
> authority. Reuse principles across projects, never entire identities by
> accident.**
