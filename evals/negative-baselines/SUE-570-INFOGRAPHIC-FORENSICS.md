# SUE-570 infographic negative baseline — structural forensics

> Snapshot: 2026-09-06 · Issue: SUE-627 (parent SUE-605)
>
> Status of the material analysed here: **negative evidence**. The owner reviewed the
> SUE-570 pilot and rated infographic composition and concept-art quality as material
> failures. Nothing in this document promotes any SUE-570 asset to a GOOD reference.
> These assets are kept because a failure you can name is routable; a failure you can
> only feel is not.

## 0. What was analysed

Six rendered assets from the SUE-570 pilot branch
(`suengj/suengj-com@sue-570-pilot-review:public/media/images/sue570-pilot/`),
plus the owner verdict recorded on Linear SUE-570 §D–E.

| asset | family | owner verdict |
|---|---|---|
| `tools-report-infographic.svg` | body infographic | **FAIL** |
| `tools-news-diagram.svg` | explanatory diagram | **FAIL** (non-data composition) |
| `tools-child-concept.svg` | concept illustration | **FAIL** (out of SUE-605 scope → SUE-630) |
| `news-jp-us-10y-divergence.svg` | evidence chart | PARTIAL / conditionally acceptable |
| `report-repricing-vs-crisis-matrix.svg` | analytical matrix | PARTIAL / conditionally acceptable |
| `child-rate-vs-worry-bars.svg` | evidence chart | PARTIAL / conditionally acceptable |

The analysis is done on the SVG source, not on an impression of the rendered image, so
every claim below is checkable against a specific coordinate, font-size or element count.

---

## 1. The discriminating variable: does spatial position encode meaning?

This is the single strongest signal separating the accepted lane from the failed lane,
and it is not a matter of taste.

### Accepted lane — position is computed from meaning

`news-jp-us-10y-divergence.svg`:

```text
y = f(interest rate)      304px ↔ 2% ,  48px ↔ 6%
x = f(date)               64px ↔ 9/1 , 538px ↔ 9/4
```

A reader who measures the picture recovers the data. Vertical distance between the two
series *is* the divergence the headline claims. The graphic is not a picture *about* a
number; it is a number.

`report-repricing-vs-crisis-matrix.svg`:

```text
row    = 국채금리 direction (상승 / 하락)
column = 신용스프레드 response (안정 / 급등)
cell   = the diagnosis that combination implies
```

Both axes carry meaning, so the four cells are not four boxes — they are the complete
partition of a two-variable question. The empty cell (`해당 없음 · 원문 진단표에 없음`)
is informative precisely *because* position is semantic: an empty cell is a claim about
coverage, not a layout gap.

### Failed lane — position is assigned by hand

`tools-report-infographic.svg` places four modules:

```text
A. 스프레드시트 메커니즘      x=24  y=50    (top-left)
B. 권한 이동의 반복           x=368 y=50    (top-right)
C. 핵심 해석                  x=24  y=200   (bottom-left)
D. 갈라지는 지점              x=368 y=200   (bottom-right)
```

Nothing is encoded by those coordinates. "A is left of B" asserts no relation. "C is
below A" asserts no relation. The 2×2 arrangement borrows the *appearance* of a matrix
while neither axis means anything — which is worse than no grid, because it implies a
comparison structure that does not exist. The modules are lettered A/B/C/D precisely
because the geometry cannot say what the order is.

`tools-news-diagram.svg` is a weaker case of the same defect: two horizontal lanes,
each `기업/업무 → 스프레드시트/AI → 최적화 대상`. The x-axis encodes sequence, which is
real but trivial; the y-axis (top lane = 지난 반세기, bottom lane = 지금) encodes an
analogy that is asserted by a dashed line rather than by geometry.

**Named signature — `F1 · decorative-geometry`:**
> Spatial position in the plate encodes no relation. The layout could be permuted without
> changing what the graphic asserts. Route: **composition plan** (relation geometry), not
> renderer, not palette.

The routable test is mechanical: *name the axes.* If neither the x- nor the y-dimension
of a plate can be given a semantic name, the plate is a list wearing a diagram's clothes.

---

## 2. Enclosure budget: chrome scales with elements, not with modules

Counted from source:

| asset | semantic modules | drawn enclosures (rect/circle acting as container) | ratio |
|---|---|---|---|
| `tools-report-infographic.svg` | 4 | 12 (4 module cards + 7 chips/accent bars + 1 dashed conclusion box) | **3.0×** |
| `tools-news-diagram.svg` | 2 lanes × 3 stages | 6 boxes | 1.0× |
| `report-repricing-vs-crisis-matrix.svg` | 4 cells | 4 (the cells themselves) | 1.0× |
| `news-jp-us-10y-divergence.svg` | 2 series | 0 | 0× |
| `child-rate-vs-worry-bars.svg` | 2 bars | 2 (the bars themselves) | 1.0× |

The failed infographic nests enclosure inside enclosure: a bordered card containing
bordered chips containing text. `SUENGJ-INFOGRAPHIC-CALIBRATION.md` §4 asks for exactly
the opposite transformation (`many bordered cards → shared alignment + whitespace`).

