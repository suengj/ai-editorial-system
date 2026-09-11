/**
 * Fail-closed semantic-field authority for the composed Visual Job contract.
 *
 * The registry is the only field classification data. Consumers receive
 * projections derived from validated entries; an unclassified or stale schema
 * property makes the entire authority context unusable.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const AUTHORITY_CODES = Object.freeze({
  REGISTRY_INVALID: 'visual-semantic-authority-registry-invalid',
  UNCLASSIFIED_FIELD: 'visual-semantic-authority-unclassified-field',
  ORPHANED_FIELD: 'visual-semantic-authority-orphaned-field',
  SHAPE_MISMATCH: 'visual-semantic-authority-shape-mismatch',
  PROMPT_UNCONSUMED: 'visual-semantic-authority-prompt-unconsumed',
});

export const VISUAL_SCHEMA_MOUNTS = Object.freeze([
  Object.freeze({ mount: '/', schema_source: 'schemas/visual-job.schema.json' }),
  Object.freeze({ mount: '/visual_brief', schema_source: 'schemas/visual-brief.schema.json' }),
  Object.freeze({ mount: '/render_spec', schema_source: 'schemas/render-spec.schema.json' }),
  Object.freeze({ mount: '/visual_production', schema_source: 'schemas/visual-production.schema.json' }),
]);

export const VISUAL_AUTHORITY_REGISTRY = resolve(ROOT, 'schemas/visual-semantic-authority.registry.json');
export const VISUAL_AUTHORITY_REGISTRY_SCHEMA = resolve(ROOT, 'schemas/visual-semantic-authority-registry.schema.json');

const ABSENT = Object.freeze({ $visual_semantic_authority: 'absent' });
const PRESENT_OBJECT = Object.freeze({ $visual_semantic_authority: 'present_object' });
const STRUCTURAL_KEYS = Object.freeze([
  '$ref', 'type', 'const', 'enum', 'required', 'additionalProperties', 'pattern',
  'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'minimum',
  'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'format',
]);

const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'));
const escapePointer = (value) => String(value).replace(/~/g, '~0').replace(/\//g, '~1');
const unescapePointer = (value) => value.replace(/~1/g, '/').replace(/~0/g, '~');
const joinRuntimePath = (base, segment) => `${base === '/' ? '' : base}/${escapePointer(segment)}`;
const issue = (code, message, path = '/') => ({ code, path, message });

function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function pointerValue(root, pointer) {
  if (!pointer.startsWith('#/')) throw new Error(`cross-file or unsupported reference: ${pointer}`);
  let node = root;
  for (const segment of pointer.slice(2).split('/')) {
    node = node?.[unescapePointer(segment)];
    if (node === undefined) throw new Error(`unresolved reference: ${pointer}`);
  }
  return node;
}

function resolveNode(node, root, pointer, refStack = []) {
  if (!node || typeof node !== 'object') throw new Error(`schema node ${pointer} is not an object`);
  if (!node.$ref) return { node, pointer, refStack };
  if (!node.$ref.startsWith('#/')) throw new Error(`cross-file reference at ${pointer}: ${node.$ref}`);
  if (refStack.includes(node.$ref)) throw new Error(`reference cycle at ${pointer}: ${[...refStack, node.$ref].join(' -> ')}`);
  return resolveNode(pointerValue(root, node.$ref), root, node.$ref.slice(1), [...refStack, node.$ref]);
}

function structuralShape(node, root, pointer, refStack = []) {
  const out = {};
  if (node.$ref !== undefined) out.$ref = node.$ref;
  const resolved = resolveNode(node, root, pointer, refStack);
  for (const key of STRUCTURAL_KEYS) {
    if (key === '$ref') continue;
    if (resolved.node[key] !== undefined) out[key] = resolved.node[key];
  }
  if (resolved.node.items !== undefined) {
    out.items = structuralShape(resolved.node.items, root, `${resolved.pointer}/items`, resolved.refStack);
  }
  return out;
}

export function structuralSchemaDigest(node, root, pointer = '/', {
  refStack = [],
  containerNode,
  containerPointer = '/',
  containerRefStack = [],
} = {}) {
  return sha256(canonicalJSON({
    property: structuralShape(node, root, pointer, refStack),
    container: containerNode === undefined
      ? null
      : structuralShape(containerNode, root, containerPointer, containerRefStack),
  }));
}

function nodeKind(node, root, pointer, refStack = []) {
  const resolved = resolveNode(node, root, pointer, refStack);
  if (resolved.node.type === 'array') {
    if (!resolved.node.items) throw new Error(`array schema at ${pointer} has no items`);
    const item = resolveNode(resolved.node.items, root, `${resolved.pointer}/items`, resolved.refStack).node;
    return item.type === 'object' || item.properties ? 'object_array' : 'scalar_array';
  }
  return resolved.node.type === 'object' || resolved.node.properties ? 'object' : 'scalar';
}

function normalizeMounts(schemaMounts) {
  if (!Array.isArray(schemaMounts) || schemaMounts.length === 0) throw new Error('authorityContext.schemaMounts must be a non-empty array');
  return schemaMounts.map((entry) => {
    if (!entry || typeof entry.mount !== 'string' || typeof entry.schema_source !== 'string') throw new Error('each schema mount needs mount and schema_source');
    return { ...entry, schema: entry.schema ?? readJSON(resolve(ROOT, entry.schema_source)) };
  });
}

/** Build the exact named-property inventory for a composed schema graph. */
export function buildSchemaFieldInventory(schemaMounts = VISUAL_SCHEMA_MOUNTS) {
  const mounts = normalizeMounts(schemaMounts);
  const roots = mounts.filter((entry) => entry.mount === '/');
  if (roots.length !== 1) throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, 'schema mounts must contain exactly one / root')]);
  const mountPaths = new Set();
  for (const entry of mounts) {
    if (mountPaths.has(entry.mount)) throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, `duplicate schema mount ${entry.mount}`)]);
    mountPaths.add(entry.mount);
  }
  const rootSchema = roots[0].schema;
  for (const entry of mounts.filter((candidate) => candidate.mount !== '/')) {
    const segments = entry.mount.slice(1).split('/').map(unescapePointer);
    if (segments.length !== 1 || rootSchema.properties?.[segments[0]] === undefined) {
      throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, `mounted schema ${entry.mount} does not replace exactly one root property`)]);
    }
  }

  const inventory = [];
  const runtimePaths = new Set();
  function walkObject(rawNode, root, source, runtimeBase, schemaPointer, refStack = []) {
    const resolved = resolveNode(rawNode, root, schemaPointer, refStack);
    const object = resolved.node;
    if (object.type !== 'object' && !object.properties) throw new Error(`reachable schema at ${schemaPointer} is not an object`);
    if (object.additionalProperties !== false) throw new Error(`reachable object schema at ${schemaPointer} is not closed with additionalProperties false`);
    for (const [name, property] of Object.entries(object.properties ?? {})) {
      const runtimePath = joinRuntimePath(runtimeBase, name);
      if (runtimeBase === '/' && mountPaths.has(runtimePath)) continue;
      const propertyPointer = `${resolved.pointer === '/' ? '' : resolved.pointer}/properties/${escapePointer(name)}`;
      if (runtimePaths.has(runtimePath)) throw new Error(`duplicate runtime path ${runtimePath}`);
      runtimePaths.add(runtimePath);
      const kind = nodeKind(property, root, propertyPointer, resolved.refStack);
      inventory.push({
        path: runtimePath,
        schema_source: source,
        schema_pointer: propertyPointer,
        node_kind: kind,
        shape_sha256: structuralSchemaDigest(property, root, propertyPointer, {
          refStack: resolved.refStack,
          containerNode: rawNode,
          containerPointer: schemaPointer,
          containerRefStack: refStack,
        }),
      });
      const child = resolveNode(property, root, propertyPointer, resolved.refStack);
      if (kind === 'object') {
        walkObject(property, root, source, runtimePath, propertyPointer, resolved.refStack);
      } else if (kind === 'object_array') {
        walkObject(child.node.items, root, source, `${runtimePath}/*`, `${child.pointer}/items`, child.refStack);
      }
    }
  }

  try {
    for (const entry of mounts) walkObject(entry.schema, entry.schema, entry.schema_source, entry.mount, '/');
  } catch (error) {
    if (error instanceof VisualSemanticAuthorityError) throw error;
    throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, error.message)]);
  }
  return inventory.sort((left, right) => left.path.localeCompare(right.path));
}

