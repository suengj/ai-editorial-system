# schemas/

Source, Article, and Artifact schemas plus lineage and staleness rules.

Every artifact tracks the article version/hash and the generator/skill version
that produced it, so staleness is decidable when the article changes.

Admits: JSON Schema and contract documents.
Rejects: populated instance data from real private sources.

Defined by AES-P0.2 (SUE-435) and AES-P0.3 (SUE-436).
