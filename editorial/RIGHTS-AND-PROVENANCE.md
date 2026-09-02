# Rights and provenance policy (AES-P0.4 / SUE-437)

Editorial and licensing rules for source-derived writing, external references,
and generated media.

Not legal advice and not a clearance service. It is an operating policy with
one governing rule:

> **Fail to reference.** When rights are unclear, link to the material. Never
> copy on an assumption, and never let "probably fine" decide.

Machine contracts: [`../schemas/reference-catalog.schema.json`](../schemas/reference-catalog.schema.json),
plus the `transformation` and `visual` blocks in the Article and Artifact
schemas. Enforcement: `npm run validate:rights`.

## 1. Transformation — source-derived articles

Most of the estate is transcript-derived: daily YouTube summaries, market
briefs, and research drafts. These are inputs to thinking, never bodies to be
reshaped and republished.

**Prohibited: transcript-shaped output.** A piece that follows the source's
order, keeps its section breaks, or paraphrases it line by line is a
republication wearing different words, regardless of how much it was reworded.

Every materialized article carries a `transformation` record:

```yaml
transformation:
  transcript_shaped: false     # true blocks materialization outright
  original_framing: true       # the thesis and structure are ours
  synthesis_note: "What this article does that the sources do not."
  attribution: "How the sources are credited in the body."
```

The validator refuses `final`, `published`, and `revised` when
`transcript_shaped` is true or `original_framing` is not true.

What counts as transformation:

- A thesis the sources do not state.
- Structure derived from the argument, not from the source's running order.
- Synthesis across sources, including sources that disagree.
- Our own verification of the numbers, dates, and quotations.

What does not:

- Summarising one source more briefly.
- Reordering its sections.
- Translating it.
- Adding a conclusion paragraph to someone else's argument.

## 2. Citation and provenance by source type

| Source type | Minimum in the published piece |
|---|---|
| `youtube_summary` | Creator/channel and video title, linked. No transcript text reproduced. Quoted speech limited to what the point requires, attributed to the speaker. |
| `market_brief` | Data provider and observation date. Figures traced to the primary series where one exists. |
| `research_draft` | Not cited as a source — it is our own working note. Its *underlying* sources are cited. |
| `project_repo` | Repository and commit. Code excerpts carry the repo's license. |
| `web_reference` | Publisher, author, title, URL, retrieval date. |
| `dataset` | Provider, dataset name, version or vintage, licence, access date. |

Provenance in the manifest (`source.schema.json`) is the record; citation in
the body is the reader-facing obligation. Both are required — one does not
substitute for the other.

## 3. Visual classes

Every `evidence_visual` and `infographic` artifact carries a `visual` record.

| `visual_class` | Whose work | Rule |
|---|---|---|
| `generated_chart` | Ours | `rights_basis: own_work`. Underlying facts must still cite their sources via `source_references`. |
| `generated_diagram` | Ours | Same. A diagram of someone else's model credits the model. |
| `screenshot` | Theirs | `licensed` or `quotation` only. Attribution required when embedded. Crop to what the point needs. |
| `thumbnail` | Theirs | Same, and never as decoration. A thumbnail used to identify a source is quotation; one used to make a page look busy is not. |
| `source_image` | Theirs | `licensed` requires a named license. Otherwise link. |
| `remix` | Mixed | Treated as theirs. Derivation does not launder the underlying rights. |

`rights_basis: unclear` forces `embedded: false` — the visual may be
referenced by link and never reproduced in our surface.

**A generated chart is not rights-free.** It is our expression of someone
else's facts. The expression is ours; the facts still need provenance. This is
why `evidence_visual` requires `source_references` resolving to verified
claims.

## 4. Generated media provenance

Every artifact records `generator: {skill, tool}` and the exact article
version it derives from (`ARTICLE-ARTIFACT-CONTRACT.md`). For generated media
specifically:

- AI assistance is disclosed on the article per the `suengj-com` contract's
  `ai_assistance` block.
- A generated visual that depicts external facts carries those facts'
  citations, not merely a note that it was generated.
