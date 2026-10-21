# Editorial reference sourcing and asset rights

Use references to learn a named craft dimension. A reference used for study is
not automatically a reusable asset, a factual source, or authority over AES
brand choices. Record the dimension being studied (for example, texture,
composition, or material) and keep factual content and identity separate.

## Where to find references

Start with public editorial and data-visualization work for craft study. The
SUE-1750 visual dossier points to Reuters Graphics, FT Visual Vocabulary,
Datawrapper, The Pudding, Information is Beautiful Awards, and Korean
Yonhap/JoongAng examples. Check AES curation boundaries before using any
publisher: the Pudding is a journalism/craft study surface, not an active
suengj.com design reference. Do not copy layouts, exact palettes, wording,
logos, or images. For code-native chart choices, use FT Visual Vocabulary and
Datawrapper's chart and accessibility guides; generated supporting art never
stands in for a chart.

For reusable imagery and visual ingredients, search per item rather than
assuming that a public page grants use rights:

| Style | Reference or candidate starting points | What to inspect |
| --- | --- | --- |
| `photo-editorial` | Openverse first; then official Unsplash or Pexels catalogs for candidate photos. Editorial still-life examples from Reuters Graphics are craft-only unless a specific asset license permits reuse. | Lighting, crop, focal point, object realism, and whether an image is documentary or illustrative. |
| `flat-editorial` | Reuters Graphics, Yonhap graphics, and public editorial illustration examples for craft study; Openverse for reusable illustrations with item-level license confirmation. | Silhouette clarity, shape economy, and palette roles. |
| `isometric` | FT Visual Vocabulary and Datawrapper for diagram/chart craft; Openverse for reusable isometric illustrations. | Consistent object scale and spatial relationships. A diagram-like image is not measured data. |
| `clay-3d` | Openverse for reusable images; publisher examples only as link-only craft references. | Matte material, scale, light, and whether detail overwhelms the subject. |
| `glass-3d` | Openverse for reusable material studies; publisher examples only as link-only craft references. | Refraction, contrast, and preserved silhouettes. Check brand materiality limits before selection. |
| `risograph` | Openverse for reusable print-texture assets; public editorial and cultural work for craft study. | Paper stock, grain, spot-color roles, and registration shift. |
| `paper-collage` | Openverse for reusable component assets; editorial collage examples for craft study only. | Edge, fiber, layering, asymmetry, and rights for every source fragment. |
| `line-accent` | Openverse for reusable line illustrations; Datawrapper and FT examples for chart line/label craft, not as art to copy. | Line weight at phone size, open space, and a restrained accent role. |

Openverse is the first candidate-search API for a future automated path because
the dossier recommends it specifically for an asset-acquisition pilot. Search
results are candidates only. Unsplash and Pexels APIs can be evaluated later
for photo-specific retrieval, subject to their current API rules. Iconify or
Lucide can be evaluated for reusable symbols; verify the exact icon package and
license. API availability, search result metadata, or a public URL never
proves the target use is permitted.

## Reference-only versus reusable

- **Reference-only:** inspect or link to understand a craft property. Keep the
  source URL and observations; do not download, embed, train on, publish, or
  pass it as a generation input unless those uses are separately permitted.
- **Reusable asset:** an item whose exact license/terms have been checked for
  the intended destination, modifications, attribution, and commercial or
  other planned use. Store the original source and asset identity and retain
  required attribution. A permissive license does not authorize copying a
  creator's identity or implying endorsement.
- **Generated output:** record provider/model, generation date, prompt or brief
  revision, output ID/hash, and the provider terms in force for the intended
  use. A generated image is not automatically exclusive, accurate, or approved.

Do not use an unclear-rights item as a production asset. It may remain a
link-only inspiration reference if its URL and observation can be retained.

## Per-item rights record

For each saved or proposed asset, record:

| Field | Record |
| --- | --- |
| Identity | Asset ID, creator/rightsholder, title or description, original source URL, and stable source/item ID. |
| Retrieval | Retrieved date/time and the API/catalog/query that surfaced it. |
| Rights | Exact license or applicable terms URL/version; commercial-use status; attribution text; modification, redistribution, and sublicensing conditions; model/property releases where relevant. |
| Intended use | AES project/profile, destination, media, territory if relevant, and whether the item is reference-only or reusable. |
| Derivatives | Crop, recolor, edit, collage, overlay, or other change; source-to-derivative lineage and output hash. |
| Decision | `REFERENCE_ONLY`, `REUSE_ALLOWED`, `REUSE_REJECTED`, or `RIGHTS_UNCLEAR`, reviewer and checked date. |

Recheck terms when the use, destination, or source changes. Keep attribution
with the asset record and in the rendered artifact where the license requires
it. Rights status never validates factual claims shown beside the asset.

## Automation boundary

Future automation may query Openverse first, preserve candidate IDs and source
links, and collect license/credit fields for human review. It must follow each
result to its source and confirm item-level terms, attribution, modification
rights, model/property context, and target permission. Unsplash/Pexels photo
search and Iconify/Lucide symbols are later candidates after their live API
conditions are checked. Search, scraping, MCP access, and a license label are
discovery inputs, not publication approval or a rights PASS.

Research basis: `intelligence-library` branch
`origin/research/sue-1750-visual`,
`references/2026-10-22-editorial-visual-research.md`, sections 4, 5, and 7.
