# Benchmark — visual storytelling, slides, infographics, and assembled video

Observed 2026-09-02. This benchmark supplies research inputs for the editorial
contracts that compile one verified article into slides, infographics, posters,
and later an assembled narrated video.

The goal is **not** to copy a benchmark aesthetic. The useful question is which
information-design mechanics survive a change of brand, renderer, modality, and
provider.

Recommendations are marked **[R]** when they follow from an external source and
**[Owner]** when they are a local editorial decision informed by the research.
All external material below is link-only and paraphrased.

---

## 1. Denoiser — one knowledge object, several consumption surfaces

Internal reference:
`../references/catalog.json` → `ref:denoiser-consumption-architecture`.

The already-adopted lesson remains narrow:

```text
same information role
→ same semantic importance
→ surface-appropriate visual realization
```

**[Owner]** We do not reproduce Denoiser's visual identity. We reuse the
multi-surface idea: the same argument can be encountered as article, summary,
slide sequence, visual explanation, or timed video without creating several
independent versions of truth.

**Implication:** a derivative surface needs a shared semantic intermediate, not
its own free-form summary prompt.

---

## 2. Multimedia learning — reduce extraneous processing and segment the story

Primary references:

- Richard E. Mayer / Logan Fiorella, *The Cambridge Handbook of Multimedia
  Learning*, coherence, signaling, redundancy, spatial/temporal contiguity:
  https://www.cambridge.org/core/books/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning/F29A19FCD34C542806F736E0661C05F5
- Richard E. Mayer, segmenting/pretraining/modality:
  https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-managing-essential-processing-in-multimedia-learning-segmenting-pretraining-and-modality-principles/4110A2275F6DCD02DAB1F8B37BA7E5CE

Research-backed mechanics worth adapting:

- **[R] Coherence:** omit material that does not help the audience process the
  target idea.
- **[R] Signaling:** use cues to make the organization of essential material
  visible.
- **[R] Spatial contiguity:** explanatory words and the visual they explain
  should be integrated rather than forcing cross-screen search.
- **[R] Temporal contiguity:** when narration explains a changing visual, the
  two should be synchronized rather than separated in time.
- **[R] Segmenting:** complex multimedia is easier to process when divided into
  meaningful segments rather than delivered as one uninterrupted unit.
- **[R] Redundancy caution:** graphics + narration + the same full on-screen
  prose can create unnecessary processing. This is a caution against verbatim
  duplication, not a ban on captions, labels, accessibility text, or a silent
  reading mode.

**[Owner]** The editorial unit derived from this research is the **argument
beat**: one cognitively coherent move in the reasoning. A beat may occupy one
slide, one poster panel, one scrolly step, or several seconds of video.

---

## 3. Assertion–Evidence — message-first slide grammar

Primary references:

- Garner & Alley (2013), Penn State research record:
  https://pure.psu.edu/en/publications/how-the-design-of-presentation-slides-affects-audience-comprehens/
- Penn State Assertion–Evidence checklist:
  https://www.writing.engr.psu.edu/AE_checklist.pdf

The assertion–evidence structure uses a succinct sentence assertion as the
headline and supports it with visual evidence rather than a generic bullet
list. The 2013 experiment reported better comprehension, fewer misconceptions,
lower perceived cognitive load, and stronger delayed recall for the tested
technical presentation than a common-practice slide condition.

**[R]** Slides benefit from a clear message and visual support that directly
serves it.

**[Owner]** Assertion–evidence is a **preferred profile**, not a universal
layout law. A title card, quotation, transition, process build, or purely
visual explanatory frame may have a different grammar. The invariant is that a
frame has one primary information function and that its evidence/text/visuals
agree about what that function is.

---

## 4. MIT Communication Labs — one takeaway, figures over wall-of-text

References:

- MIT NSE poster guide:
  https://mitcommlab.mit.edu/nse/commkit/poster/
- MIT AeroAstro slide design:
  https://mitcommlab.mit.edu/aeroastro/commkit/slide-design/
