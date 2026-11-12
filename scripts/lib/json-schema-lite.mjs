/**
 * json-schema-lite — a dependency-free validator for the JSON Schema subset
 * this repository actually uses.
 *
 * Supported: oneOf, type, const, enum, required, properties, additionalProperties,
 * items, minItems, maxItems, minProperties, maxProperties, pattern, minLength, maxLength, minimum, maximum, format (date, date-time), $ref into
 * local $defs, and union types via array-valued `type`.
 *
 * Deliberately small. Fail-closed on constructs it does not understand: an
 * unknown keyword is reported rather than silently ignored, so a schema can
 * never pass by being unreadable.
 */

const KNOWN_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'description',
  'oneOf', 'type', 'const', 'enum', 'required', 'properties', 'additionalProperties',
  'items', 'minItems', 'maxItems', 'minProperties', 'maxProperties', 'uniqueItems', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'format',
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

// Inspect schemas independently of the instance: a nonmatching branch must not
// hide a keyword we cannot evaluate. Traverse only schema-valued keywords.
function schemaErrors(schema, root, path = '$schema', seen = new Set()) {
  if (typeof schema === 'boolean') return [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema))
    return [{ path, message: 'invalid schema: expected object or boolean' }];
  if (seen.has(schema)) return [];
  seen.add(schema);
  const errors = [];
  for (const key of Object.keys(schema)) {
    if (!KNOWN_KEYWORDS.has(key)) errors.push({ path, message: `schema uses unsupported keyword "${key}"` });
  }
  for (const key of ['properties']) {
    if (schema[key] && typeof schema[key] === 'object' && !Array.isArray(schema[key])) {
      for (const [name, sub] of Object.entries(schema[key])) errors.push(...schemaErrors(sub, root, `${path}.${key}.${name}`, seen));
    }
  }
  for (const key of ['items', 'additionalProperties']) {
    if (schema[key] !== undefined) errors.push(...schemaErrors(schema[key], root, `${path}.${key}`, seen));
  }
  if (Array.isArray(schema.oneOf)) schema.oneOf.forEach((sub, i) => errors.push(...schemaErrors(sub, root, `${path}.oneOf[${i}]`, seen)));
  if (schema.$ref) {
    try { errors.push(...schemaErrors(resolveRef(schema.$ref, root), root, `${path}.$ref`, seen)); }
    catch (error) { errors.push({ path, message: error.message }); }
  }
  return errors;
}

/**
 * Validate `value` against `schema`. Returns an array of
 * `{ path, message }` — empty means valid.
 */
export function validate(value, schema, root = schema, path = '$') {
  return validateValue(value, schema, root, path);
}

function validateValue(value, schema, root, path) {
  if (schema === true) return [];
  if (schema === false) return [{ path, message: 'boolean false schema rejects all values' }];
  const errors = Object.keys(schema).filter(key => !KNOWN_KEYWORDS.has(key))
    .map(key => ({path, message: `schema uses unsupported keyword "${key}"`}));

  if (schema.oneOf !== undefined) {
    if (Array.isArray(schema.oneOf)) {
      for (const branch of schema.oneOf) errors.push(...schemaErrors(branch, root));
      if (errors.length) return errors;
    }
    if (!Array.isArray(schema.oneOf) || schema.oneOf.filter((branch) => validateValue(value, branch, root, path).length === 0).length !== 1) {
      errors.push({ path, message: 'expected exactly one matching oneOf branch' });
    }
  }

  if (schema.$ref) {
    return [...errors, ...validateValue(value, resolveRef(schema.$ref, root), root, path)];
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
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `longer than maxLength ${schema.maxLength}` });
    }
    if (schema.format === 'date' && !DATE_RE.test(value)) {
      errors.push({ path, message: 'not an ISO date (YYYY-MM-DD)' });
    }
    if (schema.format === 'date-time' && !DATE_TIME_RE.test(value)) {
      errors.push({ path, message: 'not an ISO date-time' });
    }
    if (schema.format === 'uri') {
      try { new URL(value); } catch { errors.push({ path, message: 'not a valid URI' }); }
    }
  }

  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    errors.push({ path, message: `below minimum ${schema.minimum}` });
  }
  if (typeof value === 'number' && schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    errors.push({ path, message: `not greater than exclusiveMinimum ${schema.exclusiveMinimum}` });
  }
  if (typeof value === 'number' && schema.maximum !== undefined && value > schema.maximum) {
    errors.push({ path, message: `above maximum ${schema.maximum}` });
  }

  if (typeOf(value) === 'array' && schema.items !== undefined) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path, message: `fewer than minItems ${schema.minItems}` });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `more than maxItems ${schema.maxItems}` });
    }
    if (schema.uniqueItems === true && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push({ path, message: 'array items are not unique' });
    value.forEach((item, i) => {
      errors.push(...validateValue(item, schema.items, root, `${path}[${i}]`));
    });
  }

  if (typeOf(value) === 'object') {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) errors.push({ path, message: `fewer than minProperties ${schema.minProperties}` });
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) errors.push({ path, message: `more than maxProperties ${schema.maxProperties}` });
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push({ path, message: `missing required property "${key}"` });
    }
    const props = schema.properties ?? {};
    for (const [key, sub] of Object.entries(value)) {
      if (key in props) {
        errors.push(...validateValue(sub, props[key], root, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push({ path: `${path}.${key}`, message: 'unexpected property' });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        errors.push(...validateValue(sub, schema.additionalProperties, root, `${path}.${key}`));
      }
    }
  }

  return errors;
}
