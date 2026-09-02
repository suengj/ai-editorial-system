# Audio script — spoken structure, performance semantics, and audio QA

This document governs **audio scripts derived from canonical articles**. It sits
below the Editorial Constitution and beside [`MEDIA-STRATEGY.md`](MEDIA-STRATEGY.md).
The media strategy decides whether an `audio` artifact belongs at all; this
contract decides how an article is recompiled for listening before any TTS
provider sees it.

It does not choose a voice vendor, model, API, SSML dialect, or rendering
parameter. Those are replaceable implementation details. Current provider and
model observations live in
[`../benchmarks/AUDIO-TTS-PROVIDERS.md`](../benchmarks/AUDIO-TTS-PROVIDERS.md).

## 1. Audio is a recompilation, not a read-aloud

The canonical article and the audio artifact carry the same verified argument,
but they are not the same surface.

A reader can stop, scan backward, inspect a citation, or re-read a dense
sentence. A listener usually encounters the argument once, in time. Copying an
article body into TTS preserves the words while often losing the reasoning.

The pipeline is therefore:

```text
Canonical Article
  ├─ thesis
  ├─ verified claims
  ├─ uncertainty
  └─ provenance
        ↓
audio plan
        ↓
Canonical Spoken Script Package
        ↓
provider adapter
        ↓
Rendered Audio
```

The audio plan may reorder explanation, compress supporting detail, make a
transition explicit, or recur to a load-bearing idea. It may not silently
change what the article claims.

## 2. The canonical script is a package, not one prompt blob

Keep **what is spoken** separate from **how it should be performed**. Existing
speech-generation Skills repeatedly converge on this separation even though
their provider syntax differs; we adopt the boundary, not their vendor-specific
controls.

A canonical spoken-script package contains four independent layers:

```yaml
narration_text: clean spoken text only
pronunciation_glossary: provider-neutral intended readings
delivery_spec: global and local performance intents
segment_plan: semantic boundaries, continuity context, optional time budgets
```

`narration_text` is the textual SSOT for what the listener should hear. It must
remain usable for a human reader or a different TTS backend without stripping
SSML, audio tags, stage directions, voice IDs, or API instructions.

`delivery_spec` may describe affect, tone, pace, emphasis, pauses, or speaker
assignment. It is not part of the narration text and must never leak into
speech.

`segment_plan` exists because long-form rendering, local regeneration, dubbing,
and video synchronization all need structure that a flat text file cannot
express safely.

This separation gives the system a clean invariant:

```text
same narration_text
+ different certified adapter
→ different render, same spoken claim set
```

## 3. The protected factual set survives modality change

Across Article → Spoken Script, preserve:

- thesis and direction of the argument;
- every material verified fact carried into audio;
- numbers, dates, units, quotations, and named entities;
- the fact / interpretation / hypothesis boundary;
- stated uncertainty and confidence;
- provenance from every factual statement the audio actually carries.

A script may omit a secondary claim when the audio plan does not need it. It
may not weaken, strengthen, or simplify a retained claim into something the
article did not verify.

### Derived explanations

A spoken reformulation is allowed when it is semantically equivalent. A new
calculation, comparison, analogy, conversion, or numerical example is **a new
claim** and returns to verification before rendering.

`audio-friendly` is not an exception to the evidence contract.

## 4. One listen changes information architecture

The unit of spoken writing is not a fixed sentence length. It is a **listenably
complete thought**.

Prefer one main cognitive move per breath-scale unit:

- one claim;
- one causal step;
- one qualification;
- one comparison;
- one consequence.

This is not a command to produce uniformly short sentences. Sentence-length
quotas create another synthetic cadence. A longer sentence is valid when the
condition and its consequence need to remain together; a short sentence is
valid when a boundary needs to land cleanly.

The test is whether a listener can retain the relation without needing to
reconstruct written syntax.

## 5. Spoken structure is allowed to differ from article structure

Section order in the article is not protected. The spoken version should give
the listener the minimum context needed **before** a claim depends on it.

Useful audio beats often include:

```text
orientation
→ first load-bearing idea
→ mechanism / evidence
→ complication or boundary
→ next inference
→ closing consequence
```

This is a reasoning shape, not a mandatory template. Some pieces need fewer
beats; some need a historical sequence, a comparison, or a single sustained
explanation instead.

Do not create headings in speech merely because the article has headings.
Translate structural boundaries into the lightest transition the listener
actually needs.