- MIT/Broad figure design:
  https://mitcommlab.mit.edu/broad/commkit/figure-design/

Recurring mechanics:

- identify the main message before choosing a template;
- make the primary message visually dominant;
- prioritize strong figures and sparing text;
- treat poster panels similarly to message-bearing slides;
- adapt information density to audience and platform;
- remove visual content that does not support the message.

**[Owner]** For our publication, no fixed percentage of figures/text and no
fixed font-size formula becomes a global invariant. Those are surface-specific
heuristics. The portable rule is hierarchy: **takeaway → support → detail**.

---

## 5. Datawrapper — a chart needs a takeaway and annotations

References:

- Datawrapper annotation guidance:
  https://academy.datawrapper.de/article/336-annotate-tab
- Datawrapper bar-chart annotation/highlight guidance:
  https://academy.datawrapper.de/article/33-customizing-your-bar-chart

Datawrapper recommends a title that highlights the most interesting statement
and provides structured places for description, source, notes, byline, and
alternative description. Its annotations/highlights are mechanisms for drawing
attention to the relevant part of the visual.

**[R]** A data visual should not make the audience infer the editorial point
from an unlabeled field of marks.

**[Owner]** Exact charts remain `evidence_visual` and are generated from
traceable data/specs. The slide/infographic layer may crop, annotate, or
sequence those evidence visuals but may not repaint values with a generative
image model.

---

## 6. Flourish — progressive reveal as story pacing

References:

- Flourish scrollytelling examples and principles:
  https://flourish.studio/blog/scrollytelling-examples/
- Flourish data storytelling:
  https://flourish.studio/product/data-storytelling/

Flourish frames scrollytelling as progressive reveal: show one insight at a
time, in an intentional order, with transitions/highlights that make change
trackable.

**[R]** Progressive reveal is useful when simultaneous presentation would force
the audience to decode too much at once.

**[Owner]** Slide/carousel/video/scrolly are therefore alternate **navigation
modes over a beat sequence**, not separate arguments. A surface can combine or
split beats, but it records the mapping.

---

## 7. Accessibility — plan it before rendering

References:

- Microsoft PowerPoint accessibility guidance:
  https://support.microsoft.com/en-US/accessibility/powerpoint/make-your-powerpoint-presentations-accessible-to-people-with-disabilities
- W3C WAI, making audio/video media accessible:
  https://www.w3.org/WAI/media/av/

Useful mechanics include unique/descriptive slide titles, logical reading
order, adequate contrast, alternative descriptions, captions, and planning
media accessibility during scripting/storyboarding rather than after export.

**[Owner]** Accessibility metadata is part of the artifact plan/compilation
contract. It must not depend on pixels alone. Captions for narrated video derive
from the canonical spoken-script lineage rather than from an unrelated summary
pass.

---

## 8. Resulting architecture

The combined research supports this hierarchy:

```text
Canonical Article + verified claims
        ↓
Artifact Plan
        ↓
Visual Story Plan / argument-beat graph
        ↓
┌────────────────┬─────────────────┬──────────────────┐
│ spatial        │ sequential      │ spoken           │
│ infographic    │ slides/carousel │ spoken script    │
│ poster         │ scrolly         │                  │
└────────────────┴─────────────────┴──────────────────┘
        ↓                    ↓
visual/image renderers      TTS adapter
        └────────────┬───────┘
                     ↓
              timed storyboard
                     ↓
              assembled video
```

The intermediate plan is the important new layer. It keeps claim identity,
argument order, and visual/narration responsibilities explicit while allowing
each output surface to use different density, typography, timing, and renderer.

## 9. What not to import

Do not turn any of the following into global rules:

- one vendor's template;
- Denoiser's visual identity;
- one fixed words-per-slide limit;
- one fixed poster figure/text ratio;
- assertion–evidence on every frame regardless of function;
- animation on every transition;
- narration copied verbatim onto the screen;
- generative imagery for evidence-bearing charts;
- a specific TTS, slide, infographic, or video provider.

The durable target is **semantic continuity with surface-specific compression**.
