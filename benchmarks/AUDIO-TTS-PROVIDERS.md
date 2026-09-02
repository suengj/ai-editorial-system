# Benchmark — TTS providers, models, and audio rendering adapters

Observed **2026-09-02**. This document is intentionally volatile.

The editorial contract for what should be spoken lives in
[`../editorial/AUDIO-SCRIPT.md`](../editorial/AUDIO-SCRIPT.md). This benchmark
describes what current rendering backends can do with that contract. A provider
or model named here is **an observed worker, not editorial authority and not a
permanent default**.

This document supersedes any older `audio` row in
[`MULTIMEDIA-GENERATORS-BENCHMARK.md`](MULTIMEDIA-GENERATORS-BENCHMARK.md) when
provider/model-specific TTS behavior is concerned.

The unit we certify is not “Google”, “ElevenLabs”, or “OpenAI”. It is:

```text
provider
+ model/version
+ endpoint/mode
+ voice
+ rendering configuration
```

A capability seen on one model must never be inferred onto another model from
the same provider.

---

## 1. What the adapter is translating

The canonical layer should ask for semantic intents such as:

```text
spoken text
pronunciation intent
pause intent
pace / emphasis intent
speaker assignment
semantic chunk boundaries
```

The provider layer may implement those intents through very different
mechanisms:

```text
natural-language direction
| SSML
| inline audio tags
| punctuation
| pronunciation dictionary
| API parameters
| context from adjacent chunks
```

**[Owner]** Provider syntax never enters the canonical spoken script. An adapter
is accepted only when it preserves the text and realizes enough of the semantic
intent to pass rendered-audio QA.

---

## 2. Google Gemini API TTS

`ref:google-gemini-tts` · `ref:google-gemini-models` · verdict: **adapt**

As observed, the Gemini API exposes dedicated TTS models separately from the
Live API. Google describes Gemini TTS as the path for exact text recitation with
fine-grained sound/style control, whereas Live is the interactive,
unstructured audio path. This distinction fits our architecture: long-form
editorial narration should begin with a script and use the TTS surface, not a
conversation model. **[R]**

### Models observed

| Model | Observed role |
|---|---|
| `gemini-3.1-flash-tts-preview` | Current low-latency, controllable TTS preview; text in, audio out; expressive audio tags |
| `gemini-2.5-flash-preview-tts` | Fast controllable TTS from the 2.5 family |
| `gemini-2.5-pro-preview-tts` | Quality-oriented TTS described for structured workflows such as podcasts/audiobooks |

The current Gemini model catalog labels `gemini-3.1-flash-tts-preview` as a
Preview model. Its model page lists an 8,192-token input limit and 16,384-token
output limit as observed on this date. **[R]**

### Control model

Gemini TTS is unusual in treating performance direction as natural language.
Google's current guide describes a prompt structure built around:

- an audio profile;
- scene/context;
- director's notes;
- transcript;
- optional inline audio tags.

Style, tone, accent, pace, articulation, breathing, and related performance
characteristics can be steered by instructions. Inline audio tags such as
emotion, delivery, or non-verbal cues can alter local performance. Google notes
that tags are open-ended rather than a fixed exhaustive vocabulary, and
recommends English audio tags even when the transcript is not English. **[R]**

### Multi-speaker

The Gemini TTS API supports single-speaker and multi-speaker synthesis; the
current documented multi-speaker configuration supports **up to two speakers**.
Speaker names in the prompt must correspond to the configured speaker voices.
**[R]**

### Implications for our adapter

**[Owner]** Translate our global performance profile into concise director's
notes; do not copy the entire editorial brief into the TTS prompt. Translate
local cues only where they are semantically useful. Because audio tags are
model behavior rather than a closed grammar, every new tag used in production
needs rendered-audio verification.

**[Owner]** `gemini-3.1-flash-tts-preview` cannot be treated as a stable
production dependency merely because it is current. Preview status itself is a
recertification trigger.

---

## 3. Google Cloud Text-to-Speech

`ref:google-cloud-tts` · `ref:google-cloud-custom-voice` · verdict: **adapt**

