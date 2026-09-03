# editorial/

Editorial Constitution, shared voice, content-type registers, and executable
quality gates.

| Document | What it governs | Issue |
|---|---|---|
| [`constitution.md`](constitution.md) | Ten durable principles, with a precedence order for when they collide | AES-P1.3 (SUE-440) |
| [`voice.md`](voice.md) | Shared prose identity and language-quality failure signatures; explicitly not a sentence template | AES-P1.3 (SUE-440) |
| [`quality-gates.md`](quality-gates.md) + [`quality-gates.json`](quality-gates.json) | Executable reject / fix / flag conditions | AES-P1.3 (SUE-440) |
| [`profiles/`](profiles/) | Evidence burden, required fields, **content-type register**, and artifact fit | AES-P1.4 (SUE-441) |
| [`MEDIA-STRATEGY.md`](MEDIA-STRATEGY.md) + [`artifact-priority.json`](artifact-priority.json) | Evidence vs distribution media, build-out order, and what would change it | AES-P1.5 (SUE-442) |
| [`VISUAL-STORY-COMPILATION.md`](VISUAL-STORY-COMPILATION.md) | Shared argument-beat graph between a final article and multi-surface visual/spoken derivatives | Visual-story extension |
| [`SLIDES-AND-CAROUSELS.md`](SLIDES-AND-CAROUSELS.md) | Sequential frame grammar, assertion–evidence profile, density modes, progressive reveal, and slide QA | Visual-story extension |
| [`INFOGRAPHIC-AND-POSTER.md`](INFOGRAPHIC-AND-POSTER.md) | Spatial hierarchy, poster/infographic profiles, module reuse, evidence boundary, and spatial QA | Visual-story extension |
| [`VIDEO-STORYBOARD.md`](VIDEO-STORYBOARD.md) | Beat-indexed visual/narration synchronization, captions, temporal assembly, local repair, and video QA | Video extension |
| [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md) | Editorial role, routing, prompt construction, reference consistency, bounded revision, and visual QA for generated/edited images | Visual generation extension |
| [`IMAGE-TEXT-RENDERING-PROFILES.md`](IMAGE-TEXT-RENDERING-PROFILES.md) | Modular text handling for generated images: external overlay, hybrid, integrated generated text, or no text | Visual generation extension |
| [`DIAGRAMMATIC-VISUAL-LANGUAGE.md`](DIAGRAMMATIC-VISUAL-LANGUAGE.md) | Diagrammatic editorial styling, geometric character grammar, thumbnail adaptation, reusable prompt blocks, and style QA | Visual language extension |
| [`ARTICLE-ILLUSTRATION-ROUTING.md`](ARTICLE-ILLUSTRATION-ROUTING.md) | Article thesis → information type → renderer → illustration family routing, plus the current suengj.com Editorial Research Graphic profile | Article illustration extension |
| [`ARTICLE-VISUAL-PUBLICATION-HANDOFF.md`](ARTICLE-VISUAL-PUBLICATION-HANDOFF.md) | Rendered article visual → semantic placement, external publication text, accessibility, lineage, and publication-layer handoff | Article illustration extension |
| [`AUDIO-SCRIPT.md`](AUDIO-SCRIPT.md) | Article-to-spoken-script recompilation, clean narration vs delivery state, pronunciation, semantic segmentation/timing, bounded revision, and rendered-audio QA | Audio generation extension |
| [`presentation.md`](presentation.md) | Semantic block grammar — what a block means, never how it looks | AES-P1.6 (SUE-464) |
| [`HITL-PROTOCOL.md`](HITL-PROTOCOL.md) | Human review stages, approval boundary, Final ≠ Published | AES-P5.1 (SUE-457) |
| [`RIGHTS-AND-PROVENANCE.md`](RIGHTS-AND-PROVENANCE.md) | Transformation, citation, visual/media rights and generated-voice provenance | AES-P0.4 (SUE-437) |

The separation is deliberate. Constitution holds the durable reasoning and
integrity principles. `voice.md` holds only the shared identity and language
quality constraints. The profiles carry register, so Research, View, News,
Note, and Project do not collapse into one sentence architecture. Mechanical
gates remain separate from judgement.

## Multi-surface editorial stack

Visual/audio/video work is layered so a renderer cannot quietly become a new
editorial authority.

