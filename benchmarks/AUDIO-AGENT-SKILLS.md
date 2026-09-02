# Benchmark — agent Skills for speech, narration, and timed voiceover

Observed **2026-09-02**. This benchmark asks a narrower question than
[`AUDIO-TTS-PROVIDERS.md`](AUDIO-TTS-PROVIDERS.md): not which TTS backend is
capable, but **which orchestration patterns existing agent Skills use well
before and around rendering**.

The editorial authority remains
[`../editorial/AUDIO-SCRIPT.md`](../editorial/AUDIO-SCRIPT.md). External Skills
are references, not templates. We absorb process boundaries that improve our
system and reject provider hardcoding, personality imitation, or timing rules
that would weaken editorial integrity.

---

## 1. ElevenLabs official `text-to-speech` Skill

`ref:elevenlabs-tts-skill` · verdict: **adapt**

The official ElevenLabs Skill is implementation-oriented, but several workflow
mechanics generalize beyond ElevenLabs. **[R]**

### Useful mechanics

- model selection is explicit rather than hidden in one generic TTS command;
- text normalization is a first-class request decision because dates, numbers,
  phone numbers, and abbreviations can be spoken differently from their surface
  notation;
- long-form rendering supports **request stitching** through previous/next text
  context;
- output format and streaming/file mode are explicit execution choices;
- cost/usage and request identity are observable rather than discarded.

### What we absorb

**[Owner]** Strengthen the canonical separation between surface values and
provider-neutral `spoken_form`. A renderer must not improvise material number or
date normalization.

**[Owner]** Make adjacent semantic context part of `segment_plan`, so a middle
segment can be regenerated with both neighbours without rebuilding the whole
asset.

**[Owner]** Record stable segment identity, text hash, and render lineage even
when provider job files are temporary.

### What we do not absorb

Voice IDs, Eleven-specific model defaults, account settings, output-codec
preferences, and SDK commands remain adapter implementation. They do not enter
the editorial Skill.

---

## 2. OpenAI curated `speech` Skill

`ref:openai-speech-skill` · verdict: **adapt**

The strongest transferable pattern is the separation between **exact text** and
a compact **delivery instruction spec**. The Skill explicitly augments
instructions without rewriting the input text and treats voice affect, tone,
pacing, pronunciation, pauses, emphasis, and delivery as a separate control
surface. **[R]**

It also distinguishes single and batch jobs, validates important clips after
rendering, records the final text/instructions/flags used, and recommends one
targeted iteration at a time. **[R]**

### What we absorb

**[Owner]** `narration_text` and `delivery_spec` become separate canonical
layers. Direction may clarify what the editorial register already implies; it
must not invent persona, accent, or emotional stance.

**[Owner]** Bounded revision should change one causal variable per pass where
practical. Otherwise a better render cannot be attributed to a script,
pronunciation, voice, or performance change.

**[Owner]** Batch rendering is an execution mode, not a different editorial
artifact. Each batch job preserves stable segment/script identity.

### What we do not absorb

Provider/model/voice defaults and request limits are volatile adapter facts and
stay outside the canonical Skill.

---

## 3. NoizAI `tts` Skill

`ref:noiz-tts-skill` · verdict: **adapt**

This Skill usefully separates **simple narration** from **timeline-accurate
rendering**, and its timed mode attaches voice/speed/emotion state per segment
rather than baking those controls into one monolithic narration string. **[R]**

### What we absorb

**[Owner]** Formalize two rendering modes in the editorial contract:

```text
free narration
| timed narration
```

Timed narration exists only when another surface imposes a real duration
constraint. The time budget belongs in `segment_plan`; it does not change the
factual authority of the script.

**[Owner]** Speaker/voice/performance mapping can vary per semantic segment, but
that map is delivery/rendering state separate from clean narration text.

### What we do not absorb

Backend-specific emotion parameters, cloning mechanics, local/cloud routing,
and exact characters-per-second defaults are execution concerns. A generic CPS
rule would be particularly unsafe across Korean, English, numbers, and mixed
technical terminology.

---

## 4. Social Media Skills `ai-voiceover`

`ref:social-ai-voiceover-skill` · verdict: **adapt**

The useful high-level claim is that voiceover quality is dominated by **script
for the ear + delivery direction**, not by selecting a premium TTS model after
feeding it eye-written copy. The Skill also loads a persistent brand/voice
context before choosing audio delivery and keeps consent/disclosure as a hard
boundary. **[R]**

