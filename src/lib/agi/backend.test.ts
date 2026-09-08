import test from 'node:test';
import assert from 'node:assert/strict';

import {
  backendUrl,
  BACKEND_TIMEOUTS,
  BACKEND_URL,
  DEFAULT_BACKEND_URL,
  normaliseBaseUrl,
  type BackendEndpoint,
} from './backend.ts';

// The proxies used to hard-code http://127.0.0.1:8080 in six separate files,
// which ignored FRACTALBRAIN_URL and produced trailing-slash bugs. Pinned here.

const ENDPOINTS: BackendEndpoint[] = [
  '/api/state',
  '/api/memory',
  '/api/perceive',
  '/api/think',
  '/api/reflect',
  '/api/train',
];

test('every proxied endpoint has a bounded timeout', () => {
  for (const endpoint of ENDPOINTS) {
    const timeout = BACKEND_TIMEOUTS[endpoint];
    assert.ok(typeof timeout === 'number' && timeout > 0, `${endpoint} has no timeout`);
    assert.ok(timeout <= 30_000, `${endpoint} timeout is too long for a UI request`);
  }
});

test('backendUrl joins paths without doubling slashes', () => {
  assert.equal(backendUrl('/api/state'), `${BACKEND_URL}/api/state`);
  assert.equal(backendUrl('api/state'), `${BACKEND_URL}/api/state`);
  assert.ok(!backendUrl('/api/state').includes('//api'), 'no doubled slash');
});

test('normaliseBaseUrl honours FRACTALBRAIN_URL and strips trailing slashes', () => {
  assert.equal(normaliseBaseUrl('http://brain.local:9000///'), 'http://brain.local:9000');
  assert.equal(normaliseBaseUrl('  http://brain.local:9000/  '), 'http://brain.local:9000');
  // Empty / missing config falls back to the documented default.
  assert.equal(normaliseBaseUrl(''), DEFAULT_BACKEND_URL);
  assert.equal(normaliseBaseUrl(undefined), DEFAULT_BACKEND_URL);
  assert.equal(normaliseBaseUrl(null), DEFAULT_BACKEND_URL);
});
