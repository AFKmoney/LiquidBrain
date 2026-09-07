// ─── Route guard: origin check, throttle, body size ─────────────
// Every /api/agi/* route is a proxy that can spend money (LLM tokens, image
// generation) or load the engine, and until now any page on the internet
// could drive it from a victim's browser: no origin check, no rate limit, no
// body cap. These three checks are deliberately tiny, dependency-free and
// synchronous so they can run in a Node test as well as in a route handler.

import { readSessionId, resolveSession, type ResolvedSession } from './session';

export interface RateLimit {
  limit: number;
  windowMs: number;
}

/** Budgets per class of endpoint. Generous for one person typing, tight for a script. */
export const LIMITS = {
  /** LLM round trip: the expensive one. */
  chat: { limit: 12, windowMs: 60_000 },
  /** Images, TTS and vision: priced per call and slow. */
  media: { limit: 6, windowMs: 60_000 },
  /** Safety screening rides the same paid APIs. */
  safety: { limit: 20, windowMs: 60_000 },
  /** Engine nudges: cheap locally, but still not unbounded. */
  engine: { limit: 60, windowMs: 60_000 },
  /** Key custody: enough to edit a few fields, not to probe. */
  keys: { limit: 20, windowMs: 60_000 },
} satisfies Record<string, RateLimit>;

interface Bucket {
  count: number;
  resetAt: number;
}

const global = globalThis as typeof globalThis & { __liquidbrainThrottle?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (global.__liquidbrainThrottle ??= new Map<string, Bucket>());

export interface ThrottleResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter per client+scope. Not fair across a shared NAT, which
 * is acceptable: the goal is to cap blast radius, not to fingerprint users.
 */
export function throttle(key: string, { limit, windowMs }: RateLimit, now = Date.now()): ThrottleResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) sweepThrottle(now);
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

function sweepThrottle(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Test hook. */
export function __resetThrottle(): void {
  buckets.clear();
}

/** Split `host[:port]`, tolerating an IPv6 literal in brackets. */
function splitAuthority(authority: string): { host: string; port: string } {
  const value = authority.trim().replace(/\/$/, '');
  // tsconfig targets ES2017, so no named capture groups here.
  const bracketed = value.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketed) return { host: bracketed[1]!, port: bracketed[2] ?? '' };
  const plain = value.match(/^([^:]+)(?::(\d+))?$/);
  if (!plain) return { host: value, port: '' };
  return { host: plain[1]!, port: plain[2] ?? '' };
}

/**
 * Does the caller's Origin belong to this deployment?
 *
 * The comparison cannot use `request.url` alone: in dev, in a container, and
 * behind any TLS-terminating proxy the URL Next hands a route handler is the
 * *internal* one (`http://localhost:3000`) while the browser sent the public
 * authority. So every authority the request actually carries is accepted —
 * `x-forwarded-host`, then `Host`, then the request URL — and when a proxy
 * rewrote the host, ports are not comparable and only the hostname is.
 */
export function isSameOrigin(request: Request): boolean {
  const header = request.headers.get('origin') ?? request.headers.get('referer');
  // No Origin at all: curl, health checks and same-origin GETs from older
  // browsers. SameSite=Strict on the session cookie is what stops a foreign
  // page from riding a session here, so this is not a bypass of anything.
  if (!header) return true;

  let source: URL;
  try {
    source = new URL(header);
  } catch {
    return false;
  }

  const forwarded = request.headers.get('x-forwarded-host');
  const authorities: string[] = [];
  if (forwarded) authorities.push(...forwarded.split(',').map((part) => part.trim()));
  const host = request.headers.get('host');
  if (host) authorities.push(host);
  try {
    authorities.push(new URL(request.url).host);
  } catch {
    /* a malformed absolute URL leaves the Host header as the only reference */
  }

  for (const authority of authorities.filter((a) => a.length > 0)) {
    const { host: expected, port } = splitAuthority(authority);
    if (source.hostname !== expected) continue;
    if (forwarded) return true; // the proxy owns the port and the scheme
    const sourcePort = source.port || (source.protocol === 'https:' ? '443' : '80');
    const expectedPort = port || (source.protocol === 'https:' ? '443' : '80');
    if (sourcePort === expectedPort) return true;
  }
  return false;
}

/** Client identity for throttling: forwarded IP, falling back to the session. */
export function clientLabel(request: Request, sessionId = readSessionId(request)): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]!.trim() : '';
  return ip.length > 0 ? ip : (sessionId ?? 'anonymous');
}

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return json(
    429,
    { error: `Too many requests. Retry in ${retryAfterSeconds}s.`, retryAfterSeconds },
    { 'Retry-After': String(retryAfterSeconds) }
  );
}

export function crossOrigin(): Response {
  return json(403, { error: 'Cross-origin requests are not allowed on this proxy' });
}

export type GuardResult =
  | { ok: true; body: Record<string, unknown>; session: ResolvedSession }
  | { ok: false; response: Response };

export interface GuardOptions extends Partial<RateLimit> {
  scope: keyof typeof LIMITS;
  /** Reject a larger body than this (bytes). Default 64 KB; vision/image raise it. */
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 64 * 1024;
/** Base64 images arrive in the body, so those routes need more room. */
export const MEDIA_MAX_BYTES = 6 * 1024 * 1024;

/**
 * One call per route: origin check, throttle, then a size-capped JSON parse.
 * A GET/DELETE carries no body, so `body` comes back as `{}`.
 */
export async function guard(request: Request, options: GuardOptions): Promise<GuardResult> {
  if (!isSameOrigin(request)) return { ok: false, response: crossOrigin() };
  const session = resolveSession(request);

  // An explicit limit overrides the scope preset; the scope always names the bucket.
  const rate: RateLimit = {
    limit: options.limit ?? LIMITS[options.scope].limit,
    windowMs: options.windowMs ?? LIMITS[options.scope].windowMs,
  };
  const verdict = throttle(`${options.scope}:${clientLabel(request, session.sessionId)}`, rate);
  if (!verdict.allowed) return { ok: false, response: tooManyRequests(verdict.retryAfterSeconds) };

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: json(413, { error: `Body larger than ${Math.floor(maxBytes / 1024)} KB` }) };
  }

  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
    return { ok: true, body: {}, session };
  }

  const raw = await request.text();
  if (raw.length === 0) return { ok: true, body: {}, session };
  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { ok: false, response: json(413, { error: `Body larger than ${Math.floor(maxBytes / 1024)} KB` }) };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, response: json(400, { error: 'Expected a JSON object body' }) };
    }
    return { ok: true, body: parsed as Record<string, unknown>, session };
  } catch {
    return { ok: false, response: json(400, { error: 'Invalid JSON body' }) };
  }
}
