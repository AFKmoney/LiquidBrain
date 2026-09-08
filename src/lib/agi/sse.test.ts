import test from 'node:test';
import assert from 'node:assert/strict';

import { consumeSse, createSseParser } from './sse';

function collect() {
  const events: Array<{ event: string; data: string }> = [];
  return { events, parser: createSseParser((e) => events.push(e)) };
}

test('a frame is dispatched once its blank line arrives', () => {
  const { events, parser } = collect();
  parser.feed('event: delta\ndata: {"text":"co"}\n\n');
  assert.deepEqual(events, [{ event: 'delta', data: '{"text":"co"}' }]);
});

test('frames split across chunk boundaries are reassembled', () => {
  const { events, parser } = collect();
  parser.feed('event: del');
  assert.equal(events.length, 0, 'a partial frame must not be dispatched early');
  parser.feed('ta\ndata: {"tex');
  assert.equal(events.length, 0);
  parser.feed('t":"herence"}\n\n\n');
  assert.deepEqual(events, [{ event: 'delta', data: '{"text":"herence"}' }]);
});

test('comments, CRLF endings and unnamed events are handled', () => {
  const { events, parser } = collect();
  parser.feed(': keep-alive\r\ndata: {"a":1}\r\n\r\ndata: {"b":2}\n\n');
  assert.deepEqual(events, [
    { event: 'message', data: '{"a":1}' },
    { event: 'message', data: '{"b":2}' },
  ]);
});

test('multi-line data is joined with newlines, as the SSE spec requires', () => {
  const { events, parser } = collect();
  parser.feed('data: line1\ndata: line2\n\n');
  assert.equal(events[0].data, 'line1\nline2');
});

test('end() flushes a final frame the stream cut short', () => {
  const { events, parser } = collect();
  parser.feed('event: done\ndata: {"reply":"x"}');
  assert.equal(events.length, 0);
  parser.end();
  assert.deepEqual(events, [{ event: 'done', data: '{"reply":"x"}' }]);
});

test('consumeSse decodes a byte stream into parsed payloads', async () => {
  const encoder = new TextEncoder();
  // Deliberately cut mid-frame and mid-JSON to prove the reader is incremental.
  const chunks = [
    'event: meta\ndata: {"model":"m',
    '1","coherence":0.7,"memory_size":3}\n\nevent: delta\ndata: {"text":"hel',
    'lo"}\n\nevent: done\ndata: {"reply":"hello"}\n\n',
  ].map((c) => encoder.encode(c));

  const seen: Array<[string, unknown]> = [];
  await consumeSse(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    (event, payload) => seen.push([event, payload])
  );

  assert.deepEqual(seen, [
    ['meta', { model: 'm1', coherence: 0.7, memory_size: 3 }],
    ['delta', { text: 'hello' }],
    ['done', { reply: 'hello' }],
  ]);
});

test('consumeSse hands non-JSON data through as text instead of throwing', async () => {
  const body = new Response('data: plain text\n\n', {
    headers: { 'Content-Type': 'text/event-stream' },
  }).body!;
  const seen: Array<[string, unknown]> = [];
  await consumeSse(body, (event, payload) => seen.push([event, payload]));
  assert.deepEqual(seen, [['message', 'plain text']]);
});
