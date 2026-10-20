# VQ-V2 Round 4 — reusable R3 direction grammar

Date: 2026-10-20 (Asia/Seoul)

## Design decision

Round 3's selected comparison was the second redesign. Owner's exact feedback was: **"두번째꺼가 '훨씬' 낫네"**. This is `OWNER_DIRECTION_PREFERRED`, not final aesthetic approval or `OWNER_ACCEPTED`.

Make the direction reusable as a job-scoped opt-in grammar within the existing AES repository. The renderer is an example adapter under `examples/vq-v2-round4/`; it is not registered as a default. Existing compositor behavior and profiles stay unchanged. No new project or style database is created.

The grammar exposes `cover`, `fact`, `flow`, and `list` card forms plus `video` scene/caption styling. Shared tokens define top/bottom scrims, type scale, a 16 CSS px floor at 390px card width, a 44px minimum for the video support labels on 1080px frames, yellow/blue emphasis, and local text shadow on the cover series mark. Cards use edge-to-edge imagery where source photos exist, open text on dark gradients, bold white type, one highlighted phrase, and prominent figures. Without source photos, money flow and opportunity graphics are deterministic; only declared diagram relationships receive arrows.

## Round 4 implementation scope

- Render all five M1 frames from the frozen `base-series.json` and original approved pilot images.
- Compare cover, money, and JustPark against their archived Round 1 B HTML/Playwright PNGs. Round 1 B has no YourParkingSpace or opportunity render; those comparison rows use the preserved AES source outputs and are labelled accordingly.
- Inspect true 390×488 responsive Playwright captures with overflow and minimum-font assertions.
- Re-render the full 27.5-second v56 water video at 9:16 in HTML/CSS frames. Preserve original source assets, Shorts Gen word-caption timing, and exact encoded AAC audio mix. Add two already-used support strings to the number scene: "총수분 참고값" and "개인별 목표가 아닌 참고값".
- Keep large media intermediates and final outputs on the OricoSSD evidence archive.

## Rework and rollback

Delete no canonical source or master. Re-render with the prior archived inputs and remove only this opt-in example, report, and evidence archive if the experiment is rejected. Since no default or profile changes, rollback does not require restoring the existing compositor.

## Risks and limits

The two M1 comparisons without a Round 1 B render are not same-renderer B comparisons. The full water recreation retains the original still assets and audio/caption timing; it does not add generated motion footage. Visual quality and factual rendering checks do not establish Owner aesthetic acceptance or authorization to publish.
