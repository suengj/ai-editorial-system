# schemas/

Source, Article, and Artifact schemas plus lineage and staleness rules.

| Contract | Machine schema | Issue |
|---|---|---|
| [`SOURCE-CONTRACT.md`](SOURCE-CONTRACT.md) | [`source.schema.json`](source.schema.json) | AES-P0.2 (SUE-435) |
| [`ARTICLE-ARTIFACT-CONTRACT.md`](ARTICLE-ARTIFACT-CONTRACT.md) | [`article.schema.json`](article.schema.json), [`artifact.schema.json`](artifact.schema.json) | AES-P0.3 (SUE-436) |
| [`ANSWER-UNIT-CONTRACT.md`](ANSWER-UNIT-CONTRACT.md) | [`article.schema.json`](article.schema.json) `$defs.answer` | AEO-P2.3 (SUE-525) |
| [`../docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md`](../docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md) | [`language-pack.schema.json`](language-pack.schema.json) | AES-V2.17 (SUE-607) |

Content types (`research`, `view`, `news`, `note`, `project`) and artifact
kinds (`brief`, `full`, `sources`, `evidence_visual`, `slides`, `infographic`,
`audio`, `video`) are orthogonal axes.

Every artifact records the article version and the generator/skill version
that produced it, so staleness is decidable: `claims_hash` unchanged means a
prose edit (cosmetic), `claims_hash` changed means the factual substance moved
(material) and the artifact must be regenerated.

Admits: JSON Schema and contract documents, plus examples built from synthetic
or public material (`examples/`).
Rejects: populated instance data from real private sources.

```bash
npm run validate:source && npm run validate:article
npm run test:source && npm run test:article
```