Google Cloud TTS is not one control surface. It contains multiple voice/model
families with materially different behavior. The product documentation exposes
plain text, SSML, and natural-language-prompt control **depending on model**.
**[R]**

### Chirp 3 HD

Current Google Cloud documentation shows why certification must include request
mode. The supported-voices page notes that Chirp 3 HD does not generally expose
the same speaking-rate/pitch parameters as older voice families. A newer Chirp
3 HD page documents a limited SSML subset for synchronous requests while SSML
is not supported for streaming requests. **[R]**

The important conclusion is not which page is “right”. The conclusion is that:

```text
provider-level capability inference is unsafe
```

**[Owner]** An adapter must record model + endpoint/mode and test the exact
control path it intends to use.

### Traditional SSML-oriented families

Cloud TTS supports SSML-based control on applicable models, including use cases
such as pauses and pronunciation/format hints. Older/other families may also
expose speaking rate, pitch, volume, sample-rate, and audio profile controls.
**[R]**

For our canonical contract, SSML is merely one compilation target:

```text
pause_medium → <break ...>     # only on a certified SSML-capable path
spoken number intent → say-as / normalized text
pronunciation intent → supported pronunciation mechanism
```

The literal tags never belong in the canonical script.

### Instant Custom Voice

Current Chirp 3 Instant Custom Voice documentation describes custom voices from
short reference audio, with provider-side consent statements and controls that
include pace plus experimental pause and pronunciation features. The exact
supported locales and controls remain product/version dependent. **[R]**

**[Owner]** Provider consent mechanics are necessary implementation controls,
but they do not expand our editorial rights policy. A provider accepting a
voice asset does not authorize this system to imitate a third party.

---

## 4. ElevenLabs

`ref:elevenlabs-tts` · `ref:elevenlabs-pronunciation` ·
`ref:elevenlabs-voice-cloning` · verdict: **adapt**

ElevenLabs currently exposes several TTS models optimized for different
trade-offs. Their control grammars differ enough that a shared “ElevenLabs
prompt” would be a design error. **[R]**

### Models observed

| Model family | Observed strength | Important constraint |
|---|---|---|
| Eleven v3 | Highest expressiveness; audio tags; 70+ languages; dialogue/multi-speaker workflows | More variable / higher latency than realtime-oriented models; no SSML break tags |
| Multilingual v2 | Stable multilingual long-form lane | Less expressive control than v3; SSML break path available |
| Flash v2.5 | Very low latency (~75 ms excluding network/app latency), 32 languages, high-throughput / interactive lane | Text normalization is a material concern, especially numbers/dates/currencies |

### v3: performance is in the text surface

Eleven v3 uses audio tags, punctuation, capitalization, and text structure to
shape delivery. It does **not** support SSML break tags. Current documentation
instead recommends v3-specific expressive pause/audio tags and punctuation for
rhythm. Audio-tag behavior depends on the selected voice; a direction that
conflicts with the voice's character may perform poorly. **[R]**

**[Owner]** The v3 adapter must therefore keep two representations separate:
canonical spoken text and generated v3 render input. Punctuation or tags added
for rendering are renderer state and must never silently flow back into the
article or canonical script.

### Other Eleven models: exact break syntax

For Multilingual v2, Flash v2, and Flash v2.5, ElevenLabs documents SSML-style
`<break>` tags for controlled pauses, up to the documented bound. Excessive
break markup can make output unstable. **[R]**

That maps cleanly from our semantic pause vocabulary, but only after model
selection:

```text
pause intent
→ if v3: v3-compatible delivery instruction / punctuation
→ if supported v2 lane: break tag
```

### Pronunciation dictionaries

ElevenLabs provides pronunciation dictionaries for names, brands, acronyms,
and technical terms. Current docs describe phoneme/alias approaches and expose
IPA/CMU-related workflows, but support varies by model. One official guide
currently states pronunciation-dictionary phoneme support for
`eleven_flash_v2` and `eleven_v3`; another help page distinguishes SSML phoneme
support on Flash/Turbo from v3's native IPA path. **[R]**

**[Owner]** Treat that documentation variance as a reason to test the exact
model, not as a reason to normalize away the term. Our provider-neutral glossary
remains authoritative for intended pronunciation.

