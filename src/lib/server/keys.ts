// ─── API key custody ────────────────────────────────────────────
// Provider keys entered in the UI used to be written to localStorage and
// re-sent inside every request body, which put them in the browser database,
// in the request log of every proxy, and in any XSS payload's reach.
//
// They now live in this process only, in a Map sharded by session id:
//   • never written to disk, never logged, never echoed back — the client gets
//     a mask (`••••••abcd`) at most;
//   • gone on restart or `forget`, no cleanup job required;
//   • env vars (NVIDIA_API_KEY, …) still work and are the only option for
//     headless deployments.
// The trade-off is honest and documented: keys do not survive a server
// restart, and a single-user machine is the intended deployment.

import { readSessionId } from './session';

/** The only key names this module will ever store. */
export const KEY_NAMES = ['NVIDIA_API_KEY', 'MINIMAX_API_KEY', 'ZAI_API_KEY'] as const;
export type KeyName = (typeof KEY_NAMES)[number];

/** A key is not a place to smuggle payloads: cap and strip control chars. */
const MAX_KEY_LENGTH = 512;

/** Idle buckets are swept, and the Map is capped so a hostile client cannot grow it. */
const IDLE_MS = 12 * 60 * 60 * 1000;
const MAX_SESSIONS = 5000;

export type KeySource = 'session' | 'env' | 'none';

export interface KeyStatus {
  name: KeyName;
  source: KeySource;
  /** Masked, e.g. `••••••cdef` — the full value never leaves the server. */
  masked: string | null;
}

interface Bucket {
  keys: Map<KeyName, string>;
  touched: number;
}

// Keyed off globalThis so Next's dev module graph does not hand each re-eval
// a fresh, empty store (which would silently drop keys mid-session on reload).
const global = globalThis as typeof globalThis & { __liquidbrainKeys?: Map<string, Bucket> };
const store: Map<string, Bucket> = (global.__liquidbrainKeys ??= new Map<string, Bucket>());

export function isKeyName(value: unknown): value is KeyName {
  return typeof value === 'string' && (KEY_NAMES as readonly string[]).includes(value);
}

/** Sanitise a client-supplied key, or `null` when it means "forget this one". */
export function cleanKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (value.length === 0 || value.length > MAX_KEY_LENGTH) return null;
  return value;
}

function sweep(now: number): void {
  for (const [id, bucket] of store) {
    if (now - bucket.touched > IDLE_MS) store.delete(id);
  }
  // The sweep above is time-based; this is the hard cap against flooding.
  while (store.size > MAX_SESSIONS) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

function bucketFor(sessionId: string, create: boolean): Bucket | undefined {
  const existing = store.get(sessionId);
  if (existing) {
    existing.touched = Date.now();
    return existing;
  }
  if (!create) return undefined;
  const fresh: Bucket = { keys: new Map(), touched: Date.now() };
  store.set(sessionId, fresh);
  sweep(Date.now());
  return fresh;
}

/**
 * Apply a `{ NVIDIA_API_KEY: 'nvapi-…', ZAI_API_KEY: '' }` patch.
 * Empty/oversized values delete the entry, so a saved key can be unset.
 * Returns the names that changed.
 */
export function setKeys(sessionId: string, patch: Record<string, unknown>): KeyName[] {
  const bucket = bucketFor(sessionId, true)!;
  const changed: KeyName[] = [];
  for (const [name, raw] of Object.entries(patch ?? {})) {
    if (!isKeyName(name)) continue;
    const value = cleanKey(raw);
    if (value === null) bucket.keys.delete(name);
    else bucket.keys.set(name, value);
    changed.push(name);
  }
  return changed;
}

/** Keys held for a session, shaped the way the provider layer expects. */
export function getKeys(sessionId: string | null): Record<string, string> {
  if (!sessionId) return {};
  const bucket = bucketFor(sessionId, false);
  return bucket ? Object.fromEntries(bucket.keys) : {};
}

/** Keys for the session attached to a request (used by every proxy route). */
export function requestKeys(request: Request): Record<string, string> {
  return getKeys(readSessionId(request));
}

export function forgetKeys(sessionId: string | null): number {
  if (!sessionId) return 0;
  const removed = store.delete(sessionId);
  return removed ? 1 : 0;
}

/**
 * `••••••cdef` — enough to recognise a key, not enough to use it. A key
 * shorter than eight characters would otherwise be revealed in full, so at
 * most half of it is ever shown.
 */
export function maskKey(value: string): string {
  const visible = Math.min(4, Math.floor(value.length / 2));
  return `••••••${value.slice(value.length - visible)}`;
}

function envValue(name: KeyName): string {
  const fromEnv = process.env[name];
  return typeof fromEnv === 'string' && fromEnv.trim().length > 0 ? fromEnv.trim() : '';
}

/** Per-key report for the UI: where the effective key comes from, plus a mask. */
export function keyStatus(sessionId: string | null): KeyStatus[] {
  const held = sessionId ? bucketFor(sessionId, false)?.keys : undefined;
  return KEY_NAMES.map((name) => {
    const sessionValue = held?.get(name);
    if (sessionValue) return { name, source: 'session' as const, masked: maskKey(sessionValue) };
    if (envValue(name)) return { name, source: 'env' as const, masked: maskKey(envValue(name)) };
    return { name, source: 'none' as const, masked: null };
  });
}

/** Test hook: drop everything. */
export function __resetKeyStore(): void {
  store.clear();
}