### What we absorb

**[Owner]** Audio voice should inherit the existing editorial identity and
content register rather than create a separate “podcast persona”. Delivery is a
modality expression of the publication, not a new author.

**[Owner]** Provider choice happens after the script package exists. A more
expressive model is not compensation for weak spoken structure.

### What we do not absorb

We do not adopt “short sentences” as a universal spoken-writing rule, social
platform hooks, fixed model recommendations, or engagement-driven delivery.
Those would recreate the same formulaic failure that `voice.md` removed from
written prose.

---

## 5. `app-demo-agent` timed voiceover workflow

`ref:app-demo-voiceover-skill` · verdict: **adapt**

The useful part is not the app-demo domain. It is the constraint handling. The
Skill establishes the destination timeline first, writes narration against that
timeline, measures the rendered duration, and **prefers rewriting the script to
fit over stretching the video/audio mechanically**. **[R]**

### What we absorb

**[Owner]** A fixed-duration destination must declare its timing contract before
`compile-audio-script` writes narration.

**[Owner]** If rendered narration materially misses the duration budget, revise
the spoken script within the verified claim set before considering audio
time-stretching. Timing failure is a script-plan problem first.

**[Owner]** For video-bound narration, keep a timed alignment plan and a clean
narration track as separate representations. Shot/screen directions must not be
spoken accidentally.

### What we do not absorb

The specific duration tolerances, voice recommendations, music levels, and
screen-description rules are artifact-family decisions, not global audio
principles.

---

## 6. Convergent patterns worth keeping

Across the five Skills, the most useful overlap is structural rather than
stylistic:

| Pattern | External observation | Our decision |
|---|---|---|
| Exact spoken text separate from performance controls | OpenAI; implicit in provider Skills generally | **Adopt as canonical package boundary** |
| Text normalization is explicit | ElevenLabs | **Adopt for numbers/dates/symbols** |
| Long-form segments carry neighbour context | ElevenLabs request stitching | **Adopt in `segment_plan`** |
| Free vs timeline-constrained narration | NoizAI; app-demo workflow | **Adopt as two rendering modes** |
| Per-segment voice/delivery state | NoizAI | **Adopt outside narration text** |
| Fixed duration known before writing | app-demo workflow | **Adopt for video/dubbing-bound audio** |
| Prefer script repair over temporal distortion | app-demo workflow | **Adopt** |
| One targeted revision variable | OpenAI curated Skill | **Adopt for diagnosable QA** |
| Shared brand/editorial context precedes voice selection | Social Media Skills | **Adapt to Suengj voice + content register** |
| Rendered audio must be listened to | OpenAI and voiceover workflows | **Already constitutionalized in audio QA** |

The important negative finding is equally consistent: **provider ergonomics
must not become editorial semantics**. A Skill that hardcodes a voice, model,
punctuation trick, emotional tag, or timeline heuristic may be useful inside
one renderer and still be the wrong layer for this repository.

---

## 7. Resulting Skill boundary in this repository

The search exposed a missing orchestration step. We now make it explicit:

```text
plan-artifacts
  decides: should audio exist, why, which claims, free vs timed
        ↓
compile-audio-script
  decides: spoken structure, clean narration, spoken forms,
           delivery intents, semantic segments, timing budgets
        ↓
provider adapter
  decides: model/voice/API syntax/render parameters
        ↓
rendered audio QA
```

`compile-audio-script` is intentionally vendor-neutral. It absorbs the process
patterns above without copying any third-party Skill body or importing their
provider defaults.

## Sources and limits

- `ref:elevenlabs-tts-skill` — ElevenLabs official text-to-speech Skill.
- `ref:openai-speech-skill` — OpenAI curated speech Skill.
- `ref:noiz-tts-skill` — NoizAI TTS Skill.
- `ref:social-ai-voiceover-skill` — Social Media Skills AI voiceover Skill.
- `ref:app-demo-voiceover-skill` — app-demo-agent timed voiceover workflow.

These are implementation references observed on one date. They demonstrate
useful workflow patterns; they do not establish provider quality, editorial
voice, or permanent defaults. Nothing was copied into this repository. The
rules above are our own abstraction of the observed mechanics.
