import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODEL_REGISTRY,
  CATEGORIES,
  PROVIDERS,
  getCategoryLabel,
  getModelById,
  getModelsByCategory,
  getModelsByProvider,
} from './registry.ts';

// These guard the data the whole dashboard is built on. The model list is
// hand-maintained (36 entries), so the checks that used to be implicit are
// pinned down here — an id typo or a wrong category silently breaks routing
// in /api/agi/chat and the panels, with no type error to catch it.

test('model ids are unique', () => {
  const seen = new Set<string>();
  for (const model of MODEL_REGISTRY) {
    assert.ok(!seen.has(model.id), `duplicate model id: ${model.id}`);
    seen.add(model.id);
  }
});

test('every model references a known provider', () => {
  for (const model of MODEL_REGISTRY) {
    assert.ok(PROVIDERS[model.provider as keyof typeof PROVIDERS], `${model.id}: unknown provider ${model.provider}`);
  }
});

test('every model category has a UI bucket and a label', () => {
  for (const model of MODEL_REGISTRY) {
    assert.ok(CATEGORIES.includes(model.category), `${model.id}: category "${model.category}" is not selectable`);
    assert.ok(getCategoryLabel(model.category).length > 0, `${model.id}: empty label`);
  }
});

test('apiKeyName matches the provider contract', () => {
  for (const model of MODEL_REGISTRY) {
    const expected = PROVIDERS[model.provider as keyof typeof PROVIDERS].apiKeyEnvVar;
    assert.equal(model.apiKeyName, expected, `${model.id}: apiKeyName should be ${expected}`);
  }
});

test('models that need a key are not advertised as keyless', () => {
  for (const model of MODEL_REGISTRY) {
    if (model.provider === 'z-ai') continue; // SDK path, key injected by the dev host
    if (model.requiresApiKey) {
      assert.ok(model.apiKeyName, `${model.id}: requiresApiKey without an env var name`);
    }
  }
});

test('chat-capable models advertise the chat capability', () => {
  // Category 'chat' / 'specialized' models are fed through /api/agi/chat.
  for (const model of MODEL_REGISTRY) {
    if (model.category === 'chat') {
      assert.ok(model.capabilities.includes('chat'), `${model.id}: chat model without chat capability`);
    }
  }
});

test('image-gen / tts / safety models can be resolved by the routes that use them', () => {
  // Each specialized route hard-codes a default model id; keep them valid.
  const defaults = [
    'black-forest-labs/flux.1-schnell', // /api/agi/image
    'nvidia/magpie-tts-zeroshot', // /api/agi/tts
    'nvidia/nemotron-3.5-content-safety', // /api/agi/safety
    'nvidia/nemotron-nano-12b-v2-vl', // /api/agi/vision
    'z-ai/glm-5.1', // /api/agi/chat
  ];
  for (const id of defaults) {
    assert.ok(getModelById(id), `default model id "${id}" is missing from the registry`);
  }
});

test('params stays a human-readable string', () => {
  for (const model of MODEL_REGISTRY) {
    if (model.params !== undefined) {
      assert.equal(typeof model.params, 'string', `${model.id}: params must be a string`);
    }
  }
});

test('helpers return consistent slices', () => {
  for (const category of CATEGORIES) {
    const models = getModelsByCategory(category);
    for (const model of models) assert.equal(model.category, category);
  }
  const total = CATEGORIES.reduce((sum, c) => sum + getModelsByCategory(c).length, 0);
  assert.equal(total, MODEL_REGISTRY.length, 'every model belongs to exactly one category');

  const nvidia = getModelsByProvider('nvidia');
  assert.ok(nvidia.length > 0);
  for (const model of nvidia) assert.equal(model.provider, 'nvidia');
});
