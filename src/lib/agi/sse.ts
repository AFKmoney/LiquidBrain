// ─── Minimal SSE frame parser (client side) ─────────────────────
// The chat route answers `stream: true` with `text/event-stream`, so the
// browser has to split frames across arbitrary network chunk boundaries.
// Kept free of DOM types so it can be unit-tested in plain Node.

export interface SseEvent {
  /** The `event:` field, or `message` when the frame did not name one. */
  event: string;
  /** The joined `data:` lines, still a string — the caller parses JSON. */
  data: string;
}

/** A frame is complete at the blank line; `data:` lines may repeat within it. */
function parseFrame(frame: string): SseEvent | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue; // comment / keep-alive
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (data.length === 0) return null;
  return { event, data: data.join('\n') };
}

export interface SseParser {
  /** Feed a decoded text chunk; complete frames are dispatched synchronously. */
  feed(chunk: string): void;
  /** Dispatch a trailing frame that never got its blank line (stream ended). */
  end(): void;
}

/**
 * Incremental parser. Tolerates CRLF line endings and a chunk boundary that
 * splits `\r\n` or a multi-byte character (the caller decodes with
 * `TextDecoder({ stream: true })`, which handles the latter).
 */
export function createSseParser(onEvent: (event: SseEvent) => void): SseParser {
  let buffer = '';
  return {
    feed(chunk: string) {
      buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseFrame(frame);
        if (parsed) onEvent(parsed);
        boundary = buffer.indexOf('\n\n');
      }
    },
    end() {
      const rest = buffer;
      buffer = '';
      const parsed = parseFrame(rest);
      if (parsed) onEvent(parsed);
    },
  };
}

/** Read a fetch body as SSE, dispatching each frame's parsed JSON payload. */
export async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, payload: any) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser(({ event, data }) => {
    let payload: unknown = data;
    try {
      payload = JSON.parse(data);
    } catch {
      /* non-JSON data line: hand it over as text */
    }
    onEvent(event, payload);
  });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
    parser.end();
  } finally {
    reader.releaseLock();
  }
}
