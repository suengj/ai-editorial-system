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
| [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md) | Editorial role, routing, prompt construction, reference consistency, bounded revision, and visual QA for generated/edited images | Visual generation extension |
| [`IMAGE-TEXT-RENDERING-PROFILES.md`](IMAGE-TEXT-RENDERING-PROFILES.md) | Modular text handling for generated images: external overlay, hybrid, integrated generated text, or no text | Visual generation extension |
| [`DIAGRAMMATIC-VISUAL-LANGUAGE.md`](DIAGRAMMATIC-VISUAL-LANGUAGE.md) | Diagrammatic editorial styling, geometric character grammar, thumbnail adaptation, reusable prompt blocks, and style QA | Visual language extension |
| [`AUDIO-SCRIPT.md`](AUDIO-SCRIPT.md) | Article-to-spoken-script recompilation, pronunciation/performance semantics, semantic chunking, bounded revision, and rendered-audio QA | Audio generation extension |
| [`presentation.md`](presentation.md) | Semantic block grammar — what a block means, never how it looks | AES-P1.6 (SUE-464) |
| [`HITL-PROTOCOL.md`](HITL-PROTOCOL.md) | Human review stages, approval boundary, Final ≠ Published | AES-P5.1 (SUE-457) |
| [`RIGHTS-AND-PROVENANCE.md`](RIGHTS-AND-PROVENANCE.md) | Transformation, citation, visual/media rights and generated-voice provenance | AES-P0.4 (SUE-437) |

The separation is deliberate. Constitution holds the durable reasoning and
integrity principles. `voice.md` holds only the shared identity and language
quality constraints. The profiles carry register, so Research, View, News,
Note, and Project do not collapse into one sentence architecture. Mechanical
gates remain separate from judgement.

`IMAGE-GENERATION.md` extends the control plane into generated visuals without
making this repository a renderer: it owns the editorial brief and QA contract,
while project repositories own provider adapters and publication implementation.
`IMAGE-TEXT-RENDERING-PROFILES.md` keeps text treatment replaceable per
artifact/visual family rather than making one thumbnail convention a permanent
image-generation invariant. `DIAGRAMMATIC-VISUAL-LANGUAGE.md` adds a reusable
style contract on top of that workflow without turning a project-specific
screenshot or one generated image into global editorial authority.

`AUDIO-SCRIPT.md` applies the same boundary to speech. This repository decides
how a verified article becomes a listener-first canonical script, including
pronunciation and performance intent; a replaceable rendering adapter decides
how those intents map to one provider/model. Current provider behavior is
observed separately in
[`../benchmarks/AUDIO-TTS-PROVIDERS.md`](../benchmarks/AUDIO-TTS-PROVIDERS.md),
not hardcoded into the editorial contract or a Skill.

A rule that is not load-bearing across all five content types does not belong
in the constitution. A corpus tendency that becomes repetitive when used as a
generation command does not belong among voice invariants. A provider feature
that changes with a model version does not belong among modality invariants.

```bash
npm run check:gates     # editorial gates over the golden fixture
npm run check:profile   # worked example against its content-type profile
npm run test:gates      # negative fires, golden passes, polish invariants hold
npm run test:profiles   # profiles differ; media strategy holds
npm run validate:presentation
npm run test:presentation  # renderer neutrality and lossless fallbacks
npm run test:eval       # integrity + prose-regression corpus
```

Admits: Markdown rules, machine-readable gate and profile definitions.
Rejects: article prose, examples containing private material.
