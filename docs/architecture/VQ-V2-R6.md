# Visual Quality V2 — Round 6 owner-selected reference variants

Date: 2026-10-20 (Asia/Seoul)

## Scope and authority

Owner statement on SUE-1691, verbatim: **"2,3,4,8,10 괜찮아 - 나머지도 괜찮지만 패턴이 유사해보임"**.

Record `OWNER_SELECTED_REFERENCES = {02,03,04,08,10}` as candidate selection. This records which examples the owner wants explored and the concern that the remaining candidates look too similar. It is not final aesthetic approval and does not establish `OWNER_ACCEPTED`.

The five pointers reuse the SUE-643 `references/catalog.json` plus append-only `references/evaluations/` contracts. `editorial/approved-examples.json` is not the visual registry; it is scoped to owner-selected personal voice excerpts. Candidate metadata, source URLs, observed craft traits, and local archive hashes are recorded in `examples/vq-v2-round4/owner-selected-references.json`. Copyrighted images stay outside the repository; catalog pointers remain `rights_status: unclear`, `copy_status: linked`.

Catalog pointers: `ref:vq-m1-ktv-finance-2026-10-20`, `ref:vq-m1-fsc-correction-2026-10-20`, `ref:vq-m1-kird-gene-edit-2026-10-20`, `ref:vq-m1-kigam-poem-2026-10-20`, and `ref:vq-m1-koreascientists-2026-10-20`.

## Three opt-in grammars

The direct candidate inspection supports three bounded grammar families:

1. **Claim-led notice (R3-03):** one short dominant statement, ample surrounding space, and restrained support. Tested on the M1 cover. Retain its existing M1 photo; do not reproduce the source's exact blue header, illustration, or logo.
2. **Dense explainer (R3-02, R3-04):** a clear headline, image separated from exact supporting facts, and selective typographic emphasis. Tested on the JustPark evidence card. The informational role transfers; institutional palette, portrait, text, characters, icons, and layout do not.
3. **Editorial narrative (R3-08, R3-10):** a paced lead/support sequence ending on the existing experiment question. Tested on the opportunity card. No mascot, speech-bubble, quote artwork, or source wording is reused.

The renderer stays inside `examples/vq-v2-round4/`; `round6-variants.css` is loaded only with `--owner-reference-variants`. The unflagged renderer and R4 CSS continue to render R4. All five M1 cards are rendered and inspected; the money and case-b cards remain R4 because their source structures do not call for the three selected variants. The comparison uses archived R4 cards at desktop scale and renders each R6 card at 390×488.

## Boundaries

- Frozen M1 copy, facts, source notes, images, and source hashes remain unchanged.
- No reference image bytes are stored in Git. No generated images or paid calls are needed.
- R4 stays opt-in; profiles, compositor, defaults, publishing, and deployment remain untouched.
- Technical copy/overflow checks do not confer aesthetic acceptance. Report a visual improvement only if the direct side-by-side supports it.
