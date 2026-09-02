# Video Storyboard — assembled visual essay, narration sync, and temporal QA

This document governs **video compiled from an already-verified article and its
visual/spoken derivatives**.

The initial editorial model is deliberately not `prompt → generative video`.
It is an **assembled visual essay**:

```text
Canonical Article
→ Artifact Plan
→ Visual Story Plan
→ visual frames/assets + Canonical Spoken Script
→ TTS / recorded narration
→ timed storyboard
→ compositor
→ captions / accessibility layer
→ rendered-video QA
```

Generative motion/video can later become one replaceable renderer for selected
shots. It does not replace this semantic contract.

Related contracts:

- `VISUAL-STORY-COMPILATION.md`
- `SLIDES-AND-CAROUSELS.md`
- `INFOGRAPHIC-AND-POSTER.md`
- `AUDIO-SCRIPT.md`
- `IMAGE-GENERATION.md`

## 1. Video is temporal assembly, not another summary pass

The video does not independently decide what the article means.

Its semantic inputs are:

```text
Visual Story Plan
+ selected beat ids
+ Canonical Spoken Script
+ approved visual assets/evidence
```

The storyboard decides:

- what the viewer sees while each spoken beat is heard;
- when a visual changes;
- which parts of a visual are revealed/highlighted;
- when silence or a pause needs visual time;
- where captions and accessibility descriptions fit;
- which assets can be reused.

It may not invent a new claim, new interpretation, or more dramatic certainty
because video benefits from a stronger hook.

## 2. Beat identity is the synchronization key

Use stable `beat_id`s to connect modalities.

Example:

```yaml
beat_id: beat-04
visual_refs:
  - chart-02
  - concept-illustration-01
spoken_chunk_ref: audio-beat-04
caption_ref: caption-beat-04
start_hint: after beat-03 completion
transition_in: reveal comparison
transition_out: hold on consequence
```

The renderer may ultimately use timestamps/frame numbers, but those are build
outputs. Editorial synchronization starts from semantic identity.

This makes partial repair possible:

```text
bad visual in beat-04
→ rerender visual beat-04
→ preserve audio and other beats

mispronunciation in beat-07
→ rerender audio chunk beat-07
→ preserve visual sequence when timing still fits
```

## 3. Duration follows comprehension, not a fixed slide timer

Do not assign every slide or frame the same duration.

A beat needs enough time to:

- hear the spoken thought;
- inspect the load-bearing visual;
- understand an annotation/reveal;
- register a qualification or contrast.

Some frames may persist through several spoken sentences. Others may change
quickly because the visual itself is simple.

A useful rule:

```text
visual change when the cognitive task changes
OR when a meaningful reveal reduces interpretation cost
```

not:

```text
visual change every N seconds
```

## 4. Static-first is a valid production strategy

A video does not need continuous generated motion to feel intentional.

Initial production can use:

- designed slides/frames;
- pans/crops over high-resolution artwork where justified;
- progressive chart/diagram reveals;
- simple deterministic transitions;
- character/concept illustrations;
- highlighted evidence;
- limited motion typography when semantically useful.

This preserves:

- visual consistency;
- deterministic evidence;
- lower render cost;
- beat-level editability;
- reuse across website/carousel/video.

Motion is promoted only when it explains something static composition cannot.

## 5. Narration comes from the canonical spoken-script layer

Do not produce video narration by summarizing the slides after they are made.
Do not produce slides by transcribing a TTS script after audio is rendered.

Both compile from the shared Visual Story Plan:

```text
                    ┌→ slide/frame compilation
Visual Story Plan ──┤
                    └→ compile-audio-script → Canonical Spoken Script
```

The spoken version may contain more connective explanation than the frame. That
is expected.

Provider-specific TTS controls remain governed by `AUDIO-SCRIPT.md` and the TTS
provider benchmark.

## 6. Visual and narration should complement each other

Prefer:

```text
voice: explains why / how / qualification
screen: shows what / relation / evidence / concise takeaway
```

Avoid:

```text
voice: reads full paragraph
screen: displays same paragraph
```

Exceptions include captions, exact quotations, deliberate definitions, or a
silent accessibility/distribution variant.

If the narration refers to `this chart`, `the green line`, or `the number on the
left`, the storyboard must guarantee that the relevant object is visible and
unambiguous at that moment.

## 7. Motion is signaling, not decoration

Motion/reveal can:

- direct attention;
- expose one part of a complex figure;
- show a before/after state;
- trace a causal/process sequence;
- align a visual change with a spoken transition.

Motion should not:

- animate every object;
- add ambient movement that competes with evidence;
- turn an illustration into false evidence;
- change the apparent magnitude/timing of data;
- create cuts only to maintain artificial energy.

When nothing meaningful changes, hold the frame.

## 8. Captions derive from spoken lineage

Captions are not an independent `summarize this audio` product.

Preferred path:

```text
Canonical Spoken Script
→ rendered audio
→ alignment / timing
→ captions
```

The caption text may need segmentation/punctuation appropriate to reading, but
its words remain traceable to the spoken script.

Required QA:

