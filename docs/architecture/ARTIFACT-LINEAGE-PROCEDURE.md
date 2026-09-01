# Artifact lineage procedure (AES-P4.4 / SUE-455)

How a derived artifact stays trustworthy when the canonical article changes.
Written for the `suengj-com` integration in SUE-459/SUE-460.

Code: `../../scripts/lib/lineage.mjs`. Contract:
`../../schemas/ARTICLE-ARTIFACT-CONTRACT.md`.

## What lineage is carried by

The recorded article version — `article_id`, `version_number`, `content_hash`,
`claims_hash`, and `commit` where available. **Not** the file path.

Moving an artifact from `pending` to `suengj_com_asset`, renaming it, or
serving it from a different host changes `location` and nothing else.
`relocate()` exists to make that explicit rather than implicit.

## Material vs non-material change

Decided by the two hashes, not by inspection:

| Comparison against the current article | Level | Requires |
|---|---|---|
| both hashes match | `fresh` | nothing |
| `content_hash` differs, `claims_hash` matches | `cosmetic` | optional regeneration |
| `claims_hash` differs | **`material`** | **regeneration** |
| lineage incomplete | `unknown` | review |

**Material means the verified claim set changed.** A typo fix, a reordered
paragraph, or a retitled section is cosmetic. A corrected number, a withdrawn
claim, or a newly verified one is material — the artifact may now assert
something the article no longer says.

`unknown` is the fail-safe. An artifact whose lineage cannot be resolved is
never treated as current; conservative behaviour under uncertainty is the
whole point of having a level for it.

## A stale artifact is not current because its file exists

`classifyArtifact()` returns `presentable: false` for `material` and
`unknown`. The file continuing to exist is not evidence of anything, and any
surface that renders artifacts must consult the classification rather than the
filesystem.

The contract layer enforces the matching rule from the other side: an artifact
in state `approved` whose hashes compute `material` fails validation.

## Regeneration resets human judgement

`regenerate()` rebinds the artifact to the new version and **drops
`verified_at` and resets `state` to `generated`.**

An artifact approved against version 3 has not been approved against version 4.
Inheriting that approval would launder a human decision onto content the human
never saw. This is the same principle as `final ≠ published`, applied to
artifacts.

## Procedure

1. **On article change** — recompute `content_hash` and `claims_hash`, bump
   `version.number`.
2. **Classify every dependent artifact** with `classifyArtifact()`. Store the
   returned record; it is machine-readable and carries its own reason.
3. **Material** → regenerate from the plan, or retire the artifact. It may not
   remain published.
4. **Cosmetic** → regeneration is optional. The artifact stays presentable.
5. **On regeneration** → `regenerate()` rebinds lineage and clears review
   state. A human reviews again before the artifact is approved.
6. **On relocation** → `relocate()` only. Never re-derive lineage from a path.

## For `suengj-com`

What the site receives per artifact: `article_ref` with both hashes, a
`staleness` record with a level and a reason, and a `state`. What it must do:
render only `presentable` artifacts, and treat `state: approved` as required
for a published surface.

What it must not do: infer currency from file existence, modification time, or
directory placement.
