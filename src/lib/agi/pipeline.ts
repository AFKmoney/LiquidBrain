import { callBackend } from "./backend";
import type { MemoryResponse, BrainState } from "./types";

// ─── Fractal cognition pipeline ─────────────────────────────────
// PERCEIVE → RECALL → STATE, run before the LLM generates an answer.
// The FractalBrain engine is optional, so each step is best-effort and
// the caller always gets a usable context object.

export interface CognitiveContext {
  /** Extra system-prompt fragment describing live fractal memory/state. */
  memoryContext: string;
  coherence: number;
  memoryConcepts: number;
  /** Whether the Rust backend answered at all. */
  backendReached: boolean;
}

const DEFAULT_COHERENCE = 0.5;

export function formatConcepts(
  concepts: MemoryResponse["concepts"],
  topN = 8
): string {
  return [...concepts]
    .sort((a, b) => b.salience - a.salience)
    .slice(0, topN)
    .map(
      (c) =>
        c.label ||
        `concept@(${c.position_re?.toFixed(2) ?? "?"},${c.position_im?.toFixed(2) ?? "?"})`
    )
    .join(", ");
}

export async function gatherCognitiveContext(
  input: string
): Promise<CognitiveContext> {
  const perceive = await callBackend("/api/perceive", {
    method: "POST",
    body: { input },
    timeoutMs: 5000,
  });

  if (!perceive.ok) {
    return {
      memoryContext: "",
      coherence: DEFAULT_COHERENCE,
      memoryConcepts: 0,
      backendReached: false,
    };
  }

  let memoryContext = "";
  let memoryConcepts = 0;
  let coherence = DEFAULT_COHERENCE;

  const memory = await callBackend<MemoryResponse>("/api/memory");
  if (memory.ok) {
    const concepts = memory.data.concepts ?? [];
    memoryConcepts = memory.data.total ?? concepts.length;
    if (concepts.length > 0) {
      memoryContext += `\n\n[Fractal Memory — concepts: ${formatConcepts(concepts)}]`;
    }
  }

  const state = await callBackend<BrainState>("/api/state");
  if (state.ok) {
    coherence = state.data.coherence || DEFAULT_COHERENCE;
    if (state.data.last_insight) {
      memoryContext += `\n[Insight: ${state.data.last_insight}]`;
    }
  }

  return { memoryContext, coherence, memoryConcepts, backendReached: true };
}
