import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMITS,
  __resetThrottle,
  clientLabel,
  guard,
  isSameOrigin,
  throttle,
} from './guard';

const HOST = 'http://localhost:3000';

function request(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Request {
  return new Request(`${HOST}${path}`, {
    method: init.method ?? 'GET',
    headers: init.headers,
    ...(init.body === undefined ? {} : { body: init.body }),
  });
}

test('throttle allows `limit` calls per window and reports the reset', () => {
  __resetThrottle();
  const now = 1_000_000;
  for (let i = 0; i < 3; i++) {
    assert.equal(throttle('a', { limit: 3, windowMs: 1000 }, now).allowed, true, `call ${i + 1}`);
  }
  const blocked = throttle('a', { limit: 3, windowMs: 1000 }, now + 500);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1, 'rounds the remaining 500ms up to a second');

  // A different client is unaffected, and the window rolls over.
  assert.equal(throttle('b', { limit: 3, windowMs: 1000 }, now + 500).allowed, true);
  assert.equal(throttle('a', { limit: 3, windowMs: 1000 }, now + 1001).allowed, true);
});

test('throttle counts each scope separately', () => {
  __resetThrottle();
  for (let i = 0; i < LIMITS.media.limit; i++) {
    assert.equal(throttle(`media:1.2.3.4`, LIMITS.media, 0).allowed, true);
  }
  assert.equal(throttle('media:1.2.3.4', LIMITS.media, 0).allowed, false);
  assert.equal(throttle('chat:1.2.3.4', LIMITS.chat, 0).allowed, true);
});

test('same-origin accepts this host, a missing Origin and relative referers; rejects foreign ones', () => {
  assert.equal(isSameOrigin(request('/api/agi/chat')), true, 'curl-style request without Origin');
  assert.equal(
    isSameOrigin(request('/api/agi/chat', { headers: { origin: HOST } })),
    true
  );
  assert.equal(
    isSameOrigin(request('/api/agi/chat', { headers: { referer: `${HOST}/some/page` } })),
    true
  );
  assert.equal(isSameOrigin(request('/api/agi/chat', { headers: { origin: 'https://evil.example' } })), false);
  // A different port is a different origin, even on the same host.
  assert.equal(isSameOrigin(request('/api/agi/chat', { headers: { origin: 'http://localhost:4000' } })), false);
});

test('isSameOrigin accepts the public authority, not just Next\'s internal URL', () => {
  // In dev and in containers request.url is the internal address while the
  // browser sent the host it actually typed — rejecting that breaks the app.
  const devLike = new Request('http://localhost:3000/api/agi/chat', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' },
  });
  assert.equal(isSameOrigin(devLike), true, 'Origin matches Host even though request.url differs');

  // Behind a TLS proxy the port belongs to the proxy, so only the hostname is compared.
  const proxied = new Request('http://127.0.0.1:3000/api/agi/chat', {
    method: 'POST',
    headers: {
      origin: 'https://brain.example.com',
      host: '127.0.0.1:3000',
      'x-forwarded-host': 'brain.example.com',
      'x-forwarded-proto': 'https',
    },
  });
  assert.equal(isSameOrigin(proxied), true);

  const spoofed = new Request('http://localhost:3000/api/agi/chat', {
    method: 'POST',
    headers: { origin: 'https://brain.example.com', host: 'localhost:3000' },
  });
  assert.equal(isSameOrigin(spoofed), false, 'no forwarded host means the public origin is foreign');

  assert.equal(
    isSameOrigin(new Request('http://localhost:3000/x', { method: 'POST', headers: { origin: 'not a url' } })),
    false,
    'an unparseable Origin is not a pass'
  );
});

test('guard mints a session for a first visit and exposes its cookie', async () => {
  const result = await guard(request('/api/agi/keys', { method: 'POST', headers: { origin: HOST } }), {
    scope: 'keys',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.session.sessionId, /^[0-9a-f-]{36}$/);
    assert.equal(result.session.isNew, true);
    assert.ok(result.session.cookie?.startsWith('lb_session='));
    assert.match(result.session.cookie!, /HttpOnly/);
    assert.match(result.session.cookie!, /SameSite=Strict/);
    assert.match(result.session.cookie!, /Max-Age=43200/);
    assert.ok(!/Secure/.test(result.session.cookie!), 'plain-http dev must not get a Secure cookie');
  }
});

test('clientLabel prefers the leftmost forwarded-for hop, then the session', () => {
  assert.equal(
    clientLabel(request('/x', { headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18' } })),
    '203.0.113.7'
  );
  assert.equal(
    clientLabel(request('/x', { headers: { cookie: 'lb_session=11111111-1111-4111-8111-111111111111' } })),
    '11111111-1111-4111-8111-111111111111'
  );
  assert.equal(clientLabel(request('/x')), 'anonymous');
});

test('guard rejects cross-origin writes with 403 before anything else', async () => {
  const result = await guard(
    request('/api/agi/chat', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    }),
    { scope: 'chat' }
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 403);
    assert.match((await result.response.json()).error, /Cross-origin/);
  }
});

test('guard parses the body once, caps its size, and keeps the session id', async () => {
  const ok = await guard(
    request('/api/agi/chat', {
      method: 'POST',
      headers: {
        origin: HOST,
        'content-type': 'application/json',
        cookie: 'lb_session=22222222-2222-4222-8222-222222222222',
      },
      body: JSON.stringify({ message: 'hello', stream: true }),
    }),
    { scope: 'chat' }
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.body, { message: 'hello', stream: true });
    assert.equal(ok.session.sessionId, '22222222-2222-4222-8222-222222222222');
    assert.equal(ok.session.isNew, false, 'an existing cookie must not be re-minted');
    assert.equal(ok.session.cookie, null);
  }

  const tooBig = await guard(
    request('/api/agi/chat', {
      method: 'POST',
      headers: { origin: HOST, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'x'.repeat(5000) }),
    }),
    { scope: 'chat', maxBytes: 1024 }
  );
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.equal(tooBig.response.status, 413);

  const malformed = await guard(
    request('/api/agi/chat', {
      method: 'POST',
      headers: { origin: HOST, 'content-type': 'application/json' },
      body: '{oops',
    }),
    { scope: 'chat' }
  );
  assert.equal(malformed.ok, false);
  if (!malformed.ok) {
    assert.equal(malformed.response.status, 400);
    assert.equal((await malformed.response.json()).error, 'Invalid JSON body');
  }

  // An empty body is legal: routes fall back to their own defaults.
  const empty = await guard(
    request('/api/agi/reflect', { method: 'POST', headers: { origin: HOST } }),
    { scope: 'engine' }
  );
  assert.deepEqual(empty.ok ? empty.body : null, {});
});

test('guard answers 429 with Retry-After once the budget is gone', async () => {
  __resetThrottle();
  let last: Response | null = null;
  for (let i = 0; i <= LIMITS.chat.limit; i++) {
    const result = await guard(
      request('/api/agi/chat', {
        method: 'POST',
        headers: { origin: HOST, 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.9' },
        body: JSON.stringify({ message: `nudge ${i}` }),
      }),
      { scope: 'chat' }
    );
    if (!result.ok) last = result.response;
  }
  assert.ok(last, 'the limit+1 call should have been throttled');
  assert.equal(last!.status, 429);
  assert.ok(Number(last!.headers.get('Retry-After')) >= 1);
  assert.match((await last!.json()).error, /Too many requests/);
});
