# Journey Envelope Contract

Status: **V1 reference contract**
Owner: SUE-790
Schema: [`journey-envelope.schema.json`](journey-envelope.schema.json)

## Purpose and boundary

The journey envelope is a small persisted reference record for one recoverable
editorial journey across `suengj/intelligence-library`,
`suengj/ai-editorial-system`, and `suengj/suengj-com`.

It stores references and digests only. It contains no article, dossier,
evidence, source, capture, image, prompt, or publication-payload body. It
creates no database, vector store, queue, publication Writer path, image
materializer, deployment path, or publication engine. Its only persistence is
the reference-only file writer described under "Writing the envelope".

The envelope never grants approval or sets publication status.
`approved_revision` and each `visual_approval` only record an owner decision
made elsewhere. Publication, deployment, and live verification remain with the
existing downstream system.

## Identity chain

A complete envelope and the independently resolved record metadata reconstruct:

```text
candidate slug + exact ledger ref + valid human selection
  -> exact derived dossier ref
  -> exact article revision
  -> editorial review ref
  -> handoff receipt ref and its ordered artifact digests
  -> publish and per-asset owner-decision refs
  -> publication run
  -> source commit
  -> deployment record
  -> exact LIVE_VERIFIED result + its record ref
```

`journey_binding_sha256` cross-binds the complete candidate, dossier, and
article reference objects. Its payload is canonical JSON:

```json
{
  "format_version": "journey-identity-binding/1",
  "candidate": {},
  "dossier": {},
  "article_ref": {}
}
```

Object keys are recursively sorted before UTF-8 JSON serialization and bare
lowercase SHA-256 hashing. Changing a dossier commit, path, or digest while
retaining the old binding returns `STALE_REVISION`. Dossier filenames are
exactly `<candidate-slug>.md` or `<candidate-slug>-YYYY-MM-DD.md` with a real
calendar date; prefix matches are not identity.

The handoff receipt remains authoritative for fields it already owns, including
article identity and artifact identity/location. The envelope stores one
`handoff_receipt_ref` and only the decision-required ordered digests plus
receipt indices. `validateJourneyReferences()` resolves separately persisted
record bytes, verifies their `content_sha256`, and requires exact agreement
across the candidate ledger, dossier, review, handoff, approvals, publication,
deployment, and live read-back.

Every file `record_ref` requires `content_sha256`. JSON record digests are bare
lowercase SHA-256 over recursively key-sorted canonical JSON; non-JSON record
digests are SHA-256 over the raw bytes. JSON is rejected before
canonicalization if any object contains duplicate keys, including escaped
spellings of the same decoded key.

## Two distinct, self-binding approvals

Every recorded approval carries `binding_sha256`. The decision-time digest is
computed over this canonical JSON payload:

```json
{
  "format_version": "journey-approval-binding/1",
  "article_revision": {
    "article_id": "...",
    "version_number": 1,
    "content_hash": "...",
    "claims_hash": "..."
  },
  "ordered_asset_digests": ["..."]
}
```

Validation recomputes the digest from the values currently stored beside the
external decision reference. Reusing an old `record_ref` while rewriting the
article tuple, asset lineage, or digests therefore returns `STALE_REVISION`.
The independently resolved decision record must carry the same binding digest,
so recomputing only the envelope cannot replace the external owner decision.
Both assessment functions require the hash-verified decision record and compare
it to the immutable `record_ref`, article tuple, ordered digest set, and binding
digest before treating the recorded approval as usable.

### Publish-gate binding

`approved_revision.binding_sha256` binds the exact article tuple and the whole
ordered asset digest set. `asset_digest_set_hash` separately remains the bare
SHA-256 of the UTF-8 bytes of `JSON.stringify(asset_digests)` and is order
sensitive.

`assessPublishGate()` honors the envelope's current `article_ref` and state.
Any article tuple change or asset substitution, addition, removal, or reorder
returns `STALE_REVISION`. A `STALE_REVISION` envelope refuses even when a caller
supplies the old approved tuple.

