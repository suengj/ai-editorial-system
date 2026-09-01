# Generated media storage and delivery (AES-P6.3 / SUE-461)

Decided from measured PoC artifacts, not from projected scale.

## What was actually measured

Every artifact the system currently produces, in bytes:

| Artifact | Bytes |
|---|---|
| `cost-stack.svg` — evidence visual | 2,619 |
| `cost-flow.mmd` — diagram source | 478 |
| `brief.md` | 1,382 |
| `deck.md` — 6-page Marp source | 951 |
| `cost-stack.chart.json` — spec | 800 |
| `cost-flow.diagram.json` — spec | 830 |
| `handoff-receipt.json` | 3,044 |
| **Total for one fully-artifacted article** | **~10 KB** |

Context: `suengj-com/public/` is 28 KB today, fonts included. This repository
is 1.3 MB with history.

**Every artifact the system produces is text.** That is not an accident of the
PoC — it follows from the P1.2 decision that evidence visuals go to
deterministic renderers, where the spec is the artifact and the render is a
build product.

## Decision: Git, for everything currently produced

No object storage. No R2 bucket. No asset pipeline.

At ~10 KB per fully-artifacted article, a hundred articles with every artifact
would add roughly 1 MB — smaller than this repository's current history.
Introducing object storage for that would be buying an operational dependency,
a second identity space, and a cache-invalidation problem in exchange for
nothing measurable.

| Artifact class | Lives in | Why |
|---|---|---|
| Chart specs, diagram sources, presentation plans | `ai-editorial-system` | The spec **is** the artifact; it must be diffable and reviewable |
| Rendered SVG, brief, deck source | `suengj-com` alongside the article | Delivery format; small, text, cacheable by the existing CDN |
| Review records, source manifests, eval runs | `ai-editorial-system` | Execution evidence, referenced by path, never copied to the site |
| Raw sources | Drive / project repos | Never either repo — charter rule |

Rendered SVG is served as a static asset by the existing Cloudflare Pages
build (`pages_build_output_dir: ./dist`). Stable URLs, CDN caching, and
invalidation-on-deploy already work; nothing new is required.

## Editable source vs delivery artifact

They are already separate, and the separation is load-bearing rather than
tidy:

```text
spec (editorial repo)  →  render  →  delivery asset (site repo)
```

The spec is versioned where it is reviewed; the rendered file is versioned
where it is served. Regeneration produces the delivery asset from the spec at
a recorded renderer version, so the two never need to be reconciled by hand —
and a delivery asset can be deleted and rebuilt without losing anything.

## Stable asset identity

Identity is the `artifact_id` — `art:<slug>#<kind>[.<variant>]` — not the
filename. This is the same rule as source identity and article lineage:
**renaming or moving a file changes its location, never its identity.**

`relocate()` already enforces this in code, and the handoff receipt carries
`artifact_id`, `kind`, `staleness`, and `location` as separate fields so a
consumer never has to parse a path to learn what something is.

## The threshold that would change this

This decision is measured, so it comes with the measurement that would
overturn it. Move to object storage when **any** holds:

| | Trigger |
|---|---|
| **ST-1** | A single artifact exceeds 2 MB — the charter's binary ceiling |
| **ST-2** | Total artifact bytes in either repo exceed ~50 MB |
| **ST-3** | An artifact class is genuinely binary and regenerated often — in practice, audio or video |
| **ST-4** | An artifact needs to be served without a site deploy |

ST-3 is the realistic one, and it is already gated: audio is deferred and
video rejected for now (SUE-456). **The storage question is downstream of the
format question**, which is why this decision is easy today.

## Migration path, if a trigger fires

The design already permits it without a rewrite:

1. `location.kind` on the artifact is an enum that already includes
   `suengj_com_asset` and `drive`; adding `r2` is a schema addition, not a
   restructuring.
2. Identity is `artifact_id`, so moving storage does not change any reference.
3. Lineage lives in `article_ref`, not in the path, so it survives the move —
   `relocate()` is the operation and it is already tested.
4. Specs stay in Git regardless. Only *delivery* assets would move.

The migration would be a location change for one artifact class, not an
architecture change.

## Orphan and stale cleanup

Deliberately conservative, because deleting evidence is worse than keeping
bytes at this scale:

- **Materially stale delivery assets** are regenerated or retired. They may not
  remain published — enforced by the lineage classifier.
- **Superseded delivery assets** are deleted from the site repo once the
  replacement is published. Git retains the history.
- **Specs are never deleted.** They are the record of how an artifact was
  produced, and they cost bytes measured in hundreds.
- **Nothing is auto-deleted.** Cleanup is a human action on a reported list —
  the same reason no tool in this system moves or deletes a source file.

## Rights and public/private separation

Every artifact in either repo is public. Anything whose rights are unclear
never becomes an asset at all: the visual rights record forces
`embedded: false` for `rights_basis: unclear`, so it is referenced by link and
never stored. Private material is excluded upstream by the charter and never
reaches a storage decision.

## Summary

**Simplest viable option, chosen because it is measurably sufficient:** Git
for everything, served by the existing Cloudflare Pages build. Revisit at a
named threshold, with a migration path that is a location change rather than
a rewrite.
