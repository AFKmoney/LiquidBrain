#!/usr/bin/env node
/**
 * FractalBrain mock engine — a dependency-free reference implementation of
 * `contracts/fractalbrain.openapi.json`, for local development, CI and demos.
 *
 * It is a real (if tiny) fractal brain, not a fixture:
 *   perceive → deterministic hash of the input into the complex plane, merged
 *              into an LSH bucket grid so repeated ideas reinforce one concept
 *   think    → activation spreads from concept to concept along those links
 *   reflect  → coherence / surprise / confidence are derived from the graph
 *   train    → per-token loss decays with exposure
 *
 * Run:  node mini-services/brain-mock/server.mjs   (or: npm run mock:brain)
 * Env:  PORT | FRACTALBRAIN_PORT (default 8080), HOST (default 0.0.0.0),
 *       BRAIN_CAPACITY (memory size at which utilization saturates, default 512)
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || process.env.FRACTALBRAIN_PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const EMBEDDING_DIM = 128;
const LANGUAGE_DEPTH = 8;
const CAPACITY = Number(process.env.BRAIN_CAPACITY || 512);
const NEIGHBOUR_RADIUS = 0.35; // concepts closer than this merge into one trace
const BUCKET = NEIGHBOUR_RADIUS;

// ─── Deterministic embedding ────────────────────────────────────

/** FNV-1a; a salt turns one input into several independent channels. */
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Uniform in [0,1) derived from an independent hash channel of the input. */
function unit(str, salt) {
  return (hash32(`${salt}:${str}`) % 1000003) / 1000003;
}

function round6(n) {
  return Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0;
}

/**
 * Position in the complex plane: `re` from the text's identity, `im` from its
 * novelty, both projected into the window the frontend renders
 * (x ∈ [-2,1], y ∈ [-1.5,1.5]) so mock traces look plausible on screen.
 */
function embed(text) {
  const clean = text.trim().toLowerCase();
  const re = -2 + unit(clean, 're') * 3;
  const im = -1.5 + unit(clean, 'im') * 3;
  const energy = Math.min(1, Math.abs(Math.sin(re * Math.PI) * Math.cos(im * Math.PI)) + 0.1);
  const vector = [];
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vector.push(round6(Math.sin((i + 1) * re * 0.37) * Math.cos((i + 1) * im * 0.21) * energy));
  }
  return { re: round6(re), im: round6(im), vector, energy: round6(energy) };
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'of', 'to', 'in', 'on',
  'for', 'with', 'is', 'are', 'was', 'were', 'be', 'it', 'this', 'that', 'as',
  'at', 'by', 'from', 'le', 'la', 'les', 'des', 'un', 'une', 'et', 'que', 'qui',
  'se', 'ce', 'en',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9']+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

// ─── Memory graph ───────────────────────────────────────────────

/** @type {Map<number, {id:number,re:number,im:number,label:string,tokens:string[],salience:number,access_count:number,timestamp:number,connections:number[]}>} */
const memory = new Map();
const buckets = new Map(); // coarse LSH grid: "cellRe|cellIm" → concept ids
const tokenCounts = new Map();
let nextId = 1;
let cycles = 0;
let trained = 0;
let lastActivation = new Set();
let lastInsight = null;
let lastSurprise = 0;
let lastConfidence = 0;

const bucketKey = (re, im) => `${Math.floor(re / BUCKET)}|${Math.floor(im / BUCKET)}`;

function addToBucket(key, id) {
  const list = buckets.get(key);
  if (list) list.push(id);
  else buckets.set(key, [id]);
}

function labelFor(tokens, source) {
  const ranked = [...new Set(tokens)]
    .map((t) => ({ t, score: tokens.filter((x) => x === t).length * t.length }))
    .sort((a, b) => b.score - a.score || a.t.localeCompare(b.t));
  return ranked.length > 0 ? ranked[0].t : source.trim().slice(0, 24) || 'unnamed';
}

function distance(a, b) {
  return a && b ? Math.hypot(a.re - b.re, a.im - b.im) : Number.POSITIVE_INFINITY;
}

/** Ids within NEIGHBOUR_RADIUS, found through the 3×3 neighbourhood of buckets. */
function peersOf(concept) {
  const reCell = Math.floor(concept.re / BUCKET);
  const imCell = Math.floor(concept.im / BUCKET);
  const ids = new Set();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const id of buckets.get(`${reCell + dx}|${imCell + dy}`) ?? []) {
        if (id !== concept.id && distance(concept, memory.get(id)) < NEIGHBOUR_RADIUS) ids.add(id);
      }
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** Move a drifted concept between buckets, then refresh its links. */
function rebucket(concept, previousKey) {
  const nextKey = bucketKey(concept.re, concept.im);
  if (nextKey !== previousKey) {
    const list = buckets.get(previousKey);
    if (list) buckets.set(previousKey, list.filter((id) => id !== concept.id));
    addToBucket(nextKey, concept.id);
  }
  concept.connections = peersOf(concept);
}

