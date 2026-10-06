/**
 * SUE-1333–1336: a local realization sidecar over existing profiles and renderers.
 * Natural-language interpretation belongs to intake-request/the calling LLM.
 * This module resolves its explicit task delta; it is NOT another LLM/parser,
 * profile database, approval engine, publisher, or source-of-truth store.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAxisProfiles } from './profile-core.mjs';
import { sha256, resolveWatermark, applyWatermark, decodePng, encodePng, WATERMARK_CHUNK_KEY, FONT_STACK } from './watermark-core.mjs';
import { renderChartPanel, validateChartAgainstArticle } from './chart-renderer.mjs';
import { esc, svgDocument, findRasterizer, rasterize, textMeasurer, wrapText } from './svg-tools.mjs';

export const EXECUTION_VERSION = '1.0.0';
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const stable = (x) => Array.isArray(x) ? x.map(stable) : object(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable(x[k])])) : x;
export const digest = (x) => sha256(JSON.stringify(stable(x)));
export class ExecutionError extends Error {
  constructor(code, message) { super(message); this.name = 'ExecutionError'; this.code = code; }
}
const fail = (code, message) => { throw new ExecutionError(code, message); };
function keys(o, allowed, where) {
  if (!object(o)) fail('INVALID_INPUT', `${where} must be an object`);
  for (const k of Object.keys(o)) if (!allowed.includes(k)) fail('UNKNOWN_FIELD', `${where}.${k}`);
}
function str(s, where) { if (typeof s !== 'string' || !s.trim()) fail('INVALID_INPUT', `${where} is required`); }
function localInput(ref, baseDir, expected = null) {
  str(ref, 'local file ref');
  if (/^[a-z]+:\/\//i.test(ref)) fail('SOURCE_REQUIRED', 'materialize remote bytes with the existing authorized handoff first');
  const path = resolve(baseDir, ref);
  if (!existsSync(path)) fail('SOURCE_REQUIRED', `missing local bytes: ${ref}`);
  const bytes = readFileSync(path), hash = sha256(bytes);
  if (expected && hash !== expected) fail('SOURCE_CHANGED', `digest mismatch: ${ref}`);
  return { ref, path, bytes, sha256: hash };
}
function box(slot, canvas) {
  keys(slot, ['x', 'y', 'width', 'height'], 'slot');
  if (!['x', 'y', 'width', 'height'].every((k) => Number.isFinite(slot[k]) && slot[k] >= 0 && slot[k] <= 1) || slot.width <= 0 || slot.height <= 0 || slot.x + slot.width > 1.0000001 || slot.y + slot.height > 1.0000001) fail('INVALID_SLOT', 'slots use normalized 0–1 coordinates inside the canvas');
  return { x: Math.round(slot.x * canvas.width), y: Math.round(slot.y * canvas.height), width: Math.round(slot.width * canvas.width), height: Math.round(slot.height * canvas.height) };
}
function canvasOf(defaults, preset, task) {
  let width = 1080, height = 1080, ratio = null;
  for (const c of [defaults ?? {}, preset ?? {}, task ?? {}]) {
    keys(c, ['width', 'height', 'aspect_ratio'], 'canvas');
    if (c.width !== undefined) width = c.width;
    if (c.height !== undefined) height = c.height;
    if (c.aspect_ratio !== undefined) {
      if (!/^\d+:\d+$/.test(c.aspect_ratio)) fail('INVALID_GEOMETRY', 'aspect_ratio must be W:H');
      const [a, b] = c.aspect_ratio.split(':').map(Number);
      if (!a || !b) fail('INVALID_GEOMETRY', 'ratio terms must be positive');
      ratio = c.aspect_ratio;
      if (c.height !== undefined && c.width === undefined) width = Math.round(height * a / b);
      else {
        const resolvedHeight = Math.round(width * b / a);
        if (c.height !== undefined && Math.abs(c.height - resolvedHeight) > 1) fail('INVALID_GEOMETRY', 'explicit dimensions and ratio conflict');
        height = resolvedHeight;
      }
    } else if (c.width !== undefined || c.height !== undefined) ratio = null;
  }
  if (![width, height].every((n) => Number.isInteger(n) && n >= 64 && n <= 8192) || width * height > 25000000) fail('INVALID_GEOMETRY', 'canvas dimensions must be 64–8192px, at most 25MP');
  return { width, height, aspect_ratio: ratio ?? `${width}:${height}` };
}

function resolveProfiles(selection) {
  keys(selection, ['surface', 'artifact', 'brand'], 'profiles');
  const out = {};
  for (const axis of ['surface', 'artifact', 'brand']) {
    if (selection[axis] === undefined) { if (axis !== 'brand') fail('PROFILE_REQUIRED', axis); continue; }
    const p = loadAxisProfiles(axis)[selection[axis]];
    if (!p) fail('UNKNOWN_PROFILE', `${axis}: ${selection[axis]}`);
    if (axis === 'artifact' && p.modality !== 'visual') fail('PROFILE_MISMATCH', 'image execution requires a visual artifact');
    out[axis] = p;
  }
  if (!(out.surface.artifact_fit ?? []).includes(selection.artifact)) fail('PROFILE_MISMATCH', `${selection.artifact} is not declared for ${selection.surface}; select a suitable profile`);
  return out;
}

/** LLM-produced plan + request text -> reproducible, capability-aware packet. */
export async function compileExecution(plan, { baseDir = process.cwd(), preset = {} } = {}) {
  keys(plan, ['schema_version', 'request', 'source', 'profiles', 'task', 'layers', 'caption', 'job_ref'], 'plan');
  if (plan.schema_version !== EXECUTION_VERSION) fail('VERSION', 'unsupported execution plan version');
  str(plan.request, 'request');
  keys(plan.source, ['ref', 'sha256', 'scope'], 'source');
  if (!['source_bound', 'illustrative'].includes(plan.source.scope)) fail('SOURCE_SCOPE', 'declare source_bound or illustrative; this is not a verification verdict');
  const source = localInput(plan.source.ref, baseDir, plan.source.sha256);
  const profiles = resolveProfiles(plan.profiles);
  const task = plan.task ?? {};
  const taskKeys = ['canvas', 'theme', 'text_policy', 'density', 'watermark', 'watermark_layer'];
  keys(task, taskKeys, 'task'); keys(preset, taskKeys, 'preset');
  const defaults = profiles.surface.visual_defaults ?? {};
  const canvas = canvasOf(defaults.canvas, preset.canvas, task.canvas);
  const theme = { background: '#FFFFFF', foreground: '#222222', accent: '#536756', font_family: FONT_STACK,
    ...(profiles.brand?.execution_defaults?.theme ?? {}), ...(preset.theme ?? {}), ...(task.theme ?? {}) };
  keys(theme, ['background', 'foreground', 'accent', 'font_family'], 'theme');
  for (const k of ['background', 'foreground', 'accent']) if (!/^#[a-f0-9]{6}$/i.test(theme[k])) fail('INVALID_COLOR', `${k} must be #RRGGBB after token resolution`);
  str(theme.font_family, 'font_family');
  const policy = task.text_policy ?? preset.text_policy ?? profiles.artifact.text_policy?.profile ?? 'external_overlay';
  if (!['no_text', 'external_overlay', 'hybrid_template', 'integrated_generated_text'].includes(policy)) fail('TEXT_POLICY', policy);
  const density = { semantic: profiles.artifact.semantic_density?.level, visual: profiles.artifact.visual_density?.level, ...(preset.density ?? {}), ...(task.density ?? {}) };
  keys(density, ['semantic', 'visual'], 'density');
  for (const v of Object.values(density)) if (!['low', 'moderate', 'medium', 'high', 'medium-high'].includes(v)) fail('DENSITY', 'use an explicit supported density');
  const watermark = resolveWatermark(profiles.brand?.watermark_default, preset.watermark, task.watermark);
  const watermarkLayer = task.watermark_layer ?? preset.watermark_layer ?? 'overlay';
  if (!['overlay', 'background'].includes(watermarkLayer)) fail('WATERMARK_LAYER', 'use overlay or background; flattened images cannot accept a behind-plot edit');
  if (!Array.isArray(plan.layers) || !plan.layers.length || plan.layers.length > 32) fail('LAYERS', 'one to 32 layers required');
  const ids = new Set(), layers = [];
  for (const l of plan.layers) {
    keys(l, ['id', 'kind', 'slot', 'ref', 'sha256', 'mode', 'fit', 'rights_note', 'protect', 'text', 'source_ref', 'font_size', 'weight', 'align', 'max_lines', 'line_height', 'color', 'instruction'], 'layer');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(l.id ?? '') || ids.has(l.id)) fail('LAYER_ID', 'layer IDs must be unique lowercase slugs');
    ids.add(l.id);
    if (!['text', 'image', 'chart', 'generated'].includes(l.kind)) fail('LAYER_KIND', String(l.kind));
    const permitted = {
      text: ['text', 'source_ref', 'font_size', 'weight', 'align', 'max_lines', 'line_height', 'color'],
      chart: ['ref', 'sha256'],
      image: ['ref', 'sha256', 'mode', 'fit', 'rights_note', 'protect'],
      generated: ['ref', 'sha256', 'mode', 'fit', 'rights_note', 'protect', 'instruction'],
    };
    keys(l, ['id', 'kind', 'slot', ...permitted[l.kind]], `layer ${l.id}`);
    const pixelSlot = box(l.slot, canvas);
    if (pixelSlot.width < 1 || pixelSlot.height < 1) fail('INVALID_SLOT', 'slot rounds to zero pixels');
    const next = { ...l, pixel_slot: pixelSlot };
    if (l.kind === 'text') {
      str(l.text, 'text'); str(l.source_ref, 'text source_ref');
      const knownRefs = new Set(['request', plan.source.ref, ...plan.layers.map((x) => x.ref).filter(Boolean)]);
      if (!knownRefs.has(l.source_ref.split('#')[0])) fail('TEXT_SOURCE', `unresolved source_ref: ${l.source_ref}`);
      if (policy === 'no_text') fail('TEXT_POLICY', 'no_text cannot contain text layers');
      next.font_size = l.font_size ?? Math.round(canvas.width * 0.05);
      next.weight = l.weight ?? 400; next.max_lines = l.max_lines ?? 3;
      next.align = l.align ?? 'start'; next.line_height = l.line_height ?? 1.25;
      if (!Number.isFinite(next.font_size) || next.font_size < 10 || next.font_size > 256 || !Number.isInteger(next.max_lines) || next.max_lines < 1 || next.max_lines > 30 || ![400, 500, 600, 700, 800].includes(next.weight) || !['start', 'middle', 'end'].includes(next.align) || !(next.line_height >= 1.05 && next.line_height <= 2)) fail('TEXT_STYLE', l.id);
      if (l.color && !/^#[a-f0-9]{6}$/i.test(l.color)) fail('INVALID_COLOR', l.id);
    } else if (l.kind === 'generated' && !l.ref) {
      str(l.instruction, 'generated layer instruction');
      next.status = 'RENDER_REQUIRED';
    } else {
      const file = localInput(l.ref, baseDir, l.sha256);
      next.sha256 = file.sha256;
      if (l.kind === 'chart') {
        // Chart values stay in their existing canonical spec, not in the prompt.
        const chart = JSON.parse(file.bytes);
        if (!['line', 'bar'].includes(chart.type)) fail('CHART_BINDING', 'v1 binds line/bar; use an existing rendered evidence image for another geometry');
      } else {
        next.mode = l.mode ?? 'exact_composite'; next.fit = l.fit ?? 'contain';
        if (!['exact_composite', 'cutout_composite'].includes(next.mode)) fail('EDIT_REQUIRED', 'supply the actual edited background/cutout; no inpainting is performed by this compositor');
        if (!['contain', 'cover'].includes(next.fit)) fail('IMAGE_FIT', 'contain or cover');
        str(l.rights_note, 'rights_note');
        const png = decodePng(file.bytes);
        if (png.text[WATERMARK_CHUNK_KEY]) fail('INPUT_IS_DERIVATIVE', 'use the clean master; do not stack a previous watermark');
        if (next.mode === 'cutout_composite' && (png.channels !== 4 || !png.pixels.some((v, i) => i % 4 === 3 && v < 255))) fail('CUTOUT_REQUIRED', 'cutout mode requires a supplied PNG with actual alpha; no automatic background removal');
        next.native_geometry = { width: png.width, height: png.height };
        for (const protectedBox of l.protect ?? []) {
          const p = box(protectedBox, { width: png.width, height: png.height });
          if (next.fit === 'cover') {
            const scale = Math.max(pixelSlot.width / png.width, pixelSlot.height / png.height);
            const ox = (pixelSlot.width - png.width * scale) / 2, oy = (pixelSlot.height - png.height * scale) / 2;
            if (ox + p.x * scale < -0.01 || oy + p.y * scale < -0.01 || ox + (p.x + p.width) * scale > pixelSlot.width + 0.01 || oy + (p.y + p.height) * scale > pixelSlot.height + 0.01) fail('PROTECTED_CROP', l.id);
          }
        }
      }
    }
    layers.push(next);
  }
  if (policy === 'no_text' && plan.source.scope === 'illustrative') fail('TEXT_POLICY', 'illustrative scope requires a visible label; no_text conflicts');
  if (policy === 'no_text' && layers.some((l) => l.kind === 'chart')) fail('TEXT_POLICY', 'chart axes require text');
  if (policy === 'no_text' && watermark.enabled) fail('TEXT_POLICY', 'no_text and a text watermark conflict');
  const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  for (let i = 0; i < layers.length; i++) for (let j = 0; j < i; j++) {
    if (['text', 'chart'].includes(layers[j].kind) && intersects(layers[j].pixel_slot, layers[i].pixel_slot)) fail('LAYER_OVERLAP', `${layers[i].id} would obscure ${layers[j].id}; re-layout instead of overpainting text/evidence`);
  }
  const pending = layers.filter((l) => l.status === 'RENDER_REQUIRED');
  let legacy = null;
  if (plan.job_ref) {
    const f = localInput(plan.job_ref, baseDir); const job = JSON.parse(f.bytes);
    // Load the existing authority/lock/compiler only for jobs that actually use it.
    const core = await import('./visual-job-core.mjs');
    const errors = core.validateVisualJobFile(f.path);
    if (errors.length) fail('LEGACY_JOB_INVALID', JSON.stringify(errors));
    if (job.artifact_profile !== plan.profiles.artifact) fail('PROFILE_MISMATCH', 'job and execution artifact differ');
    if (job.approved_asset?.state === 'human_approved_locked') fail('APPROVED_MASTER_ROUTE', 'use the existing approved-media materializer, not a new generation packet');
    const compiled = pending.length ? core.compileVisualPrompt(job) : {};
    legacy = { ref: f.ref, sha256: f.sha256, visual_brief: job.visual_brief ?? null, render_spec: job.render_spec ?? null, ...compiled };
  }
  const origins = {};
  for (const key of ['canvas', 'text_policy', 'density', 'watermark', 'watermark_layer']) origins[key] = task[key] !== undefined ? 'task' : preset[key] !== undefined ? 'preset' : 'profile_or_renderer_default';
  for (const key of Object.keys(theme)) origins[`theme.${key}`] = task.theme?.[key] !== undefined ? 'task' : preset.theme?.[key] !== undefined ? 'preset' : profiles.brand?.execution_defaults?.theme?.[key] !== undefined ? 'brand' : 'renderer_default_not_canonical_brand_token';
  const packet = {
    schema_version: EXECUTION_VERSION, kind: 'visual_execution', status: pending.length ? 'RENDER_REQUIRED' : 'COMPOSITION_REQUIRED',
    request: plan.request, request_hash: digest(plan), source: { ref: source.ref, sha256: source.sha256, scope: plan.source.scope },
    profiles: Object.fromEntries(Object.entries(profiles).map(([axis, p]) => [axis, { id: plan.profiles[axis], version: p.profile_version ?? p.schema_version, sha256: digest(p) }])),
    canvas, theme, density, text_policy: policy, watermark, watermark_layer: watermarkLayer, field_origins: origins,
    resolved_requirements: {
      artifact: { primary_job: profiles.artifact.primary_job, composition: profiles.artifact.composition, acceptance: profiles.artifact.acceptance, readability: profiles.artifact.readability_gate },
      surface: profiles.surface.visual_defaults ?? profiles.surface.constraints,
      brand: profiles.brand ? { stable_visual_properties: profiles.brand.stable_visual_properties, palette: profiles.brand.palette, materiality: profiles.brand.line_and_materiality } : null,
      density_review: 'Declared intent, not measured coverage. Review actual semantic/visual density; explicit slots own geometry.',
    },
    layers, caption: plan.caption ?? '', legacy,
    generation: pending.map((l) => ({ layer_id: l.id, instruction: l.instruction, pixel_slot: l.pixel_slot,
      constraints: 'Generate this illustrative layer only. Do not draw data geometry, numbers, citations, watermark or source photo identity. Use the supplied source and authorized reference traits only.',
      external_generator_required: true })),
    qa: { source_semantics: 'NOT_REVIEWED', visual: 'NOT_REVIEWED', publication: 'NOT_AUTHORIZED' },
  };
  packet.execution_hash = digest(packet);
  return packet;
}

/** A fresh output directory prevents stale PNGs being mistaken for a failed rerun. */
export function prepareOutput(outDir) {
  if (!outDir) fail('OUTPUT_REQUIRED', 'provide a separate output directory');
  if (existsSync(outDir) && readdirSync(outDir).length) fail('OUTPUT_EXISTS', 'use a new empty output directory; previous runs and input files are never overwritten');
}


function imageElement(file, l) {
  const b = l.pixel_slot;
  const ratio = l.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
  return `<svg x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" viewBox="0 0 ${b.width} ${b.height}" overflow="hidden"><image width="${b.width}" height="${b.height}" preserveAspectRatio="${ratio}" xlink:href="data:image/png;base64,${file.bytes.toString('base64')}"/></svg>`;
}

/** Writes clean master + optional derivative + packet/receipt; never publishes. */
export async function executeVisual(plan, { baseDir = process.cwd(), preset = {}, outDir, rasterizer = 'auto' } = {}) {
  prepareOutput(outDir);
  const packet = await compileExecution(plan, { baseDir, preset });
  const adapter = findRasterizer(rasterizer);
  packet.rasterizer = adapter ? { name: adapter.name, version: adapter.version } : null;
  if (!adapter || packet.status === 'RENDER_REQUIRED') {
    if (!adapter) packet.missing_capabilities = ['local_svg_rasterizer'];
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'execution.json'), `${JSON.stringify(packet, null, 2)}\n`);
    return packet;
  }
  const { width, height } = packet.canvas;
  const measure = textMeasurer(adapter, packet.theme.font_family);
  const source = localInput(packet.source.ref, baseDir, packet.source.sha256);
  const inputs = [source]; if (plan.job_ref) inputs.push(localInput(plan.job_ref, baseDir));
  let article = null;
  if (plan.job_ref) { try { article = JSON.parse(source.bytes); } catch { /* article check requires the actual article JSON */ } }
  const elements = [], charts = [], textEvidence = [], imageEvidence = [];
  const exclusions = [];
  for (const l of packet.layers) {
    const b = l.pixel_slot;
    if (l.kind === 'text') {
      const lines = wrapText(l.text, { width: b.width, height: b.height, size: l.font_size, weight: l.weight, maxLines: l.max_lines, lineHeight: l.line_height }, measure);
      const x = b.x + (l.align === 'middle' ? b.width / 2 : l.align === 'end' ? b.width : 0);
      elements.push(`<text font-family="${esc(packet.theme.font_family)}" font-size="${l.font_size}" font-weight="${l.weight}" fill="${l.color ?? packet.theme.foreground}" text-anchor="${l.align}">${lines.map((t, i) => `<tspan x="${x}" y="${b.y + l.font_size + i * l.font_size * l.line_height}">${esc(t)}</tspan>`).join('')}</text>`);
      textEvidence.push({ id: l.id, text: l.text, source_ref: l.source_ref, lines, font_size: l.font_size, slot: b });
    } else {
      const file = localInput(l.ref, baseDir, l.sha256); inputs.push(file);
      if (l.kind === 'chart') {
        const spec = JSON.parse(file.bytes);
        if (article?.verification) {
          const errors = validateChartAgainstArticle(spec, article);
          if (errors.length) fail('CHART_CLAIM', errors.join('; '));
        }
        const result = renderChartPanel(spec, { width: b.width, height: b.height, theme: packet.theme, measure });
        elements.push(`<svg x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" overflow="hidden">${result.svg}</svg>`);
        charts.push({ id: l.id, source_ref: l.ref, source_sha256: file.sha256, ...result, svg: undefined });
      } else {
        elements.push(imageElement(file, l));
        imageEvidence.push({ id: l.id, ref: l.ref, source_sha256: file.sha256, mode: l.mode, fit: l.fit, source_geometry: l.native_geometry, slot: b, rights_note: l.rights_note, protect: l.protect ?? [] });
      }
    }
    // Background watermarks may sit below evidence marks, but not below copy.
    if (packet.watermark_layer === 'overlay' || l.kind === 'text') exclusions.push({ zone_id: l.id, ...l.slot });
  }
  if (packet.source.scope === 'illustrative') {
    elements.push(`<text x="${Math.round(width * 0.05)}" y="${Math.round(height * 0.985)}" font-family="${esc(packet.theme.font_family)}" font-size="${Math.max(14, Math.round(width * 0.018))}" fill="${packet.theme.foreground}">ILLUSTRATIVE / 가상 예시</text>`);
  }
  const background = `<rect width="${width}" height="${height}" fill="${packet.theme.background}"/>`;
  const cleanSvg = svgDocument(width, height, background + elements.join(''));
  const master = rasterize(cleanSvg, adapter);
  const m = decodePng(master);
  if (m.width !== width || m.height !== height) fail('OUTPUT_GEOMETRY', 'rasterizer returned a different size');
  const config = resolveWatermark(packet.watermark, { exclusion_zones: exclusions });
  const wmAdapter = { render: (svg) => rasterize(svg, adapter), version: adapter.version };
  let final = master, watermarkEvidence = null;
  if (config.enabled && packet.watermark_layer === 'background') {
    const base = rasterize(svgDocument(width, height, background), adapter);
    const marked = applyWatermark(base, config, { masterRef: 'background-layer', rasterizer: wmAdapter });
    final = rasterize(svgDocument(width, height, `<image width="${width}" height="${height}" xlink:href="data:image/png;base64,${marked.bytes.toString('base64')}"/>${elements.join('')}`), adapter);
    const composed = decodePng(final);
    final = encodePng({ ...composed, text: { ...composed.text, [WATERMARK_CHUNK_KEY]: JSON.stringify({ master_sha256: sha256(master), text: config.text, layer: 'background' }) } });
    watermarkEvidence = { ...marked.lineage, composed_layer: 'background', final_sha256: sha256(final), final_master_sha256: sha256(master) };
  } else {
    const marked = applyWatermark(master, config, { masterRef: 'master.png', rasterizer: wmAdapter });
    final = marked.bytes; watermarkEvidence = marked.lineage ?? null;
  }
  // Resolve actual file identities before writing. Never overwrite an input,
  // including via a symlinked output directory.
  mkdirSync(outDir, { recursive: true });
  const realOut = realpathSync(outDir);
  for (const name of ['master.png', 'image.png', 'master.svg', 'execution.json', 'receipt.json']) {
    const target = resolve(realOut, name);
    for (const f of inputs) if (realpathSync(f.path) === target || (existsSync(target) && realpathSync(target) === realpathSync(f.path))) fail('SOURCE_OVERWRITE', `output would replace input ${f.ref}`);
  }
  for (const f of inputs) localInput(f.ref, baseDir, f.sha256);
  packet.status = 'RENDERED_NEEDS_REVIEW';
  const receipt = {
    schema_version: EXECUTION_VERSION, status: packet.status, request_hash: packet.request_hash, execution_hash: packet.execution_hash,
    renderer: { tool: 'aes-visual-execution', version: EXECUTION_VERSION, ...packet.rasterizer, font_stack: packet.theme.font_family },
    inputs: inputs.map((f) => ({ ref: f.ref, sha256: f.sha256 })), geometry: packet.canvas,
    outputs: { master: { ref: 'master.png', sha256: sha256(master) }, image: { ref: 'image.png', sha256: sha256(final) }, svg: { ref: 'master.svg', sha256: sha256(cleanSvg) } },
    text: textEvidence, charts, images: imageEvidence, watermark: watermarkEvidence,
    checks: { output_geometry: 'PASS', text_fit: 'PASS', inputs_rechecked: 'PASS', numeric_render_binding: charts.length ? 'PASS' : 'NOT_APPLICABLE', actual_pixel_semantic_review: 'NOT_RUN_PHASE4', source_truth: 'NOT_ESTABLISHED_BY_RENDERER' },
    api_calls: 0, publication_authorized: false,
  };
  writeFileSync(resolve(outDir, 'master.svg'), cleanSvg);
  writeFileSync(resolve(outDir, 'master.png'), master);
  writeFileSync(resolve(outDir, 'image.png'), final);
  writeFileSync(resolve(outDir, 'execution.json'), `${JSON.stringify(packet, null, 2)}\n`);
  writeFileSync(resolve(outDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return { ...packet, receipt };
}
