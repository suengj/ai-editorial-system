# Visual Production Contract

This is SUE-645/SUE-648 declared control-plane state, not a renderer.

| Object | Owns | Does not own |
| --- | --- | --- |
| Semantic master | scene, metaphor, spatial narrative, selected direction and renderer lineage | exact factual wording or approval |
| Factual overlay | exact items, source refs, accessible equivalents, numbers/labels/citations/axes/chronology | semantic scene or title artwork |
| Publication composite | declared linkage to one master and overlay | bytes, publication, or approval |

The objects have separate declared digest lineage. A `factual_overlay_repair` resolves a repository-contained regular-file `prior_production_ref`, recursively validates its predecessor chain, and may traverse at most 4 predecessor links; it must retain that record's master digest and replace its overlay and composite digests. Prior-digest fields were deliberately dropped: duplicating them in the current record would be self-attestation. `payload_sha256` verifies canonical overlay SOURCE under this repository's serializer, and every VisualBrief factual invariant requires a declared invariant and exact payload item. It does not prove renderer bytes or factual truth; byte reproducibility needs a shared serializer fixture with suengj-com.

`semantic_master.renderer_lineage` uses the same runtime shape as the job's
`renderer` and must equal that lineage exactly. Factual overlay `source_ref`
is a required, non-empty opaque reference supplied by the upstream article
authority. Callers may use the convention
`article-claim:<article_id>:<claim_id>`, but this control plane cannot resolve
that claim ID: `article_ref` carries only article/version/hash lineage,
VisualBrief carries factual text but no claim set, and no canonical article
claim registry is reachable here. The validator therefore does not assert
article or claim existence; upstream verification must resolve each reference
to the verified claim set before publication.

`direction_discovery` holds 2–4 distinct thesis/composition alternatives, article-fit rationale, and only already-selected authorities. It precedes `production_refinement`; refinement preserves the selected direction and scopes its budget to bounded local edits, one declared major variable at a time. An unavailable positive anchor rejects rather than being invented.

| Failure class | Required next action |
| --- | --- |
| `wrong_concept` | `new_direction` |
| `local_defect` | `local_edit` |
| `low_fidelity` | `fidelity_derivative` |
| `facts_or_text_wrong` | `factual_overlay_repair` |
| `reference_drift` | `recompile_reference_authority` |
| `dashboardization` | `reroute_composition_renderer` |
| `human_likes_candidate` | `human_approval_required` |

`generation_count` and `edit_count` are declared, not observed: this repository cannot observe provider calls, billing, cost, or rendered images. `requires_owner_gate` reaches the composite boundary but does not prove routing or grant approval.

This contract proves only relationships between declared digests across a chain of repository-contained visual-job records that each validate. It does not render, store, hash, inspect, approve, lock, publish, or verify a real asset; prove visual quality/text/brand compliance; prove a provider followed an action; or make external bytes reproducible. Existing SUE-638/639 human approval lock remains the only approval authority; PR C vision review owns rendered-image detection. V1/V1.1 jobs stay valid without this optional state.
