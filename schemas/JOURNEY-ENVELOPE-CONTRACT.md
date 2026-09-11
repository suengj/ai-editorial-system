# Journey Envelope Contract

Status: **V1 reference contract**
Owner: SUE-790
Schema: [`journey-envelope.schema.json`](journey-envelope.schema.json)

## Purpose and boundary

The journey envelope is a small, persisted reference record that makes one
cross-repository editorial journey recoverable. It links identities that
already exist in `suengj/intelligence-library`, `suengj/ai-editorial-system`,
and `suengj/suengj-com`.

It is not an object store or an execution engine. It contains no article body,
dossier body, evidence body, source/capture body, image bytes, prompt, or
publication payload. It creates no database, vector store, queue, Writer path,
image materializer, deployment path, or publication engine.

The envelope also has no operation that grants approval or sets publication
status. `approved_revision` and each `visual_approval` record the identity,
time, actor, and immutable reference of an owner decision made elsewhere.
Downstream systems remain responsible for accepting or refusing the referenced
handoff and for publishing, deploying, and verifying it.

## Identity chain

A complete envelope reconstructs this chain from references and digests:

```text
candidate slug + pinned ledger revision + human selection evidence
  -> pinned intelligence_dossier source revision
  -> current article_ref (article_id, version_number, content_hash, claims_hash)
  -> handoff_receipt_ref
  -> ordered approved_revision.asset_digests
  -> recorded publish-gate approval
  -> receipt-indexed per-asset visual approvals
  -> publish_run
  -> source_commit
  -> deployed_artifact
  -> live_verification
```

The handoff receipt remains authoritative for fields it already carries:
`article_id`, `body_sha256`, artifact identity/location, visual production
lineage, evidence refs, target, presentation, and production time. The envelope
stores one immutable `handoff_receipt_ref` instead of copying those fields.
`asset_bindings[].receipt_artifact_index` points into the receipt's ordered
`artifacts` array.

The envelope necessarily records `approved_revision.asset_digests`, because
the exact ordered digest set is part of the owner decision being bound. A
per-asset decision separately records `asset_sha256`, because its approval is
bound to those exact visual bytes independently of the publish-gate decision.
The receipt index links both digests to the receipt without copying
receipt-owned artifact identity or location. A validator-clean locked set has
the same current digest under both bindings, but neither approval is inferred
from the other.

## Two distinct bindings

### Publish-gate revision binding

`approved_revision` records:

- `approved_by` and `approved_at`;
- an immutable `record_ref` to the external owner decision;
- the exact `article_ref`;
- `asset_digests` in handoff-receipt order; and
- `asset_digest_set_hash`.

The digest-set hash is the lowercase bare SHA-256 of the UTF-8 bytes of
`JSON.stringify(asset_digests)`. Array order is significant.

`assessPublishGate()` compares the whole article reference and the exact
ordered digest list. Any change to `content_hash`, `claims_hash`, another
article-revision identity field, an asset digest, or asset order returns
`STALE_REVISION` and refuses the gate. Approval is never inferred or inherited.

### Per-asset visual binding

`asset_bindings[]` is separate. Each entry carries the visual's own
`article_ref`, its independently approved `asset_sha256`, an immutable
external owner-decision reference, and a receipt artifact index.
`assessAssetApproval()` calls the existing
`scripts/lib/lineage.mjs` `classifyArtifact()` unchanged:

- `fresh`: the recorded visual approval remains usable when its digest is the
  digest at the bound receipt index;
- `cosmetic`: the article prose changed while `claims_hash` did not, so the
  unrelated visual approval remains usable and no regeneration is triggered;
- `material`: the claims changed, so the visual is not presentable and the
  recorded approval is stale; and
- `unknown`: lineage is incomplete, so the visual fails safe as not
  presentable.

A changed asset digest always returns `STALE_REVISION`, even when lineage is
`fresh` or `cosmetic`. Therefore a text-only article revision invalidates the
publish-gate binding while preserving unrelated per-asset approvals; the owner
may re-approve the new publish revision without regenerating unchanged visuals.

## State and restart

Progress is ordered:

```text
RECEIVED -> SELECTED -> DRAFT_READY -> IN_REVIEW -> APPROVED_REVISION
  -> ASSETS_LOCKED -> PUBLISH_ACCEPTED -> SOURCE_COMMITTED
  -> ARTIFACT_DEPLOYED -> LIVE_VERIFIED
```

Typed interruptions are:

```text
NEEDS_EVIDENCE  NO_ARTICLE  BLOCKED_AUTH  BLOCKED_TRANSPORT
STALE_REVISION  MEDIA_DIGEST_MISMATCH  ARTICLE_ANCHOR_MISSING
GIT_CONCURRENT_UPDATE  DEPLOYMENT_PARTIAL
```

For a progress state, `last_good_state` equals `state`. For an interruption,
`state` and `interruption.code` record the typed pause while
`last_good_state` is unchanged. `recoverJourneyState()` reads only the
persisted JSON bytes and resumes from `last_good_state`; it uses no in-memory
session state.

An interruption is a resume point, never a regeneration trigger.
`recordInterrupt()` can only change `state`, `updated_at`, and `interruption`;
it preserves every article, asset, approval, and external reference and
returns an empty effects list. In particular, `BLOCKED_TRANSPORT` and
`BLOCKED_AUTH` never request text or asset regeneration.

The envelope's `SOURCE_COMMITTED` state maps to the downstream
`scripts/publication-state.mjs` state `SOURCE_MERGED`. Both names retain their
repo-local meanings. Downstream `ARTIFACT_DEPLOYED` and `LIVE_VERIFIED` names
are recorded without granting the envelope deployment authority.

## Authority and refusal rules

- `candidate.selection === null` is valid only at `RECEIVED` (or a
  `NEEDS_EVIDENCE` pause from it). Advancing further returns
  `SELECTION_REQUIRED`.
- `NO_ARTICLE` remains reachable after `SELECTED`; selection never forces an
  article.
- `NEEDS_EVIDENCE` remains reachable and is not converted into prose.
- A dossier is always `source_class: intelligence_dossier`, pinned by repo,
  immutable commit, path, and content digest. Giving that derived source the
  role `primary` returns the existing source-contract code
  `derived-evidence-role`.
- Structural or incomplete identity-chain failures return `HANDOFF_INVALID`.
- The downstream names `STALE_REVISION`, `MEDIA_DIGEST_MISMATCH`,
  `ARTICLE_ANCHOR_MISSING`, `GIT_CONCURRENT_UPDATE`, and
  `DEPLOYMENT_PARTIAL` are preserved exactly.

## Validation

```bash
npm run validate:journey
npm run test:journey
```

The default validator checks the complete allow fixture and proves that the
deny fixture fails with the named `derived-evidence-role` code. The regression
test starts every mutation from a validator-clean baseline and asserts named
failure codes rather than accepting an arbitrary non-empty issue list.
