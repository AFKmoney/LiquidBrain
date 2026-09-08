'use client';

import { create } from 'zustand';
import { agiApi, type KeyStatus } from './api';
import type {
  BrainState,
  MemoryResponse,
  ReflectResponse,
  ChatMessage,
  ThinkResponse,
} from './types';
import { AIModel, ModelCategory, MODEL_REGISTRY, getModelById } from '@/lib/models/registry';

const STORAGE_MODEL = 'liquidbrain_model';

// Default brain state for offline mode
const DEFAULT_BRAIN_STATE: BrainState = {
  status: 'offline',
  model: 'LiquidBrain v2.0 (Offline)',
  embedding_dim: 128,
  brain_nodes: 0,
  language_depth: 8,
  memory_concepts: 0,
  coherence: 0,
  last_insight: null,
};

const DEFAULT_MODEL_ID = 'z-ai/glm-5.1';

/** How many salient concepts are highlighted as "active" after a think cycle. */
const ACTIVE_NODE_HIGHLIGHT = 6;

function readStoredModelId(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL_ID;
  try {
    const stored = localStorage.getItem(STORAGE_MODEL);
    if (stored && getModelById(stored)) return stored;
  } catch {
    /* private mode / storage disabled */
  }
  return DEFAULT_MODEL_ID;
}

/**
 * The Rust engine only reports how many nodes fired, not which ones, so the
 * dashboard approximates "most active" with the most-accessed memory concepts.
 * This keeps the fractal highlight honest instead of permanently empty.
 */
function activeNodesFromMemory(memory: MemoryResponse): number[] {
  return [...memory.concepts]
    .sort(
      (a, b) =>
        b.access_count - a.access_count || b.salience - a.salience
    )
    .slice(0, ACTIVE_NODE_HIGHLIGHT)
    .map((c) => c.id);
}

interface AgiStore {
  // Connection
  isOnline: boolean;
  isConnecting: boolean;

  // Brain state (polled)
  brainState: BrainState;
  lastStateUpdate: number;

  // Memory (polled)
  memory: MemoryResponse;
  lastMemoryUpdate: number;

  // Chat
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  chatError: string | null;
  historyLoaded: boolean;
  persistenceEnabled: boolean;

  // Reflection
  lastReflection: ReflectResponse | null;
  isReflecting: boolean;

  // Think
  lastThinkResult: ThinkResponse | null;
  isThinking: boolean;

  // Training
  isTraining: boolean;
  lastTrainLoss: number | null;

  // Sequencer
  isSequencerRunning: boolean;
  sequencerStep: number;

  // Active node highlight
  mostActiveNodes: number[];

  // ─── Model Selection ───
  selectedModelId: string;
  selectedModel: AIModel | undefined;
  modelCategory: ModelCategory;
  /** Server-side key custody: masks only, never a key. */
  keyStatus: KeyStatus[];
  isSavingKeys: boolean;
  keyMessage: string | null;
  keyStorageNote: string | null;
  showModelSelector: boolean;
  isStreamingReply: boolean;

  // Image generation
  imagePrompt: string;
  generatedImages: Array<{ url?: string; b64_json?: string; prompt: string }>;
  isImageGenerating: boolean;
  imageError: string | null;

  // TTS
  isTTSGenerating: boolean;
  audioData: string | null;

  // Safety
  isSafetyChecking: boolean;
  safetyResult: { is_safe: boolean; violation?: string | null; categories?: Record<string, { is_safe: boolean; confidence: number }> } | null;

  // Vision
  isVisionAnalyzing: boolean;
  visionResult: string | null;
  visionImageUrl: string;

  // Actions
  connect: () => Promise<void>;
  fetchState: () => Promise<void>;
  fetchMemory: () => Promise<void>;
  loadHistory: () => Promise<void>;
  sendChat: (message: string) => Promise<void>;
  clearChat: () => Promise<void>;
  triggerThink: (cycles?: number) => Promise<void>;
  triggerReflect: () => Promise<void>;
  triggerTrain: (text: string) => Promise<void>;
  runSequencerStep: (input: string) => Promise<void>;
  setMostActiveNodes: (nodes: number[]) => void;