```text
LEVEL 0  Canonical Article + verified claims
              ↓
LEVEL 1  Artifact Plan — which derivatives are worth making
              ↓
LEVEL 2  Visual Story Plan — shared argument beats / cross-surface mapping
              ↓
LEVEL 3  Surface compilation
         ├─ slides / carousel / scrolly
         ├─ infographic / poster
         └─ compile-audio-script → listener-first spoken script
              ↓
LEVEL 4  Media realization
         ├─ deterministic evidence visuals
         ├─ generated/edited imagery + text-rendering profile
         └─ TTS adapter
              ↓
LEVEL 5  Timed storyboard / assembled video when planned
              ↓
LEVEL 6  Surface-specific rendered QA + lineage
```

`VISUAL-STORY-COMPILATION.md` is the semantic bridge: the same verified claim
keeps one `beat_id` and provenance across slide, infographic, audio selection,
and video even though each surface may use different wording, density, layout,
and timing.

`SLIDES-AND-CAROUSELS.md` and `INFOGRAPHIC-AND-POSTER.md` define two different
information geometries: sequential frames versus one spatial canvas.
`VIDEO-STORYBOARD.md` adds time and synchronization; it does not create another
summary of the article.

`IMAGE-GENERATION.md` extends the control plane into generated visuals without
making this repository a renderer: it owns the editorial brief and QA contract,
while project repositories own provider adapters and publication implementation.
`IMAGE-TEXT-RENDERING-PROFILES.md` keeps text treatment replaceable per
artifact/visual family rather than making one thumbnail convention a permanent
image-generation invariant. `DIAGRAMMATIC-VISUAL-LANGUAGE.md` adds a reusable
style contract on top of that workflow without turning a project-specific
screenshot or one generated image into global editorial authority.
`ARTICLE-ILLUSTRATION-ROUTING.md` adds the missing article-level decision layer:
it reads the thesis and reader need first, routes exact data to deterministic
evidence, relationships/processes to explanatory diagrams, systems to layered
architectural visuals, comparisons to structured analytical graphics, and
abstract theses to restrained conceptual illustration. It also records the
current suengj.com **Editorial Research Graphic** publication profile so future
article sessions do not have to reconstruct the visual direction from chat
memory.

`ARTICLE-VISUAL-PUBLICATION-HANDOFF.md` closes the next boundary after rendering:
it keeps mutable article/section titles, dates, captions, citations, and UI copy
outside generated artwork; expresses placement through semantic article anchors;
and hands accessibility, lineage, and renderer-neutral asset identity to the
publication repository. Binary storage and transport remain publication
implementation details, so Git-native assets can later move to object storage
without changing the editorial meaning.

`AUDIO-SCRIPT.md` applies the same boundary to speech. This repository decides
how a verified article becomes a listener-first canonical package: clean
narration, provider-neutral spoken forms, delivery intent, and semantic
segment/timing state. `compile-audio-script` operationalizes that modality
change after `plan-artifacts` approves audio; a replaceable rendering adapter
decides how those intents map to one provider/model.

Current provider behavior is observed separately in
[`../benchmarks/AUDIO-TTS-PROVIDERS.md`](../benchmarks/AUDIO-TTS-PROVIDERS.md).
Reusable orchestration mechanics found in external narration/TTS Skills are
studied separately in
[`../benchmarks/AUDIO-AGENT-SKILLS.md`](../benchmarks/AUDIO-AGENT-SKILLS.md).
Neither benchmark can override the canonical editorial contract.

The external research basis for the visual-story layer is recorded in
[`../benchmarks/VISUAL-STORYTELLING-SLIDES-INFOGRAPHICS.md`](../benchmarks/VISUAL-STORYTELLING-SLIDES-INFOGRAPHICS.md).
It adapts multimedia-learning, assertion–evidence, data-annotation,
scrollytelling, poster, and accessibility mechanics without importing a third
party's visual identity.

A rule that is not load-bearing across all five content types does not belong
in the constitution. A corpus tendency that becomes repetitive when used as a
generation command does not belong among voice invariants. A provider feature
or community-Skill convenience that changes with implementation does not belong
among modality invariants. A surface-specific density/layout default does not
belong in the shared Visual Story Plan.

```bash
npm run check:gates     # editorial gates over the golden fixture
npm run check:profile   # worked example against its content-type profile
npm run test:gates      # negative fires, golden passes, polish invariants hold
npm run test:profiles   # profiles differ; media strategy holds
npm run validate:presentation
npm run test:presentation  # renderer neutrality and lossless fallbacks
npm run validate:skills
npm run test:skills
npm run test:eval       # integrity + prose-regression corpus
```

Admits: Markdown rules, machine-readable gate and profile definitions.
Rejects: article prose, examples containing private material.
