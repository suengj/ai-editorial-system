# Pinned shorts_gen contract snapshot

These schema files are copied from `suengj/p04_shorts` at commit
`6d24e8c23044b614ff404750c1351adaca9e505a`. The StageResult receipt reference
is rewritten to the vendored repo-relative path so schema bundling resolves the
upstream RenderReceipt schema. The video critique contract test validates its
`stage_result` against this upstream `StageResult` schema. The upstream enum
does not define a `critique` stage, so the fixture carries the associated
`render` StageResult; frame-level critique findings remain in the separate AES
`frame_samples` field.
