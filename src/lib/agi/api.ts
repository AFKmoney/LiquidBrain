'use client';

// ─── API Service (client side) ──────────────────────────────────
// Types live in ./types so server routes can share them without
// importing a 'use client' module.

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

  async chat(message: string, model?: string, apiKeys?: Record<string, string>): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, model, apiKeys }),
    });
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
