# Benchmark — AI editorial systems, Skills, and publication workflows (AES-P1.1 / SUE-438)

Observed 2026-09-01. Five references, chosen because each answers a question
this system has to answer anyway. Nothing here is imported; the catalog entry
for each is in [`../references/catalog.json`](../references/catalog.json).

Recommendations are marked **[R]** when traceable to a reference and
**[Owner]** when they are Suengj's editorial choice that the reference merely
informed. The distinction matters: a reference can tell us what works
elsewhere, not what this publication should sound like.

---

## 1. Agent Skills specification — portable `SKILL.md`

`ref:agent-skills-spec` · https://github.com/agentskills/agentskills ·
Apache-2.0 (code) / CC-BY-4.0 (docs) · verdict: **adopt**

**Problem it solves.** How to package a capability so more than one agent
runtime can load it, without the capability becoming a prompt blob.

**Mechanics worth adopting.**

- A skill is a *directory*, not a file: `SKILL.md` plus optional `scripts/`,
  `references/`, `assets/`. The manifest and the instructions are the same
  document.
- Required frontmatter is deliberately minimal — `name`, `description`.
- **Progressive disclosure**: the agent sees only name and description at
  session start and loads the body on demand. This is the mechanism that lets
  a skill library grow without growing the context.
- A size discipline on the entry point (community guidance converges on
  roughly 500 lines / 5k tokens), with detail pushed into `references/` and an
  explicit statement of *when* to load each one.

**Mechanics to avoid.** Nothing structural. The risk is cultural: skill
registries accumulate near-duplicate skills whose descriptions overlap, and
the agent then picks by coin-flip. A description that does not say when *not*
to use the skill is a defect.

**Portability / vendor coupling.** Low. The format is adopted across several
agent runtimes, and the structure is plain files. This is exactly the property
our vendor-neutrality rule wants.

**Implications.**

- **[R]** Adopt the directory shape and progressive disclosure for `skills/`
  (feeds AES-P2.1 / SUE-443).
- **[R]** Cap the entry-point document and push detail to `references/`.
- **[Owner]** Add three fields the spec does not require, because our contract
  needs them: `invariants` (what must remain true), `acceptance` (which
  fixture proves it), and `authority` (what the Skill may not decide). A Skill
  here is an orchestration contract, so an unenforceable Skill is not a Skill.

---

## 2. AP newsroom AI standards — where the human line sits

`ref:ap-ai-newsroom-standards` ·
https://www.editorandpublisher.com/stories/ap-updates-newsroom-standards-for-artificial-intelligence,262741 ·
all rights reserved, cited under attribution · verdict: **adopt**

**Problem it solves.** Which parts of the editorial process may be delegated
to a machine, stated precisely enough to be operational rather than
aspirational.

**Mechanics worth adopting.**

- The line is drawn around a *function*, not a tool: reporting, sourcing,
  editorial judgment, and verification stay human. AI may assist early-stage
  research, summarization, transcription, translation, headline suggestion,
  and grammar/SEO cleanup.
- That list makes **verification and copy-editing structurally different
  activities**. Grammar cleanup is delegable; verification is not.
- AI output is reviewed and edited by a journalist before publication —
  generation is never the last step.

**Mechanics to avoid.** A newsroom policy assumes a newsroom: multiple humans,
a standards desk, an existing accountability chain. A single-author
publication cannot borrow the staffing, only the boundary. Copying the policy
text without the organisation behind it produces a claim we cannot honour.

**Portability.** High as a principle, low as a process.

**Implications.**

- **[R]** Verification and Polish stay separate Skills with separate
  acceptance. This confirms Editorial Rule 4 and rules out a single
  "improve the draft" step. Already enforced structurally: `polished` and
  `verified` are distinct article states.
- **[R]** Generation is never terminal. Already enforced: `final` and
  `published` require `lifecycle_authority: human`.
- **[Owner]** Where AP has a standards desk, we have fixtures. The
  accountability chain for a one-person publication is the eval suite plus a
  named human decision recorded on the article.

---

## 3. LLM-as-judge reliability — how not to build the eval

`ref:llm-judge-reliability` · https://arxiv.org/pdf/2606.19544 and
https://arxiv.org/pdf/2604.23178 · license not established, link-only ·
verdict: **adapt**

**Problem it solves.** Whether a model can score editorial quality well enough
to gate a release.

**Mechanics worth adopting.**

- Decompose a broad rubric into discrete, separately-scored checks. A single
  "quality" score is where the bias hides.
- Rotate positions in pairwise comparison; position order alone reportedly
  swings win-rate by roughly 10–15 points.
- Validate against a human baseline before trusting the judge, and treat a
  uniform score shift across rubrics as a moved baseline rather than noise.

**Mechanics to avoid.**

- A general-purpose "chat quality" rubric applied to a domain task. The
  criteria that predict preference in conversation do not transfer.
- Trusting length as a proxy: verbosity bias reportedly inflates preference
  for longer outputs by 15–30 points. An editorial rubric that rewards length
  would reward exactly the failure mode we are trying to eliminate.
- A judge from the same model family as the writer (self-preference bias).

*Uncertainty:* the point-magnitudes above come from secondary summaries of the
cited papers, not from our own replication. They are directionally useful and
should not be quoted as precise findings.

**Portability.** Method-level, fully portable.

**Implications.**

