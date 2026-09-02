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

## The V0.1 set + modality compilers

```text
frame-article → verify-claims → write-article → editorial-polish → human review
                                      ↘ plan-artifacts
                                             ↓
                                  compile-visual-story
                                   ↙                 ↘
                         visual surfaces      compile-audio-script
                                   \                 /
                                    \→ video assembly
```

`plan-artifacts` decides **whether** a derivative is worth building.
`compile-visual-story` runs only for approved multi-surface visual/spoken work
and defines one shared argument-beat graph. `compile-audio-script` remains the
authority for the final provider-neutral listener-first spoken package. None of
these Skills renders anything.

| Skill | Owns | Issue |
|---|---|---|
| [`frame-article`](frame-article/) | The decision to write, or `NO_ARTICLE` | AES-P2.2 (SUE-444) |
| [`verify-claims`](verify-claims/) | What is true and supported | AES-P2.4 (SUE-446) |
| [`write-article`](write-article/) | The draft, arguing the frame's thesis | AES-P2.3 (SUE-445) |
| [`editorial-polish`](editorial-polish/) | How it reads — never what it claims | AES-P2.5 (SUE-447) |
| [`plan-artifacts`](plan-artifacts/) | Which artifacts are worth building | AES-P2.6 (SUE-448) |
| [`compile-visual-story`](compile-visual-story/) | One provider-neutral argument-beat graph and cross-surface mapping for approved slides, infographics, audio selection, and video | Visual-story extension |
| [`compile-audio-script`](compile-audio-script/) | Canonical listener-first narration text plus provider-neutral pronunciation, delivery, segment, and timing state | Audio extension |

The division is the design. Verification decides truth and may block a
finalization; polish decides rhythm and may not touch a protected span; the
human decides publication. Artifact planning decides whether a derivative
exists; visual-story compilation keeps approved multi-surface derivatives
semantically aligned; the audio compiler performs the reading→listening
modality change; renderers produce files. No Skill in this set can publish or
approve.
