# evals/

Golden corpus references, negative fixtures, the editorial rubric, and the
regression method.

| Fixture | Purpose |
|---|---|
| `fixtures/negative/N-01-sue-417-shape.md` | The SUE-417 failure shape: prompt echo, verbatim repetition, scaffolding leakage, formulaic sectioning, hedged non-statement, single-source-in-order citation |
| `fixtures/golden/G-01-synthesis.md` | The shape a passing article has: thesis first, synthesis across disagreeing sources, numbers rather than adjectives, a stated limit |

Fixtures are body-only — no front matter — so they are fixtures and not
articles. They reproduce failure and success *shapes*, not original text.

Both directions are required. A gate suite that only fires on bad text proves
nothing about good text, so every run asserts that the golden fixture produces
no findings at all.

Expanded by AES-P3.1 (SUE-449); scored by the rubric in AES-P3.2 (SUE-450).

Admits: synthetic or publicly sourced, attributed fixtures.
Rejects: raw transcript corpus, private research working set.