### Long-form continuity

The ElevenLabs speech API exposes useful continuity inputs for segmented
rendering: `previous_text`, `next_text`, `previous_request_ids`, and
`next_request_ids`. It also exposes a `seed` that makes a best effort toward
repeatability but explicitly does **not** guarantee deterministic output.
**[R]**

This is particularly compatible with semantic chunking:

```text
canonical semantic chunks
→ render chunk N with adjacent context / request lineage
→ regenerate a defective middle chunk with both neighbours supplied
```

**[Owner]** We should prefer this bounded local regeneration to rerolling a
whole long-form asset when only one chunk fails QA.

### Text normalization

Flash v2.5 disables some normalization by default to preserve latency. Eleven's
docs specifically flag numbers, dates, currencies, and similar text as a risk,
and recommend pre-normalization or an appropriate normalization setting/model
when those forms matter. **[R]**

This directly validates the separation in `AUDIO-SCRIPT.md` between canonical
values and provider-neutral `spoken_form`. **[Owner]** Never let a low-latency
model improvise a material number.

### Voice cloning

ElevenLabs separates Instant and Professional Voice Cloning. Current Professional
Voice Clone documentation requires voice verification and states that PVC is
for cloning one's own voice; another person must create/verify their own PVC
before sharing it. Instant Voice Cloning requires confirmation that the user has
rights and consent to clone the voice. **[R]**

Our policy remains stricter where necessary: third-party/public-figure voice
imitation is out of scope regardless of technical availability. **[Owner]**

---

## 5. OpenAI Speech API

`ref:openai-tts` · `ref:openai-custom-voice` · verdict: **adapt**

OpenAI's current dedicated speech-generation path is `POST /v1/audio/speech`.
The current model catalog lists `gpt-4o-mini-tts` as a dedicated TTS model and
provides dated snapshots for version pinning. **[R]**

### Control surface

For `gpt-4o-mini-tts`, the Speech API accepts natural-language `instructions`
for voice delivery. The current guide describes control over characteristics
including accent, emotional range, intonation, speed, tone, and whispering.
The older `tts-1` and `tts-1-hd` models do not support the `instructions`
parameter. **[R]**

The endpoint also exposes an explicit `speed` parameter and multiple audio
formats. The current API reference sets the text input bound at 4,096
characters, while the model page lists a 2,000-token model input limit; adapters
should respect the stricter effective limit observed in actual certification
rather than assuming one generic bound. **[R]**

### Streaming

The Speech API supports streaming audio output, including chunked delivery, so
streaming does not require switching the artifact into a conversational Realtime
workflow. **[R]**

**[Owner]** For a fixed editorial script, prefer the dedicated Speech API over
a Realtime conversation surface unless the product genuinely requires
interactive turn-taking. Interactivity is not a quality upgrade for narration.

### Voice selection and Korean

The current guide states that speech can be generated from Korean input along
with many other languages, while also noting that built-in voices are optimized
for English. **[R]**

**[Owner]** This makes Korean editorial certification mandatory rather than
inferable from language-list support. A model “supporting Korean” is not the
same as passing our Korean prosody and mixed-terminology suite.

### Custom voices

OpenAI's current custom-voice documentation limits the feature to eligible
customers and requires two recordings: a consent recording and a matching voice
sample. **[R]**

OpenAI also requires clear disclosure to end users that TTS output is
AI-generated rather than a human voice. **[R]**

**[Owner]** These product controls are implementation requirements in addition
to, not replacements for, our own rights/provenance policy.

---

## 6. Capability matrix — observed, not promised

`✓` means the capability is documented on at least one named configuration
above. It does **not** transfer to sibling models.