  // Model actions
  setSelectedModel: (modelId: string) => void;
  setModelCategory: (category: ModelCategory) => void;
  saveApiKeys: (patch: Record<string, string>) => Promise<boolean>;
  forgetAllKeys: () => Promise<void>;
  refreshKeyStatus: () => Promise<void>;
  toggleModelSelector: () => void;

  // Specialized actions
  generateImage: (prompt: string) => Promise<void>;
  generateTTS: (text: string) => Promise<void>;
  checkSafety: (text: string) => Promise<void>;
  analyzeImage: (imageUrl: string, prompt?: string) => Promise<void>;
  setImagePrompt: (prompt: string) => void;
  setVisionImageUrl: (url: string) => void;
}

export const useAgiStore = create<AgiStore>((set, get) => ({
  isOnline: false,
  isConnecting: true,
  brainState: DEFAULT_BRAIN_STATE,
  lastStateUpdate: 0,
  memory: { concepts: [], total: 0 },
  lastMemoryUpdate: 0,
  chatMessages: [],
  isChatLoading: false,
  chatError: null,
  historyLoaded: false,
  persistenceEnabled: false,
  lastReflection: null,
  isReflecting: false,
  lastThinkResult: null,
  isThinking: false,
  isTraining: false,
  lastTrainLoss: null,
  isSequencerRunning: false,
  sequencerStep: 0,
  mostActiveNodes: [],

  // Model selection defaults (persisted choice wins over the built-in default)
  selectedModelId: DEFAULT_MODEL_ID,
  selectedModel: MODEL_REGISTRY.find((m) => m.id === DEFAULT_MODEL_ID),
  modelCategory: 'chat',
  keyStatus: [],
  isSavingKeys: false,
  keyMessage: null,
  keyStorageNote: null,
  showModelSelector: false,
  isStreamingReply: false,

  // Image generation
  imagePrompt: '',
  generatedImages: [],
  isImageGenerating: false,
  imageError: null,

  // TTS
  isTTSGenerating: false,
  audioData: null,

  // Safety
  isSafetyChecking: false,
  safetyResult: null,

  // Vision
  isVisionAnalyzing: false,
  visionResult: null,
  visionImageUrl: '',

  /** One-shot bootstrap: restore prefs, then probe state / memory / history. */
  connect: async () => {
    void get().refreshKeyStatus();
    const modelId = readStoredModelId();
    if (modelId !== get().selectedModelId) {
      get().setSelectedModel(modelId);
    }
    await Promise.all([get().fetchState(), get().fetchMemory(), get().loadHistory()]);
  },

  fetchState: async () => {
    try {
      const state = await agiApi.getState();
      set({
        brainState: state,
        isOnline: state.status !== 'offline' && state.status !== 'error',
        isConnecting: false,
        lastStateUpdate: Date.now(),
      });
    } catch {
      set({
        isOnline: false,
        isConnecting: false,
        brainState: { ...DEFAULT_BRAIN_STATE, status: 'offline' },
      });
    }
  },

  fetchMemory: async () => {
    try {
      const memory = await agiApi.getMemory();
      set({
        memory,
        lastMemoryUpdate: Date.now(),
      });
    } catch {
      // Backend offline: keep the last known concepts, stay quiet.
    }
  },

  /** Restore the last conversation from SQLite (no-op when DB is unavailable). */
  loadHistory: async () => {
    try {
      const { messages, persisted } = await agiApi.getHistory(40);
      set((s) => ({
        persistenceEnabled: persisted,
        historyLoaded: true,
        chatMessages:
          s.chatMessages.length > 0
            ? s.chatMessages
            : messages.map((m) => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
              })),
      }));
    } catch {
      set({ historyLoaded: true });
    }
  },

  sendChat: async (message: string) => {
    const { selectedModelId } = get();
    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg],
      isChatLoading: true,
      isStreamingReply: false,
      chatError: null,
    }));

    // The assistant turn is created by the first token rather than up front, so a
    // provider that fails instantly leaves no empty bubble behind.
    let streaming = false;
    const pushDelta = (text: string) =>
      set((state) => {
        const messages = [...state.chatMessages];
        if (!streaming) {
          streaming = true;
          messages.push({ role: 'assistant', content: text, timestamp: Date.now() });
          return { chatMessages: messages, isStreamingReply: true };
        }
        const last = messages[messages.length - 1];
        messages[messages.length - 1] = { ...last, content: last.content + text };
        return { chatMessages: messages };
      });

    try {
      const response = await agiApi.chatStream(message, selectedModelId, {
        onDelta: pushDelta,
        onMeta: (meta) =>
          set((state) => ({
            // Coherence and memory move before the reply finishes, so the
            // fractal view reacts while the text is still arriving.
            brainState: {
              ...state.brainState,
              coherence: meta.coherence,
              memory_concepts: meta.memory_size,
            },
          })),
      });

      set((state) => {
        const messages = [...state.chatMessages];
        const final = { role: 'assistant' as const, content: response.reply, timestamp: Date.now() };
        if (streaming) messages[messages.length - 1] = { ...messages[messages.length - 1], ...final };
        else messages.push(final);
        return {
          chatMessages: messages,
          isChatLoading: false,
          isStreamingReply: false,
          brainState: {
            ...state.brainState,
            coherence: response.coherence,
            memory_concepts: response.memory_size,
          },
        };
      });
      // The pipeline already stored a memory trace + ran think cycles.
      get().fetchMemory();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        isChatLoading: false,
        isStreamingReply: false,
        chatError: detail,
        // A partial reply stays visible (it really was streamed); an empty
        // placeholder is dropped so the transcript shows only what happened.
        chatMessages:
          streaming && state.chatMessages[state.chatMessages.length - 1]?.content === ''
            ? state.chatMessages.slice(0, -1)
            : state.chatMessages,
        // Only the transport failing means we are disconnected; a 502
        // from the model provider does not.
        isOnline: /502|Model error|API key/i.test(detail) ? state.isOnline : false,
      }));
    }
  },

  /** Clear the transcript locally and on the server. */
  clearChat: async () => {
    set({ chatMessages: [], chatError: null });
    try {
      await agiApi.clearHistory();
    } catch {
      /* local clear already happened */
    }
  },

  triggerThink: async (cycles = 5) => {
    set({ isThinking: true });
    try {
      const result = await agiApi.think(cycles);
      set({ lastThinkResult: result, isThinking: false });
      get().fetchState();
      // Highlight the concepts that were most live during the cycle.
      void get().fetchMemory().then(() => {
        set({ mostActiveNodes: activeNodesFromMemory(get().memory) });
      });
    } catch (error) {
      set({
        isThinking: false,
        chatError: error instanceof Error ? error.message : 'Think cycle failed',
      });
    }
  },

  triggerReflect: async () => {
    set({ isReflecting: true });
    try {
      const reflection = await agiApi.reflect();
      set({ lastReflection: reflection, isReflecting: false });
      get().fetchState();
    } catch (error) {
      set({
        isReflecting: false,
        chatError: error instanceof Error ? error.message : 'Reflection failed',
      });
    }
  },

  triggerTrain: async (text: string) => {
    set({ isTraining: true });
    try {
      const result = await agiApi.train(text);
      set({ lastTrainLoss: result.loss, isTraining: false });
      get().fetchState();
      get().fetchMemory();
    } catch (error) {
      set({
        isTraining: false,
        chatError: error instanceof Error ? error.message : 'Training failed',
      });
    }
  },

  runSequencerStep: async (input: string) => {
    set({ isSequencerRunning: true });
    try {
      await agiApi.perceive(input);
      const thinkResult = await agiApi.think(3);
      set((s) => ({
        sequencerStep: s.sequencerStep + 1,
        lastThinkResult: thinkResult,
      }));
      get().fetchState();
      await get().fetchMemory();
      set({ mostActiveNodes: activeNodesFromMemory(get().memory) });
    } finally {
      set({ isSequencerRunning: false });
    }
  },

  setMostActiveNodes: (nodes: number[]) => {
    set({ mostActiveNodes: nodes });
  },

  // ─── Model Selection Actions ───

  setSelectedModel: (modelId: string) => {
    const model = getModelById(modelId);
    if (!model) return;
    set({
      selectedModelId: modelId,
      selectedModel: model,
      modelCategory: model.category,
      showModelSelector: false,
    });
    try {
      localStorage.setItem(STORAGE_MODEL, modelId);
    } catch {
      /* storage disabled */
    }
  },

  setModelCategory: (category: ModelCategory) => {
    set({ modelCategory: category });
  },

  /**
   * Hand keys to the server, which keeps them for this session only. Only the
   * fields present in `patch` change, so an untouched input can never wipe a
   * stored key; send '' to forget one.
   */
  saveApiKeys: async (patch: Record<string, string>) => {
    set({ isSavingKeys: true, keyMessage: null });
    try {
      const result = await agiApi.saveKeys(patch);
      set({
        isSavingKeys: false,
        keyStatus: result.keys,
        keyMessage:
          result.updated.length > 0
            ? `${result.updated.length} key field(s) updated on the server`
            : 'Nothing to save',
      });
      return true;
    } catch (error) {
      set({
        isSavingKeys: false,
        keyMessage: error instanceof Error ? error.message : 'Could not store the key',
      });
      return false;
    }
  },

  forgetAllKeys: async () => {
    set({ isSavingKeys: true });
    try {
      await agiApi.forgetKeys();
      set({ isSavingKeys: false, keyStatus: [], keyMessage: 'Keys forgotten for this session' });
    } catch (error) {
      set({
        isSavingKeys: false,
        keyMessage: error instanceof Error ? error.message : 'Could not forget the keys',
      });
    }
  },

  refreshKeyStatus: async () => {
    try {
      const status = await agiApi.getKeyStatus();
      set({ keyStatus: status.keys, keyStorageNote: status.storage });
    } catch {
      // Key custody is optional: an unreachable /keys route must not break the
      // dashboard, it only means the provider list stays empty.
      set({ keyStatus: [] });
    }
  },

  toggleModelSelector: () => {
    set((s) => ({ showModelSelector: !s.showModelSelector }));
  },

  // ─── Specialized Actions ───

  setImagePrompt: (prompt: string) => {
    set({ imagePrompt: prompt });
  },

  setVisionImageUrl: (url: string) => {
    set({ visionImageUrl: url });
  },

  generateImage: async (prompt: string) => {
    const { selectedModelId } = get();
    set({ isImageGenerating: true, imageError: null });
    try {
      const res = await fetch('/api/agi/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: selectedModelId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Image generation failed (${res.status})`);
      set((s) => ({
        generatedImages: [...(data.images || []).map((img: any) => ({ ...img, prompt })), ...s.generatedImages].slice(0, 20),
        isImageGenerating: false,
      }));
    } catch (error: any) {
      set({ isImageGenerating: false, imageError: error?.message ?? 'Image generation failed' });
      console.error('[Image Gen]', error);
    }
  },

  generateTTS: async (text: string) => {
    const { selectedModelId } = get();
    set({ isTTSGenerating: true });
    try {
      const res = await fetch('/api/agi/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model: selectedModelId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `TTS failed (${res.status})`);
      set({ audioData: data.audio, isTTSGenerating: false });
    } catch (error: any) {
      set({ isTTSGenerating: false, chatError: error?.message ?? 'TTS failed' });
      console.error('[TTS]', error);
    }
  },

  checkSafety: async (text: string) => {
    const { selectedModelId } = get();
    set({ isSafetyChecking: true });
    try {
      const res = await fetch('/api/agi/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model: selectedModelId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Safety check failed (${res.status})`);
      set({ safetyResult: data, isSafetyChecking: false });
    } catch (error: any) {
      set({ isSafetyChecking: false, chatError: error?.message ?? 'Safety check failed' });
      console.error('[Safety]', error);
    }
  },

  analyzeImage: async (imageUrl: string, prompt?: string) => {
    const { selectedModelId } = get();
    set({ isVisionAnalyzing: true });
    try {
      const res = await fetch('/api/agi/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: prompt || 'Describe what you see in this image in detail.',
          model: selectedModelId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Vision analysis failed (${res.status})`);
      set({ visionResult: data.analysis, isVisionAnalyzing: false });
    } catch (error: any) {
      set({ isVisionAnalyzing: false, chatError: error?.message ?? 'Vision analysis failed' });
      console.error('[Vision]', error);
    }
  },
}));
