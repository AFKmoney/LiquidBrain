// ─── Shared AGI types ───────────────────────────────────────────
// Types mirror the FractalBrain (Rust) backend contract and are used
// by both the server routes and the client, so they live in a module
// that is free of 'use client' / runtime code.

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

/** Persisted chat turn (SQLite via Prisma). */
export interface StoredChatMessage extends ChatMessage {
  id: number;
  model: string | null;
  coherence: number | null;
}
