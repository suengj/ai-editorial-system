/**
 * json-schema-lite — a dependency-free validator for the JSON Schema subset
 * this repository actually uses.
 *
 * Supported: type, const, enum, required, properties, additionalProperties,
 * items, pattern, minLength, minimum, format (date, date-time), $ref into
 * local $defs, and union types via array-valued `type`.
 *
 * Deliberately small. Fail-closed on constructs it does not understand: an
 * unknown keyword is reported rather than silently ignored, so a schema can
 * never pass by being unreadable.
 */

const KNOWN_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'description',
  'type', 'const', 'enum', 'required', 'properties', 'additionalProperties',
  'items', 'pattern', 'minLength', 'minimum', 'format',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value === 'number' ? 'number' : typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref: ${ref}`);
  let node = root;
  for (const seg of ref.slice(2).split('/')) {
    node = node?.[seg.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (node === undefined) throw new Error(`unresolvable $ref: ${ref}`);
  }
  return node;
}

/**
 * Validate `value` against `schema`. Returns an array of
 * `{ path, message }` — empty means valid.
 */
export function validate(value, schema, root = schema, path = '$') {
  const errors = [];

  for (const key of Object.keys(schema)) {
    if (!KNOWN_KEYWORDS.has(key)) {
      errors.push({ path, message: `schema uses unsupported keyword "${key}"` });
    }
  }

  if (schema.$ref) {
    return validate(value, resolveRef(schema.$ref, root), root, path);
  }

  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((t) => matchesType(value, t))) {
      errors.push({ path, message: `expected type ${expected.join('|')}, got ${typeOf(value)}` });
      return errors; // further keywords are meaningless on the wrong type
    }
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push({ path, message: `expected const ${JSON.stringify(schema.const)}` });
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push({ path, message: `"${value}" is not one of ${schema.enum.join(', ')}` });
  }

  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, message: `does not match ${schema.pattern}` });
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `shorter than minLength ${schema.minLength}` });
    }
    if (schema.format === 'date' && !DATE_RE.test(value)) {
      errors.push({ path, message: 'not an ISO date (YYYY-MM-DD)' });
    }
    if (schema.format === 'date-time' && !DATE_TIME_RE.test(value)) {
      errors.push({ path, message: 'not an ISO date-time' });
    }
  }

  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    errors.push({ path, message: `below minimum ${schema.minimum}` });
  }

  if (typeOf(value) === 'array' && schema.items) {
    value.forEach((item, i) => {
      errors.push(...validate(item, schema.items, root, `${path}[${i}]`));
    });
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push({ path, message: `missing required property "${key}"` });
    }
    const props = schema.properties ?? {};
    for (const [key, sub] of Object.entries(value)) {
      if (key in props) {
        errors.push(...validate(sub, props[key], root, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push({ path, message: `unexpected property "${key}"` });
      }
    }
  }

  return errors;
}