- **[R]** The AES-P3.2 rubric (SUE-450) must be a set of discrete binary or
  short-scale checks, not one holistic score.
- **[R]** Deterministic checks first. Anything mechanically decidable —
  citation resolution, claim coverage, staleness, forbidden-vocabulary — is
  already enforced by the P0 validators and must never be delegated to a
  judge. The judge only handles what genuinely needs judgement.
- **[Owner]** SUE-417 is the negative fixture. A rubric that cannot separate
  it from the golden corpus is not yet a rubric, regardless of its scores.

---

## 4. AI-slop screening in academic publishing — quality over origin

`ref:ai-slop-screening` ·
https://casrai.org/guides/ai-detection-tools-adoption-academic-publishing-2026-trends ·
license not established, link-only · verdict: **adapt**

**Problem it solves.** What to actually screen for when machine-written text
is unremarkable.

**Mechanics worth adopting.**

- The field moved from *origin* detection to *quality* assessment. The useful
  question is whether the piece is specific, verifiable, and substantive — not
  whether a machine was involved.
- The failure signatures are concrete and checkable: fabricated references,
  phantom citations, overstated claims, weak figure provenance, missing
  disclosure.
- Figure provenance is treated as a first-class risk: a materially
  AI-generated or AI-altered figure needs disclosure and justification.

**Mechanics to avoid.** AI-origin detectors as a gate. They produce false
positives on edited human writing, and passing one proves nothing about
accuracy.

**Portability.** High.

**Implications.**

- **[R]** Every slop signature maps to something already mechanical here:
  citations must resolve to *verified* claims; artifacts cannot cite
  unverified claims; `evidence_visual` carries a `visual` rights record and
  must cite the facts it depicts; AI assistance is disclosed on the article.
  This benchmark confirms the P0 design rather than changing it.
- **[R]** Add "phantom citation" — a citation that exists but does not support
  the claim — to the AES-P3.1 negative fixtures (SUE-449). Our current
  validators check that a citation *resolves*, not that it *supports*. That
  gap is real and belongs to the eval layer.
- **[Owner]** No AI-origin detector will be adopted. It answers the wrong
  question.

---

## 5. Denoiser — multi-surface consumption architecture

`ref:denoiser-consumption-architecture` · internal benchmark, recorded in
`suengj-com/docs/architecture/P1-6-VISUAL-HIERARCHY.md` · verdict: **adapt**

Captured as one reference among five, **not** as a visual template.

**Problem it solves.** How one body of work stays coherent when a reader meets
it across several surfaces.

**Mechanic worth adopting.** *Same information role ⇒ same visual grammar,
across every surface.* Content type may change structure and metadata; it may
not change the importance of an ordinary title. This is a consumption-layer
rule about roles, and it has already been applied in `suengj-com` (SUE-429 /
SUE-430) with Suengj's own typography and palette preserved.

**Mechanics to avoid.** Importing the aesthetic. The borrowed idea is role
consistency; Pretendard, the warm-neutral palette, minimal editorial styling,
and AEO-native IA are Suengj's identity and stay.

**Implications.**

- **[R]** Artifact surfaces added in AES-P6.2 (SUE-460) inherit the existing
  role matrix. A brief or a deck is a new *role*, not a new design language.
- **[Owner]** Distribution artifacts must not outrank the article. The
  canonical article is the destination; the brief is a door.

---

## What `suengj.com` already does well — preserved, not renegotiated

These are settled and out of scope for renegotiation by any benchmark:

| Strength | Where it lives | Status |
|---|---|---|
| Content types (`note`, `research`, `view`, `project`, `editorial`) | `CONTENT_CONTRACT.md` | Preserved; artifacts are a separate axis |
| Fail-closed publication (missing status is invalid; no auto-publish) | same | Preserved and reinforced |
| Provenance and citation blocks on editorial content | same | Extended, not replaced |
| Global slug uniqueness and `/content/{slug}` canonical URLs | AEO V1 route contract | Preserved; the process contract validates against it |
| Human approval as a distinct event from merge | `SUE-398-HUMAN-APPROVAL.md` | Preserved; `final` → `draft` only |
| Role-consistent visual hierarchy | `P1-6-VISUAL-HIERARCHY.md` | Preserved; artifact surfaces inherit it |

## What this benchmark changes downstream

| Finding | Feeds |
|---|---|
| Skill = directory + progressive disclosure + our three extra fields | AES-P2.1 (SUE-443) |
| Verification ≠ polish, structurally | AES-P2.4 (SUE-446), AES-P2.5 (SUE-447) |
| Rubric as discrete checks; deterministic checks never delegated to a judge | AES-P3.2 (SUE-450) |
| Phantom-citation fixture (citation resolves but does not support) | AES-P3.1 (SUE-449) |
| Slop signatures already mechanised in P0 | confirms SUE-436 / SUE-437 |
| Artifact surfaces inherit the existing role matrix | AES-P6.2 (SUE-460) |

## Method and limits

Five references, read at the level of their stated mechanics. This is a
working benchmark, not a survey: the selection is biased toward references
that change a decision we have to make in P2–P3. Two entries (3 and 4) cite
secondary summaries for their quantitative claims and are marked accordingly —
they inform method, and no number from them should be republished as a
finding.

Nothing was forked, vendored, or mirrored. Every external entry is link-only
or attributed quotation; see `../editorial/RIGHTS-AND-PROVENANCE.md`.
