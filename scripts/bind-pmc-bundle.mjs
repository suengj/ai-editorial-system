#!/usr/bin/env node
/**
 * Bind a finished PMC plot bundle to the existing deterministic chart panel
 * (SUE-1336). See editorial/PMC-BUNDLE-BINDING.md. No network, model or paid calls.
 *
 *   bind   --plot <slug>.plot.json --out <new-dir> [--title T] [--title-origin source_rewrite|request_summary|source_verbatim]
 *   verify --inputs <bind-dir> --render <render-visual --out dir>
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareOutput } from './lib/visual-execution-core.mjs';
import { PMC_BINDING_VERSION, loadPmcPlotBundle, pmcPlotToChartSpec, buildCardPlan, verifyRenderAgainstBundle } from './lib/pmc-bundle-binding.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
const allowed = { bind: ['--plot', '--out', '--title', '--title-origin'], verify: ['--inputs', '--render'] }[cmd];
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
try {
  if (!allowed) throw Object.assign(new Error('usage: bind-pmc-bundle.mjs bind|verify ... (see editorial/PMC-BUNDLE-BINDING.md)'), { code: 'USAGE' });
  for (let i = 0; i < rest.length; i++) {
    if (!allowed.includes(rest[i]) || Object.hasOwn(opts, rest[i]) || !rest[i + 1]) throw Object.assign(new Error(`unknown/duplicate/valueless option: ${rest[i]}`), { code: 'USAGE' });
    opts[rest[i]] = rest[++i];
  }
  if (cmd === 'bind') {
    if (!opts['--plot'] || !opts['--out']) throw Object.assign(new Error('--plot and --out are required'), { code: 'USAGE' });
    const out = resolve(opts['--out']);
    const bundle = loadPmcPlotBundle(opts['--plot']);
    const spec = pmcPlotToChartSpec(bundle);
    const specText = `${JSON.stringify(spec, null, 2)}\n`;
    const plan = buildCardPlan(bundle, { title: opts['--title'], titleOrigin: opts['--title-origin'], specRef: 'chart.spec.json', specSha256: sha(Buffer.from(specText)), plotRef: 'pmc.plot.json' });
    prepareOutput(out);
    mkdirSync(out, { recursive: true });
    copyFileSync(bundle.path, resolve(out, 'pmc.plot.json'));
    writeFileSync(resolve(out, 'chart.spec.json'), specText);
    write(resolve(out, 'plan.json'), plan);
    write(resolve(out, 'binding.json'), {
      binding_version: PMC_BINDING_VERSION, source: 'prediction-market-crawler plot bundle', schema: bundle.plot.schema,
      provider: bundle.plot.meta.provider, market_id: bundle.plot.meta.market_id, run_id: bundle.plot.meta.run_id, as_of: bundle.plot.meta.as_of,
      plot_file_sha256: bundle.file_sha256, plot_data_sha256: bundle.plot_data_sha256, meta_file: bundle.meta_file, pmc_png: bundle.pmc_png,
      chart_spec_sha256: sha(Buffer.from(specText)), title_origin: opts['--title-origin'] ?? 'source_verbatim', checks: bundle.checks,
      curve: { panel: 'straight segments between raw observations; no smoothing, step or fill is added', pmc_history_type: bundle.plot.meta.history_type ?? null, note: 'PMC draws event history as a step curve and owns smoothing; this panel does not, so the curve shape differs from the PMC PNG — owner reviews the final look' },
      numeric_policy_scope: 'title %-numbers only; checkNumericCard (title dates/period claims, footer as_of/coverage, dual mode) is NOT applied by this binding',
      api_calls: 0, publication: 'NOT_AUTHORIZED', visual_review: 'OWNER_REQUIRED',
    });
    console.log(JSON.stringify({ status: 'BOUND', out, plot_data_sha256: bundle.plot_data_sha256, checks: bundle.checks, next: 'resolve-editorial --plan, then render-visual --plan inputs/plan.json, then bind-pmc-bundle verify' }));
  } else {
    if (!opts['--inputs'] || !opts['--render']) throw Object.assign(new Error('--inputs and --render are required'), { code: 'USAGE' });
    const inputs = resolve(opts['--inputs']), render = resolve(opts['--render']);
    const binding = json(resolve(inputs, 'binding.json'));
    const bundle = loadPmcPlotBundle(resolve(inputs, 'pmc.plot.json'));
    if (bundle.file_sha256 !== binding.plot_file_sha256) throw Object.assign(new Error('bound plot file changed after binding'), { code: 'SOURCE_CHANGED' });
    const execution = json(resolve(render, 'receipt.json'));
    const qa = verifyRenderAgainstBundle(bundle, execution);
    const png = readFileSync(resolve(render, 'image.png'));
    const record = {
      binding_version: PMC_BINDING_VERSION, numeric_lineage_qa: qa.ok ? 'PASS' : 'FAIL', checks: qa.checks, notes: qa.notes,
      plot_data_sha256: bundle.plot_data_sha256, render_image_sha256: sha(png), receipt_chart_source_sha256: execution.charts?.[0]?.source_sha256 ?? null,
      chart_spec_sha256: binding.chart_spec_sha256, visual_qa: 'NOT_RUN_OWNER_REVIEW_REQUIRED', publication: 'NOT_AUTHORIZED',
    };
    if (execution.charts?.[0]?.source_sha256 !== binding.chart_spec_sha256) { record.numeric_lineage_qa = 'FAIL'; record.notes.push('rendered chart spec digest differs from the bound spec'); }
    write(resolve(render, 'pmc-binding-qa.json'), record);
    console.log(JSON.stringify({ status: record.numeric_lineage_qa, qa: resolve(render, 'pmc-binding-qa.json'), notes: record.notes }));
    if (record.numeric_lineage_qa !== 'PASS') process.exitCode = 1;
  }
} catch (err) {
  console.error(JSON.stringify({ status: 'FAILED', code: err.code ?? 'BINDING_FAILED', message: err.message }));
  process.exitCode = 1;
}
