import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const substantive = (value) => String(value ?? '').replace(/\s+/gu, '').length;
const issue = (code, message, card_id = undefined) => ({ code, message, ...(card_id ? { card_id } : {}) });

/** Content gate shared by the resolver and carousel renderer. Sidecar facts never enter the card artwork. */
export function validateCardNewsBrief(series, brief) {
  const issues = [];
  if (!series || !Array.isArray(series.frames)) return { ok: false, issues: [issue('CARD_NEWS_SERIES', 'a card-news series with frames is required')] };
  if (!brief || brief.schema_version !== '1.0.0') return { ok: false, issues: [issue('CARD_NEWS_BRIEF_REQUIRED', 'brief.json with schema_version 1.0.0 is required')] };
  if (typeof brief.reader_question !== 'string' || brief.reader_question.trim().length < 12) issues.push(issue('CARD_NEWS_READER_QUESTION', 'reader_question must state what the reader wants to know'));
  if (typeof brief.angle !== 'string' || brief.angle.trim().length < 20) issues.push(issue('CARD_NEWS_ANGLE', 'angle must be a one-sentence thesis'));
  if (typeof brief.so_what !== 'string' || brief.so_what.trim().length < 20) issues.push(issue('CARD_NEWS_SO_WHAT', 'so_what must explain the implication for the target reader'));
  const facts = Array.isArray(brief.facts) ? brief.facts : [];
  if (facts.length < 6 || facts.length > 10) issues.push(issue('CARD_NEWS_FACT_COUNT', 'brief requires 6–10 dated, sourced facts'));
  const factIds = new Set();
  for (const fact of facts) {
    if (!fact?.id || factIds.has(fact.id)) issues.push(issue('CARD_NEWS_FACT_ID', 'fact ids must be present and unique'));
    factIds.add(fact?.id);
    if (![fact?.value, fact?.date, fact?.source_name, fact?.source_url].every((x) => typeof x === 'string' && x.trim())) issues.push(issue('CARD_NEWS_FACT_SOURCE', `fact ${fact?.id ?? '(missing id)'} needs value, date, source_url, and source_name`));
    try { if (new URL(fact.source_url).protocol !== 'https:') throw new Error(); } catch { issues.push(issue('CARD_NEWS_FACT_URL', `fact ${fact?.id ?? '(missing id)'} needs an https source_url`)); }
  }
  const mapped = brief.per_card && typeof brief.per_card === 'object' ? brief.per_card : {};
  const usedFacts = new Set();
  for (const frame of series.frames) {
    const card = mapped[frame.id];
    const evidenceIds = Array.isArray(card?.evidence_fact_ids) ? card.evidence_fact_ids : [];
    const validIds = evidenceIds.filter((id) => factIds.has(id));
    if (!card || !card.claim || !card.evidence || !card.takeaway || !validIds.length) {
      issues.push(issue('CARD_NEWS_CARD_EVIDENCE', 'each card needs a claim, evidence line linked to a brief fact, and takeaway', frame.id));
    }
    for (const id of validIds) usedFacts.add(id);
    const body = (frame.blocks ?? []).filter((b) => b?.kind === 'text' && b.id !== 'headline' && b.region !== 'headline' && b.region !== 'hero-value').map((b) => b.text ?? '').join('\n');
    const chars = substantive(body);
    const lines = body.split(/\n+/u).map((x) => x.trim()).filter((x) => substantive(x) >= 8);
    if (chars < 45 || lines.length < 2) issues.push(issue('CARD_NEWS_BODY_TOO_THIN', `body needs at least two substantive lines and about 45 Korean characters (got ${chars} chars, ${lines.length} lines)`, frame.id));
    if (chars > 120) issues.push(issue('CARD_NEWS_BODY_TOO_LONG', `body exceeds the 120-character readability cap (got ${chars})`, frame.id));
    if (/^\s*(?:\d+(?:\.\d+)?\s*[%％]?|[₩$]\s*[\d,.]+)\s*$/mu.test(body) || (/^[^\n]{1,28}$/u.test(body.trim()) && /[!！?？]/u.test(body))) issues.push(issue('CARD_NEWS_NUMBER_SLOGAN', 'a bare number or slogan cannot stand in for card substance', frame.id));
    if (card?.evidence) {
      const evidenceNumbers = String(card.evidence).match(/\d+(?:[.,]\d+)?/gu) ?? [];
      const visibleCopy = [frame.headline, ...(frame.blocks ?? []).filter((b) => b?.kind === 'text').map((b) => b.text ?? '')].join('\n');
      const visibleNumbers = visibleCopy.match(/\d+(?:[.,]\d+)?/gu) ?? [];
      if (!evidenceNumbers.some((n) => visibleNumbers.includes(n))) issues.push(issue('CARD_NEWS_EVIDENCE_NOT_VISIBLE', 'at least one concrete number or date from the evidence must appear in visible card copy', frame.id));
    }
  }
  if (usedFacts.size < 6) issues.push(issue('CARD_NEWS_FACTS_USED', `at least six distinct brief facts must be used across the series (got ${usedFacts.size})`));
  for (const id of Object.keys(mapped)) if (!series.frames.some((frame) => frame.id === id)) issues.push(issue('CARD_NEWS_ORPHAN_CARD', `brief has an unknown card id: ${id}`, id));
  return { ok: issues.length === 0, issues, fact_count: facts.length, distinct_facts_used: usedFacts.size };
}