| Capability | Gemini API TTS | Google Cloud TTS | ElevenLabs | OpenAI Speech |
|---|---|---|---|---|
| Natural-language performance direction | ✓ | model-dependent | model-dependent / v3 tag-centric | ✓ on `gpt-4o-mini-tts` |
| Inline expressive audio tags | ✓ | model-dependent | ✓ v3 | not a documented core grammar |
| SSML pause path | not the primary Gemini-TTS grammar | model/mode-dependent | ✓ on supported non-v3 models; not v3 | not the documented control path |
| Pronunciation dictionary / phoneme tooling | adapter/pre-normalization needed unless model feature used | model-dependent | ✓ model-dependent | adapter/pre-normalization; no general dictionary contract documented here |
| Explicit pace control | prompt-based | model-dependent/API params | model/settings-dependent | instructions + `speed` parameter |
| Multi-speaker generation | ✓ up to 2 | model/family-dependent | ✓ v3 dialogue workflows | not the dedicated Speech endpoint's primary contract |
| Long-form continuity helpers between chunks | context via prompting; certify empirically | implementation-dependent | explicit previous/next text/request IDs | chunking/streaming; no equivalent request-lineage primitive documented here |
| Streaming | product/model-dependent | ✓ on supported paths | ✓ endpoints | ✓ Speech API |
| Custom/cloned voice | provider/product-dependent | ✓ Instant Custom Voice | ✓ IVC/PVC | ✓ eligible customers |

**[Owner]** Do not use this table to select a production provider. It is a map
of what needs testing.

---

## 7. Provider routing — benchmark lanes, not defaults

No provider earns a permanent global default from documentation.

The useful lanes to benchmark are:

### Editorial long-form / quality lane

Candidate configurations should optimize:

- Korean naturalness over several minutes;
- stable voice identity across semantic chunks;
- accurate mixed Korean/English technical terminology;
- controlled but restrained performance;
- local regeneration without audible seams.

Include quality-oriented Gemini TTS, appropriate Eleven long-form/expressive
models, and `gpt-4o-mini-tts` in the comparative suite. **[Owner]**

### Expressive / dialogue lane

Only for an artifact whose editorial plan genuinely needs performance range or
multiple speakers. Gemini multi-speaker TTS and Eleven v3 dialogue are obvious
candidates from current documented capabilities. **[R]/[Owner]**

### Preview / latency lane

For rapid script inspection, low-latency models such as Gemini Flash TTS lanes,
Eleven Flash v2.5, or streamed OpenAI Speech may reduce iteration cost. A fast
preview render is never promoted directly to production merely because it was
cheap to generate. **[Owner]**

### Pronunciation-critical lane

Prefer a configuration that gives the adapter a reliable pronunciation
mechanism or proves that provider-neutral spoken-form substitution is enough.
A model with superior acting range but unstable proper nouns is the wrong
worker for terminology-heavy material. **[Owner]**

---

## 8. Korean editorial certification suite

Documentation cannot answer whether a model sounds right for this publication.
Every candidate configuration should be rendered against the **same synthetic,
non-private certification suite**.

The suite should cover:

1. native Korean explanatory prose without English syntax underneath it;
2. mixed Korean/English professional terminology;
3. acronyms with an explicit pronunciation glossary;
4. percentages, decimals, dates, time, currency, and units;
5. a long sentence whose qualification must stay attached to the claim;
6. a short sentence that should land without exaggerated drama;
7. semantic recurrence of a thesis without robotic repetition;
8. a deliberate short and medium pause;
9. a confidence/uncertainty contrast where emphasis must not change certainty;
10. at least one multi-chunk long-form sample with two splice boundaries;
11. a targeted regeneration of only the middle chunk;
12. multi-speaker material only for configurations being certified for that
    purpose.

No provider-specific markup belongs in the fixture's canonical script. Each
adapter compiles the same intent into its own syntax. **[Owner]**

### Score dimensions

Keep the dimensions separate; do not collapse them into one “naturalness”
score:

- textual fidelity;
- Korean pronunciation;
- technical-term pronunciation;
- number/date fidelity;
- language-native prosody;
- pace;
- pause placement;
- emphasis fidelity;
- voice continuity;
- chunk-boundary continuity;
- unexpected vocalization / directive leakage;
- render latency and cost only after quality is acceptable.

A configuration with a factual or numeric misreading cannot win on a higher
style score. **[Owner]**

---

## 9. Adapter invariants

Every production adapter must preserve these properties regardless of vendor:

1. **Canonical text is immutable at render time.** Any semantic edit creates a
   new script version.