### Per-asset visual binding

Each `visual_approval.binding_sha256` independently binds that visual's own
article lineage and the one-element ordered set containing its asset digest.
`assessAssetApproval()` calls the unchanged
`scripts/lib/lineage.mjs` `classifyArtifact()`:

- `fresh` preserves approval for unchanged bytes;
- `cosmetic` preserves the unrelated visual approval without regeneration;
- `material` returns `STALE_REVISION`; and
- `unknown` fails safe with `STALE_REVISION`.

A text-only revision therefore invalidates the publish-gate decision while an
unrelated visual decision remains valid. A changed asset digest inherits no
approval under either binding.

## State, restart, and terminal outcomes

Progress records are ordered:

```text
RECEIVED -> SELECTED -> DRAFT_READY -> IN_REVIEW -> APPROVED_REVISION
  -> ASSETS_LOCKED -> PUBLISH_ACCEPTED -> SOURCE_COMMITTED
  -> ARTIFACT_DEPLOYED -> LIVE_VERIFIED
```

The validator derives the last completed stage from the contiguous records
actually present. Persisted `state` and `last_good_state` labels must equal that
derived stage; labels cannot make absent or rewritten records authoritative.
For an interruption, `last_good_state` must still equal the derived stage.

`recoverJourneyState()` reads only persisted bytes. `resumeJourney()` selects
and invokes one supplied observation adapter for a resumable interruption. The
mapping exposes no text generation, asset regeneration, approval, locking, or
publication operation, and identical persisted bytes yield the same
idempotency key on replay.

`NO_ARTICLE` is terminal after `SELECTED`: it cannot carry dossier, article,
review, approval, asset, publish, source, deployment, or live fields, and its
recovery has no resume point. `NEEDS_EVIDENCE` and the blocked interruption
family remain resumable from their derived last-good state.

Selection requires a non-blank `selected_by` and a real calendar date. A null
selection cannot advance past `RECEIVED`; violations return
`SELECTION_REQUIRED`.

## Exact SUE-789 interoperation

The envelope records the literal result returned by
`suengj-com@a4e9022` `verifyLivePublication()`:

```json
{
  "state": "LIVE_VERIFIED",
  "article_url": "https://...",
  "article_body_sha256": "sha256:<64 lowercase hex>",
  "media_url": "https://...",
  "media_sha256": "sha256:<64 lowercase hex>"
}
```

The media fields are optional as a pair. `live_verification_ref` separately
points to the persisted read-back record. Prefixed live and publication-receipt
digests are not normalized into the envelope's bare internal decision digests.
The publication manifest's `expected_article_sha256` remains bare, while the
materialization receipt's `production_sha256` and live result digests remain
`sha256:`-prefixed. Exact form mismatches return `HANDOFF_INVALID`; a live media
digest that disagrees with the receipt returns `MEDIA_DIGEST_MISMATCH`.
`expected_source_sha` is exactly 40–64 lowercase hex, matching the merged
SUE-789 downstream contract.

When live media is present, the materialization receipt must also carry its
`master_sha256`. The envelope's optional `media_binding` copies the
`master_sha256` → `production_sha256` pair from that receipt. Validation
requires the master (after removing only its `sha256:` prefix) to equal one of
the ordered, owner-approved `asset_bindings[].asset_sha256` values, and requires
the production digest to equal both the receipt and live read-back. A read-back
whose derivative has no approved master mapping fails with
`MEDIA_DIGEST_MISMATCH`. Old records without media read-back remain valid; a
media read-back without this lineage proof does not.

### Per-visual claim dependencies (SUE-787 F13)

An `asset_bindings[]` entry may carry `claim_ids` for the claims asserted by
that visual. On a revision with a verified `changed_claim_ids` set, only a
visual whose `claim_ids` intersects that set is stale. A visual with no
`claim_ids`, or a revision without `changed_claim_ids`, keeps the existing
whole-article invalidation behavior. The change set must come from an upstream
comparison of the exact old and new claims; this envelope records the supplied
set but cannot independently prove the claim diff from its digest alone.
Existing envelopes remain schema-valid because both fields are optional.

