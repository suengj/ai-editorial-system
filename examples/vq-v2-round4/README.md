# VQ-V2 Round 4 opt-in grammar

This example packages the Round 3 visual direction as an explicit AES-owned HTML/CSS grammar. Consumers opt in by using this stylesheet and renderer for a specific job. It is not registered in `editorial/entry-manifest.json`, does not change an AES profile or default, and does not replace the existing compositor.

## Grammar

- `cover`: edge-to-edge photo, local top and bottom scrims, strong white headline with one yellow or blue phrase, protected series mark.
- `fact`: a single large number or fact with one supporting line.
- `flow`: deterministic text nodes; only source-declared edges receive arrows. No card boxes.
- `list`: open typographic rows with small emphasis markers; no cream panels or repeated boxes.
- `video`: full-frame source assets, open captions driven by Shorts Gen caption-page timings, and restrained continuous image scale.

Tokens in `art-direction.css` define overlay gradients, hierarchy, yellow/blue emphasis, and mobile-readable minimums. At a 390px card viewport, all visible card text is checked at 16 CSS px or larger. Video legal/support labels are at least 44 CSS px in a 1080px frame. The cover series mark has a local shadow for bright imagery.

## Run

Requires Python 3.9+, Pillow, Playwright, an installed Chromium executable, FFmpeg, and ffprobe. All media outputs belong in the evidence archive, not the repository.

```sh
python3 examples/vq-v2-round4/render_round4.py --out /Volumes/OricoSSD/MacArchive/vq-v2-round4
```

`--cards-only` and `--video-only` can be used for focused reruns with a new, empty `--out` directory. The script refuses to overwrite an occupied output directory. It blocks remote browser requests; source images and fonts are embedded for offline HTML rendering.

The card baseline sheet uses direct Round 1 B browser renders for cover, money, and JustPark. Round 1 B did not render YourParkingSpace or opportunity, so their comparison cells use the archived AES source outputs and state that limit in the receipt and sheet labels.

## Evidence boundaries

The video uses the v56 canonical 27.5-second storyboard and its six original still assets. Captions are revealed against the v56 plan's word timing; the exact encoded AAC mix is reused from v56 and hash-compared after mux. HTML/Playwright changes the image/caption presentation only. This does not imply Owner aesthetic acceptance, publication, or production promotion.
