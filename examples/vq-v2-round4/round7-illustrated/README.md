# Round 7 illustrated card variant

This is an opt-in visual experiment for two M1 cards (cover and opportunity). It uses newly generated transparent editorial illustrations, vivid blue color blocks, large highlighted Korean headlines, and deterministic copy from the frozen M1 series. It does not change the R4 renderer or default output.

The images contain no text, numbers, logos, or product UI. The owner-selected reference IDs are craft pointers only; no source artwork was copied. Asset hashes, prompts, API request IDs, and the pre-call budget plus actual usage are tracked in the companion Round 7 ledger/report under `/Volumes/OricoSSD/MacArchive/vq-v2-round7-illustrated-cards/`.

Render with `python3 examples/vq-v2-round4/round7-illustrated/render_round7.py --out <empty-directory>`. The renderer reads the frozen M1 series, writes desktop and 390×488 captures, and creates side-by-side R4 comparison sheets. It requires the archived Round 4 baseline and installed Playwright Chromium. R4 remains the default and is untouched.

Round 8 records the owner's preference in `../owner-selected-references.json`: `R4 >= R7`, with R4 as primary and R7 as a usable secondary direction for content with absent/weak photo assets or lifestyle/practical information. This is preference guidance only; it does not change compositor, Studio, or deployment defaults and does not mean `OWNER_ACCEPTED`. The opportunity card now uses a centered larger illustration and full-width information blocks; mobile information text is 18px. Round 8 comparison evidence is under `/Volumes/OricoSSD/MacArchive/vq-v2-round8-style-preference/`.
