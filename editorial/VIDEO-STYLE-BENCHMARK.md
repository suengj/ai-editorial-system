# Video style benchmark notes

This summary separates public observations from production hypotheses. The
working benchmark input is intentionally not part of this repository.

- **Manim styling evidence [S].** Manim documents object fill and stroke color
  controls and illustrates them with green, yellow, and pink objects. Its text
  guide documents setting text color and coloring selected text. These sources
  establish that Manim supports per-object and per-text color styling; they do
  not establish that 3Blue1Brown uses a fixed role-based palette.
  [Manim object styling example](https://docs.manim.community/en/stable/tutorials/building_blocks.html#styling-mobjects)
  · [Manim text color guide](https://docs.manim.community/en/stable/guides/using_text.html#using-colors)
- **Role-based palette [P].** The dark background and semantic color roles in
  the video profiles are palette hypotheses for this system. They require
  frame-level calibration and are not attributed to 3Blue1Brown.
- **Narration-led motion design [S/P].** The supplied benchmark describes
  Kurzgesagt's narration-first production flow. Layered motion, restrained
  palettes, and morph or match-cut transitions remain practical hypotheses.
  [Kurzgesagt production](https://kurzgesagt.org/youtube/)
- **Caption and frame constraints [P].** Hook timing, caption density, safe
  margins, scene lengths, and audio targets are implementation starting values
  from the supplied benchmark. The validator checks declared plan values; it
  does not measure encoded frames or audio.

### VIDEO-CRAFT-3: decisions to use at the styleframe gate

The 2026-11-01 corpus adds local production evidence, separate from the public
observations above. Compare a real 5–10 s preview before committing to a full
render; apply these rules while laying out each beat:

| Decision | Production rule from the tests |
|---|---|
| Data briefing (UC1, 9:16 Remotion) | Pin FACTS, date/base and one-decimal labels. Near-tie bars share a zero baseline; reveal exact final values after settling, never count up through another row's real value. |
| Generated backgrounds | Codex `image_gen`: shared style + exclusion lines, exact prompt and SHA-256 recorded. Reject recognizable brand trade dress even without a logo (triple-lens phone → generic regeneration). Show AI-image disclosure; facts stay deterministic overlays. |
| Caption hierarchy | ≤2 lines, actual glyphs about 4% of frame height; keep numbers/decimals/%/units together across lines and pages. Local translucent scrim must clear chart data. |
| Footer rail | Minimum actual glyphs: 34 px at 1080×1920; 28 px at 1920×1080 for attribution/source/AI disclosure. Wrap and hold ≥2 s on the ending; confirm on a phone-size frame. These are new production floors, not an old-output PASS. |
| Math explanation (UC2, 16:9 Manim + FFmpeg) | Reserve separate title/shape/dimension/formula/comparison rows; test their bounds. Hold the comparison through its takeaway, and start every scene with visible content. |
| Dashboard (UC3, 16:9) | Crop to the spoken panel; body glyphs ≥18 px at 1080p. Keep both comparison cards and clicked controls in the ROI, DEMO away from controls, action/caption delta ≤0.3 s. |

Confirmed narration is Gemini 3.8 flash TTS / Rasalgethi; Chirp3-HD was evaluated
and rejected. Fixed-gap beat audio gives beat sync; UC1 word times remain
proportional estimates. Word-sync PASS awaits measured provider timestamps or
forced alignment. Review the encoded output against its SHA-256, including
phone-size footer and caption inspection; SHOWABLE is not measured word sync.

Corpus locators (VIDEO-CRAFT-3 workspace): `uc1/decision-log.md`,
`uc1/FACTS.md`, `uc1v2/GENERATED.md`, `uc1v2/qa/REPORT.md`,
`uc1v2/qa/REVIEW-sol-36080d205144.md`, `uc2/QA-SUP1.md`, `uc2/FIX-SUP1.md`,
`uc2/compose.sh`, `uc3/QA-G4.md` and `uc3/REVIEW-SUP1.md`. The build report's
blocked render and the later SHA-bound viewing review are different stages;
neither supplies measured word alignment.

Profile values are defaults for production planning. Source facts, rights,
accessibility, and render acceptance remain governed by their canonical
contracts and evidence.