## Authority and refusal rules

`REFERENCE_AUTHORITIES` is the single declarative registry for every durable
pointer family. Candidate and dossier refs are authoritative only in
`suengj/intelligence-library`; review, handoff, visual-decision, and interruption
reason refs only in `suengj/ai-editorial-system`; publish decision/run, source,
deployment, and live refs only in `suengj/suengj-com`. An unknown repository
returns `HANDOFF_INVALID`.

An `intelligence_dossier` is derived scaffolding. Assigning it the `primary`
evidence role returns `derived-evidence-role`. Named downstream refusals remain
unchanged: `STALE_REVISION`, `MEDIA_DIGEST_MISMATCH`,
`ARTICLE_ANCHOR_MISSING`, `GIT_CONCURRENT_UPDATE`, and
`DEPLOYMENT_PARTIAL`.

### Record resolution boundary

References into `suengj/ai-editorial-system` are resolved from the exact local
Git object named by `commit:path`; a missing object or digest mismatch returns
`HANDOFF_INVALID`. This module does not fetch another repository. For
`suengj/intelligence-library` and `suengj/suengj-com`, the caller must supply
`resolveExternalRecord(ref)`, which returns raw JSON bytes/text or raw non-JSON
bytes for that exact ref. Returning a parsed object is invalid. A missing
resolver, unavailable external record, or unresolved external path returns
`BLOCKED_TRANSPORT`; validation and recovery never silently retain
`LIVE_VERIFIED`.

The committed record-bundle adapter exists for deterministic fixtures and SIT
inputs; it is not a source of external authority. If a caller controls both the
envelope and the supplied records, no purely local comparison can be
authoritative. That is precisely why unresolved references fail closed here
and why authentic cross-repository byte resolution is deferred to the SUE-787
system-integration tests rather than certified by this envelope implementation.

All entry points use one shared verification path: it resolves and digest-checks
references, then checks the resolved decision, review, receipt, publication,
deployment, and live records against the envelope bindings. Validation,
restart recovery, reference reconstruction, and assessment therefore cannot
disagree about whether a completed journey is supported. Local Git resolution
accepts only a 7-40 character lowercase-hex commit id before invoking `git
show`; revision expressions such as `^{tree}`, `HEAD`, and `main` return
`HANDOFF_INVALID`.

For every JSON record expected by the identity chain, a successful byte/digest
resolution is only a transport result: the resolved value must still be a
non-null JSON object. A primitive, array, or missing parsed record returns
`HANDOFF_INVALID` through the shared path. The exported `deriveProgressState()`
also runs that path before reporting any state, and a CLI invocation using
`--records` must include an envelope input.

## Writing the envelope (SUE-1659)

The core module only validates and reads. A small, separate layer persists
transitions between steps: `scripts/lib/journey-envelope-writer.mjs`, driven by
`scripts/journey-envelope.mjs` (`npm run journey -- <command>`). It adds no
database, queue, or service and keeps the reference-and-digest-only boundary: it
records refs to decisions made elsewhere and never grants approval, publishes,
or deploys.

There is **no second state machine**. The core already derives the progress
state from the records present and rejects any `state` / `last_good_state` label
that disagrees. A transition therefore means: merge the supplied evidence refs
into a copy, relabel it, and run the core validator on the result. Whatever the
validator refuses is never written; the validator's named code is returned.

| Command | Effect |
|---|---|
| `init --file F --slug S --ledger-ref ref.json` | Create a `RECEIVED` envelope (unselected candidate). |
| `transition --file F --to STATE [--evidence e.json]` | Record evidence refs and advance, or resume from a pause. |
| `interrupt --file F --code CODE [--reason-ref ref.json]` | Record a typed pause through the core `recordInterrupt`. |
| `show --file F [--json]` | Recover the state with the core reader; exit 1 on any invalid file. |