export class VisualSemanticAuthorityError extends Error {
  constructor(issues) {
    super(issues.map((entry) => `[${entry.code}] ${entry.message}`).join(' | '));
    this.name = 'VisualSemanticAuthorityError';
    this.code = issues[0]?.code ?? AUTHORITY_CODES.REGISTRY_INVALID;
    this.issues = issues;
  }
}

function contextKey(schemaMounts, registry, committedDigestKey) {
  if (committedDigestKey) return committedDigestKey;
  return sha256(canonicalJSON({ schemaMounts: schemaMounts.map(({ mount, schema_source, schema }) => ({ mount, schema_source, schema })), registry }));
}

let committedCache;
const validatedAuthorities = new WeakSet();
const authorityRegistryIndexes = new WeakMap();

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function loadVisualSemanticAuthorityContext() {
  const schemaMounts = VISUAL_SCHEMA_MOUNTS.map((entry) => {
    const bytes = readFileSync(resolve(ROOT, entry.schema_source));
    return { ...entry, schema: JSON.parse(bytes), schema_sha256: sha256(bytes) };
  });
  const registryBytes = readFileSync(VISUAL_AUTHORITY_REGISTRY);
  return {
    schemaMounts,
    registry: JSON.parse(registryBytes),
    registry_sha256: sha256(registryBytes),
    committed_digest_key: sha256(canonicalJSON({
      schemas: schemaMounts.map((entry) => [entry.mount, entry.schema_source, entry.schema_sha256]),
      registry: sha256(registryBytes),
    })),
  };
}

