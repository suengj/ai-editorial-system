# Audio and video roadmap (AES-P4.5 / SUE-456)

Decided **after** the brief, evidence-visual, and slide PoCs, as sequenced.
Audio and video are decided separately, because they fail differently.

Evidence base: `../../evals/poc/FINDINGS.md`,
`../../benchmarks/MULTIMEDIA-GENERATORS-BENCHMARK.md`.

## What the PoC actually established

| Finding | Consequence for audio/video |
|---|---|
| Text artifacts regenerate **byte-identically** from unchanged inputs | The update cost of a text artifact is near zero. Neither audio nor video has this property, so every article revision carries a re-render cost |
| The brief and deck are **deterministic compilers, not writers** | The generator slot for prose-bearing artifacts is untested with a model in it. Audio would put a model *and* a synthesiser in that slot at once |
| A material article change makes dependent artifacts non-presentable | A monthly cadence of corrections means a monthly cadence of re-renders. For text that is free; for a narrated video it is the dominant cost |
| Every fact-bearing artifact must carry claims that are verified | An audio track asserts facts with no visible citation surface. The provenance has to live somewhere the listener can reach |

## Audio — **defer**

Not rejected. Deferred with named triggers.

**Use cases considered.** Long-form listening for research pieces; a market or
research recap; accessibility; a podcast feed.

**Why defer.**

1. **No automation surface for the product-grade route.** Gemini Notebook has
   no public consumer API; the REST surface is enterprise-only. Any pipeline
   assuming automated audio overviews is assuming a contract we do not have.
   Third-party NotebookLM-style APIs are not Google, and routing article
   content through an unaffiliated intermediary is a provenance question
   before a technical one.
2. **The citation problem is unsolved, not merely unbuilt.** A brief shows its
   sources inline. An audio track cannot. Either the provenance lives in a
   companion text surface — in which case the audio is a second door to a
   door — or the listener gets assertions without evidence, which the
   constitution does not allow.
3. **Update cost is real.** Generation is cheap per the benchmark's indicative
   TTS pricing; *review* is not. A corrected number means re-listening to
   confirm the correction landed, every time.

**What it is not deferred for.** Cost. TTS is cheap enough that price is not
the blocker, and saying so keeps the reason honest.

**Revisit when any of these holds:**

- `AV-1` — A model-written brief passes the claim-carry-through boundary in
  production, so the prose-bearing generator slot is proven with a model in it.
- `AV-2` — A stable, first-party automation surface exists on a plan we
  actually hold.
- `AV-3` — A reader asks for it, or accessibility need is demonstrated rather
  than assumed.

## Video — **reject for now**

Stronger than defer, and stated as such.

**Use cases considered.** A narrated visual brief; an explainer; social
short-form.

**Why reject.**

1. **No editorial need has been established.** Not "we have not built it" —
   nothing in the corpus, the profiles, or the reader-facing goals requires
   video. Building it would be answering a question nobody asked.
2. **Per-second pricing makes iteration the cost centre.** Editorial work is
   iterative by construction; a format where each revision costs real money
   pushes toward accepting the first take, which is the opposite of the
   discipline everything else here enforces.
3. **The staleness cost is worst here.** A material claim change invalidates a
   narrated video completely — narration, captions, and any on-screen figure
   at once.
4. **Rights exposure is highest.** Generated audio or video reproducing a third
   party's voice, likeness, or distinctive style is already out of scope in the
   rights policy. Video multiplies the surface on which that could happen
   accidentally.

**Revisit when both hold:**

- `AV-4` — Audio has shipped and its provenance surface works.
- `AV-5` — A specific piece exists whose argument is genuinely better shown
  moving than still — an animated mechanism, not a narrated article.

## What does not change

- **Article-first discipline is untouched.** The canonical article remains the
  destination; every artifact is a door to it. Neither decision above weakens
  that, and RP-5 in the artifact priority already demotes any format that gets
  consumed *instead of* the article.
- **Lineage and provenance requirements apply unchanged** to any format that
  ships later. Audio would carry `article_ref` with both hashes, a
  `carries_claims` list, and a reachable citation surface — or it would not
  ship.
- **Nothing is promoted by default.** The priority order stays evidence-visual
  → brief → slides → infographic → audio → video, and the reprioritisation
  criteria remain the only route to changing it.

## Summary

| Format | Decision | Revisit trigger |
|---|---|---|
| **Audio** | `defer` | AV-1 model-written brief proven · AV-2 first-party API on a plan we hold · AV-3 demonstrated demand |
| **Video** | `reject for now` | AV-4 audio shipped with working provenance **and** AV-5 a piece genuinely better shown moving |
| **Infographic** | unchanged — rank 4, optional | — |
| **Interactive / quiz** | unchanged — no contract exists yet | A contract would need writing first |
