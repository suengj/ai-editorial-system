# skills/

Portable Skill definitions. A Skill is an **orchestration contract**: inputs,
outputs, invariants, refusal conditions, and an explicit authority boundary.
The generator that satisfies it is a replaceable worker and is never named
here.

| | |
|---|---|
| Format spec | [`SKILL-FORMAT.md`](SKILL-FORMAT.md) (AES-P2.1 / SUE-443) |
| Canonical shape | [`template/SKILL.md`](template/SKILL.md) |
| Machine contract | [`../schemas/skill.schema.json`](../schemas/skill.schema.json) |

Directory convention follows the Agent Skills open standard so Skills stay
portable across runtimes. Three additions the standard does not require —
`authority`, `evidence`, `when_not_to_use` — because an unenforceable Skill is
not a Skill.

Enforced, not advised:

- **No Skill may publish, approve, or finalize.** Claiming it fails; omitting
  the denial from `authority.may_not` also fails.
- **Missing required context is a refusal.** A Skill that improvises around
  absent input is how a fabrication enters with a clean audit trail.
- **Governing documents are referenced, never restated.** A copied paragraph
  drifts, and a drifted copy silently overrides the original.
- **`allowed_tools` names capability classes, never products.**
- **`SKILL.md` is capped at 500 lines.** Detail moves to `references/` with a
  `load_when` condition.

```bash
npm run validate:skills
npm run test:skills
```

Skills built in AES-P2.2–P2.6.