- Generated audio/video carries the same `source_references` obligation for
  every factual claim it speaks or depicts.
- Generated audio or video reproducing a third party's voice, likeness, or
  distinctive style is out of scope for this system. Not a rights question we
  intend to litigate.

### Generated voice provenance

A TTS provider's voice catalog, cloning workflow, consent checkbox, or identity
verification is **not editorial rights authority**. It tells us what that
provider will technically accept under its product rules; it does not decide
what this publication may represent as a voice.

For every production audio artifact, the rendering lineage should identify the
voice provenance class even while the current Artifact schema has no dedicated
`voice` block. Until such a block is justified by implementation evidence,
record this in artifact/render notes rather than expanding the schema
speculatively.

Recommended provenance classes:

| Voice class | Policy |
|---|---|
| `provider_stock` | Allowed subject to provider terms and required AI-audio disclosure. Record provider voice ID/version where available. |
| `synthetic_designed` | Allowed when the voice is generated as a non-identifying synthetic identity. Record the generation/design source. |
| `owner_cloned` | Allowed only with explicit owner control/consent and the provider's required verification flow. Preserve the consent/provenance record privately. |
| `licensed_voice_actor` | Requires an explicit licence/consent basis covering synthetic use; provider acceptance alone is insufficient. |
| `third_party_imitation` | Out of scope — public figure, creator, colleague, expert, or other identifiable third-party imitation is not used. |

Provider mechanics differ and change. Current official documentation observed
for Google Cloud, ElevenLabs, and OpenAI includes provider-specific custom-voice
consent or verification flows; see
[`../benchmarks/AUDIO-TTS-PROVIDERS.md`](../benchmarks/AUDIO-TTS-PROVIDERS.md).
Those controls are additive to this policy, never substitutes for it.

### Consent records are not public artifacts

Consent recordings, raw cloning samples, identity-verification audio, and
provider verification material can themselves be sensitive media. They do not
belong in this public repository and do not become a distribution artifact.
Store only the minimum lineage/reference needed to prove that an authorised
process occurred; the actual sensitive source stays in an appropriate private
system.

### Disclosure

If a provider requires disclosure that speech is AI-generated, that requirement
must survive into the publication surface. The publication may choose a broader
disclosure rule than the provider requires. A provider requiring less never
weakens the publication rule.

The canonical audio-script and rendering boundary is defined in
[`AUDIO-SCRIPT.md`](AUDIO-SCRIPT.md).

## 5. Reference and benchmark catalog

`references/catalog.json` records everything we study. Every entry declares
its rights explicitly — there is no default and no blank.

| Field | Why it exists |
|---|---|
| `url`, `creator`, `kind`, `observed_at` | Attribution and recency |
| `rights_status` | `clear` or `unclear` — the fail-to-reference switch |
| `license`, `license_compatible` | Whether it may enter an MIT / CC BY 4.0 repository |
| `copy_status` | `linked` / `quoted` / `copied` |
| `local_path` | What was reproduced, when anything was |
| `verdict`, `observations` | Why we bothered: adopt, adapt, avoid, monitor |

Enforced invariants:

1. `rights_status: unclear` ⇒ `copy_status: linked`, no license named, no
   compatibility asserted.
2. `copy_status: copied` ⇒ identified license **and** `license_compatible:
   true` **and** attribution **and** `local_path`.
3. `copy_status: quoted` ⇒ attribution.
4. `copy_status: linked` ⇒ no `local_path`. The repository is not a mirror.

### Third-party Skills, docs, and examples

Studying another project's Skill does not entitle us to vendor it. A Skill,
prompt, or example enters this repository only as a `copied` catalog entry
under a compatible license with attribution. Otherwise we record what we
learned and write our own — that is what `verdict: adapt` means.

## 6. What this policy does not do

- It does not clear rights. An entry marked `clear` reflects our reading, not
  a legal determination.
- It does not detect infringement automatically. The validator checks that we
  *declared* something coherent, not that the declaration is true.
- It does not permit bulk media ingestion. See the "Never committed" list in
  `../docs/architecture/REPOSITORY-CONTRACT.md`.
