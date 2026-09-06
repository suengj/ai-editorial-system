/**
 * plate-verify — measure a rendered plate against the plan that claimed it
 * (AES-V2.16b / SUE-628).
 *
 * The composition plan is a declaration. Independent review of the first cut
 * of this contract demonstrated the consequence: taking the rejected SUE-570
 * plate and changing only fields its own author writes — its declaration of
 * what position means, its own count of how many boxes it wanted, its own
 * claim about label count and rendered type — made the identical picture pass
 * the entire validator with zero issues. `enclosures_planned <=
 * parallel_category_boundaries` was comparing a number to itself.
 *
 * A plan legitimately records intent, so that is not a defect in the plan
 * format. It is a defect in believing the plan. This module closes it for the
 * four quantities a rendered SVG can actually be measured for, so those fields
 * stop being self-report the moment an asset exists:
 *
 *   declared max_labels        vs  <text> elements actually drawn
 *   declared enclosures        vs  container rects actually drawn
 *   declared min_type_px       vs  smallest type at the target viewport
 *   declared mobile strategy   vs  whether the asset can do anything but scale
 *
 * Deliberately not measured: prose_only and position_convention are editorial
 * judgements about what a picture MEANS, and no parser recovers those. They
 * stay declarations, and the contract now says so rather than implying
 * otherwise.
 */

export const CODES = Object.freeze({
  PARSE: 'plate-parse',
  LABEL_COUNT: 'label-count-exceeds-plan',
  ENCLOSURE_COUNT: 'enclosure-count-exceeds-plan',
  TYPE_FLOOR: 'rendered-type-below-floor',
  TYPE_OVERSTATED: 'min-type-px-overstated',
  SCALE_ONLY: 'scale-only-asset-under-a-reflow-plan',
  TYPE_UNMEASURABLE: 'type-size-unmeasurable',
  UNMODELLED_TRANSFORM: 'shrinking-transform-not-modelled',
  NO_BREAKPOINT: 'reflow-claimed-without-a-breakpoint',
  MUTABLE_COPY: 'mutable-copy-rendered-in-artwork',
});

/**
 * Mutable publication copy: a credit line, a publication date, a citation.
 * Checked against the ASSET rather than the plan because in the plate that
 * produced signature F6 the offending string lived in a footer <text> element,
 * which no field of a composition plan represents — the plan-level rule could
 * only ever catch it if an author happened to put it in a module label.
 */
const MUTABLE_COPY_RE = [
  { re: /\bsource\s*:/i, what: 'a "source:" credit line' },
  { re: /출처/, what: 'a 출처 credit line' },
  { re: /\b(19|20)\d{2}-\d{2}-\d{2}\b/, what: 'an ISO date' },
  { re: /\((19|20)\d{2}-\d{2}-\d{2}\)/, what: 'a parenthesised publication date' },
];

/** suengj.com --width-article is 42rem; a ~390px viewport leaves about this. */
export const DEFAULT_AVAILABLE_PX = 358;
export const TYPE_FLOOR_PX = 14;
/** SVG's initial font-size when nothing declares one. */
export const UA_DEFAULT_TYPE_PX = 16;

const issue = (code, where, message) => ({ code, where, message });

/**
 * Measure what an SVG actually contains. Structural counting only — no
 * rendering engine, no layout, nothing that needs a browser.
 */
/**
 * Measure what an SVG actually contains. Structural counting only — no
 * rendering engine, no layout, nothing that needs a browser.
 *
 * Every unknown is an ISSUE, never a skip. Independent review defeated an
 * earlier cut of this function eight ways out of nine, and five of those rode
 * a single fail-open branch: when no font-size parsed, the type check was
 * skipped rather than failed, so `font-size="6px"`, `0.4rem`, or a unitless
 * value bought a clean bill of health on an unreadable plate. A measurement
 * layer that fails open is worth less than no measurement layer, because it
 * also confers a passing grade.
 */