## 6. Recurrence is not repetition

Written prose usually cuts repetition. Spoken prose sometimes needs a central
idea to return because the listener cannot glance back up the page.

Allow **semantic recurrence** when it restores orientation or shows how a later
fact changes an earlier claim. Do not repeat the same sentence as a substitute
for structure.

A recurring thesis should normally return with a new function:

```text
initial claim
→ later evidence
→ claim restated with a narrower / clearer consequence
```

Verbatim recurrence without a new function is filler.

## 7. Transitions carry logic, not presenter scaffolding

Audio needs more explicit connection than text, but less hosting than a generic
AI script tends to add.

Avoid transitions whose only job is to announce the script machinery:

- numbered host patter when the items are not genuinely parallel;
- “now let us move to…” style navigation;
- repeated previews of what the next section will discuss;
- artificial rhetorical questions used only to create energy.

Prefer transitions that state the relationship itself: cause, limit,
consequence, reversal, time shift, or unresolved condition.

If the relation is already obvious from the adjacent sentences, no transition
is required.

## 8. Opening reduces entry cost; it does not manufacture a hook

The opening has three possible jobs:

1. identify what the piece is actually about;
2. expose the intuition or distinction the argument will change;
3. give enough orientation for the first evidence to make sense.

It does **not** need shock, suspense, a promise of a revelation, or an invented
question. Clickbait translated into speech is still clickbait.

The opening should reach the article's real argument quickly without sounding
like a headline being read aloud.

## 9. The ending lands an inference

Do not close by listing what the listener has just heard.

A useful ending does one of three things:

- states the consequence that follows from the argument;
- names the decision boundary the evidence creates;
- leaves the genuinely unresolved question visible.

“Today we covered…” and equivalent recap formulas are not endings unless the
artifact is explicitly instructional and a recap is the learning objective.

## 10. Numbers are spoken forms of the same facts

Written notation and spoken notation are different representations of one
verified value.

The script compiler may create a **spoken form** for:

- numbers and percentages;
- dates and times;
- currencies and units;
- acronyms;
- symbols;
- URLs when they genuinely need to be spoken;
- mixed Korean/English technical terms.

The spoken form must preserve the value and meaning. It is metadata or a
rendering substitution, not a license to approximate.

Recommended conceptual shape:

```yaml
surface_text: canonical visible form
spoken_form: provider-neutral spoken form
pronunciation_ref: optional glossary key
```

Do not rewrite the canonical article merely to make a TTS model pronounce it
correctly.

### Normalization is an explicit decision

Do not let a backend decide silently whether a date, decimal, currency, code,
or abbreviation should be normalized. Provider Skills expose materially
different normalization behavior, especially in low-latency lanes. Anything
whose spoken expansion matters should be resolved in the canonical spoken-form
layer and then verified in the render.

## 11. Pronunciation is editorial metadata

Names, acronyms, technical terms, and mixed-language phrases need explicit
handling when pronunciation matters.

Maintain a provider-neutral pronunciation glossary before translating it into
IPA, X-SAMPA, SSML, alias substitutions, or provider-specific dictionaries.
The glossary records the editorial decision; the adapter records the syntax
used to realize it.

```text
canonical term
→ intended spoken form
→ provider adapter representation
```

If a provider cannot reliably realize a load-bearing pronunciation, route the
artifact to another certified configuration or require a human audio fix. Do
not distort the terminology to accommodate one backend.

## 12. Delivery direction is separate from narration text

Do not solve performance control by contaminating the text with directions.
The renderer receives two channels conceptually:

```text
TEXT
- exact narration to speak

DIRECTION
- voice affect
- tone / formality
- pace
- pronunciation guidance
- intentional pauses
- emphasis
- speaker assignment
```

The direction layer should be **augmented, not invented**. It may make explicit
what the article register, audience, and audio plan already imply. It must not
invent a persona, accent, emotional stance, or theatrical interpretation merely
because a provider can render one.

A provider-specific adapter can compile this compact direction into natural
language instructions, SSML, audio tags, voice settings, or other controls.
Those compiled controls never become canonical text.

## 13. Performance cues are semantic, not provider markup

The canonical script may carry a **small, provider-neutral performance
vocabulary** when delivery changes meaning or comprehension.

Recommended roles:

- `pause_short`
- `pause_medium`
- `emphasis`
- `pace_slow`
- `pace_fast`
- `pronunciation_ref`
- `speaker`