/** Store a trace, reinforcing the nearest existing concept when one is close by. */
function store(input) {
  const source = String(input ?? '');
  const tokens = tokenize(source);
  const e = embed(source || 'brain-mock:empty');
  const key = bucketKey(e.re, e.im);

  for (const id of buckets.get(key) ?? []) {
    const existing = memory.get(id);
    if (!existing) continue;
    const seen = existing.access_count + 1;
    const w = 1 / (seen + 1); // a reinforced concept drifts less with each visit
    existing.re = round6(existing.re * (1 - w) + e.re * w);
    existing.im = round6(existing.im * (1 - w) + e.im * w);
    existing.salience = round6(Math.min(1, 0.2 + Math.log1p(seen) / 6));
    existing.access_count = seen;
    existing.timestamp = Date.now();
    existing.tokens = [...existing.tokens, ...tokens];
    existing.label = labelFor(existing.tokens, source);
    rebucket(existing, key);
    return { concept: existing, merged: true };
  }

  const concept = {
    id: nextId++,
    re: e.re,
    im: e.im,
    label: labelFor(tokens, source),
    tokens,
    salience: round6(Math.min(1, 0.2 + tokens.length * 0.05)),
    access_count: 1,
    timestamp: Date.now(),
    connections: [],
  };
  memory.set(concept.id, concept);
  addToBucket(key, concept.id);
  concept.connections = peersOf(concept);
  return { concept, merged: false };
}

function neighbours(concept) {
  return concept.connections
    .map((id) => ({ other: memory.get(id), d: distance(concept, memory.get(id)) }))
    .filter((n) => n.other !== undefined);
}

function publicConcept({ id, re, im, label, salience, access_count, timestamp }) {
  return {
    id,
    position_re: re,
    position_im: im,
    label,
    salience: round6(salience),
    access_count,
    ...(timestamp === undefined ? {} : { timestamp }),
  };
}

/** Mean link density, clamped: a concept with 3+ close neighbours is "connected". */
function coherence() {
  const concepts = [...memory.values()];
  if (concepts.length < 2) return round6(concepts.length ? 0.5 : 0);
  const sum = concepts.reduce((s, c) => s + Math.min(1, neighbours(c).length / 3), 0);
  return round6(Math.min(1, sum / concepts.length));
}

/** Exactly the `BrainState` schema of the contract — the UI reads every field. */
function snapshot() {
  const concepts = [...memory.values()];
  return {
    status: 'online',
    model: `FractalBrain mock (${trained} training steps)`,
    embedding_dim: EMBEDDING_DIM,
    brain_nodes: concepts.length + cycles,
    language_depth: LANGUAGE_DEPTH,
    memory_concepts: concepts.length,
    coherence: coherence(),
    last_insight: lastInsight,
  };
}

// ─── Endpoints (one per operation in the contract) ──────────────