export function validateCardNewsContentQa(contentQa, series=null) {
  const issues = [];
  if (!contentQa || contentQa.schema_version !== '1.0.0') return { ok: false, issues: [issue('CARD_NEWS_CONTENT_QA_REQUIRED', 'content-qa.json with schema_version 1.0.0 is required')] };
  if (typeof contentQa.would_a_smart_reader_learn_something_new !== 'string' || contentQa.would_a_smart_reader_learn_something_new.trim().length < 20) issues.push(issue('CARD_NEWS_CONTENT_QA_LEARNING', 'content-qa must answer what a smart reader learns'));
  if (typeof contentQa.one_surprising_fact !== 'string' || contentQa.one_surprising_fact.trim().length < 10) issues.push(issue('CARD_NEWS_CONTENT_QA_SURPRISE', 'content-qa must state one surprising fact'));
  if (contentQa.sources_are_sidecar_only !== true || contentQa.disclaimers_or_meta_on_cards !== false) issues.push(issue('CARD_NEWS_CONTENT_QA_POLICY', 'content-qa must confirm sidecar-only sources and no disclaimers/meta on cards'));
  if (series && (!Array.isArray(contentQa.reviewed_cards) || JSON.stringify([...contentQa.reviewed_cards].sort()) !== JSON.stringify(series.frames.map((frame) => frame.id).sort()))) issues.push(issue('CARD_NEWS_CONTENT_QA_COVERAGE', 'content-qa reviewed_cards must cover every card exactly once'));
  return { ok: issues.length === 0, issues };
}

export function loadAndValidateCardNewsBrief(series, seriesPath) {
  if (series.content_kind !== 'card-news') return { ok: true, applies: false, issues: [] };
  const briefPath = resolve(seriesPath ? resolve(seriesPath, '..') : process.cwd(), series.brief_file ?? 'brief.json');
  let brief, contentQa;
  try { brief = JSON.parse(readFileSync(briefPath, 'utf8')); }
  catch { return { ok: false, applies: true, brief_path: briefPath, issues: [issue('CARD_NEWS_BRIEF_REQUIRED', `required brief sidecar is missing or invalid: ${briefPath}`)] }; }
  const qaPath = resolve(seriesPath ? resolve(seriesPath, '..') : process.cwd(), 'content-qa.json');
  try { contentQa = JSON.parse(readFileSync(qaPath, 'utf8')); }
  catch { return { ok: false, applies: true, brief_path: briefPath, content_qa_path: qaPath, issues: [issue('CARD_NEWS_CONTENT_QA_REQUIRED', `required content-qa sidecar is missing or invalid: ${qaPath}`)] }; }
  const briefResult = validateCardNewsBrief(series, brief);
  const qaResult = validateCardNewsContentQa(contentQa, series);
  return { ok: briefResult.ok && qaResult.ok, issues: [...briefResult.issues, ...qaResult.issues], applies: true, brief_path: briefPath, content_qa_path: qaPath, brief, content_qa: contentQa, fact_count: briefResult.fact_count, distinct_facts_used: briefResult.distinct_facts_used };
}
