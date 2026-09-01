# Cross-repo handoff contract (AES-P6.1 / SUE-459)

What `ai-editorial-system` hands to `suengj-com`, and the smallest mechanism
that carries semantic presentation without making HTML part of the editorial
contract.

Machine contract:
[`../../schemas/handoff-receipt.schema.json`](../../schemas/handoff-receipt.schema.json).
Engine: `../../scripts/lib/handoff-core.mjs`. Run: `npm run handoff`.

## The one rule everything else serves

**The canonical article is the deliverable. Everything else is optional.**

A handoff with zero artifacts and no presentation block is complete and valid.
If every artifact were deleted and the sidecar stripped, the published article
would read exactly the same. That is the property the rest of this document
protects.

## What travels, and how

| Data | How it travels | Why |
|---|---|---|
| Article body | Copied into canonical Markdown | It *is* the article |
| type, title, date, status | Copied into front matter | The site's existing contract |
| Provenance (version, hashes, commit) | Copied into front matter | Small, stable, useful to a reader |
| Citations | Copied into front matter | Reader-facing evidence |
| Artifacts (brief, sources, visual, slides) | **Referenced** by id, kind, staleness, location | The site is not a mirror of our build outputs |
| Semantic roles | **Sidecar** with text anchors | See below |
| Review record, source manifest, eval runs | **Referenced by path only** | Execution evidence stays here |

Nothing copied into front matter requires our code to interpret. Enforced: a
receipt whose front matter references editorial-system internals is rejected.

## The serialization decision

`suengj-com` today is `gray-matter` + `marked` with GFM, no MDX and no
Markdoc. Four candidates were considered against a smallest-compatible-change
bias:

| Candidate | Verdict |
|---|---|
| **Front-matter sidecar with text anchors** | **Chosen** |
| Markdown directive (`:::key_point`) via a `marked` extension | Rejected for V0.1 |
| Markdoc | Rejected — a migration |
| MDX | Rejected — a migration, and it invites components into content |

**Why the sidecar wins.** The body stays plain Markdown that the existing
pipeline already renders correctly. No `marked` extension, no parser change,
no build risk. A renderer that ignores the sidecar entirely produces today's
output — the change is needed to make the feature *useful*, not to make it
*safe*.

The directive syntax was the close second and lost on the fallback property:
without the extension, `:::key_point` renders as literal text in the body. The
information survives, but the plain-Markdown fallback stops being clean, and
"clean fallback" is the guarantee the presentation contract is built on.

**How anchoring works.** Each block carries a `role` and an `anchor` — exact
text from the body that must match **once**.

```yaml
presentation:
  schema_version: 1.0.0
  blocks:
    - role: key_point
      anchor: "가격이 내려간 것은 **list price**이고, 마진을 결정하는 것은 seat당 실제 소비량이기 때문이다."
```

Anchoring by text rather than by index means an edit elsewhere in the article
cannot silently reassign a role to the wrong paragraph. An edit *to* the
anchored text unresolves the block, which is the correct outcome: the role was
assigned to a sentence that no longer exists.

## Degradation is the design

Every failure mode ends with a readable article:

| Situation | Behaviour |
|---|---|
| Anchor does not match | Block dropped; paragraph renders as plain prose |
| Anchor matches more than once | Block dropped — never guessed at |
| Role unknown to the renderer | Degrades to plain content |
| Sidecar major version unknown | **Whole sidecar ignored**, article renders normally |
| Artifact missing | Article unaffected; the artifact simply is not shown |
| Artifact stale | **Handoff refused** before the site ever sees it |

`resolvePresentation()` never throws. A renderer must not fail a build over
presentation metadata, and this one cannot.

The strict check is on *our* side: `validateReceipt` reports every dropped
block, so a broken anchor is caught before a `suengj-com` change is opened
rather than discovered as a silently missing callout.

## Version compatibility

`schema_version` on the receipt, and again on the presentation sidecar.
`suengj-com` declares which majors it accepts; anything else is **refused, not
guessed at**.

- Minor version change → additive, safe to accept.
- Major version change → refused with a named reason.
- Unknown role inside an accepted major → degrades to plain content.

This is what stops schema evolution here from silently breaking a site build
there.

## Stale artifacts cannot masquerade as current

Only artifacts classifying `fresh` or `cosmetic` are eligible for handoff.
`material` and `unknown` are rejected by the receipt validator, before the
change reaches `suengj-com` at all.

The receipt carries each artifact's staleness level explicitly, so the site
does not have to re-derive it — and per the lineage procedure, it must not
infer currency from a file existing.

## Publication authority does not move

`target.status` is `const: "draft"`. The handoff produces a draft; a human in
`suengj-com` decides publication, exactly as the existing content contract
requires. Nothing in this receipt can set `published`, and there is no field
for an approver.

## No reader-side runtime dependency

A published article renders from its Markdown and front matter alone. Nothing
in this contract requires `ai-editorial-system` to be installed, running, or
reachable — for a new article or for any already published. Enforced by the
receipt validator.

## The handoff receipt

```bash
npm run handoff          # build and validate
npm run handoff -- --check   # fail if the committed receipt would change
```

Worked example: [`../../evals/poc/handoff-receipt.json`](../../evals/poc/handoff-receipt.json).

It is checked before a `suengj-com` change is opened. A receipt that fails is
not a handoff.

## What is deliberately not decided here

- No frontend component implementation — SUE-460.
- No design tokens, no colour, no accessibility rendering — SUE-460.
- No asset storage or delivery decision — SUE-461.
- No MDX or Markdoc migration. If the sidecar proves limiting in practice, the
  directive route is the next step to evaluate, not a rewrite.