**Named signature — `F2 · enclosure-inflation`:**
> More drawn containers than load-bearing modules. Each nesting level costs stroke weight,
> corner radius, inner padding and colour without adding a relation.
> Route: **composition grammar** (enclosure budget).

---

## 3. Text-in-a-box is not information design

Modules C and D of `tools-report-infographic.svg` contain no geometry at all. Their
entire content is prose set inside a rectangle:

```text
C:  "관리 범위 ↑ → 계층 ↓ (flat)"
    "동시에 최고 의사결정자 가시성 ↑ (centralized)"
    "span of control → span of complexity (원문 제안, 미검증 개념)"

D:  "AI가 이해할 수 있는 것"
    "≠ AI에게 맡길 수 있는 것"
    "반론2(맥락 보존 가능성)를 완전히 기각도 수용도 하지 않음"
```

The closing element is a dashed rectangle holding two more lines of prose
(`열린 질문: 이해–위임 간극을 / 누가, 어떤 기준으로 좁힐 것인가`).

Half the plate is therefore a bulleted list with borders. This is the mechanism behind
the owner's "infographic composition is seriously inadequate" verdict and behind the
`VISUAL-INFORMATION-GAIN.md` §10 R3 regression (paragraph-to-icons transcription): the
first-read payload is identical to the sentences it was derived from, so the marginal
information gain is zero even though the plate is factually correct and schema-valid.

**Named signature — `F3 · prose-in-a-rectangle`:**
> A module whose content is a sentence, and whose enclosure is the only visual work done.
> Route: **semantic plan** (this module should not have been a module) *or*
> **composition plan** (this content needed a geometry that was never chosen).

---

## 4. One plate, four primary questions

`tools-report-infographic.svg` declares its question in-frame:

```text
질문: 스프레드시트의 경로가 AI에도 그대로 적용되는가?
```

but then answers four different ones:

```text
A → how did the spreadsheet mechanism work?
B → what authority shift recurs?
C → is the resulting org flat or centralized?
D → where does the analogy break?
```

Then a fifth element (`열린 질문`) opens a further question that the plate explicitly
does not answer. `SUENGJ-ARTICLE-IMAGE-FAMILIES.md` §6 names this as a split trigger and
requires plate splitting rather than shrinking. The asset shrank instead — which produced
the mobile failure in §5.

**Named signature — `F4 · multi-question plate`:**
> Route: **semantic plan / plate split**.

---

## 5. The mobile gate was not failed narrowly — it was never attempted

`--width-article` on suengj.com is `42rem` (672px). A ~390px viewport leaves roughly
358px of usable figure width. Every asset in the set is a fixed-`viewBox` SVG with no
breakpoint, no reflow, and no alternate plate, so the only available response to a narrow
viewport is uniform scaling. Effective rendered type sizes at 358px:

| asset | intrinsic width | scale | largest type → | smallest type → |
|---|---|---|---|---|
| `tools-report-infographic.svg` | 720 | 0.497 | 15px → **7.5px** | 10.5px → **5.2px** |
| `tools-news-diagram.svg` | 640 | 0.559 | 15px → **8.4px** | 11px → **6.2px** |
| `news-jp-us-10y-divergence.svg` | 620 | 0.577 | 15px → **8.7px** | 11px → **6.4px** |
| `report-repricing-vs-crisis-matrix.svg` | 720 | 0.497 | 17px → **8.5px** | 10.5px → **5.2px** |
| `child-rate-vs-worry-bars.svg` | 640 | 0.559 | 18px → **10.1px** | 12px → **6.7px** |

> **Correction, 2026-09-06.** The first version of this table omitted
> `child-rate-vs-worry-bars.svg`, and the range `5.2–8.7px` was quoted from it into
> the benchmark, the composition contract, three artifact profiles and two commit
> messages. The measured range across the five non-concept assets is
> **5.2–10.1px**. The conclusion is unchanged — 10.1px is still far below any
> usable floor, and no asset reaches 14px even at its largest type — but the number
> was wrong and had propagated. All copies are corrected, and
> `scripts/test-plate-verify.mjs` now asserts the range against the actual files so
> it cannot drift again.

Two consequences that must not be blurred together:

1. The failed infographic renders its module labels at **5.2–6.5px**. This is not "small";
   it is roughly half of any usable floor. The hard gate in
   `SUENGJ-ARTICLE-IMAGE-FAMILIES.md` §5 is failed by a wide margin, deterministically,
   without any judgement call about taste.
2. **The conditionally-accepted chart lane fails the same gate.** It was accepted on
   evidence-accuracy grounds, not on mobile grounds. The owner's PARTIAL verdict on charts
   should not be read as "the chart lane is mobile-safe".

**Named signature — `F5 · scale-only mobile strategy`:**
> The asset has exactly one layout and answers a narrow viewport by shrinking type.
> Route: **composition plan** (mobile strategy) and **renderer** (the renderer must be able
> to emit a second layout, not just a smaller one). A plate with no declared mobile
> strategy should not be renderable at all.

