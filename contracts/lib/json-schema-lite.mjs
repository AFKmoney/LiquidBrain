/**
 * Minimal JSON Schema validator (subset used by contracts/fractalbrain.openapi.json):
 * type (incl. unions), required, properties, additionalProperties, items, enum,
 * minimum/maximum, minLength/maxLength, format-free numbers.
 *
 * Deliberately dependency-free: CI must be able to validate the engine contract
 * (and the mock) without pulling a validator package, and the app code is
 * server-rendered TypeScript we do not want to couple to a runtime dep.
 */

const TYPEOF = {
  string: 'string',
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  object: 'object',
  array: 'array',
  null: 'object',
};

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isNaN(value)) return 'number';
  return typeof value;
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && !Number.isNaN(value);
  return typeOf(value) === type && typeOf(value) === TYPEOF[type];
}

function resolveRef(ref, root) {
  const segments = ref.replace(/^#\//, '').split('/');
  let node = root;
  for (const segment of segments) {
    node = node?.[segment.replace(/~1/g, '/')];
  }
  return node;
}

/**
 * @param {unknown} value
 * @param {object} schema
 * @param {object} root root document, for $ref resolution
 * @param {string} path
 * @returns {string[]} human-readable list of violations (empty = valid)
 */
export function validate(value, schema, root = schema, path = '$') {
  if (!schema || typeof schema !== 'object') return [];
  if (schema.$ref) return validate(value, resolveRef(schema.$ref, root), root, path);

  const errors = [];
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];

  if (types.length > 0 && !types.some((t) => typeMatches(value, t))) {
    errors.push(`${path}: expected ${types.join('|')}, got ${typeOf(value)}`);
    return errors; // further checks would be noise
  }

  if (schema.enum && !schema.enum.some((v) => v === value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.items) {
      value.forEach((item, i) => errors.push(...validate(item, schema.items, root, `${path}[${i}]`)));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!(required in value)) errors.push(`${path}.${required}: missing required property`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (props[key]) {
        errors.push(...validate(child, props[key], root, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key}: unexpected property`);
      }
    }
  }

  return errors;
}

/** Look up a component schema by name. */
export function component(root, name) {
  return root?.components?.schemas?.[name];
}
