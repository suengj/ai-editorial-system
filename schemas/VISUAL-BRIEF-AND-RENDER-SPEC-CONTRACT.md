# VisualBrief and RenderSpec contract (SUE-642 / SUE-643 / SUE-644)

```text
Article / editorial thesis
  → VisualBrief (editorial purpose and semantic authority)
  → registry-only reference retrieval + authority contract
  → RenderSpec (scene and factual-layer allocation)
  → provider-adapter prompt (disposable)
```

`VisualBrief` owns purpose, thesis, reader outcome, artifact role, visual story,
factual invariants, failures to avoid, and reference requirements. `RenderSpec`
owns geometry, scene, focal/read order, spatial layers, safe zones, crop,
visual devices, and selected reference authority. The prompt owns neither; an
adapter may change its wording but not the brief, RenderSpec, profile, brand,
or reference authority.

Each selected reference is a catalog-resolving craft-evidence evaluation with
an explicit `authority` and `not_authority`. `not_authority` names only that
evaluation's own `do_not_copy` dimensions; VisualBrief
`forbidden_literal_copy` remains brief-wide and is not attributed to a source.
It is never a factual Source, and its body is never embedded. The resolver reads only `references/catalog.json`
and `references/evaluations/`; it does not consult recent context or images.
Generative and hybrid briefs must name at least one required dimension; a
dimension's relevance to the thesis/visual story is a human reviewer judgement,
not something this text validator can establish, and routes to SUE-646 in PR C.

For generative and hybrid jobs, `visual-job.article_title` is lineage and
verification input only. It is never compiled. The title check detects an
article title reproduced in prompt-bound text in recognisable form, catching
honest inclusion; it does not and cannot defeat deliberate obfuscation, and is
not a security control. The load-bearing guarantee is structural: the compiler
has no article-title input, and `text_handling.article_title: "external_overlay"`
means baking a title into artwork requires a contract change, not a field value.
Whether a rendered image contains title text is undecidable from the job and is
vision review work in SUE-646 / PR C.

Generative semantic layers may own scene, people, AI, environment, metaphor,
atmosphere, perspective, depth, and non-exact spatial/process relationships.
Deterministic factual layers own exact values/labels/citations/axes/scales/
chronology and mechanically verified annotations. Accuracy never means that
the whole plate must be deterministic. `simple` means cognitively clear, not
graphically sparse; `brand-compatible` does not mean UI-mimetic.

`text_handling.article_title` is the schema constant `external_overlay`.

The brand profile's `line_and_materiality.depth_model: flat or nearly flat 2D`
remains authoritative until an owner-reviewed decision changes it. PR A does
not change that profile. A RenderSpec depth/spatial override requires a
selected reference authority trait and a human-visible `brand_conflicts` entry;
every entry carries `owner_review: "pending_owner_review"`. That entry is
not approval, a lock, or publication authority; granting an owner verdict
requires a future contract change, not a different field value. PR A does not
block candidate-prompt compilation for a recorded conflict: a candidate must
be renderable for the owner to judge it. Instead, `requires_owner_gate` is a
derived boolean: it is true exactly when `brand_conflicts` is non-empty and no
PR-A path may set it false while a conflict is recorded. PR B and PR C must
honour that routing flag. The flag is self-attested routing state, not proof
that an owner gate actually ran; routing evidence belongs to PR B/PR C.

Generative/hybrid RenderSpecs also declare a constrained
`materiality_treatment`; its enum structurally bounds the declared treatment
to values that cannot request materiality beyond the brand ceiling. Core also
scans the exact assembled provider prompt for literal terms from the resolved
brand profile, including its own singular `drop shadow` variant. That free-text
backstop is lexical only: translated, paraphrased, or semantic requests are
not detected. Detecting a ceiling violation in the rendered image belongs to
SUE-646 vision review in PR C, not this text-contract validator.

The SUE-638/SUE-639 approval lock remains solely on `visual-job`; neither this
brief nor this RenderSpec grants machine approval, lock, or publication rights.