/** Validate registry schema, exact inventory coverage, and every stored shape. */
export function validateVisualSemanticAuthority(authorityContext) {
  const isCommitted = authorityContext === undefined;
  const resolvedContext = authorityContext ?? loadVisualSemanticAuthorityContext();
  let schemaMounts;
  let registry;
  try {
    schemaMounts = normalizeMounts(resolvedContext.schemaMounts ?? VISUAL_SCHEMA_MOUNTS);
    registry = resolvedContext.registry ?? readJSON(VISUAL_AUTHORITY_REGISTRY);
  } catch (error) {
    return { ok: false, issues: [issue(AUTHORITY_CODES.REGISTRY_INVALID, error.message)] };
  }
  const key = contextKey(schemaMounts, registry, isCommitted ? resolvedContext.committed_digest_key : undefined);
  if (isCommitted && committedCache?.key === key) return committedCache.value;

  const issues = [];
  for (const error of validate(registry, readJSON(VISUAL_AUTHORITY_REGISTRY_SCHEMA))) {
    issues.push(issue(AUTHORITY_CODES.REGISTRY_INVALID, `${error.path}: ${error.message}`));
  }
  if (Array.isArray(registry?.fields)) {
    const seen = new Set();
    for (const entry of registry.fields) {
      if (seen.has(entry.path)) issues.push(issue(AUTHORITY_CODES.REGISTRY_INVALID, `duplicate registry path ${entry.path}`, entry.path));
      seen.add(entry.path);
      if (typeof entry.rationale === 'string' && entry.rationale.trim().length === 0) issues.push(issue(AUTHORITY_CODES.REGISTRY_INVALID, `blank rationale for ${entry.path}`, entry.path));
      if (entry.localized_repair === 'decision_gated' && !entry.collection_key) issues.push(issue(AUTHORITY_CODES.REGISTRY_INVALID, `decision-gated field ${entry.path} has no collection_key`, entry.path));
      if (entry.localized_repair !== 'decision_gated' && entry.collection_key !== undefined) issues.push(issue(AUTHORITY_CODES.REGISTRY_INVALID, `collection_key is only valid for decision-gated fields`, entry.path));
    }
  }
  let inventory = [];
  try {
    inventory = buildSchemaFieldInventory(schemaMounts);
  } catch (error) {
    issues.push(...(error instanceof VisualSemanticAuthorityError ? error.issues : [issue(AUTHORITY_CODES.REGISTRY_INVALID, error.message)]));
  }
  const inventoryByPath = new Map(inventory.map((entry) => [entry.path, entry]));
  const registryByPath = new Map((registry?.fields ?? []).map((entry) => [entry.path, entry]));
  for (const entry of inventory) {
    const registered = registryByPath.get(entry.path);
    if (!registered) {
      issues.push(issue(AUTHORITY_CODES.UNCLASSIFIED_FIELD, `schema property ${entry.path} has no authority registry entry`, entry.path));
    } else if (['schema_source', 'schema_pointer', 'node_kind', 'shape_sha256'].some((keyName) => registered[keyName] !== entry[keyName])) {
      issues.push(issue(AUTHORITY_CODES.SHAPE_MISMATCH, `registry shape for ${entry.path} does not match the reachable schema property`, entry.path));
    }
  }
  for (const entry of registry?.fields ?? []) {
    if (!inventoryByPath.has(entry.path)) issues.push(issue(AUTHORITY_CODES.ORPHANED_FIELD, `registry path ${entry.path} has no reachable schema property`, entry.path));
  }
  const value = { ok: issues.length === 0, issues, inventory, registry, schemaMounts };
  if (value.ok) {
    deepFreeze(value);
    validatedAuthorities.add(value);
    authorityRegistryIndexes.set(value, registryByPath);
  }
  if (value.ok && isCommitted) committedCache = { key, value };
  return value;
}

