# references/

Attributed pointers to third-party material: title, creator, publisher, URL,
retrieval date, rights, and our notes.

[`catalog.json`](catalog.json) is the live catalog, governed by
[`../schemas/reference-catalog.schema.json`](../schemas/reference-catalog.schema.json)
and the policy in [`../editorial/RIGHTS-AND-PROVENANCE.md`](../editorial/RIGHTS-AND-PROVENANCE.md).

Every entry declares its rights explicitly. The governing rule is
**fail to reference**: when rights are unclear the entry is link-only, names
no license, and carries no local copy. Copying requires an identified,
compatible license plus attribution and a `local_path` naming what was
reproduced.

Referenced works are never mirrored. See `../NOTICE`.

```bash
npm run validate:rights
npm run test:rights
```