2. **Text normalization is inspectable.** Numbers, symbols, and abbreviations
   may be transformed only into a recorded equivalent `spoken_form`.
3. **Provider markup is ephemeral renderer state.** Strip it when comparing
   textual fidelity.
4. **Directives must not leak into speech.** A spoken tag/instruction is a render
   defect.
5. **Model identity is pinned where the provider permits it.** An alias that
   can change underneath us is recorded as a lifecycle risk.
6. **Chunk boundaries are semantic first.** Provider size limits can subdivide
   only at approved boundaries or after an explicit script-plan change.
7. **Local regeneration preserves neighbours.** Use continuity context when the
   backend supports it; otherwise re-certify the splice manually.
8. **A provider-side safety/consent check does not substitute for editorial
   rights authority.**
9. **Rendered audio is listened to.** Text-only validation cannot certify
   pronunciation or prosody.

---

## 10. Model lifecycle and recertification

Speech behavior is model behavior. Alias drift can change pronunciation,
prosody, latency, or control adherence without changing our canonical script.

Recertify a configuration when any of these changes:

- model ID or snapshot;
- provider alias target;
- voice ID / custom voice revision;
- endpoint or streaming mode;
- pronunciation dictionary;
- normalization setting;
- material performance prompt;
- SDK/API version when it changes request semantics.

Preview or experimental model status lowers the threshold for recertification.
Where a provider offers dated snapshots, prefer pinning for production and test
a migration before switching. Where it does not, preserve accepted audio and
record the exact observed configuration in lineage. **[Owner]**

---

## 11. Rights and disclosure

Voice capability is not voice permission.

Provider documentation shows materially different custom/cloning controls:
Google Cloud uses consent statements for its custom-voice flow; ElevenLabs has
rights/consent and verification requirements that differ between IVC and PVC;
OpenAI custom voices require a consent recording plus a matching sample and
OpenAI requires user disclosure that TTS audio is AI-generated. **[R]**

Our policy remains backend-independent:

- do not clone or imitate a third-party/public-figure voice;
- do not use a provider's acceptance of an upload as evidence of editorial
  rights;
- record whether the voice is stock, synthetic-designed, owner-cloned, or
  otherwise authorized;
- keep consent/provenance records outside public artifacts when they contain
  sensitive audio;
- disclose AI-generated audio where required by provider policy and by the
  publication's own disclosure policy.

See
[`../editorial/RIGHTS-AND-PROVENANCE.md`](../editorial/RIGHTS-AND-PROVENANCE.md).

---

## 12. Current decision

**[Owner]** Do not hardcode a default TTS vendor into a Skill, profile, Article,
or Artifact schema.

**[Owner]** Implement the editorial layer first:

```text
Article
→ canonical audio plan / spoken script
→ provider-neutral pronunciation + performance intent
```

Then certify provider adapters with the Korean suite above. The winning
configuration can differ by lane — long-form quality, preview latency,
dialogue, or pronunciation-critical work — without changing the editorial
contract.

**[Owner]** The older multimedia benchmark's provisional Gemini preference is
therefore retired as a provider decision. Gemini remains a candidate worker,
not the canonical audio backend.

## Sources and limits

- `ref:google-gemini-tts` — official Gemini API TTS generation guide.
- `ref:google-gemini-models` — official Gemini model catalog/version-status
  documentation.
- `ref:google-cloud-tts` — official Google Cloud Text-to-Speech documentation.
- `ref:google-cloud-custom-voice` — official Chirp 3 Instant Custom Voice
  documentation.
- `ref:elevenlabs-tts` — official ElevenLabs model/TTS documentation.
- `ref:elevenlabs-pronunciation` — official ElevenLabs pronunciation and TTS
  API documentation.
- `ref:elevenlabs-voice-cloning` — official ElevenLabs voice-cloning
  documentation.
- `ref:openai-tts` — official OpenAI Text-to-Speech and Speech API
  documentation.
- `ref:openai-custom-voice` — official OpenAI custom-voice documentation.

This is a capability snapshot, not a service guarantee. Pricing, model aliases,
launch stages, supported controls, and language quality can change after the
observation date. Re-read the provider's official documentation and rerun the
certification suite before any production migration.
