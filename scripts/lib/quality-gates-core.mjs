/**
 * Quality gates engine — AES-P1.3 (SUE-440).
 *
 * Runs the mechanically decidable gates defined in
 * editorial/quality-gates.json against an article body, and checks the
 * polish invariants across a before/after pair.
 *
 * Deliberately limited to what a machine can decide. Everything requiring
 * judgement — is the thesis worth an article, is the synthesis real — is a
 * `flag`, or belongs to the rubric in AES-P3.2, not here.
 *
 * The benchmark finding that motivates this split: deterministic checks must
 * never be delegated to a judge (see benchmarks/EDITORIAL-SYSTEMS-BENCHMARK.md,
 * ref:llm-judge-reliability).
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GATES_PATH = resolve(HERE, '../../editorial/quality-gates.json');

export const loadGates = (path = GATES_PATH) => JSON.parse(readFileSync(path, 'utf8'));

export const SEVERITY = Object.freeze({ REJECT: 'reject', FIX: 'fix', FLAG: 'flag' });

const finding = (gate, severity, detail, evidence) => ({ gate, severity, detail, evidence });

/** Split a Markdown body into paragraphs, dropping fenced code and headings. */
export function paragraphs(body) {
  const withoutCode = body.replace(/```[\s\S]*?```/g, '\n');
  return withoutCode
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^#{1,6}\s/.test(p));
}

export function headings(body) {
  return [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim().toLowerCase());
}

const normalize = (s) => s.replace(/\s+/g, ' ').replace(/\[\^[^\]]*\]/g, '').trim().toLowerCase();

const CITATION_MARKER_RE = /\[\^[^\]]+\]|\[\d+\]/g;
const NUMBER_RE = /(?<![\w-])\d+(?:[.,]\d+)?\s*(?:%|배|원|달러|\$|USD|KRW|s|초)?/;
const DATE_RE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{4}년\b|\b(19|20)\d{2}\b/;

/**
 * Run every body-level gate. `article` is optional; when supplied, citation
 * integrity and thesis fidelity are checked too.
 */
