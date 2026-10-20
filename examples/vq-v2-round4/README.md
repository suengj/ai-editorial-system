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

The receipt binds outputs to the exact clean Git commit, renderer SHA-256, and stylesheet SHA-256. It records actual rendered-copy hashes and verifies source-string occurrence counts. The video renderer checks every frame for visible text bounds/clipping, the 42px caption and 44px support-label floors, and the seven fact strings in their dedicated elements.

## Round 6 owner-selected reference variants

`render_round4.py --cards-only --owner-reference-variants --out <empty-dir>` opts into three additional card grammars in the same R4 example: a claim-led, whitespace-forward cover; an image-led fact explainer; and a paced editorial close. R4 remains the default, the video path is unchanged, and no registered profile or compositor is changed. The exact owner selection quote, five metadata-only pointers, local archive hashes, observed traits, and variant mapping are in `owner-selected-references.json`; the linked AES catalog/evaluations are under `references/`. The original reference images are copyright-held assets in the external MacArchive and are never copied into Git.

Supply the R4 output's `m1` directory if it is stored elsewhere; this keeps the comparison source explicit and lets each row bind to the actual R4 card:

```sh
python3 examples/vq-v2-round4/render_round4.py --cards-only --owner-reference-variants --r4-baseline /Volumes/OricoSSD/MacArchive/vq-v2-round4-final4/m1 --out /Volumes/OricoSSD/MacArchive/vq-v2-round6-owner-references
```

The variants adapt hierarchy and information roles only. They do not copy reference text, people, logos, characters, exact palette, or signature composition. The owner selected five reference candidates for exploration; this is not final aesthetic approval and does not establish `OWNER_ACCEPTED`.

The card baseline sheet uses direct Round 1 B browser renders for cover, money, and JustPark. Round 1 B did not render YourParkingSpace or opportunity, so their comparison cells use the archived AES source outputs and state that limit in the receipt and sheet labels.

## Evidence boundaries

The video uses the v56 canonical 27.5-second storyboard and its six original still assets. Captions are revealed against the v56 plan's word timing; the exact encoded AAC mix is reused from v56 and hash-compared after mux. HTML/Playwright changes the image/caption presentation only. This does not imply Owner aesthetic acceptance, publication, or production promotion.
