# VQ-V2 Round 9 plan

Date: 2026-10-20 (Asia/Seoul)

## Scope and order

1. A: adopt the recorded owner preference for cards and recurring static visuals: R4 full-bleed photo primary, R7 illustration fallback for absent/weak photo assets or lifestyle/practical content. Preserve explicit recipe selections and keep the current compositor as rollback. Add the preference to the Studio handoff; keep SUE-1591 provider and budget gates unchanged. Deployment is allowed only if the repository has a documented, isolated procedure with no unrelated service impact.
2. B: inspect the Shorts Gen narration/caption timing implementation and the archived SUE-1639 v56 R5 water render. Measure real audio/cue offsets, correct the root cause, add a bounded timing regression, rerender, and remeasure.
3. C: verify all five font pairs and real font loads; produce a clearly labeled 5×3 in-context specimen board. Do not select a production font.

## Contracts and evidence

- Preserve existing explicit recipe inputs, source/master bytes, provider gates, image budget and compositor implementation.
- Record the resolved style and selection basis in the local plan/receipt so AUTO routing can be distinguished from a human explicit style.
- Caption timing is compared to the actual canonical narration audio and to cue-visible intervals in the rendered video; report both boundary and word coverage error distributions.
- Keep C outputs as review artifacts; default-font choice stays HUMAN.

## Validation and delivery

- Each code slice is delivered sequentially: focused checks, Codex Sol low review (maximum three per slice, one at a time), then PR merge.
- A is split by repository because AES and Studio are separate deployables and GitHub repositories.
- No SNS/YouTube publishing, new paid calls, Trading changes, or service deployment without a documented isolated path.
- Rollback is one line: set `VQ_V2_CARD_STYLE_DEFAULT=legacy` in the consumer runtime. Existing compositor code remains available.

## Risks and rollback

- Main risk: silently overriding a producer's explicit style. Mitigation: only the historical `editorial-minimal` default is eligible for owner preference routing; all other recipes and explicit `visual_style` values remain authoritative.
- Main risk: automatic asset-quality classification without image evidence. Mitigation: route only from explicit source-quality/content-class metadata; unknown continues R4 primary.
- B risk: archived render may not match currently checked-out engine. Record render and runner hashes; test current code with the archived request/assets before claiming a fix.
- C risk: browser/system fallback can conceal a missing font file. Verify file bytes/hash and font loading per actual output.
