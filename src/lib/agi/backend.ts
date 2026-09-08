// ─── FractalBrain Backend Client ────────────────────────────────
// Single source of truth for talking to the Rust cognitive engine.
// The backend is OPTIONAL: every call degrades gracefully so the
// dashboard keeps working in LLM-only mode.
//
// Configure with FRACTALBRAIN_URL (defaults to http://127.0.0.1:8080).

export const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8080';

/** Normalise a configured base URL: trim whitespace and trailing slashes. */
export function normaliseBaseUrl(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim();
  const url = trimmed.length > 0 ? trimmed : DEFAULT_BACKEND_URL;
  return url.replace(/\/+$/, '');
}

/** Base URL of the FractalBrain engine, without a trailing slash. */
export const BACKEND_URL: string = normaliseBaseUrl(process.env.FRACTALBRAIN_URL);

/** Absolute URL for a backend endpoint, e.g. backendUrl('/api/state'). */
export function backendUrl(path: string): string {
  return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export type BackendEndpoint =
  | '/api/state'
  | '/api/memory'
  | '/api/perceive'
  | '/api/think'
  | '/api/reflect'
  | '/api/train';

/** Per-endpoint timeouts (ms). Proxies must never hang a serverless request. */
export const BACKEND_TIMEOUTS: Record<BackendEndpoint, number> = {
  '/api/state': 8000,
  '/api/memory': 5000,
  '/api/perceive': 10000,
  '/api/think': 10000,
  '/api/reflect': 10000,
  '/api/train': 15000,
};

export type BackendResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; error: string };

/**
 * Call a backend endpoint and return a tagged result instead of throwing.
 * - `status: number`  → backend answered but with a non-2xx code
 * - `status: null`    → backend unreachable / timed out
 */
export async function callBackend<T = unknown>(
  endpoint: BackendEndpoint,
  init?: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number }
): Promise<BackendResult<T>> {
  const timeoutMs = init?.timeoutMs ?? BACKEND_TIMEOUTS[endpoint] ?? 8000;

  try {
    const res = await fetch(backendUrl(endpoint), {
      method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
      ...(init?.body !== undefined
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(init.body),
          }
        : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `Backend returned ${res.status} ${res.statusText}`,
      };
    }

    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      ok: false,
      status: null,
      error: isTimeout
        ? `Backend timed out after ${timeoutMs}ms`
        : 'Backend unreachable',
    };
  }
}

/** Fire-and-forget helper that never rejects (used to nudge think cycles). */
export function fireAndForget(
  endpoint: BackendEndpoint,
  body?: unknown
): void {
  void callBackend(endpoint, { method: 'POST', body, timeoutMs: 5000 }).catch(
    () => {}
  );
}
