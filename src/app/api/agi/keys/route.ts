import { NextResponse } from 'next/server';
import { guard } from '@/lib/server/guard';
import { forgetKeys, keyStatus, setKeys } from '@/lib/server/keys';
import {
  isSecureRequest,
  isSessionId,
  readSessionId,
  resolveSession,
  sessionCookieExpiry,
  type ResolvedSession,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Key custody for the dashboard.
 *
 *   GET    → which providers have a key, and a mask of it (never the value)
 *   POST   → store keys for this session; `""` removes one
 *   DELETE → forget this session's keys and expire the cookie
 *
 * Nothing here is persisted to disk, so a server restart returns every
 * session to "env vars only". That is the point: a leaked container image or
 * a stray SQLite file must not contain credentials.
 */

/** Attach the cookie only when this request is the one that created the session. */
function withSession(session: ResolvedSession, data: unknown, status = 200) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (session.cookie) headers['Set-Cookie'] = session.cookie;
  return NextResponse.json(data, { status, headers });
}

export async function GET(request: Request) {
  const blocked = await guard(request, { scope: 'keys' });
  if (!blocked.ok) return blocked.response;

  return withSession(blocked.session, {
    keys: keyStatus(blocked.session.sessionId),
    // Surfaced so the UI can explain why a key will disappear on restart.
    storage: 'in-memory for this process only',
    envFallback: true,
  });
}

export async function POST(request: Request) {
  const blocked = await guard(request, { scope: 'keys' });
  if (!blocked.ok) return blocked.response;

  const changed = setKeys(blocked.session.sessionId, blocked.body);
  if (changed.length === 0) {
    return withSession(
      blocked.session,
      { error: 'No known key field in the body (NVIDIA_API_KEY, MINIMAX_API_KEY, ZAI_API_KEY)' },
      400
    );
  }
  return withSession(blocked.session, {
    ok: true,
    updated: changed,
    keys: keyStatus(blocked.session.sessionId),
  });
}

export async function DELETE(request: Request) {
  const sessionId = readSessionId(request);
  const removed = forgetKeys(sessionId);
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  // Also drop the id itself so the next visit starts from a clean slate.
  if (isSessionId(sessionId)) headers['Set-Cookie'] = sessionCookieExpiry(isSecureRequest(request));
  return NextResponse.json({ ok: true, forgotten: removed }, { headers });
}