export function measureSvg(svg, availablePx = DEFAULT_AVAILABLE_PX) {
  const notes = [];

  // A fluid SVG — percentage width, no viewBox — has no scale factor at all:
  // its user units ARE CSS pixels at every viewport, so authored type renders
  // at authored size. That is the shape that actually defeats F5, so it must
  // be measurable rather than an error.
  const viewBox = /viewBox\s*=\s*"([^"]+)"/.exec(svg);
  const fluidWidth = /<svg\b[^>]*\bwidth\s*=\s*"100%"/.test(svg);
  let vbW; let vbH; let unscaled = false;
  if (viewBox) {
    [, , vbW, vbH] = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (!Number.isFinite(vbW) || vbW <= 0) return { error: `unusable viewBox "${viewBox[1]}"` };
  } else if (fluidWidth) {
    vbW = availablePx; vbH = null; unscaled = true;
  } else {
    return { error: 'no viewBox and no percentage width — the asset has neither a coordinate system to scale nor a fluid one, so no effective type size can be derived' };
  }

  // A label is a text-bearing unit, not a <text> tag. Thirty labels packed as
  // <tspan> inside one <text> is thirty labels to a reader.
  let textCount = 0;
  for (const t of svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
    const inner = t[1];
    const spans = [...inner.matchAll(/<tspan\b[^>]*>([\s\S]*?)<\/tspan>/g)]
      .filter((m) => m[1].replace(/<[^>]+>/g, '').trim().length > 0);
    textCount += spans.length > 0 ? spans.length : 1;
  }
  // A self-closing or unclosed <text> still draws.
  const bareText = (svg.match(/<text\b[^>]*\/>/g) ?? []).length;
  textCount += bareText;

  // An enclosure is a drawn closed shape, whatever element draws it. Counting
  // only <rect> let a box drawn as a closed <path> or a <polygon> through.
  // Definitions are not drawn where they are declared: an arrowhead marker is
  // a closed path, but it is a glyph on a connector, not a container.
  const drawn = svg
    .replace(/<defs\b[\s\S]*?<\/defs>/g, '')
    .replace(/<marker\b[\s\S]*?<\/marker>/g, '')
    .replace(/<symbol\b[\s\S]*?<\/symbol>/g, '')
    .replace(/<clipPath\b[\s\S]*?<\/clipPath>/g, '');

  let enclosureCount = 0;
  for (const m of drawn.matchAll(/<rect\b[^>]*>/g)) {
    const w = Number(/\bwidth\s*=\s*"([\d.]+)"/.exec(m[0])?.[1]);
    const h = Number(/\bheight\s*=\s*"([\d.]+)"/.exec(m[0])?.[1]);
    const isBackground = vbH !== null && w === vbW && h === vbH;
    if (!isBackground) enclosureCount += 1;
  }
  enclosureCount += (drawn.match(/<polygon\b/g) ?? []).length;
  for (const m of drawn.matchAll(/<path\b[^>]*\bd\s*=\s*"([^"]*)"/g)) {
    if (/[Zz]\s*$/.test(m[1].trim())) enclosureCount += 1; // a closed path is a box
  }

  // Font sizes, with units. Anything that looks like a font-size but does not
  // parse is recorded as unresolved rather than ignored.
  const sizes = [];
  let unresolvedSizes = 0;
  const toPx = (value, unit) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return null;
    switch ((unit || '').toLowerCase()) {
      case '': case 'px': return v;          // unitless SVG user units are px here
      case 'pt': return v * (96 / 72);
      case 'rem': case 'em': return v * 16;  // 16px root, the browser default
      default: return null;                  // %, ex, ch, vw — not modelled
    }
  };
  const collect = (re) => {
    for (const m of svg.matchAll(re)) {
      const px = toPx(m[1], m[2]);
      if (px === null) unresolvedSizes += 1; else sizes.push(px);
    }
  };
  collect(/font-size\s*:\s*([\d.]+)([a-z%]*)/gi);
  collect(/font-size\s*=\s*"\s*([\d.]+)([a-z%]*)\s*"/gi);
  if (/font-size\s*[:=]\s*"?\s*(inherit|smaller|larger|small|medium|large|x-small|xx-small)/i.test(svg)) unresolvedSizes += 1;
  if (unresolvedSizes > 0) notes.push(`${unresolvedSizes} font-size declaration(s) in a unit this checker does not model`);

  // A scale() below 1 shrinks whatever it wraps, and this checker does not
  // track transform stacks. Report it rather than measure around it.
  let shrinkingTransforms = 0;
  for (const m of svg.matchAll(/transform\s*=\s*"[^"]*\bscale\(\s*(-?[\d.]+)/g)) {
    if (Math.abs(Number(m[1])) < 1) shrinkingTransforms += 1;
  }

  const hasFixedSize = !unscaled
    && /<svg\b[^>]*\bwidth\s*=\s*"[\d.]/.test(svg)
    && /<svg\b[^>]*\bheight\s*=\s*"[\d.]/.test(svg);

  // Internal media queries are how a single fluid asset re-stacks instead of
  // shrinking — the mechanism behind a truthful "reflow"/"restack" claim.
  const hasBreakpoint = /@media[^{]*\((?:max|min)-width/.test(svg);

  return {
    intrinsicWidth: vbW,
    intrinsicHeight: vbH,
    unscaled,
    hasBreakpoint,
    textCount,
    enclosureCount,
    fontSizes: sizes,
    unresolvedSizes,
    shrinkingTransforms,
    smallestTypePx: sizes.length ? Math.min(...sizes) : null,
    largestTypePx: sizes.length ? Math.max(...sizes) : null,
    hasFixedSize,
    notes,
  };
}

export function effectiveTypePx(authoredPx, intrinsicWidth, availablePx = DEFAULT_AVAILABLE_PX) {
  if (intrinsicWidth <= availablePx) return authoredPx;
  return authoredPx * (availablePx / intrinsicWidth);
}

export function verifyPlateAgainstPlan(plan, svg, { availablePx = DEFAULT_AVAILABLE_PX, where = plan?.plan_id ?? 'plate' } = {}) {
  const issues = [];
  const m = measureSvg(svg, availablePx);
  if (m.error) return [issue(CODES.PARSE, where, m.error)];

  const declaredLabels = plan?.composition?.label_strategy?.max_labels;
  if (Number.isFinite(declaredLabels) && m.textCount > declaredLabels) {
    issues.push(issue(CODES.LABEL_COUNT, `${where}#composition.label_strategy.max_labels`,
      `the plan declares at most ${declaredLabels} labels; the asset draws ${m.textCount} <text> elements`));
  }

  const declaredEnclosures = plan?.composition?.enclosure_budget?.enclosures_planned;
  if (Number.isFinite(declaredEnclosures) && m.enclosureCount > declaredEnclosures) {
    issues.push(issue(CODES.ENCLOSURE_COUNT, `${where}#composition.enclosure_budget.enclosures_planned`,
      `the plan declares ${declaredEnclosures} enclosure(s); the asset draws ${m.enclosureCount} container rect(s)`));
  }

  // Fail closed. An asset whose type size cannot be read is not an asset that
  // passed the type floor — it is an asset the floor could not be applied to,
  // and reporting that as a pass is how five separate evasions got through an
  // earlier cut of this module.
  if (m.unresolvedSizes > 0) {
    issues.push(issue(CODES.TYPE_UNMEASURABLE, `${where}#asset`,
      `${m.unresolvedSizes} font-size declaration(s) use a unit this checker does not model (%, ex, ch, vw, or a keyword). The ${TYPE_FLOOR_PX}px floor cannot be applied to them, and an unapplied floor is not a met floor`));
  }

  if (m.shrinkingTransforms > 0) {
    issues.push(issue(CODES.UNMODELLED_TRANSFORM, `${where}#asset`,
      `${m.shrinkingTransforms} transform(s) apply scale() below 1, which shrinks whatever they wrap. This checker does not track transform stacks, so the measured type size is an upper bound and the floor cannot be relied on`));
  }

  // "reflow" and "restack" are claims about an asset changing its layout. A
  // fluid asset with no breakpoint cannot change layout; it can only stretch.
  const strategy = plan?.composition?.mobile_strategy?.strategy;
  if ((strategy === 'reflow' || strategy === 'restack') && m.unscaled && !m.hasBreakpoint) {
    issues.push(issue(CODES.NO_BREAKPOINT, `${where}#composition.mobile_strategy.strategy`,
      `the plan declares "${strategy}", but the asset carries no internal @media breakpoint — a fluid asset with no breakpoint cannot re-lay-out, it can only stretch, so nothing about it re-stacks at a narrow viewport`));
  }

  // No declared font-size does not mean unmeasurable: SVG's initial value is
  // 16px, which is above the floor authored but not necessarily once scaled.
  const authoredMin = m.smallestTypePx ?? (m.textCount > 0 ? UA_DEFAULT_TYPE_PX : null);
  if (authoredMin !== null) {
    const effective = effectiveTypePx(authoredMin, m.intrinsicWidth, availablePx);
    const rounded = Math.round(effective * 10) / 10;
    if (effective < TYPE_FLOOR_PX) {
      issues.push(issue(CODES.TYPE_FLOOR, `${where}#composition.mobile_strategy`,
        `smallest authored type is ${authoredMin}px${m.smallestTypePx === null ? ' (SVG initial value; nothing declares one)' : ''} in a ${m.intrinsicWidth}px canvas, which renders at ${rounded}px in ${availablePx}px — below the ${TYPE_FLOOR_PX}px floor`));
    }
    const declaredMin = plan?.composition?.mobile_strategy?.min_type_px;
    if (Number.isFinite(declaredMin) && declaredMin > effective + 0.05) {
      issues.push(issue(CODES.TYPE_OVERSTATED, `${where}#composition.mobile_strategy.min_type_px`,
        `the plan claims ${declaredMin}px effective type; the asset renders its smallest type at ${rounded}px`));
    }
  }

  for (const t of svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
    const content = t[1].replace(/<[^>]+>/g, '').trim();
    for (const { re, what } of MUTABLE_COPY_RE) {
      if (re.test(content)) {
        issues.push(issue(CODES.MUTABLE_COPY, `${where}#asset`,
          `the artwork renders ${what}: "${content.slice(0, 70)}${content.length > 70 ? '…' : ''}". Mutable publication copy — titles, dates, captions, citations — belongs to the caption layer, which owns it without going stale when the article is re-dated (signature F6)`));
        break;
      }
    }
  }

  if (m.hasFixedSize) {
    issues.push(issue(CODES.SCALE_ONLY, `${where}#composition.mobile_strategy.strategy`,
      `the plan declares "${plan?.composition?.mobile_strategy?.strategy}", but the asset carries width/height alongside viewBox and is pinned to one intrinsic size — uniform scaling is the only response it can make to a narrow viewport (signature F5)`));
  }

  return issues;
}