This is the single defect the accepted and rejected lanes share, so fixing it is not an
infographic-only repair.

---

## 6. Mutable publication text baked into artwork

Both failed non-data assets carry, inside the SVG:

```text
source: 기업은 자신이 사용하는 도구를 닮아간다 (2026-09-03) · …
```

That is the article title *and* the publication date rendered into the artwork.
`visual-body-infographic.json` `text_policy.complexity_ceiling` and
`SUENGJ-ARTICLE-IMAGE-FAMILIES.md` §4.3 both forbid exactly this: stable semantic labels
are permitted, mutable article/section titles, dates, captions and citations are not.
The asset becomes stale the moment the article is revised or re-dated, and the caption
layer that should own this text is left empty.

The same line also carries a legend (`실선 = 원문이 서술한 것, 점선 = 저자의 해석적 연결`)
which *is* legitimate in-frame content — it is a stable semantic key. The two were merged
into one 10.5px line, so the load-bearing legend inherited the fate of the disposable
credit line.

**Named signature — `F6 · mutable-copy in artwork`:**
> Route: **publication handoff** (caption layer), not renderer.

---

## 7. Label budget

`visual-body-infographic.json` sets `text_policy.label_count_ceiling: 8`.
`tools-report-infographic.svg` contains 22 `<text>` elements. The ceiling was not enforced
anywhere in the path that produced the asset — the profile stated it, and nothing checked
it. This is a contract-enforcement gap, not a design gap:

**Named signature — `F7 · unenforced profile ceiling`:**
> A stated profile constraint with no mechanical check. Route: **contract / validator**.

---

## 8. What the accepted lane actually did right

Stated positively, so the successor contract can inherit it rather than rediscover it —
with one important qualification recorded first.

> **Correction, 2026-09-06.** The claim below was originally written as a property of
> "the accepted lane". It is not. `child-rate-vs-worry-bars.svg` is in the
> conditionally-accepted set and its position is **not** computed from data: the two
> bars sit on inconsistent scales (202.4px for 4.80 is 42.2 px/unit; 48.4px for 1.01 is
> 47.9 px/unit), they encode *level* while the caption claims they show *change*, and
> the asset's own in-frame note concedes the heights are `정확한 눈금이 아니`— not an
> accurate scale. Two of the three accepted assets compute position from meaning; the
> third does not, and it is the weakest of them.
>
> This makes the finding sharper rather than weaker. The discriminator is not
> *chart versus infographic* — family membership predicts nothing. It is *position
> computed from meaning versus position assigned by hand*, and an accepted-lane asset
> that fails the discriminator is evidence for the discriminator, not against it.

- **Position is computed from data** — in the two accepted assets where it holds.
  Coordinates in the line chart are arithmetic on values, not hand placement.
- **Zero enclosures.** Grouping is done by shared baseline, axis alignment and a series
  label placed at the end of its own line — not by cards.
- **`fill: currentColor` throughout.** The chart inherits the publication's text colour
  rather than hard-coding a palette, so it survives theme changes. The failed assets
  hard-code `#F5F1E7`, `#5B6F55`, `#C9A671`, `#3A3630` and cannot.
- **The empty cell is a statement.** The matrix's `해당 없음 · 원문 진단표에 없음` refuses
  to invent a diagnosis the source did not make. Evidence/interpretation boundaries were
  respected even where the geometry was weak.
- **Provenance in `<desc>`.** Retrieval dates and source identifiers ride in the
  accessibility description, where they do not consume plate area.

Two of these — computed position, and colour-as-inherited-role — are the concrete reason
the chart lane is usable and the infographic lane is not. Neither is an aesthetic
property, and neither can be fixed by prompt wording.

---

## 9. Failure signature index

| id | signature | routes to |
|---|---|---|
| `F1` | decorative-geometry — spatial position encodes no relation | composition plan · relation geometry |
| `F2` | enclosure-inflation — more containers than modules | composition grammar · enclosure budget |
| `F3` | prose-in-a-rectangle — a module that is a sentence with a border | semantic plan, or composition plan |
| `F4` | multi-question plate | semantic plan · plate split |
| `F5` | scale-only mobile strategy | composition plan · mobile strategy + renderer capability |
| `F6` | mutable-copy in artwork | publication handoff · caption layer |
| `F7` | unenforced profile ceiling | contract · validator |

The signatures are deliberately expressed as things a validator or a reviewer can check
against an artifact, because the SUE-605 boundary requires that a bad result be routable
to a layer instead of triggering an untraceable reroll.

## 10. What this analysis does NOT license

- It does not conclude that the renderer is the problem. Five of the seven signatures are
  planning defects that would survive a renderer swap.
- It does not conclude that more generative calls, a different image model, or a richer
  prompt would help. `F1`–`F4` are decisions taken before any rendering occurs.
- It does not promote any asset here to a positive reference, including the charts.
- It does not settle concept illustration (`tools-child-concept.svg`), which is out of
  SUE-605 scope and tracked by SUE-630. It is recorded here only so the SUE-570 set is
  fully accounted for.