const handlers = {
  'GET /api/state': () => snapshot(),

  'GET /api/memory': (_body, query) => {
    const limit = Math.min(Math.max(Number(query.get('limit')) || 50, 1), 200);
    const concepts = [...memory.values()]
      .sort((a, b) => b.salience * b.access_count - a.salience * a.access_count)
      .slice(0, limit)
      .map(publicConcept);
    return { concepts, total: memory.size };
  },

  'POST /api/perceive': (body) => {
    const input = String(body?.input ?? '').trim();
    if (input.length === 0) return { status: 400, data: { error: 'input is required' } };
    if (input.length > 32000) return { status: 400, data: { error: 'input too long (max 32000 chars)' } };
    const { concept, merged } = store(input);
    for (const t of tokenize(input)) tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
    lastActivation = new Set([...lastActivation, concept.id]);
    return {
      status: 200,
      data: {
        embedding_dim: EMBEDDING_DIM,
        perceived: true,
        memory_stored: true,
        concept: publicConcept(concept),
        merged,
      },
    };
  },

  'POST /api/think': (body) => {
    const requested = Number(body?.cycles ?? 5);
    const run = Math.min(Math.max(Number.isFinite(requested) ? requested : 5, 1), 50);
    lastActivation = new Set();
    for (let c = 0; c < run; c++) {
      cycles += 1;
      for (const concept of memory.values()) {
        // A concept fires in proportion to its salience, then spreads to neighbours.
        if (unit(`${concept.id}:${c}`, 'fire') < concept.salience * 0.6 + 0.1) lastActivation.add(concept.id);
        for (const { other, d } of neighbours(concept)) {
          if (unit(`${concept.id}>${other.id}:${c}`, 'spread') > d / NEIGHBOUR_RADIUS) lastActivation.add(other.id);
        }
      }
    }
    return {
      status: 200,
      data: {
        cycles_run: run,
        active_nodes: lastActivation.size,
        active_concept_ids: [...lastActivation].sort((a, b) => a - b),
      },
    };
  },

  'POST /api/reflect': () => {
    const concepts = [...memory.values()];
    if (concepts.length < 2) {
      lastSurprise = 1;
      lastConfidence = 0;
      lastInsight = 'no memory traces to reflect on yet';
      return {
        coherence: coherence(),
        avg_surprise: 1,
        avg_confidence: 0,
        should_rewire: true,
        insight: lastInsight,
        memory_utilization: 0,
      };
    }
    let surpriseSum = 0;
    for (const concept of concepts) {
      const near = neighbours(concept);
      surpriseSum += near.length ? Math.min(...near.map((n) => n.d)) / NEIGHBOUR_RADIUS : 1;
    }
    lastSurprise = round6(Math.min(surpriseSum / concepts.length, 1));
    const reuse = concepts.reduce((s, c) => s + Math.min(c.access_count / 8, 1), 0) / concepts.length;
    lastConfidence = round6(Math.min(0.95, 0.25 + reuse * 0.6 + (1 - lastSurprise) * 0.15));
    const shouldRewire = lastSurprise > 0.75;
    lastInsight = shouldRewire
      ? `islanded concepts (surprise ${lastSurprise.toFixed(2)}) — rewiring suggested`
      : `stable attractor over ${concepts.length} concepts (coherence ${coherence().toFixed(2)})`;
    return {
      coherence: coherence(),
      avg_surprise: round6(lastSurprise),
      avg_confidence: round6(lastConfidence),
      should_rewire: shouldRewire,
      insight: lastInsight,
      memory_utilization: round6(Math.min(concepts.length / CAPACITY, 1)),
    };
  },

  'POST /api/train': (body) => {
    const text = String(body?.text ?? '').trim();
    if (text.length === 0) return { status: 400, data: { error: 'Training text is required' } };
    if (text.length > 65536) return { status: 400, data: { error: 'text too long (max 65536 chars)' } };
    const tokens = tokenize(text);
    for (const t of tokens) tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
    const steps = Math.max(1, Math.min(Number(body?.steps ?? 10) || 10, 500));
    let loss = 0;
    for (let s = 0; s < steps; s++) {
      // Perplexity proxy: each token contributes 1/√(times seen), so a repeated
      // corpus decays towards 0 while novel text stays near 1.
      loss = tokens.length
        ? tokens.reduce((acc, t) => acc + 1 / Math.sqrt(tokenCounts.get(t) ?? 1), 0) / tokens.length
        : 0;
      for (const t of tokens) tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
      store(text);
      cycles += 1;
      trained += 1;
    }
    return { status: 200, data: { loss: round6(Math.min(loss, 4)), steps } };
  },

  'POST /api/reset': () => {
    const cleared = memory.size;
    memory.clear();
    buckets.clear();
    tokenCounts.clear();
    lastActivation = new Set();
    cycles = 0;
    trained = 0;
    nextId = 1;
    lastInsight = null;
    lastSurprise = 0;
    lastConfidence = 0;
    return { status: 200, data: { cleared } };
  },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.destroy();
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  if (url.pathname === '/' || url.pathname === '/health') {
    return send(res, 200, { ok: true, service: 'fractalbrain-mock', endpoints: Object.keys(handlers) });
  }
  const handler = handlers[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: `unknown endpoint ${req.method} ${url.pathname}` });
  readBody(req).then(
    (body) => {
      try {
        const result = handler(body, url.searchParams);
        if (result && typeof result === 'object' && 'status' in result && 'data' in result) {
          send(res, result.status, result.data);
        } else {
          send(res, 200, result);
        }
      } catch (error) {
        send(res, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
    (error) => send(res, 400, { error: error instanceof Error ? error.message : String(error) })
  );
});

// Listen only when run directly, so tests can import `server` on an ephemeral port.
const isDirectRun = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  server.listen(PORT, HOST, () => {
    console.log(`[brain-mock] listening on http://${HOST}:${PORT} (memory capacity ${CAPACITY})`);
  });
}

export { server, memory, embed, tokenize, round6 };
