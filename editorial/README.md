# editorial/

Editorial Constitution, Suengj voice, content-type profiles, and executable
quality gates.

| Document | What it governs | Issue |
|---|---|---|
| [`constitution.md`](constitution.md) | Ten durable principles, with a precedence order for when they collide | AES-P1.3 (SUE-440) |
| [`voice.md`](voice.md) | How the sentences sound — derived from published writing, not invented | AES-P1.3 (SUE-440) |
| [`quality-gates.md`](quality-gates.md) + [`quality-gates.json`](quality-gates.json) | Executable reject / fix / flag conditions | AES-P1.3 (SUE-440) |
| [`RIGHTS-AND-PROVENANCE.md`](RIGHTS-AND-PROVENANCE.md) | Transformation, citation, visual rights | AES-P0.4 (SUE-437) |
| Content-type profiles | Structure per type | AES-P1.4 (SUE-441) — pending |

The three-way split is deliberate: principles are durable, voice is prose-only,
gates are executable. Structure belongs to the profiles and appears in none of
them.

```bash
npm run check:gates   # run the gates over the golden fixture
npm run test:gates    # negative fixture fires, golden passes, polish invariants hold
```

Admits: Markdown rules, machine-readable gate definitions.
Rejects: article prose, examples containing private material.
