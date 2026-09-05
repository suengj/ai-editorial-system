# Strong Writer routing — owner evidence

Date: 2026-09-05

Status: owner-reviewed operating evidence, **not** a controlled model benchmark.

## Question

Can a strong Manager and Reviewer compensate for routing final prose through a lower-capability Writer, or does Writer capability remain a load-bearing quality variable?

## Evidence sequence

### SUE-570 baseline

Six multi-audience drafts established that News / Report / Child macro differentiation was directionally useful, but the owner found the Korean sentence-level realization insufficiently native/professionally edited.

### SUE-604 rejected rewrite

A corpus/rule-driven rewrite pass attempted to fix the language globally. Owner review rejected the AFTER set: several drafts became more explicit, repetitive, rigid, and less readable. One child draft suffered semantic drift. This established that more rules and more rewriting do not substitute for language judgment.

### SUE-610 conservative correction

Source→Target Delta planning and `KEEP | LOCAL_POLISH | UPSTREAM_REPLAN_REQUIRED` were introduced. Seven edit candidates were tested across six cases; three survived and four reverted. The owner explicitly confirmed the surviving changes were materially better.

### Direct strong-Writer regeneration

After SUE-610 was merged, six new owner-facing articles were generated from the same two canonical sources by one context-rich strong prose Writer:

- tools / News
- tools / Report
- tools / 10–12-year-old explainer
- bonds / News
- bonds / Report
- bonds / 10–12-year-old explainer

The process deliberately applied:

```text
canonical source
→ SourceProfile / TargetProfile
→ per-axis delta
→ required upstream transformation
→ one coherent target draft
→ conservative language review
```

News and Report were not treated as different voices that required wholesale rewriting; compatible adult-professional register was preserved while information depth and structure changed. The child variants were treated as high-delta audience transformations and re-composed before polish rather than being post-processed by child-language rules.

## Owner verdict

Owner response after reading the rendered six-article set:

> 확실히 나아졌네

The verdict is recorded as **material improvement in the overall prose/transform quality direction**. It is not interpreted as publication approval for each article and does not activate the Korean language pack.

## What this supports

- Final prose Writer capability is independent from Manager authority.
- A strong Manager prompt does not make Writer realization quality interchangeable across models.
- A strong Reviewer can identify weak prose but does not repair the artifact unless a capable Writer is invoked again.
- A context-rich, single strong Writer is a useful default for coherent owner-facing prose.
- Small-intervention P0/P1 work can still be high-judgment language work.
- Model routing should distinguish support tasks from load-bearing prose realization.

## What this does not prove

This is not a causal A/B model benchmark. Several variables changed together:

- SUE-610 architecture replaced broad rewriting with delta planning and preservation-first polish;
- the Writer had direct access to the current project context and canonical source truth;
- one coherent Writer produced each article rather than paragraph-level multi-writer assembly;
- the runtime/model differed from earlier agent runs.

Therefore the evidence does **not** establish that a named provider/model caused the improvement. It establishes that Writer capability/context must be treated as an explicit routing variable and cannot be assumed away by stronger management instructions.

## Provenance

- Control-plane architecture: `docs/architecture/SOURCE-TARGET-DELTA-PLANNING.md`
- Language architecture: `docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md`
- Routing contract: `docs/architecture/WRITER-MODEL-ROUTING.md`
- Earlier SUE-610 evidence: `evals/dogfood/2026-09-05-sue610-conservative-polish/`
- Owner-facing bodies: stored as `status: draft` evidence in `suengj-com`; they are not canonical published content.

No GitHub Actions run was requested for this evidence update.