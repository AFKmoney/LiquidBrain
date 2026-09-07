// ─── Session identity ───────────────────────────────────────────
// A session here is NOT authentication: this dashboard has no user accounts.
// It is the shard key that keeps one browser's API keys and rate-limit budget
// separate from another's, and the reason a key can be forgotten on demand.
// The cookie is HttpOnly + SameSite=Strict so no script and no cross-site
// request can read or ride on it.

export const SESSION_COOKIE = 'lb_session';

/** Max-Age of the session cookie (12h): keys live in memory, not on disk. */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/** UUIDv4 shape — anything else in the cookie is foreign or tampered with. */
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function newSessionId(): string {
  return globalThis.crypto.randomUUID();
}

/** True for anything that looks like a session id we issued. */
export function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID.test(value);
}

/** Parse the session id out of a request's Cookie header. */
export function readSessionId(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    return isSessionId(value) ? value : null;
  }
  return null;
}

/**
 * Serialise the cookie. `Secure` follows the request protocol (behind a TLS
 * terminating proxy, `x-forwarded-proto`), so plain-http local dev still works.
 * `Partitioned` keeps it out of any embedding context's shared bucket.
 */
export function sessionCookieValue(id: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(id)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? 'Secure' : '',
    'Partitioned',
  ]
    .filter(Boolean)
    .join('; ');
}

/** Expire the cookie (used when the operator forgets their keys). */
export function sessionCookieExpiry(secure: boolean): string {
  return sessionCookieValue('00000000-0000-0000-0000-000000000000', secure).replace(
    /Max-Age=\d+/,
    'Max-Age=0'
  );
}

/** Whether the request reached us over TLS (directly or via a proxy). */
export function isSecureRequest(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim() === 'https';
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ResolvedSession {
  /** Stable id for this browser: existing cookie, or a freshly minted one. */
  sessionId: string;
  /** True when the caller must send `Set-Cookie`. */
  isNew: boolean;
  /** Serialised cookie to attach, or null when the client already has one. */
  cookie: string | null;
}

/**
 * Resolve the session exactly once per request. Returning the serialised
 * cookie here (instead of letting each route mint its own id) is what keeps
 * "store this under my session" and "hand the browser that session id" from
 * drifting apart on a visitor's very first request.
 */
export function resolveSession(request: Request): ResolvedSession {
  const existing = readSessionId(request);
  if (existing) return { sessionId: existing, isNew: false, cookie: null };
  const sessionId = newSessionId();
  return { sessionId, isNew: true, cookie: sessionCookieValue(sessionId, isSecureRequest(request)) };
}
