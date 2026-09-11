#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CODES,
  compileVisualPrompt,
  compileVisualPromptWithAuthorityForTests,
  validateVisualJob,
  validateVisualJobWithAuthorityForTests,
  validateVisualProduction,
} from './lib/visual-job-core.mjs';
import {
  AUTHORITY_CODES,
  VISUAL_SCHEMA_MOUNTS,
  VisualSemanticAuthorityError,
  buildSchemaFieldInventory,
  collectClassifiedRenderedText,
  loadVisualSemanticAuthorityContext,
  protectedProjection,
  sameCanonicalProjection,
  validateVisualSemanticAuthority,
} from './lib/visual-semantic-authority-core.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const clone = (value) => JSON.parse(JSON.stringify(value));
const read = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
let failures = 0;
function check(name, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${!passed && detail ? ` — ${detail}` : ''}`);
  if (!passed) failures += 1;
}
const codes = (result) => result.issues.map((entry) => entry.code);

function fixtureContext(name) {
  const source = `evals/fixtures/visual-semantic-authority/${name}/schema.json`;
  return {
    schemaMounts: [{ mount: '/', schema_source: source, schema: read(source) }],
    registry: read(`evals/fixtures/visual-semantic-authority/${name}/registry.json`),
  };
}

function setSynthetic(path, value) {
  const root = {};
  const segments = path.slice(1).split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];
    if (segment === '*') throw new Error(`unexpected leading wildcard in ${path}`);
    if (index === segments.length - 1) {
      current[segment] = value;
    } else if (next === '*') {
      current[segment] = [{}];
      current = current[segment][0];
      index += 1;
    } else {
      current[segment] = {};
      current = current[segment];
    }
  }
  return root;
}

function textFreeV2() {
  const job = read('schemas/examples/visual-job-body-infographic-v2.example.json');
  job.text_policy = 'no_text';
  delete job.visual_brief.text_ownership;
  job.visual_brief.factual_invariants = [];
  job.render_spec.spatial_layers.deterministic_factual = [];
  job.render_spec.spatial_layers.generative_semantic = [];
  job.render_spec.text_handling.deterministic_overlay = [];
  delete job.render_spec.text_handling.text_ownership;
  delete job.visual_production;
  return job;
}

console.log('\nregistry and structural closure');
const committed = validateVisualSemanticAuthority();
check('committed authority registry exactly covers 315 schema properties', committed.ok && committed.inventory.length === 315 && committed.registry.fields.length === 315,
  JSON.stringify(committed.issues));
check('four fixed mounts replace the three opaque Visual Job properties exactly once',
  JSON.stringify(VISUAL_SCHEMA_MOUNTS.map((entry) => entry.mount)) === JSON.stringify(['/', '/visual_brief', '/render_spec', '/visual_production']) &&
    buildSchemaFieldInventory().length === 315);

const allow = validateVisualSemanticAuthority(fixtureContext('allow'));
check('allow schema/registry pair is accepted', allow.ok, JSON.stringify(allow.issues));
const deny = validateVisualSemanticAuthority(fixtureContext('deny-unclassified'));
check(`deny-unclassified pair fails ${AUTHORITY_CODES.UNCLASSIFIED_FIELD}`,
  codes(deny).includes(AUTHORITY_CODES.UNCLASSIFIED_FIELD), JSON.stringify(deny.issues));

for (const [name, mutate, code] of [
  ['orphan path', (registry) => registry.fields.push({ ...registry.fields[0], path: '/orphan' }), AUTHORITY_CODES.ORPHANED_FIELD],
  ['duplicate path', (registry) => registry.fields.push(clone(registry.fields[0])), AUTHORITY_CODES.REGISTRY_INVALID],
  ['wrong node kind', (registry) => { registry.fields[0].node_kind = 'object'; }, AUTHORITY_CODES.SHAPE_MISMATCH],
  ['stale shape digest', (registry) => { registry.fields[0].shape_sha256 = `sha256:${'0'.repeat(64)}`; }, AUTHORITY_CODES.SHAPE_MISMATCH],
]) {
  const context = fixtureContext('allow');
  mutate(context.registry);
  const result = validateVisualSemanticAuthority(context);
  check(`${name} fails named code ${code}`, codes(result).includes(code), JSON.stringify(result.issues));
}

{
  const fakeValidatedContext = { ok: true, schemaMounts: [], registry: { fields: [] }, registryByPath: new Map() };
  const result = validateVisualJob(read('schemas/examples/visual-job-body-infographic-v2.example.json'), { authorityContext: fakeValidatedContext });
  check(`caller-supplied ok flag cannot bypass validation: ${AUTHORITY_CODES.REGISTRY_INVALID}`,
    result.some((entry) => entry.code === AUTHORITY_CODES.REGISTRY_INVALID), JSON.stringify(result));
}

{
  const schema = read('schemas/visual-job.schema.json');
  schema.properties.future_root_surface = { type: 'string' };
  const job = read('schemas/examples/visual-job-body-infographic-v2.example.json');
  job.future_root_surface = 'unregistered';
  const result = validateVisualJob(job, { schema });
  check(`legacy independent schema injection cannot bypass committed authority: ${AUTHORITY_CODES.SHAPE_MISMATCH}`,
    result.some((entry) => entry.code === AUTHORITY_CODES.SHAPE_MISMATCH), JSON.stringify(result));
}

for (const [name, mutate, code] of [
  ['root required relaxation', (context) => { context.schemaMounts.find((entry) => entry.mount === '/').schema.required.pop(); }, AUTHORITY_CODES.SHAPE_MISMATCH],
  ['nested required relaxation', (context) => { context.schemaMounts.find((entry) => entry.mount === '/').schema.$defs.audience.required.pop(); }, AUTHORITY_CODES.SHAPE_MISMATCH],
  ['nested additionalProperties relaxation', (context) => { context.schemaMounts.find((entry) => entry.mount === '/').schema.$defs.audience.additionalProperties = true; }, AUTHORITY_CODES.REGISTRY_INVALID],
]) {
  const context = clone(loadVisualSemanticAuthorityContext());
  mutate(context);
  const result = validateVisualSemanticAuthority(context);
  check(`${name} fails named code ${code}`, codes(result).includes(code), JSON.stringify(result.issues));
}

for (const [name, mutate] of [
  ['unresolved local reference', (context) => { context.schemaMounts[0].schema.properties.caption = { $ref: '#/$defs/missing' }; }],
  ['cross-file reference', (context) => { context.schemaMounts[0].schema.properties.caption = { $ref: 'other.schema.json' }; }],
  ['reference cycle', (context) => {
    context.schemaMounts[0].schema.$defs = { loop: { $ref: '#/$defs/loop' } };
    context.schemaMounts[0].schema.properties.caption = { $ref: '#/$defs/loop' };
  }],
  ['reachable open object', (context) => {
    context.schemaMounts[0].schema.properties.caption = {
      type: 'object', additionalProperties: true, properties: { value: { type: 'string' } },
    };
  }],
]) {
  const context = fixtureContext('allow');
  mutate(context);
  const result = validateVisualSemanticAuthority(context);
  check(`${name} fails ${AUTHORITY_CODES.REGISTRY_INVALID}`, codes(result).includes(AUTHORITY_CODES.REGISTRY_INVALID), JSON.stringify(result.issues));
}

{
  const context = clone(loadVisualSemanticAuthorityContext());
  const renderMount = context.schemaMounts.find((entry) => entry.mount === '/render_spec');
  renderMount.schema.properties.spatial_layers.properties.future_surface = { type: 'array', items: { type: 'string', minLength: 1 } };
  const baseline = read('schemas/examples/visual-job-body-infographic-v2.example.json');
  check('synthetic-new-field public-path baseline is validator-clean', validateVisualJob(baseline).length === 0);
  const job = clone(baseline);
  job.render_spec.spatial_layers.future_surface = ['future literal surface'];
  const validationCodes = validateVisualJobWithAuthorityForTests(job, context).map((entry) => entry.code);
  check(`test-only injected validator fails closed on a synthetic new field with ${AUTHORITY_CODES.UNCLASSIFIED_FIELD}`,
    validationCodes.includes(AUTHORITY_CODES.UNCLASSIFIED_FIELD), validationCodes.join(', '));
  let compileError;
  let compiled;
  try { compiled = compileVisualPromptWithAuthorityForTests(job, context); } catch (error) { compileError = error; }
  check(`test-only injected compiler fails closed before output with ${AUTHORITY_CODES.UNCLASSIFIED_FIELD}`,
    compiled === undefined && compileError instanceof VisualSemanticAuthorityError && compileError.code === AUTHORITY_CODES.UNCLASSIFIED_FIELD,
    compileError?.message);

  const added = buildSchemaFieldInventory(context.schemaMounts).find((entry) => entry.path === '/render_spec/spatial_layers/future_surface');
  context.registry.fields.push({
    ...added,
    rendered_text: 'none',
    prompt_semantics: 'prompt_input',
    localized_repair: 'protected',
    rationale: 'The synthetic field is intentionally classified as a prompt input without an assembler read.',
  });
  check('synthetic matching registry entry is structurally valid', validateVisualSemanticAuthority(context).ok,
    JSON.stringify(validateVisualSemanticAuthority(context).issues));
  const unreadValidationCodes = validateVisualJobWithAuthorityForTests(job, context).map((entry) => entry.code);
  check(`test-only injected validator reports present but unread prompt input as ${AUTHORITY_CODES.PROMPT_UNCONSUMED}`,
    unreadValidationCodes.includes(AUTHORITY_CODES.PROMPT_UNCONSUMED), unreadValidationCodes.join(', '));
  compileError = undefined;
  compiled = undefined;
  try { compiled = compileVisualPromptWithAuthorityForTests(job, context); } catch (error) { compileError = error; }
  check(`present but unread prompt input fails ${AUTHORITY_CODES.PROMPT_UNCONSUMED}`,
    compiled === undefined && compileError instanceof VisualSemanticAuthorityError && compileError.code === AUTHORITY_CODES.PROMPT_UNCONSUMED,
    compileError?.message);
}

{
  const job = textFreeV2();
  job.render_spec.spatial_layers.generative_semantic = ['41.4%'];
  const supplied = clone(loadVisualSemanticAuthorityContext());
  supplied.registry.fields.find((entry) => entry.path === '/render_spec/spatial_layers/generative_semantic').rendered_text = 'none';
  const suppliedValidation = validateVisualSemanticAuthority(supplied);
  check('substituted internally consistent registry remains valid only as a test fixture', suppliedValidation.ok,
    JSON.stringify(suppliedValidation.issues));
  const validationCodes = validateVisualJob(job, { authorityContext: supplied }).map((entry) => entry.code);
  check(`production validateVisualJob rejects substituted registry authority with ${AUTHORITY_CODES.REGISTRY_INVALID}`,
    validationCodes.includes(AUTHORITY_CODES.REGISTRY_INVALID), validationCodes.join(', '));
  const productionCodes = validateVisualProduction(job, job.job_id, {}, { chain: new Set(), depth: 0 }, supplied).map((entry) => entry.code);
  check(`production validateVisualProduction rejects substituted registry authority with ${AUTHORITY_CODES.REGISTRY_INVALID}`,
    productionCodes.includes(AUTHORITY_CODES.REGISTRY_INVALID), productionCodes.join(', '));
  let compiled;
  let compileError;
  try { compiled = compileVisualPrompt(job, { authorityContext: supplied }); } catch (error) { compileError = error; }
  check(`production compiler rejects substituted registry before emitting 41.4% with ${AUTHORITY_CODES.REGISTRY_INVALID}`,
    compiled === undefined && compileError instanceof VisualSemanticAuthorityError && compileError.code === AUTHORITY_CODES.REGISTRY_INVALID,
    compileError?.message);
}

{
  const job = textFreeV2();
  job.render_spec.spatial_layers.generative_semantic = ['41.4%'];
  const context = clone(loadVisualSemanticAuthorityContext());
  const validated = validateVisualSemanticAuthority(context);
  const entry = validated.registry.fields.find((field) => field.path === '/render_spec/spatial_layers/generative_semantic');
  const mutationApplied = Reflect.set(entry, 'rendered_text', 'none');
  let compiled;
  let compileError;
  try { compiled = compileVisualPromptWithAuthorityForTests(job, validated); } catch (error) { compileError = error; }
  check(`post-validation mutation is blocked and cannot emit 41.4%: ${CODES.TEXT_OWNERSHIP_MISMATCH}`,
    validated.ok && Object.isFrozen(validated) && Object.isFrozen(validated.registry) && Object.isFrozen(entry) &&
      mutationApplied === false && entry.rendered_text === 'generative_structural_text' && compiled === undefined &&
      compileError?.message.includes(`[${CODES.TEXT_OWNERSHIP_MISMATCH}]`),
    `mutationApplied=${mutationApplied} class=${entry.rendered_text} error=${compileError?.message}`);
}

{
  const rendered = committed.registry.fields.filter((entry) => entry.rendered_text !== 'none');
  let failedEntry;
  for (const entry of rendered) {
    const marker = `meaningful-${entry.rendered_text}`;
    const synthetic = setSynthetic(entry.path, entry.node_kind === 'scalar_array' ? [marker] : marker);
    const actual = collectClassifiedRenderedText(synthetic, committed);
    const expectedPath = `${entry.path.replace('/*/', '/0/')}${entry.node_kind === 'scalar_array' ? '/0' : ''}`;
    if (!actual.some((record) => record.path === expectedPath && record.ownership_class === entry.rendered_text && record.value === marker)) {
      failedEntry = { entry, actual, expectedPath };
      break;
    }
  }
  check(`property-driven rendered-text collector covers all ${rendered.length} non-none entries`, !failedEntry, JSON.stringify(failedEntry));
}

{
  const protectedLeaves = committed.registry.fields.filter((entry) => entry.localized_repair === 'protected' && ['scalar', 'scalar_array'].includes(entry.node_kind));
  let failedEntry;
  for (const entry of protectedLeaves) {
    const prior = setSynthetic(entry.path, entry.node_kind === 'scalar_array' ? ['before'] : 'before');
    const current = setSynthetic(entry.path, entry.node_kind === 'scalar_array' ? ['after'] : 'after');
    if (sameCanonicalProjection(protectedProjection(prior, committed), protectedProjection(current, committed))) {
      failedEntry = entry;
      break;
    }
  }
  check(`property-driven protected projection detects every protected leaf (${protectedLeaves.length})`, !failedEntry, JSON.stringify(failedEntry));
}

console.log('\nopen A fail-closed reproductions');
{
  const baseline = textFreeV2();
  check('no_text A baseline with ownership blocks absent is validator-clean', validateVisualJob(baseline).length === 0,
    JSON.stringify(validateVisualJob(baseline)));
  const job = clone(baseline);
  job.visual_production = { factual_overlay: { payload: { items: [{ exact_text: '41.4%' }] } } };
  const found = validateVisualJob(job).map((entry) => entry.code);
  check(`no_text factual-overlay exact_text fails ${CODES.TEXT_OWNERSHIP_MISMATCH}`,
    found.includes(CODES.TEXT_OWNERSHIP_MISMATCH), found.join(', '));
}
{
  const baseline = textFreeV2();
  const job = clone(baseline);
  job.render_spec.spatial_layers.generative_semantic = ['41.4%'];
  const found = validateVisualJob(job).map((entry) => entry.code);
  check(`no_text generative_semantic fails ${CODES.TEXT_OWNERSHIP_MISMATCH}`,
    found.includes(CODES.TEXT_OWNERSHIP_MISMATCH), found.join(', '));
  let error;
  let compiled;
  try { compiled = compileVisualPrompt(job); } catch (caught) { error = caught; }
  check(`direct compilation refuses no_text generative_semantic with ${CODES.TEXT_OWNERSHIP_MISMATCH}`,
    compiled === undefined && error?.message.includes(`[${CODES.TEXT_OWNERSHIP_MISMATCH}]`), error?.message);
}
{
  const cases = [
    ['absent', {}, false],
    ['empty', { render_spec: { spatial_layers: { generative_semantic: [] } } }, false],
    ['null', { render_spec: { spatial_layers: { generative_semantic: null } } }, false],
    ['whitespace-only', { render_spec: { spatial_layers: { generative_semantic: [' \t\n'] } } }, false],
    ['non-blank Unicode', { render_spec: { spatial_layers: { generative_semantic: ['가'] } } }, true],
  ];
  for (const [name, record, expected] of cases) {
    const found = collectClassifiedRenderedText(record, committed);
    check(`meaningful rendered-text boundary: ${name}`, (found.length > 0) === expected, JSON.stringify(found));
  }
}

console.log('\ncompatibility and durable vocabulary');
for (const [path, expectedSha] of [
  ['evals/dogfood/2026-09-05-sue570-pilot/source-a/02-visual/visual-job-child.json', '7f3a13256ba5e5165b34264639ecef8b9b70c519ea78a1a4e06f737f51df3f87'],
  ['schemas/examples/visual-job-evidence-visual.example.json', 'bc216f321c659ce7dd742bc010110e5eb3c27bf0a76fb80e2d9e4327b844b923'],
]) {
  const bytes = readFileSync(resolve(ROOT, path));
  const actualSha = createHash('sha256').update(bytes).digest('hex');
  const issues = validateVisualJob(JSON.parse(bytes));
  check(`${path} is byte-unchanged and validator-clean`, actualSha === expectedSha && issues.length === 0,
    `sha=${actualSha} issues=${JSON.stringify(issues)}`);
}
for (const path of [
  'schemas/examples/visual-job-body-infographic-v2.example.json',
  'schemas/examples/visual-job-body-infographic-factual-repair.example.json',
]) {
  const issues = validateVisualJob(read(path));
  check(`${path} remains validator-clean`, issues.length === 0, JSON.stringify(issues));
}
{
  const durable = `${readFileSync(resolve(ROOT, 'schemas/visual-semantic-authority.registry.json'), 'utf8')}\n${readFileSync(resolve(ROOT, 'schemas/visual-semantic-authority-registry.schema.json'), 'utf8')}`;
  check('durable authority registry/schema contain no generator identity names',
    !/openai|anthropic|claude|gpt|gemini|firefly|midjourney|dall[- ]?e/i.test(durable));
  const reviewSchema = readFileSync(resolve(ROOT, 'schemas/visual-review.schema.json'), 'utf8');
  check('durable review handoff vocabulary remains PASS_TO_HUMAN_REVIEW', reviewSchema.includes('PASS_TO_HUMAN_REVIEW'));
}

process.exitCode = failures ? 1 : 0;
