/**
 * SUE-1614 (F). Pure resolution of card-frame "chrome" tokens (kicker, brand_label, handle, footer_source_format,
 * page_mark_format, disclaimer_set, cta_policy ...) from catalog data. No brand literal lives in code:
 * every value comes from the request, the series, the target account profile, or caller-supplied defaults.
 * Priority: explicit request > series settings > target account profile > defaults.
 * Failure is explicit (UNRESOLVED_LABEL / ACCOUNT_LEAK / UNKNOWN_TARGET); never a silent default brand.
 *
 * catalog = { accounts: { <target_id>: { chrome: { <token>: value|{[channel]:value}, ... } } } }
 */
export const CHROME_TOKENS = Object.freeze(['kicker', 'brand_label', 'handle', 'footer_source_format', 'page_mark_format', 'disclaimer_set', 'cta_policy']);
const err = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const pick = (v, channel) => (isObj(v) && !Array.isArray(v) ? (channel && Object.hasOwn(v, channel) ? v[channel] : v.default) : v);
const present = (v) => v !== undefined && v !== null && !(typeof v === 'string' && !v.trim());

export function resolveChrome({ target, channel = null, request = {}, series = {}, catalog, defaults = {}, required = ['brand_label'], tokens = CHROME_TOKENS } = {}) {
  if (!isObj(catalog?.accounts)) throw err('UNKNOWN_TARGET', 'catalog.accounts is required');
  if (!target || !Object.hasOwn(catalog.accounts, target)) throw err('UNKNOWN_TARGET', `target account not in catalog: ${target}`);
  const profile = catalog.accounts[target].chrome ?? {};
  const values = {}, sources = {}, unresolved = [];
  for (const t of tokens) {
    for (const [src, bag] of [['request', request], ['series', series], ['target_profile', profile], ['default', defaults]]) {
      const v = pick(bag?.[t], channel);
      if (present(v)) { values[t] = v; sources[t] = src; break; }
    }
    if (!(t in values) && required.includes(t)) unresolved.push(t);
  }
  if (unresolved.length) throw err('UNRESOLVED_LABEL', `chrome tokens unresolved for ${target}: ${unresolved.join(', ')}`, { unresolved });
  // Account isolation: a resolved string must not contain another account's literal handle/brand/kicker.
  for (const [id, acct] of Object.entries(catalog.accounts)) {
    if (id === target) continue;
    const foreign = Object.values(acct.chrome ?? {}).flatMap((v) => (isObj(v) ? Object.values(v) : [v])).filter((v) => typeof v === 'string' && v.trim().length >= 3);
    const own = new Set(Object.values(profile).flatMap((v) => (isObj(v) ? Object.values(v) : [v])).filter((v) => typeof v === 'string'));
    for (const [t, v] of Object.entries(values)) {
      if (typeof v !== 'string' || sources[t] === 'target_profile') continue;
      const hit = foreign.find((f) => !own.has(f) && v.includes(f));
      if (hit) throw err('ACCOUNT_LEAK', `token ${t} (from ${sources[t]}) contains ${id}'s value "${hit}" while targeting ${target}`, { token: t, other_account: id });
    }
  }
  return { target, channel, values, sources };
}

/** Render-time check: every resolved string must appear in the text actually printed (comparing resolved vs pixels' text). */
export function verifyChromeText(resolved, printedByToken) {
  const mismatches = Object.entries(printedByToken).filter(([t, text]) => typeof resolved.values[t] === 'string' && !String(text).includes(resolved.values[t])).map(([t]) => t);
  if (mismatches.length) throw err('UNRESOLVED_LABEL', `printed chrome text differs from resolved value: ${mismatches.join(', ')}`, { mismatches });
  return true;
}