export function runGates(body, article = null, gates = loadGates(), profile = null) {
  const findings = [];
  const paras = paragraphs(body);

  // --- pattern gates -------------------------------------------------------
  for (const gate of gates.gates) {
    for (const pattern of gate.patterns ?? []) {
      const re = new RegExp(pattern.replace(/^\(\?([a-z]+)\)/, ''), flagsOf(pattern));
      const match = re.exec(body);
      if (match) {
        findings.push(finding(gate.name, gate.severity, gate.rationale, match[0].trim().slice(0, 120)));
        break; // one finding per gate is enough to act on
      }
    }
  }

  // --- G-02 duplicate paragraphs ------------------------------------------
  {
    const seen = new Map();
    for (const p of paras) {
      const key = normalize(p);
      if (key.length < 40) continue; // short lines repeat legitimately
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, count] of seen) {
      if (count > 1) {
        findings.push(finding(
          'duplicate-paragraph', SEVERITY.REJECT,
          `a paragraph appears ${count} times; repetition is not emphasis`,
          key.slice(0, 120),
        ));
        break;
      }
    }
  }

  // --- G-10 formulaic sectioning ------------------------------------------
  {
    const gate = gates.gates.find((g) => g.name === 'formulaic-sectioning');
    if (gate) {
      const generic = headings(body).filter((h) => gate.headings.includes(h));
      if (generic.length >= gate.threshold) {
        findings.push(finding(
          gate.name, gate.severity,
          `${generic.length} generic section headings: ${generic.join(', ')}`,
          generic.join(', '),
        ));
      }
    }
  }

  // --- G-09 evidence density ----------------------------------------------
  {
    const t = gates.thresholds.evidenceDensity;
    // The floor is per content type. A View earns its keep by reasoning, not
    // citation volume; holding it to the News floor would penalise the
    // register rather than the writing.
    const floor = profile?.quality_gates?.evidence_density_floor ?? t.minParagraphFraction;
    if (paras.length > 0) {
      const carrying = paras.filter((p) => NUMBER_RE.test(p) || DATE_RE.test(p) || CITATION_MARKER_RE.test(p)).length;
      const fraction = carrying / paras.length;
      if (fraction < floor) {
        findings.push(finding(
          t.name, t.severity,
          `${(fraction * 100).toFixed(0)}% of paragraphs carry a number, date, or citation (floor ${(floor * 100).toFixed(0)}% for ${profile?.content_type ?? 'default'})`,
          `${carrying}/${paras.length}`,
        ));
      }
    }
  }

  // --- G-12 sequential source summary -------------------------------------
  {
    const t = gates.thresholds.sequentialSummary;
    const cited = paras
      .map((p) => [...new Set((p.match(CITATION_MARKER_RE) ?? []))])
      .filter((ids) => ids.length > 0);
    if (cited.length >= t.minCitingParagraphs) {
      const single = cited.filter((ids) => ids.length === 1).length;
      const firsts = cited.map((ids) => ids[0]);
      const nonDecreasing = firsts.every((id, i) => i === 0 || id >= firsts[i - 1]);
      if (single / cited.length >= t.minSingleSourceFraction && nonDecreasing) {
        findings.push(finding(
          t.name, t.severity,
          'citing paragraphs each draw on one source, in order — the shape of a source-by-source restatement rather than a synthesis',
          firsts.join(' → '),
        ));
      }
    }
  }

  // --- G-11 uncertainty present -------------------------------------------
  {
    const stated = article?.frame?.uncertainty?.length > 0;
    if (!stated) {
      findings.push(finding(
        'uncertainty-present', SEVERITY.REJECT,
        'no uncertainty is stated; an article that admits none is either trivial or hiding something',
        null,
      ));
    }
  }

  // --- G-04 headline fidelity to thesis -----------------------------------
  if (article?.frame?.thesis && article?.title) {
    const words = (s) => new Set(
      s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3),
    );
    const t = words(article.frame.thesis);
    const overlap = [...words(article.title)].filter((w) => t.has(w)).length;

    // Mechanical scope is deliberately narrow: this catches a title written
    // for a different piece. Whether a claim-shaped title *faithfully* carries
    // the argument is judgement, and belongs to the rubric (AES-P3.2).
    //
    // A predicate-detection heuristic was tried and removed: it misclassified
    // real published titles across languages ("Static Sites Beat CMS ..." read
    // as topic-only), and a gate that is wrong about good writing is worse
    // than no gate.
    if (overlap < 2) {
      findings.push(finding(
        'headline-thesis-fidelity', SEVERITY.FIX,
        'the title shares almost nothing with the thesis; it is a title for a different piece',
        `overlap ${overlap}`,
      ));
    }
  }

  // --- G-05 citation integrity --------------------------------------------
  if (article) {
    const gate = gates.gates.find((g) => g.name === 'citation-integrity');
    const evidence = (article.verification?.claims ?? []).flatMap((c) => c.evidence ?? []);
    const urls = evidence.map((e) => e.url).filter(Boolean);

    const counts = new Map();
    for (const u of urls) counts.set(u, (counts.get(u) ?? 0) + 1);
    for (const [u, n] of counts) {
      if (n > 1) {
        findings.push(finding(gate.name, gate.severity, `citation URL repeated ${n} times, inflating the apparent evidence base`, u));
        break;
      }
    }
    for (const u of urls) {
      const host = hostOf(u);
      if (host && gate.workingDocHosts.some((h) => host.endsWith(h))) {
        findings.push(finding(gate.name, gate.severity, `citation points at a working document host (${host}); provenance pointing at a disposable draft is not provenance`, u));
        break;
      }
    }
    for (const e of evidence) {
      const label = e.title ?? '';
      if (gate.disposableLabelPatterns.some((p) => new RegExp(p.replace(/^\(\?i\)/, ''), 'i').test(label))) {
        findings.push(finding(gate.name, gate.severity, 'citation is labelled as a disposable or internal source', label.slice(0, 120)));
        break;
      }
    }
  }

  return findings;
}

function flagsOf(pattern) {
  const m = /^\(\?([a-z]+)\)/.exec(pattern);
  return m ? m[1] : '';
}

function hostOf(url) {
  try { return new URL(url).host; } catch { return null; }
}

/** True when the findings block materialization. */
export const blocks = (findings) => findings.some((f) => f.severity === SEVERITY.REJECT);
