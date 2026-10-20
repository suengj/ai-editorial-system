# VQ-V2 Round 8 — owner style preference and opportunity card

Updated: 2026-10-20 Asia/Seoul
Status: IMPLEMENTATION_COMPLETE; LOCAL_RENDER_PASS; OWNER_AESTHETIC_REVIEW_PENDING; NOT_OWNER_ACCEPTED

## Owner preference

Verbatim owner statement (2026-10-20): “둘다 좋긴 한데.. 4차 >= 7차 로 해 - 근데 진짜 둘 다 괜찮아”. Recorded as `OWNER_STYLE_PREFERENCE = R4 >= R7` in the existing `examples/vq-v2-round4/owner-selected-references.json` structure. R4 (photo full-bleed editorial) is primary; R7 (illustration, color blocks, highlighter) remains usable as a secondary direction. R7 is allowed when photo assets are absent/weak or the content is lifestyle/practical information.

This is a preference, not aesthetic acceptance. `OWNER_ACCEPTED` is false. The compositor, Studio, deployment, and other operational defaults were not changed; changing them requires separate owner approval.

## Opportunity card update

Reused the existing generated opportunity illustration; no image-generation calls were made. The R7 opportunity card now centers the illustration above full-width information blocks. At 390×488, all four blocks render at 18px, exceed the 16px floor, and span 88% of card width. Desktop blocks also span 88%. The source copy, order, and fact text remain unchanged.

Directly inspected R4 vs R7 desktop and 390px comparison sheets. The updated R7 card gives the illustration more presence and aligns the information into one readable column. This comparison is an opt-in visual result, not a promotion decision.

## Checks and evidence

- Playwright renderer: PASS at 1080×1350 and 390×488 for cover and opportunity; exact copy present; artwork loaded; no clipping, out-of-bounds text, or card overflow.
- Opportunity layout checks: all information blocks at 88% card width; mobile text 18px; illustration centered with an 84% mobile content box.
- Existing illustration asset hashes unchanged: cover `dc5d6628be08c2b2a39d983b267b3979dfed5464f8837d5f4f41a61ba9a96ee9`; opportunity `7c0a0e8c2d0be876b1ba4ad1891303b7e47f20fa5c0829458773c5df2dbb7cd6`.
- New image API spend: USD 0.00. Existing cumulative usage estimate remains USD 0.03855 / USD 2.00 cap; billing was not read back.
- R4 baseline hashes and source-series hash are in the render receipt. No publishing, deployment, or operational default change.

Desktop comparison: `/Volumes/OricoSSD/MacArchive/vq-v2-round8-style-preference/render-final2/round7-vs-r4-desktop-comparison.png`
390px comparison: `/Volumes/OricoSSD/MacArchive/vq-v2-round8-style-preference/render-final2/round7-vs-r4-mobile-comparison.png`
Render receipt: `/Volumes/OricoSSD/MacArchive/vq-v2-round8-style-preference/render-final2/receipt.json`
