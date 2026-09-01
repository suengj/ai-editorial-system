# editorial/

Editorial Constitution, Suengj voice, content-type profiles, and executable
quality gates.

| Document | What it governs | Issue |
|---|---|---|
| [`constitution.md`](constitution.md) | Ten durable principles, with a precedence order for when they collide | AES-P1.3 (SUE-440) |
| [`voice.md`](voice.md) | How the sentences sound — derived from published writing, not invented | AES-P1.3 (SUE-440) |
| [`quality-gates.md`](quality-gates.md) + [`quality-gates.json`](quality-gates.json) | Executable reject / fix / flag conditions | AES-P1.3 (SUE-440) |
| [`profiles/`](profiles/) | Evidence burden, required fields, and artifact fit per content type | AES-P1.4 (SUE-441) |
| [`MEDIA-STRATEGY.md`](MEDIA-STRATEGY.md) + [`artifact-priority.json`](artifact-priority.json) | Evidence vs distribution media, build-out order, and what would change it | AES-P1.5 (SUE-442) |
| [`RIGHTS-AND-PROVENANCE.md`](RIGHTS-AND-PROVENANCE.md) | Transformation, citation, visual rights | AES-P0.4 (SUE-437) |

The separation is deliberate. Principles are durable, voice is prose-only,
gates are executable, structure lives only in the profiles. A rule that is not
load-bearing across all five content types does not belong in the
constitution.

```bash
npm run check:gates     # editorial gates over the golden fixture
npm run check:profile   # worked example against its content-type profile
npm run test:gates      # negative fires, golden passes, polish invariants hold
npm run test:profiles   # profiles differ; media strategy holds
```

Admits: Markdown rules, machine-readable gate and profile definitions.
Rejects: article prose, examples containing private material.