`--evidence` is a JSON object keyed by envelope field (`dossier`,
`article_ref`, `review_ref`, `approved_revision`, `handoff_receipt_ref`,
`asset_bindings`, `publish_run`, `source_commit`, `deployed_artifact`,
`live_verification_ref`, `live_verification`) plus `selection`, which fills
`candidate.selection`. Because the selection is recorded in a later ledger
commit, `ledger_ref` may be re-pointed to that commit, but only in the same
transition as `selection` while the candidate is still unselected; afterwards it
is immutable like every other field. `journey_binding_sha256` is always derived
by the writer when `dossier` and `article_ref` first arrive; supplying it as
evidence is refused. `state`, `last_good_state`, `updated_at`,
`interruption`, and unknown fields are writer-controlled or refused. External
refs need a resolver, exactly as for validation: `--records bundle.json` and/or
`--repo owner/name=<local clone>` (read with `git show`); with neither, they
fail closed with `BLOCKED_TRANSPORT`. Pass `--at <ISO time>` for a
deterministic `updated_at`; a value earlier than the recorded `updated_at` (or
one that does not parse) is refused, because `updated_at` never moves backwards.

Guarantees:

- **Append-only, forward-only.** An evidence field that is already recorded may
  be re-supplied only with identical content; a different value is refused.
  Progress never moves backwards: any request for an
  earlier state (for example `--to RECEIVED` on a `LIVE_VERIFIED` envelope) is
  refused, whether or not it carries evidence; only an identical replay of the
  current state is a no-op. A jump over several stages is accepted only
  when every intermediate record is supplied and verifies.
- **Idempotent.** An identical duplicate `transition`, `interrupt`, or `init`
  exits 0 with `"result": "unchanged"` and does not touch the file (so
  `updated_at` is not bumped).
- **Pause and resume.** `transition` from a resumable pause (not `NO_ARTICLE`,
  which stays terminal) removes the `interruption` record; `--to` the pause's
  last good state clears it, a later state advances. A `STALE_REVISION` pause is
  accepted only with observable drift, as for the core, and replacing a
  recorded `article_ref` is not supported by this writer.
- **Atomic.** Writes use an exclusive `<file>.lock`, a same-directory temp file
  (fsync), a read-back through the validator, `rename`, then a best-effort
  fsync of the directory so the rename survives power loss. A lock that cannot
  be created for any reason other than an existing lock (for example a missing
  directory) is reported as such, not as another writer. A rejected result
  never replaces the target and leaves no temp file.
- **Fail closed.** A missing, empty, truncated, duplicate-keyed, symlinked,
  relabelled, or digest-tampered file is refused before any write, and the file
  is left byte-for-byte as found.

### Vocabulary alias (SUE-787 F14)

The downstream publication-state reader calls the stage `SOURCE_MERGED`. The
writer CLI accepts `--to SOURCE_MERGED` as an alias of `SOURCE_COMMITTED` and
always persists and reports `SOURCE_COMMITTED`. The schema, the state list, and
the validator are unchanged — no existing state is renamed. `DISCOVERY_NOTIFIED`
is not an envelope state: discovery notification has no record in this journey
contract and would precede `RECEIVED`, so it does not fit the ordered evidence
model. No existing states are renamed.

## Validation

```bash
npm run validate:journey
npm run test:journey
npm run test:journey-writer

# A custom envelope also requires its resolved-record bundle.
node scripts/validate-journey-envelope.mjs path/to/envelope.json \
  --records path/to/resolved-records.json
```

The validator uses the repository's JSON-schema-lite validator and the
committed allow/deny fixture pair. Regression negatives start from a
validator-clean baseline and assert a named failure code. Cross-record tests
resolve raw records, recompute content hashes, and compare independently
persisted metadata rather than cloning the envelope.