- no dropped negation/qualification;
- names/numbers match the script;
- timing does not expose a conclusion before the spoken evidence arrives;
- line breaks remain readable;
- speaker identity is clear when more than one speaker exists.

## 9. Audio description / integrated description is planned early

If a visual communicates load-bearing information that the narration does not
state, the storyboard must classify how that information remains accessible:

```text
integrate it naturally into narration
OR
provide an audio-description / media-alternative path
OR
change the visual/narration design so the information is not visual-only
```

This decision belongs before final rendering, not after export.

## 10. Video openings and endings obey the article, not platform clichés

The opening may compress entry cost and visually establish the central
problem/thesis. It may not manufacture a stronger controversy than the article
supports.

Avoid default patterns such as:

- invented shock statistic;
- fake rhetorical question;
- promise of a revelation that the article does not contain;
- exaggerated before/after transformation;
- generic countdown/list framing when the argument is not a list.

The ending should land the article's consequence, decision boundary, or genuine
open question. It need not recap every beat.

## 11. Reuse assets through beat lineage

A video should consume the same approved assets used on other surfaces when the
semantic role matches:

```text
article evidence chart
→ slide evidence frame
→ video beat

concept illustration
→ article card
→ opening/transition video frame

poster module
→ carousel frame
→ video visual
```

Re-render only when geometry/timing/legibility demands a new output. Reuse
meaning, not screenshots.

## 12. Staleness and incremental rebuild

Video carries the source article hashes and beat mapping.

Classify changes:

### Visual-only change

Palette/crop/layout changes without claim drift:

```text
rerender affected visual segment
→ preserve spoken script/audio if still synchronized
```

### Audio-renderer change

New TTS provider/voice with same script:

```text
rerender audio
→ re-check duration and sync
→ visual semantics unchanged
```

### Claim change

A carried claim changes:

```text
recompile affected beat
→ update visual/spoken/caption segments
→ propagate to dependent beats
```

### Thesis / argument-graph change

```text
recompile Visual Story Plan
→ rebuild affected surfaces
```

A single stale beat should not automatically cause full rerender if the build
system can splice and certify the affected range.

## 13. Video QA is multi-layered

### Editorial

- Does the video preserve the thesis and uncertainty?
- Does every fact-bearing beat map to verified claims?
- Does the sequence preserve logical dependency?

### Visual

- Are evidence marks traceable?
- Are focal hierarchy and text readable at target size?
- Do generated visuals avoid false factual detail?
- Is style consistent across beats?

### Audio

Follow `AUDIO-SCRIPT.md` render QA:

- pronunciation;
- numbers/dates;
- pace;
- pauses;
- voice consistency;
- chunk continuity;
- directive leakage.

### Synchronization

- Is the visual evidence visible when it is discussed?
- Do reveals/cuts occur at semantic boundaries?
- Does a transition accidentally imply causality or chronology not in the
  article?
- Do captions match the spoken beat?

### Accessibility

- captions complete and readable;
- no load-bearing meaning relies on color alone;
- visual-only information has an alternative path;
- flashing/motion patterns do not create avoidable barriers.

### Technical

- aspect ratio/resolution/frame rate/container correct;
- no clipped text / safe-area violations;
- audio levels and channel behavior acceptable;
- final duration matches manifest;
- source/provider/build lineage recorded.

## 14. Failure routing

| Failure | Correct repair boundary |
|---|---|
| Wrong claim/logic | article or Visual Story Plan |
| Wrong frame message | slide/frame compilation |
| Bad illustration | image/visual renderer |
| Bad chart | deterministic evidence renderer/spec |
| Mispronunciation | spoken form / TTS adapter / audio chunk |
| Bad pacing | audio performance or storyboard timing |
| Caption mismatch | caption alignment layer |
| One bad shot | rerender/splice that beat, not whole video |
| Visual identity drift | visual-language contract / reference assets |

Do not fix upstream truth problems with downstream animation polish.

## 15. Initial production profile

For the current `suengj.com` direction, the recommended first video profile is:

```yaml
video_family: assembled_editorial_visual_essay
story_source: visual_story_plan
visuals:
  preferred:
    - deterministic evidence visuals
    - diagrammatic editorial illustrations
    - slide/infographic modules
  motion: sparse_semantic
narration:
  source: canonical_spoken_script
  compiler: compile-audio-script
  renderer: replaceable_tts_adapter
captions: required_for_distribution
regeneration: beat_local_when_possible
```

This is a current profile, not a permanent ban on generative video. A future
motion-first family can be added as another renderer/profile after it can pass
the same claim, continuity, accessibility, and lineage requirements.

## 16. Stop rule

Video is accepted when:

```text
article/beat claim fidelity PASS
+ visual QA PASS
+ rendered-audio QA PASS
+ synchronization QA PASS
+ caption/accessibility QA PASS
+ technical render QA PASS
+ lineage/staleness metadata complete
```

Repeated full-video rerolls for a local defect indicate a missing modular build
boundary.

## One-line rule

> **Treat video as beat-indexed temporal assembly: compile visuals and listener-first narration from one shared argument plan, synchronize them by meaning, render with replaceable tools, and repair stale or defective beats locally rather than regenerating the whole story.**
