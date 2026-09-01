# schemas/

Source, Article, and Artifact schemas plus lineage and staleness rules.

| Contract | Status |
|---|---|
| [`SOURCE-CONTRACT.md`](SOURCE-CONTRACT.md) + [`source.schema.json`](source.schema.json) | AES-P0.2 (SUE-435) |
| Article + Artifact contracts | AES-P0.3 (SUE-436) — in progress |

Every artifact tracks the article version/hash and the generator/skill version
that produced it, so staleness is decidable when the article changes.

Admits: JSON Schema and contract documents, plus examples built from synthetic
or public material (`examples/`).
Rejects: populated instance data from real private sources.

```bash
npm run validate:source
npm run test:source
```