These are intents, not literal tags to be emitted to a provider. The adapter
may realize the same intent through SSML, punctuation, an audio tag, a natural
language instruction, an API parameter, or no explicit control when the model
handles it naturally.

Do not encode provider syntax such as `<break>`, `[whispers]`, voice IDs, or
model names in the canonical script.

## 14. Pauses must do work

A pause is warranted when it separates ideas the listener must not blend:

- claim from qualification;
- number from consequence;
- one speaker from another;
- a completed argument beat from the next one.

Pauses inserted only to make a voice sound dramatic are decoration. Excessive
pause markup also makes a script brittle across providers.

Use the fewest explicit cues that survive a backend swap.

## 15. Single speaker is the default

Multiple speakers add a second editorial structure: who owns each sentence.
Use them only when the information function justifies the split — for example,
a genuine dialogue artifact or two clearly different argumentative roles.

A synthetic second speaker must never be presented as:

- a sourced expert who was not recorded;
- a witness;
- an interview subject;
- the author of a quotation;
- evidence that a conversation actually occurred.

A generated dialogue is a distribution format, not a new source.

Speaker choice and per-segment voice mapping belong in delivery/rendering state,
not in the factual article layer.

## 16. Free narration and time-constrained narration are different modes

Most article audio should use **free narration**: structure and pace follow the
argument, and duration is an output measurement.

Some downstream surfaces impose a real time constraint — for example a fixed
video segment, dubbing slot, or synchronized presentation. In that case use a
**time-constrained narration** mode and make the constraint explicit before the
script is written.

```yaml
rendering_mode: free | timed
target_duration_ms: optional global target
tolerance_ms: optional acceptance band
segment_budgets: optional per-beat targets
```

A time budget is an editorial input, not permission to speed-warp the finished
audio. When narration is materially too long or too short, prefer revising the
spoken script **within the verified claim set** over stretching/compressing the
audio until it sounds unnatural.

If a video is the destination, the narration and visual timeline must agree on
what is being asserted at each beat. Timing alignment is a separate constraint;
it does not authorize new claims or force the audio to describe every visible
action.

## 17. Segment by meaning, then preserve neighbour context

Long-form synthesis often requires multiple requests. Provider limits are a
rendering constraint; they must not become the editorial segmentation rule.

Choose semantic chunk boundaries first — completed beats, paragraph groups,
or speaker turns — then fit those chunks to the certified provider limit.

The `segment_plan` should make local regeneration possible without guessing:

```yaml
segments:
  - segment_id: stable-local-id
    narration_span_hash: hash-of-spoken-text
    speaker: optional-speaker-role
    target_duration_ms: optional
    previous_context: short semantic neighbour context
    next_context: short semantic neighbour context
    cues: sparse provider-neutral performance intents
```

`previous_context` and `next_context` are continuity aids, not extra narration.
A provider adapter may pass them through explicit request-stitching fields,
prompt context, previous request IDs, or another certified mechanism. They must
never be spoken or silently alter the segment text.

A re-rendered middle segment is accepted only if:

- its exact narration span is unchanged unless a script revision was recorded;
- its entry cadence joins cleanly to the retained previous segment;
- its exit cadence joins cleanly to the retained next segment;
- voice identity and loudness remain coherent;
- no continuity context leaks into speech.

This makes **bounded local regeneration** the default repair strategy for a
local defect.

## 18. Performance direction stays subordinate to the text

Tone, pace, emphasis, accent, emotion, and vocal character can improve an audio
artifact. They cannot rescue a script whose reasoning is unclear.

Performance direction should be compact and stable:

```text
editorial register
+ audience/listening context
+ global delivery constraints
+ sparse local cues
```

Avoid large acting prompts whose persona becomes more salient than the article.
The renderer should make the argument easier to hear, not turn the publication
into a character performance unless that is the explicit artifact purpose.

## 19. Provider adaptation is a compilation step

The canonical script is the SSOT for what is spoken. Provider adaptation is a
lossless compilation from editorial semantics to one backend's controls.

```text
Canonical Spoken Script Package
        ↓
Provider Adapter
        ↓
provider/model/endpoint-specific render jobs
```

The adapter may:

- choose a certified voice/model configuration;
- translate pause/performance intent into supported syntax;
- apply pronunciation dictionaries or safe text normalization;
- split long-form input at approved semantic boundaries;
- supply previous/next continuity context;
- choose streaming or file output parameters;
- batch independent or ordered segment render jobs when that preserves lineage.

