import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KEY_NAMES,
  __resetKeyStore,
  cleanKey,
  forgetKeys,
  getKeys,
  isKeyName,
  keyStatus,
  maskKey,
  setKeys,
} from './keys';

const SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('only the three known key names are accepted', () => {
  assert.deepEqual([...KEY_NAMES], ['NVIDIA_API_KEY', 'MINIMAX_API_KEY', 'ZAI_API_KEY']);
  assert.equal(isKeyName('NVIDIA_API_KEY'), true);
  for (const sneaky of ['__proto__', 'constructor', 'PATH', '', 'NVIDIA_API_KEYX']) {
    assert.equal(isKeyName(sneaky), false, `${sneaky} must not be storable`);
  }
});

test('cleanKey trims, strips control characters, refuses junk', () => {
  assert.equal(cleanKey('  nvapi-abc123  '), 'nvapi-abc123');
  assert.equal(cleanKey('nvapi-a\u0000b\n'), 'nvapi-ab');
  assert.equal(cleanKey('   '), null, 'blank means delete');
  assert.equal(cleanKey(undefined), null);
  assert.equal(cleanKey(42), null);
  assert.equal(cleanKey('x'.repeat(513)), null, 'oversized values are rejected');
});

test('keys are sharded per session and never shared between them', () => {
  __resetKeyStore();
  assert.deepEqual(setKeys(SESSION, { NVIDIA_API_KEY: 'nvapi-session' }), ['NVIDIA_API_KEY']);
  assert.deepEqual(getKeys(SESSION), { NVIDIA_API_KEY: 'nvapi-session' });
  assert.deepEqual(getKeys(OTHER), {}, 'another session must not see it');
  assert.deepEqual(getKeys(null), {}, 'no cookie, no keys');

  // Unknown and prototype-polluting names are dropped rather than stored.
  const polluted = setKeys(SESSION, { __proto__: 'evil', nope: 'x' } as unknown as Record<string, string>);
  assert.deepEqual(polluted, [], 'nothing changed, so nothing is reported as changed');
  assert.deepEqual(Object.keys(getKeys(SESSION)), ['NVIDIA_API_KEY']);

  // The returned object is a copy: scribbling on it must not reach the store.
  const snapshot = getKeys(SESSION);
  snapshot.NVIDIA_API_KEY = 'tampered';
  assert.equal(getKeys(SESSION).NVIDIA_API_KEY, 'nvapi-session');
});

test('an empty value deletes a key so it can be forgotten', () => {
  __resetKeyStore();
  setKeys(SESSION, { ZAI_API_KEY: 'zai-1', MINIMAX_API_KEY: 'mm-1' });
  assert.deepEqual(Object.keys(getKeys(SESSION)).sort(), ['MINIMAX_API_KEY', 'ZAI_API_KEY']);
  const changed = setKeys(SESSION, { ZAI_API_KEY: '   ' });
  assert.deepEqual(changed, ['ZAI_API_KEY']);
  assert.deepEqual(getKeys(SESSION), { MINIMAX_API_KEY: 'mm-1' });
  assert.equal(forgetKeys(SESSION), 1);
  assert.deepEqual(getKeys(SESSION), {});
  assert.equal(forgetKeys(SESSION), 0, 'forgetting twice is not an error');
});

test('status reports the source of the effective key and masks its value', () => {
  __resetKeyStore();
  const envBackup = process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_API_KEY;

  let status = keyStatus(null);
  assert.deepEqual(
    status.map((k) => [k.name, k.source]),
    KEY_NAMES.map((n) => [n, 'none' as const])
  );

  process.env.NVIDIA_API_KEY = 'nvapi-env0000deadbeef';
  status = keyStatus(null);
  assert.equal(status.find((k) => k.name === 'NVIDIA_API_KEY')!.source, 'env');

  setKeys(SESSION, { NVIDIA_API_KEY: 'nvapi-sessioncafe0000' });
  status = keyStatus(SESSION);
  const nvidia = status.find((k) => k.name === 'NVIDIA_API_KEY')!;
  assert.equal(nvidia.source, 'session', 'a session key wins over the environment');
  assert.equal(nvidia.masked, maskKey('nvapi-sessioncafe0000'));
  assert.ok(nvidia.masked && !nvidia.masked.includes('sessioncafe00'), 'the value must not leak');

  if (envBackup === undefined) delete process.env.NVIDIA_API_KEY;
  else process.env.NVIDIA_API_KEY = envBackup;
});

test('maskKey shows at most half the value', () => {
  assert.equal(maskKey('0123456789'), '••••••6789');
  assert.equal(maskKey('abcdefgh'), '••••••efgh');
  assert.equal(maskKey('abc'), '••••••c', 'a short key is not revealed by its own mask');
  assert.ok(!maskKey('supersecretvalue').includes('secret'));
});
