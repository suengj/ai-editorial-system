# Skill format (AES-P2.1 / SUE-443)

A Skill is an **orchestration contract**: it declares what it needs, what it
produces, what must remain true, and what it may not decide. The model or tool
that satisfies it is a replaceable worker.

Machine contract: [`../schemas/skill.schema.json`](../schemas/skill.schema.json).
Canonical shape: [`template/SKILL.md`](template/SKILL.md).
Enforcement: `npm run validate:skills`.

The directory convention follows the Agent Skills open standard
(`ref:agent-skills-spec`), which is adopted structurally so Skills stay
portable across runtimes. Three things are added that the standard does not
require — `authority`, `evidence`, and `when_not_to_use` — because an
unenforceable Skill is not a Skill.

## Directory shape

```
skills/<name>/
  SKILL.md           required — manifest and instructions in one document
  references/        optional — loaded only when a stated condition holds
  scripts/           optional — deterministic helpers
  assets/            optional — templates
```

`name` in the front matter must equal the directory name. Enforced.

## Progressive disclosure

Three tiers, and the tier decides where a sentence lives:

| Tier | Loaded | Holds |
|---|---|---|
| Front matter | always | `name`, `description`, `when_not_to_use`, and the declared contract |
| `SKILL.md` body | when the Skill is selected | purpose, procedure, invariants, refusal conditions |
| `references/*` | only when `load_when` holds | worked examples, edge cases, long tables |

`SKILL.md` is capped at **500 lines**, enforced. Past that, detail moves into
`references/` with a condition attached. A reference file with no condition is
either always needed — in which case it belongs in the body — or never read.

`when_not_to_use` is required. A description that only says when to use a
Skill is how near-duplicate Skills end up chosen by coin-flip.

## Authority precedence

When instructions conflict, the higher entry wins:

1. **Editorial Constitution** — `../editorial/constitution.md`
2. **Content-type profile** — `../editorial/profiles/<type>.json`
3. **Task Skill** — this document
4. **Article-specific source and context**
5. **Human instruction and approval boundary** — outside the stack entirely

Item 5 is not the lowest rung; it is not on the ladder. A human decision is
not overridden by a Skill, and no Skill run produces one.

A Skill **references** the layers above it. It never restates them: a copied
paragraph drifts, and a drifted copy silently overrides the original. This is
enforced — a SKILL.md reproducing a paragraph of the constitution fails.

## Forbidden authority

No Skill may claim, in any phrasing:

- publishing, or setting `status: published`
- approval or sign-off
- finalization

Every Skill must state these in `authority.may_not`. Both directions are
checked: a Skill claiming such authority in `may` fails, and a Skill omitting
the denial from `may_not` also fails. Human approval cannot be inferred from a
Skill run, and no Skill output constitutes one.

## Missing context is a refusal

`requires` lists context that must be present. When it is absent the Skill
**stops and says so**. It does not proceed with an assumption, and it does not
fill the gap.

A Skill that improvises around absent input is how a fabrication enters the
system with a clean audit trail. Enforced: a Skill declaring `requires` whose
*Refusal conditions* section does not say it stops is rejected.

## Required sections

`Purpose`, `Inputs`, `Outputs`, `Preconditions`, `Procedure`, `Invariants`,
`Refusal conditions`, `Evidence`, `Authority`. All nine, enforced.

`Procedure` must be bounded: one task with an explicit handoff. If a step
would require different authority than the front matter declares, it belongs
in a different Skill. This is the rule that prevents the whole system
collapsing back into one giant prompt.

## Vendor neutrality

`allowed_tools` names **capability classes** — `web_search`,
`deterministic_renderer`, `file_read` — never products. A named model or
product in `allowed_tools` fails validation.

Adapters for a specific runtime are permitted only where unavoidable, and live
beside the Skill rather than inside its contract. Swapping runtimes must not
change the Skill.

## Version and lineage

`version` is semver. It is recorded in artifact lineage as
`generator.skill.{name, version}` (see
[`../schemas/ARTICLE-ARTIFACT-CONTRACT.md`](../schemas/ARTICLE-ARTIFACT-CONTRACT.md)),
so any artifact can be traced back to the contract that produced it, and a
Skill change is visible as a lineage change.

Bump the minor version when the contract changes — inputs, outputs,
invariants, authority. Bump the patch for wording. A contract change with an
unchanged version is the one failure this system cannot detect for you.

## Evidence

`evidence.acceptance` lists the checks that prove a run did its job;
`evidence.fixtures` names the fixtures it is proved against. Both are part of
the contract, not documentation about it.
