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

Profile values are defaults for production planning. Source facts, rights,
accessibility, and render acceptance remain governed by their canonical
contracts and evidence.