It may not:

- change narration text without recording a script revision;
- add emotional or dramatic direction that changes apparent certainty;
- turn interpretation into quotation or dialogue;
- normalize a number into a different value;
- hide provider/model/version identity from lineage.

For batch rendering, every job should retain a stable segment ID and record the
final text hash, delivery inputs, voice/model configuration, and output path.
Temporary provider job files are implementation state; stable lineage is not.

See [`../benchmarks/AUDIO-TTS-PROVIDERS.md`](../benchmarks/AUDIO-TTS-PROVIDERS.md)
for current adapter observations.

## 20. Audio QA has two passes

A successful API response is not an accepted audio artifact.

### Script QA

Before rendering:

- thesis fidelity;
- claim and citation carry-through;
- no unverified derived numbers or analogies;
- language-native spoken prose;
- no presenter scaffolding;
- semantic recurrence only where useful;
- clean narration text separated from delivery instructions;
- pronunciation glossary complete for risky terms;
- performance cues sparse and meaningful;
- segment/time budgets explicit when the destination is constrained.

### Render QA

Listen to the actual output and inspect:

- pronunciation and number/date reading;
- pacing and pause placement;
- emphasis that accidentally changes meaning;
- sentence-boundary and segment-boundary continuity;
- voice consistency across the artifact;
- duration against an explicit budget when one exists;
- multi-speaker identity consistency when applicable;
- directive/context leakage — control text must never be spoken;
- truncation, skipped words, repeated words, artifacts, or unexpected
  non-verbal sounds;
- output duration/format and provider lineage.

Audio cannot be certified from transcript inspection alone.

For a material or publication-facing clip, always perform rendered-audio QA.
For exploratory batch output, sample inspection may be used only when the batch
contract explicitly allows it and no factual/pronunciation risk is being hidden.

## 21. Bounded revision

Classify the failure before regenerating.

### Script failure

The listening structure, explanation, or transition is wrong. Revise the
canonical script and rerun script verification before rendering again.

### Pronunciation / normalization failure

The script is right but a term or number is rendered incorrectly. Fix the
provider-neutral spoken form or the adapter's pronunciation rule; do not change
the factual value.

### Performance failure

The script is right but pace, emphasis, voice, or pause behavior is wrong.
Change only renderer configuration where possible.

### Timing failure

The destination has a real duration constraint and the script misses it.
Tighten or expand the spoken script while preserving the verified semantics;
do not default to unnatural time stretching.

### Local audio defect

A bounded segment is defective. Regenerate that semantic segment with neighbour
context when supported; do not reroll the entire artifact by default.

Routine production should use **one targeted change per revision pass** so the
cause of improvement or regression remains observable. Repeated “make it more
natural” generations are a missing acceptance criterion, not a workflow.

## 22. Lineage and staleness

`audio` remains a distribution artifact under
[`../schemas/ARTICLE-ARTIFACT-CONTRACT.md`](../schemas/ARTICLE-ARTIFACT-CONTRACT.md).
It therefore:

- derives only from a human-finalized article;
- records the exact article version and `claims_hash`;
- carries `source_references` for every verified claim it asserts;
- records the Skill and actual rendering tool/model in `generator` lineage;
- becomes materially stale when the carried verified claim set changes.

The canonical script package should itself retain a script version and hashes
for narration text and pronunciation/delivery state. A provider/model migration
is **not** an article revision. It is a new render of the same script lineage
and must be re-certified for pronunciation, continuity, timing, and performance.

## 23. Relationship to image and video

Audio shares the same editorial hierarchy as generated imagery:

```text
editorial semantics
→ modality-specific plan
→ replaceable renderer
→ modality-specific QA
→ lineage
```

It does not share image acceptance criteria. Images fail on composition and
crop; audio fails on listening structure, pronunciation, pacing, continuity,
and voice identity. Video adds another temporal layer rather than replacing
this audio contract.

For video-bound narration, keep two linked but distinct representations:

```text
clean narration text
+ timed segment / visual alignment plan
```

Do not embed shot directions or visual-production notes into text that a TTS
backend is expected to speak.

## One-line rule

> **Compile the verified article into clean listener-first narration plus separate pronunciation, delivery, and segment/timing state before choosing a TTS backend; preserve claims and uncertainty, then translate those intents through a versioned adapter and certify the actual rendered audio by listening.**
