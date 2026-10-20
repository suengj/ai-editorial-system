# Visual Quality V2 — Round 6 owner-selected reference variants

Date: 2026-10-20 (Asia/Seoul)

## Owner selection and scope

SUE-1691 owner statement, verbatim: **"2,3,4,8,10 괜찮아 - 나머지도 괜찮지만 패턴이 유사해보임"**. Recorded as `OWNER_SELECTED_REFERENCES = {02,03,04,08,10}`. This is candidate selection for exploration, not final aesthetic approval and not `OWNER_ACCEPTED`.

The five references are cataloged through the existing SUE-643 reference registry. `editorial/approved-examples.json` was not reused because it is for personal voice excerpts. Image bytes remain only in the external reference archive; the repository contains URLs, craft notes, rights state, and hashes.

## Reference traits and variant groups

| Candidates | Observed craft traits | Opt-in grammar | M1 card |
| --- | --- | --- | --- |
| 03 FSC correction | One dominant correction statement, ample white margin, small explanatory illustration | Claim-led notice | Cover |
| 02 KTV finance; 04 K-Club gene-edit interview | Strong title/support hierarchy; 02 uses several illustrated facts, 04 separates explanatory text from a large photo and highlights key terms | Dense explainer | JustPark case-a |
| 08 KIGAM researcher card; 10 scientist quotation | 08 separates two conversational voice fields; 10 leads with a quotation and continues with smaller prose | Editorial narrative | Opportunity |

The adaptations transfer hierarchy and pacing only. No candidate images, text, identity marks, people, characters, exact palettes, or signature compositions are included. See [`owner-selected-references.json`](../examples/vq-v2-round4/owner-selected-references.json) and the individual AES evaluation records for direct URLs, observations, and archive SHA-256 values.

## Rendering and inspection

The R4 renderer gained the explicit `--owner-reference-variants` opt-in flag and a sibling stylesheet. Its default path and R4 grammar are unchanged. Cover, case-a, and opportunity use one of the three variants; the other two cards stay on R4. The full 5-card M1 input, copy, facts, source notes, and photos are unchanged.

All five cards were rendered at 1080×1350 and 390×488 and directly checked in the side-by-side R4/R6 and mobile contact sheets:

- Comparison: `/Volumes/OricoSSD/MacArchive/vq-v2-round6-owner-references-final6/m1/baseline-vs-round6-contact-sheet.png`
- Responsive 390×488: `/Volumes/OricoSSD/MacArchive/vq-v2-round6-owner-references-final6/m1/round6-mobile-contact-sheet.png`
- Render receipt: `/Volumes/OricoSSD/MacArchive/vq-v2-round6-owner-references-final6/receipt.json`

Technical QA passes on all 5/5 cards at both sizes: zero clipping/overflow, exact source-copy multiplicities, and a 16 CSS px minimum on mobile. `money` and `case-b` PNG hashes match their R4 output exactly. The comparison is visual evidence, not proof of aesthetic acceptance.

## Visual assessment

- **Cover:** The statement-first layout is easier to read against the light field; it gives up some of R4's integrated full-photo treatment. This is a different direction, not an unambiguous overall improvement.
- **Case-a:** The separated photo and highlighted fact rows make values easier to scan, but the more compact rows and large lower whitespace weaken the composition at desktop scale. Mixed result.
- **Opportunity:** The final question reads clearly as the close and the existing copy is paced into three steps. It remains typographic and sparse; the contact sheet does not establish a clear quality gain over R4.
- **M1 set:** Keep these as opt-in experiments in the R4 example. Do not promote a variant or infer `OWNER_ACCEPTED`; the set does not show a consistent enough improvement over R4.

## Cost, checks, and delivery gate

- Round 6 generation/provider calls: 0; paid spend: USD 0.00. Cumulative estimate remains USD 0.012790 / USD 2.00 cap.
- `node scripts/registry.mjs --validate`: PASS; `npm run test:registry`: PASS; `npm run test:visual-authority`: PASS; `npm run validate:rights`: PASS; `git diff --check`: PASS.
- The render receipt binds code to commit `e354fbf2412ac0687040a089d707fdb31830fbd1`, renderer SHA-256 `e3590c918a7922ca85b3ddaa4483c6ac6f5b4dd097af567f058c50ce86d2f8ac`, and stylesheet SHA-256 `c5249d1ffedb9ee44253df5399e405846bb3f45d73f1e088c501fa949c7a765c`.
- **Codex Sol low review #1:** FAIL on a stale R4 contact-sheet path in the receipt and a fixed R4 baseline path. Both were corrected in `fe3ccd4`; the receipt now resolves to generated files and `--r4-baseline` accepts the comparison directory.
- **Codex Sol low review #2:** FAIL because the unflagged R4 receipt used the R6 owner-candidate status. Corrected to preserve the R4 status when the opt-in flag is absent. The R6 flag now also requires `--cards-only`, preventing an unintended water-video render.
- **Codex Sol low review #3:** PASS with no actionable findings on code HEAD `7ed0e20541eb59683b5bacfe50f2c6526e19a974`. The report update is documentation only.
- No default/profile change, publication, or deployment. No Linear issue status changed.
