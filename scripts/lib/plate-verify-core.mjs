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
});

/** suengj.com --width-article is 42rem; a ~390px viewport leaves about this. */
export const DEFAULT_AVAILABLE_PX = 358;
export const TYPE_FLOOR_PX = 14;

const issue = (code, where, message) => ({ code, where, message });

/**
 * Measure what an SVG actually contains. Structural counting only — no
 * rendering engine, no layout, nothing that needs a browser.
 */
export function measureSvg(svg) {
  const viewBox = /viewBox\s*=\s*"([^"]+)"/.exec(svg);
  if (!viewBox) return { error: 'no viewBox — intrinsic width is unknowable, so no effective type size can be derived' };
  const [, , vbW, vbH] = viewBox[1].trim().split(/[\s,]+/).map(Number);
  if (!Number.isFinite(vbW) || vbW <= 0) return { error: `unusable viewBox "${viewBox[1]}"` };

  const textCount = (svg.match(/<text[\s>]/g) ?? []).length;

  // A container is a drawn rect that is not the canvas background. Circles are
  // excluded: in the accepted chart lane they are data marks, not enclosures.
  let enclosureCount = 0;
  for (const m of svg.matchAll(/<rect\b[^>]*>/g)) {
    const tag = m[0];
    const w = Number(/\bwidth\s*=\s*"([\d.]+)"/.exec(tag)?.[1]);
    const h = Number(/\bheight\s*=\s*"([\d.]+)"/.exec(tag)?.[1]);
    const isBackground = w === vbW && h === vbH;
    if (!isBackground) enclosureCount += 1;
  }

  const sizes = [];
  for (const m of svg.matchAll(/font-size\s*:\s*([\d.]+)px/g)) sizes.push(Number(m[1]));
  for (const m of svg.matchAll(/font-size\s*=\s*"([\d.]+)"/g)) sizes.push(Number(m[1]));
  const usable = sizes.filter((s) => Number.isFinite(s) && s > 0);

  // An asset carrying width/height alongside viewBox is pinned to one
  // intrinsic size: its only possible answer to a narrow viewport is uniform
  // scaling. That is signature F5, and it is visible in the source.
  const hasFixedSize = /<svg\b[^>]*\bwidth\s*=\s*"/.test(svg) && /<svg\b[^>]*\bheight\s*=\s*"/.test(svg);

  return {
    intrinsicWidth: vbW,
    intrinsicHeight: vbH,
    textCount,
    enclosureCount,
    fontSizes: usable,
    smallestTypePx: usable.length ? Math.min(...usable) : null,
    largestTypePx: usable.length ? Math.max(...usable) : null,
    hasFixedSize,
  };
}

/** Effective rendered size once the asset is scaled into the available width. */
export function effectiveTypePx(authoredPx, intrinsicWidth, availablePx = DEFAULT_AVAILABLE_PX) {
  if (intrinsicWidth <= availablePx) return authoredPx;
  return authoredPx * (availablePx / intrinsicWidth);
}

export function verifyPlateAgainstPlan(plan, svg, { availablePx = DEFAULT_AVAILABLE_PX, where = plan?.plan_id ?? 'plate' } = {}) {
  const issues = [];
  const m = measureSvg(svg);
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

  if (m.smallestTypePx !== null) {
    const effective = effectiveTypePx(m.smallestTypePx, m.intrinsicWidth, availablePx);
    const rounded = Math.round(effective * 10) / 10;
    if (effective < TYPE_FLOOR_PX) {
      issues.push(issue(CODES.TYPE_FLOOR, `${where}#composition.mobile_strategy`,
        `smallest authored type is ${m.smallestTypePx}px in a ${m.intrinsicWidth}px canvas, which renders at ${rounded}px in ${availablePx}px — below the ${TYPE_FLOOR_PX}px floor`));
    }
    const declaredMin = plan?.composition?.mobile_strategy?.min_type_px;
    if (Number.isFinite(declaredMin) && declaredMin > effective + 0.05) {
      issues.push(issue(CODES.TYPE_OVERSTATED, `${where}#composition.mobile_strategy.min_type_px`,
        `the plan claims ${declaredMin}px effective type; the asset renders its smallest type at ${rounded}px`));
    }
  }

  if (m.hasFixedSize) {
    issues.push(issue(CODES.SCALE_ONLY, `${where}#composition.mobile_strategy.strategy`,
      `the plan declares "${plan?.composition?.mobile_strategy?.strategy}", but the asset carries width/height alongside viewBox and is pinned to one intrinsic size — uniform scaling is the only response it can make to a narrow viewport (signature F5)`));
  }

  return issues;
}
