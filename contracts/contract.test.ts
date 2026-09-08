import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

import { validate } from './lib/json-schema-lite.mjs';
import { server, memory } from '../mini-services/brain-mock/server.mjs';
import { BACKEND_TIMEOUTS, type BackendEndpoint } from '../src/lib/agi/backend.ts';

// ─── Contract conformance ───────────────────────────────────────
// The Rust engine is an external service, so the OpenAPI document in this
// folder is the thing that actually pins its shape. Everything the dashboard
// consumes is checked against it here, through the dependency-free mock that
// `mini-services/brain-mock` also exposes for local dev.

const root = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fractalbrain.openapi.json', import.meta.url)), 'utf8')
);

const schema = (name: string) => root.components.schemas[name];

let base = '';
let closed = false;

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (!closed) await new Promise<void>((resolve) => server.close(() => resolve()));
  closed = true;
});

async function call(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  return { status: res.status, json: await res.json() };
}

function expectValid(value: unknown, name: string) {
  const errors = validate(value, schema(name), root, name);
  assert.deepEqual(errors, [], `${name} violations:\n${errors.join('\n')}`);
}

test('every endpoint the dashboard proxies is described by the contract', () => {
  const declared = Object.keys(root.paths as Record<string, unknown>);
  for (const endpoint of Object.keys(BACKEND_TIMEOUTS) as BackendEndpoint[]) {
    assert.ok(declared.includes(endpoint), `${endpoint} is proxied by the app but missing from the contract`);
  }
  // Nothing in the contract may silently drift away from the client.
  const consumed = new Set([...(Object.keys(BACKEND_TIMEOUTS) as string[]), '/api/reset']);
  for (const path of declared) {
    assert.ok(consumed.has(path), `contract declares ${path}, which nobody calls — remove it or wire it`);
  }
});

test('contract response schemas line up with the shared TypeScript types', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/lib/agi/types.ts', import.meta.url)), 'utf8');
  const fieldsOf = (iface: string): string[] => {
    const match = new RegExp(`export interface ${iface} \\{([\\s\\S]*?)\\n\\}`).exec(source);
    assert.ok(match, `interface ${iface} not found in src/lib/agi/types.ts`);
    return [...match![1].matchAll(/^\s{2}(\w+)(\?)?:/gm)].map((m) => m[1]);
  };

  for (const [iface, schemaName] of [
    ['BrainState', 'BrainState'],
    ['ConceptSummary', 'ConceptSummary'],
    ['MemoryResponse', 'MemoryResponse'],
    ['PerceiveResponse', 'PerceiveResponse'],
    ['ThinkResponse', 'ThinkResponse'],
    ['ReflectResponse', 'ReflectResponse'],
    ['TrainResponse', 'TrainResponse'],
  ] as const) {
    const tsFields = fieldsOf(iface).sort();
    const apiFields = Object.keys(schema(schemaName).properties).sort();
    assert.deepEqual(tsFields, apiFields, `${iface}: TypeScript type and contract drifted apart`);

    // Everything the client reads unconditionally must be required by the spec.
    const required: string[] = schema(schemaName).required ?? [];
    for (const field of fieldsOf(iface)) {
      const tsOptional = new RegExp(`\\b${field}\\?:`).test(source);
      if (!tsOptional) {
        assert.ok(
          required.includes(field),
          `${iface}.${field} is non-optional in TS but optional in the contract`
        );
      }
    }
  }
});

test('mock: /api/state satisfies BrainState', async () => {
  const { status, json } = await call('GET', '/api/state');
  assert.equal(status, 200);
  expectValid(json, 'BrainState');
});

test('mock: perceive → memory → think → reflect → train round-trip', async () => {
  const perceived = await call('POST', '/api/perceive', { input: 'the mandelbrot set is a fractal memory' });
  assert.equal(perceived.status, 200);
  expectValid(perceived.json, 'PerceiveResponse');
  assert.equal(perceived.json.perceived, true);

  const repeated = await call('POST', '/api/perceive', { input: 'the mandelbrot set is a fractal memory' });
  assert.equal(repeated.json.merged, true, 'same idea must merge into one concept');

  const memory1 = await call('GET', '/api/memory');
  expectValid(memory1.json, 'MemoryResponse');
  assert.equal(memory1.json.total, memory1.json.concepts.length);
  assert.ok(memory1.json.total >= 1);

  const thought = await call('POST', '/api/think', { cycles: 4 });
  expectValid(thought.json, 'ThinkResponse');
  assert.equal(thought.json.cycles_run, 4);
  if (Array.isArray(thought.json.active_concept_ids)) {
    const known = new Set(memory1.json.concepts.map((c: { id: number }) => c.id));
    for (const id of thought.json.active_concept_ids) {
      assert.ok(known.has(id), `active_concept_ids returned unknown concept ${id}`);
    }
  }

  const reflected = await call('POST', '/api/reflect');
  expectValid(reflected.json, 'ReflectResponse');

  const trained = await call('POST', '/api/train', { text: 'fractals recurse, recursion fractals' });
  expectValid(trained.json, 'TrainResponse');
  assert.ok(trained.json.loss > 0);

  const again = await call('POST', '/api/train', { text: 'fractals recurse, recursion fractals' });
  assert.ok(again.json.loss <= trained.json.loss, 'repeated exposure must not increase loss');
});

test('mock: rejects empty perceive/train input with the contract error shape', async () => {
  for (const [path, body] of [
    ['/api/perceive', { input: '   ' }],
    ['/api/train', { text: '' }],
  ] as const) {
    const { status, json } = await call('POST', path, body);
    assert.equal(status, 400, `${path} should reject empty input`);
    assert.equal(typeof json.error, 'string');
  }
});

test('mock: memory positions stay inside the visualisation window', async () => {
  await call('POST', '/api/perceive', { input: 'coherence surprise confidence rewire attractor' });
  const { json } = await call('GET', '/api/memory');
  for (const concept of json.concepts) {
    assert.ok(concept.position_re >= -2 && concept.position_re <= 1, `re ${concept.position_re} outside Mandelbrot window`);
    assert.ok(concept.position_im >= -1.5 && concept.position_im <= 1.5, `im ${concept.position_im} outside window`);
    assert.ok(concept.salience >= 0 && concept.salience <= 1);
  }
  assert.equal(memory.size, json.concepts.length, 'public memory must match the store');
});

test('contract: servers[0] matches the client default base URL', async () => {
  const { DEFAULT_BACKEND_URL } = await import('../src/lib/agi/backend.ts');
  assert.equal(root.servers[0].url, DEFAULT_BACKEND_URL);
});
