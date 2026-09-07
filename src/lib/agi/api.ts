'use client';

// ─── API Service (client side) ──────────────────────────────────
// Types live in ./types so server routes can share them without
// importing a 'use client' module.

import { consumeSse } from './sse';
import type {
  BrainState,
  MemoryResponse,
  ChatResponse,
  PerceiveResponse,
  ThinkResponse,
  ReflectResponse,
  TrainResponse,
  StoredChatMessage,
} from './types';

/** Which providers hold a key server-side, and a mask of it. */
export interface KeyStatus {
  name: 'NVIDIA_API_KEY' | 'MINIMAX_API_KEY' | 'ZAI_API_KEY';
  source: 'session' | 'env' | 'none';
  masked: string | null;
}

/** Callbacks for a streamed reply; every hook may be omitted. */
export interface ChatStreamHandlers {
  onMeta?: (meta: { model: string; coherence: number; memory_size: number }) => void;
  onDelta?: (text: string) => void;
}

export type {
  BrainState,
  ConceptSummary,
  MemoryResponse,
  ChatResponse,
  PerceiveResponse,
  ThinkResponse,
  ReflectResponse,
  TrainResponse,
  ChatMessage,
  StoredChatMessage,
} from './types';

const API_BASE = '/api/agi';

class AgiApi {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      // Route handlers return { error } — surface that instead of a bare
      // status line, so the UI can show why a call failed.
      let detail = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data && typeof data.error === 'string') detail = data.error;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(detail);
    }
    return res.json();
  }

  async getState(): Promise<BrainState> {
    return this.request<BrainState>('/state');
  }

  async getMemory(): Promise<MemoryResponse> {
    return this.request<MemoryResponse>('/memory');
  }

  /** Blocking round trip: the whole reply arrives in one JSON body. */
  async chat(message: string, model?: string): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, model }),
    });
  }

  /**
   * Streaming round trip. Tokens are handed to `handlers.onDelta` as they
   * arrive, and the resolved value is the same shape as {@link chat} so the
   * caller can finish from either mode identically.
   *
   * A non-2xx response (429 throttle, 403 cross-origin, 400 validation) is
   * still plain JSON, so the error text reaches `chatError` the same way.
   */
  async chatStream(
    message: string,
    model: string | undefined,
    handlers: ChatStreamHandlers = {}
  ): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ message, model, stream: true }),
      credentials: 'same-origin',
    });

    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data && typeof data.error === 'string') detail = data.error;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(detail);
    }
    if (!res.body) throw new Error('Streaming is not supported by this browser');

    let settled: ChatResponse | null = null;
    let failure: string | null = null;
    let streamed = '';

    await consumeSse(res.body, (event, payload) => {
      const data = (payload ?? {}) as Record<string, unknown>;
      if (event === 'meta') {
        handlers.onMeta?.(data as Parameters<NonNullable<ChatStreamHandlers['onMeta']>>[0]);
      } else if (event === 'delta') {
        const text = typeof data.text === 'string' ? data.text : '';
        streamed += text;
        handlers.onDelta?.(text);
      } else if (event === 'done') {
        settled = data as unknown as ChatResponse;
      } else if (event === 'error') {
        failure = typeof data.error === 'string' ? data.error : 'The model failed mid-reply';
      }
    });

    if (failure) throw new Error(failure);
    if (settled) return settled;
    // No `done` frame (proxy cut the stream): keep whatever arrived, or fail.
    if (streamed.trim().length > 0) {
      return { reply: streamed, coherence: 0, memory_size: 0 };
    }
    throw new Error('The response stream ended before the reply was complete');
  }

  // ─── API key custody (server-side; the browser never stores a key) ───

  async getKeyStatus(): Promise<{ keys: KeyStatus[]; storage: string }> {
    return this.request<{ keys: KeyStatus[]; storage: string }>('/keys');
  }

  /** Empty string means "forget this key"; only the fields sent are touched. */
  async saveKeys(patch: Record<string, string>): Promise<{ updated: string[]; keys: KeyStatus[] }> {
    return this.request<{ updated: string[]; keys: KeyStatus[] }>('/keys', {
      method: 'POST',
      body: JSON.stringify(patch),
    });
  }

  async forgetKeys(): Promise<{ ok: boolean; forgotten: number }> {
    return this.request<{ ok: boolean; forgotten: number }>('/keys', { method: 'DELETE' });
  }

  async perceive(input: string): Promise<PerceiveResponse> {
    return this.request<PerceiveResponse>('/perceive', {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  }

  async think(cycles: number = 5): Promise<ThinkResponse> {
    return this.request<ThinkResponse>('/think', {
      method: 'POST',
      body: JSON.stringify({ cycles }),
    });
  }

  async reflect(): Promise<ReflectResponse> {
    return this.request<ReflectResponse>('/reflect', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async train(text: string): Promise<TrainResponse> {
    return this.request<TrainResponse>('/train', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async getHistory(limit: number = 20): Promise<{ messages: StoredChatMessage[]; persisted: boolean }> {
    return this.request<{ messages: StoredChatMessage[]; persisted: boolean }>(
      `/history?limit=${encodeURIComponent(String(limit))}`
    );
  }

  async clearHistory(): Promise<{ removed: number }> {
    return this.request<{ removed: number }>('/history', { method: 'DELETE' });
  }

  async isOnline(): Promise<boolean> {
    try {
      const state = await this.getState();
      return state.status === 'online';
    } catch {
      return false;
    }
  }

  async getModels(): Promise<any> {
    return this.request<any>('/models');
  }
}

export const agiApi = new AgiApi();
