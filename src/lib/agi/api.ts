'use client';

// ─── API Types matching the Rust backend ─────────────────────────

export interface BrainState {
  status: string;
  model: string;
  embedding_dim: number;
  brain_nodes: number;
  language_depth: number;
  memory_concepts: number;
  coherence: number;
  last_insight: string | null;
}

export interface ConceptSummary {
  id: number;
  position_re: number;
  position_im: number;
  label: string | null;
  salience: number;
  access_count: number;
}

export interface MemoryResponse {
  concepts: ConceptSummary[];
  total: number;
}

export interface ChatResponse {
  reply: string;
  coherence: number;
  memory_size: number;
  model?: string;
}

export interface PerceiveResponse {
  embedding_dim: number;
  perceived: boolean;
  memory_stored: boolean;
}

export interface ThinkResponse {
  cycles_run: number;
  active_nodes: number;
}

export interface ReflectResponse {
  coherence: number;
  avg_surprise: number;
  avg_confidence: number;
  should_rewire: boolean;
  insight: string | null;
  memory_utilization: number;
}

export interface TrainResponse {
  loss: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ─── API Service ────────────────────────────────────────────────

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
      throw new Error(`API Error: ${res.status} ${res.statusText}`);
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
