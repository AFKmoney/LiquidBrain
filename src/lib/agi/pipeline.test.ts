import test from 'node:test';
import assert from 'node:assert/strict';

import { formatConcepts, gatherCognitiveContext } from './pipeline.ts';
import type { ConceptSummary } from './types.ts';

// The pipeline used to mutate the backend response with an in-place sort and
// silently swallow every failure. These pin the behaviour the chat route
// depends on: best-effort enrichment, never a throw, never a mutated input.

const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    handler(String(input))) as typeof fetch;
}

function concept(id: number, label: string | null, salience: number, access = 0): ConceptSummary {
  return { id, position_re: id / 10, position_im: -id / 10, label, salience, access_count: access };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('formatConcepts ranks by salience and falls back to coordinates', () => {
  const concepts = [concept(1, 'low', 0.2), concept(2, null, 0.9), concept(3, 'mid', 0.5)];
  const formatted = formatConcepts(concepts);

  assert.equal(formatted.split(', ')[0], 'concept@(0.20,-0.20)');
  assert.deepEqual(formatted.split(', '), [
    'concept@(0.20,-0.20)',
    'mid',
    'low',
  ]);
  // The caller's array must keep its original order.
  assert.deepEqual(concepts.map((c) => c.id), [1, 2, 3]);
});

test('formatConcepts honours topN', () => {
  const many = Array.from({ length: 12 }, (_, i) => concept(i, `c${i}`, i));
  assert.equal(formatConcepts(many, 3).split(', ').length, 3);
});

test('gatherCognitiveContext degrades to defaults when the engine is down', async () => {
  stubFetch(() => {
    throw new Error('ECONNREFUSED');
  });

  const ctx = await gatherCognitiveContext('hello');
  assert.equal(ctx.backendReached, false);
  assert.equal(ctx.coherence, 0.5);
  assert.equal(ctx.memoryConcepts, 0);
  assert.equal(ctx.memoryContext, '');
});

test('gatherCognitiveContext enriches with memory + state', async () => {
  const concepts = [concept(1, 'mandelbrot', 0.3, 4), concept(2, 'coherence', 0.95, 12)];
  stubFetch((url) => {
    if (url.includes('/api/perceive')) {
      return jsonResponse({ embedding_dim: 128, perceived: true, memory_stored: true });
    }
    if (url.includes('/api/memory')) return jsonResponse({ concepts, total: 2 });
    if (url.includes('/api/state')) {
      return jsonResponse({
        status: 'online',
        model: 'LiquidBrain v2',
        embedding_dim: 128,
        brain_nodes: 64,
        language_depth: 8,
        memory_concepts: 2,
        coherence: 0.83,
        last_insight: 'memory is sparse',
      });
    }
    return jsonResponse({ error: 'unexpected call' }, 400);
  });

  const ctx = await gatherCognitiveContext('hello');
  assert.equal(ctx.backendReached, true);
  assert.equal(ctx.coherence, 0.83);
  assert.equal(ctx.memoryConcepts, 2);
  assert.match(ctx.memoryContext, /coherence, mandelbrot/);
  assert.match(ctx.memoryContext, /\[Insight: memory is sparse\]/);
});

test('gatherCognitiveContext tolerates a partial pipeline', async () => {
  stubFetch((url) => {
    if (url.includes('/api/perceive')) {
      return jsonResponse({ embedding_dim: 128, perceived: true, memory_stored: false });
    }
    // memory + state unavailable
    return jsonResponse({ error: 'boom' }, 500);
  });

  const ctx = await gatherCognitiveContext('hello');
  assert.equal(ctx.backendReached, true);
  assert.equal(ctx.memoryContext, '');
  assert.equal(ctx.coherence, 0.5);
});