export function requireVisualSemanticAuthority(authorityContext) {
  if (authorityContext && validatedAuthorities.has(authorityContext)) return authorityContext;
  const result = validateVisualSemanticAuthority(authorityContext);
  if (!result.ok) throw new VisualSemanticAuthorityError(result.issues);
  return result;
}

/** Production trust root: no caller-supplied schema or registry is accepted. */
export function requireCommittedVisualSemanticAuthority() {
  const result = validateVisualSemanticAuthority();
  if (!result.ok) throw new VisualSemanticAuthorityError(result.issues);
  return result;
}

export function authoritySchemaAtMount(validatedAuthority, mount) {
  const authority = requireVisualSemanticAuthority(validatedAuthority);
  const matches = authority.schemaMounts.filter((entry) => entry.mount === mount);
  if (matches.length !== 1) throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, `validated authority has ${matches.length} schemas mounted at ${mount}`)]);
  return matches[0].schema;
}

function pathSegments(path) {
  return path.slice(1).split('/').map(unescapePointer);
}

function resolveRuntimePath(record, path) {
  let states = [{ value: record, path: '' }];
  for (const segment of pathSegments(path)) {
    const next = [];
    for (const state of states) {
      if (segment === '*') {
        if (!Array.isArray(state.value)) continue;
        state.value.forEach((value, index) => next.push({ value, path: `${state.path}/${index}`, present: true }));
      } else if (state.value !== null && typeof state.value === 'object' && Object.prototype.hasOwnProperty.call(state.value, segment)) {
        next.push({ value: state.value[segment], path: `${state.path}/${escapePointer(segment)}`, present: true });
      } else {
        next.push({ value: undefined, path: `${state.path}/${escapePointer(segment)}`, present: false });
      }
    }
    states = next;
  }
  return states;
}

const meaningful = (value) => typeof value === 'string' && value.trim().length > 0;

export function collectClassifiedRenderedText(job, validatedAuthority) {
  const authority = requireVisualSemanticAuthority(validatedAuthority);
  const records = [];
  for (const entry of authority.registry.fields.filter((field) => field.rendered_text !== 'none')) {
    for (const resolved of resolveRuntimePath(job, entry.path)) {
      if (entry.node_kind === 'scalar_array') {
        if (!Array.isArray(resolved.value)) continue;
        resolved.value.forEach((value, index) => {
          if (meaningful(value)) records.push({ path: `${resolved.path}/${index}`, ownership_class: entry.rendered_text, value });
        });
      } else if (meaningful(resolved.value)) {
        records.push({ path: resolved.path, ownership_class: entry.rendered_text, value: resolved.value });
      }
    }
  }
  return records;
}

function presentAtPath(record, path) {
  const states = resolveRuntimePath(record, path);
  return states.some((state) => state.present);
}

export function createPromptInputReader(job, validatedAuthority) {
  const authority = requireVisualSemanticAuthority(validatedAuthority);
  const registryByPath = authorityRegistryIndexes.get(authority);
  const consumed = new Set();
  function entryFor(path) {
    const entry = registryByPath?.get(path);
    if (!entry || entry.prompt_semantics !== 'prompt_input') {
      throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, `prompt assembler attempted to read unclassified input ${path}`, path)]);
    }
    consumed.add(path);
    return entry;
  }
  return {
    get(path) {
      entryFor(path);
      const values = resolveRuntimePath(job, path).filter((state) => state.present).map((state) => state.value);
      if (path.includes('*')) throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, `wildcard prompt input ${path} requires getArray()`, path)]);
      return values[0];
    },
    getArray(path) {
      const entry = entryFor(path);
      const values = resolveRuntimePath(job, path).filter((state) => state.present).map((state) => state.value);
      if (entry.node_kind === 'scalar_array' && !path.includes('*')) return values.length === 0 ? undefined : Array.isArray(values[0]) ? values[0] : [];
      return values.length === 0 ? undefined : values;
    },
    consumed,
    authority,
    job,
  };
}

export function assertPromptCoverage(reader) {
  const unconsumed = reader.authority.registry.fields
    .filter((entry) => entry.prompt_semantics === 'prompt_input' && presentAtPath(reader.job, entry.path) && !reader.consumed.has(entry.path));
  if (unconsumed.length > 0) {
    throw new VisualSemanticAuthorityError(unconsumed.map((entry) => issue(
      AUTHORITY_CODES.PROMPT_UNCONSUMED,
      `present prompt input ${entry.path} was not consumed by the assembler`,
      entry.path,
    )));
  }
}

function localProjectionValue(entry, resolved) {
  if (!resolved.present) return ABSENT;
  if (entry.node_kind === 'object') return PRESENT_OBJECT;
  if (entry.node_kind === 'object_array') return Array.isArray(resolved.value) ? { $visual_semantic_authority: 'present_object_array', length: resolved.value.length } : PRESENT_OBJECT;
  return resolved.value;
}

export function projectionForPolicy(record, validatedAuthority, policies) {
  const authority = requireVisualSemanticAuthority(validatedAuthority);
  const wanted = new Set(Array.isArray(policies) ? policies : [policies]);
  const projection = {};
  for (const entry of authority.registry.fields.filter((field) => wanted.has(field.localized_repair))) {
    projection[entry.path] = resolveRuntimePath(record, entry.path).map((resolved) => localProjectionValue(entry, resolved));
  }
  return projection;
}

export const protectedProjection = (record, validatedAuthority) => projectionForPolicy(record, validatedAuthority, 'protected');
export const repairEnvelopeProjection = (record, validatedAuthority) => projectionForPolicy(
  record,
  validatedAuthority,
  ['derived_output', 'repair_evidence', 'new_record_identity'],
);

export function decisionGatedProjection(record, validatedAuthority) {
  const authority = requireVisualSemanticAuthority(validatedAuthority);
  const projection = {};
  for (const entry of authority.registry.fields.filter((field) => field.localized_repair === 'decision_gated')) {
    const segments = pathSegments(entry.path);
    const wildcardIndex = segments.indexOf('*');
    if (wildcardIndex < 1) throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, `decision-gated field ${entry.path} must be under an object array`, entry.path)]);
    const collectionPath = `/${segments.slice(0, wildcardIndex).map(escapePointer).join('/')}`;
    const leaf = segments.slice(wildcardIndex + 1);
    const collections = resolveRuntimePath(record, collectionPath).filter((state) => state.present);
    const keyed = {};
    for (const collection of collections) {
      if (!Array.isArray(collection.value)) continue;
      for (const item of collection.value) {
        const key = item?.[entry.collection_key];
        if (typeof key !== 'string' || key.length === 0 || Object.prototype.hasOwnProperty.call(keyed, key)) {
          throw new VisualSemanticAuthorityError([issue(AUTHORITY_CODES.REGISTRY_INVALID, `decision-gated collection for ${entry.path} has a missing or duplicate ${entry.collection_key}`, entry.path)]);
        }
        let value = item;
        let present = true;
        for (const segment of leaf) {
          present = value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, segment);
          value = present ? value[segment] : undefined;
          if (!present) break;
        }
        keyed[key] = present ? value : ABSENT;
      }
    }
    projection[entry.path] = keyed;
  }
  return projection;
}

export function sameCanonicalProjection(left, right) {
  return canonicalJSON(left) === canonicalJSON(right);
}
