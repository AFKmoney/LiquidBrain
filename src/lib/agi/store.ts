'use client';

import { create } from 'zustand';
import {
  BrainState,
  MemoryResponse,
  ReflectResponse,
  ChatMessage,
  ThinkResponse,
  agiApi,
} from './api';
import { AIModel, ModelCategory, MODEL_REGISTRY, getModelById, getCategoryLabel, CATEGORIES } from '@/lib/models/registry';

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

interface AgiStore {
  // Connection
  isOnline: boolean;
  isConnecting: boolean;

  // Brain state (polled every 3s)
  brainState: BrainState;
  lastStateUpdate: number;

  // Memory (polled every 5s)
  memory: MemoryResponse;
  lastMemoryUpdate: number;

  // Chat
  chatMessages: ChatMessage[];
  isChatLoading: boolean;

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
  apiKeys: Record<string, string>;
  showModelSelector: boolean;
  showSettings: boolean;

  // Image generation
  imagePrompt: string;
  generatedImages: Array<{ url?: string; b64_json?: string; prompt: string }>;
  isImageGenerating: boolean;

  // TTS
  isTTSGenerating: boolean;
  audioData: string | null;

  // Safety
  isSafetyChecking: boolean;
  safetyResult: { is_safe: boolean; violation?: string; categories?: Record<string, { is_safe: boolean; confidence: number }> } | null;

  // Vision
  isVisionAnalyzing: boolean;
  visionResult: string | null;
  visionImageUrl: string;

  // Actions
  fetchState: () => Promise<void>;
  fetchMemory: () => Promise<void>;
  sendChat: (message: string) => Promise<void>;
  triggerThink: (cycles?: number) => Promise<void>;
  triggerReflect: () => Promise<void>;
  triggerTrain: (text: string) => Promise<void>;
  runSequencerStep: (input: string) => Promise<void>;
  setMostActiveNodes: (nodes: number[]) => void;

  // Model actions
  setSelectedModel: (modelId: string) => void;
  setModelCategory: (category: ModelCategory) => void;
  setApiKey: (keyName: string, value: string) => void;
  toggleModelSelector: () => void;
  toggleSettings: () => void;

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
  lastReflection: null,
  isReflecting: false,
  lastThinkResult: null,
  isThinking: false,
  isTraining: false,
  lastTrainLoss: null,
  isSequencerRunning: false,
  sequencerStep: 0,
  mostActiveNodes: [],

  // Model selection defaults
  selectedModelId: 'z-ai/glm-5.1',
  selectedModel: MODEL_REGISTRY.find(m => m.id === 'z-ai/glm-5.1'),
  modelCategory: 'chat',
  apiKeys: {},
  showModelSelector: false,
  showSettings: false,

  // Image generation
  imagePrompt: '',
  generatedImages: [],
  isImageGenerating: false,

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

  fetchState: async () => {
    try {
      const state = await agiApi.getState();
      set({
        brainState: state,
        isOnline: true,
        isConnecting: false,
        lastStateUpdate: Date.now(),
      });
    } catch {
      const wasOnline = get().isOnline;
      set({
        isOnline: false,
        isConnecting: false,
        brainState: { ...DEFAULT_BRAIN_STATE, status: 'offline' },
      });
      if (wasOnline) {
        console.warn('[AGI] Backend disconnected');
      }
    }
  },

  fetchMemory: async () => {
    try {
      const memory = await agiApi.getMemory();
      set({
        memory,
        lastMemoryUpdate: Date.now(),
        isOnline: true,
      });
    } catch {
      // Silently fail
    }
  },

  sendChat: async (message: string) => {
    const { selectedModelId, apiKeys } = get();
    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    set((s) => ({
      chatMessages: [...s.chatMessages, userMsg],
      isChatLoading: true,
    }));

    try {
      const response = await agiApi.chat(message, selectedModelId, apiKeys);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
      };
      set((s) => ({
        chatMessages: [...s.chatMessages, assistantMsg],
        isChatLoading: false,
        brainState: {
          ...s.brainState,
          coherence: response.coherence,
          memory_concepts: response.memory_size,
        },
      }));
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: '⚠️ Connection lost. Attempting to reconnect...',
        timestamp: Date.now(),
      };
      set((s) => ({
        chatMessages: [...s.chatMessages, errorMsg],
        isChatLoading: false,
        isOnline: false,
      }));
    }
  },

  triggerThink: async (cycles = 5) => {
    set({ isThinking: true });
    try {
      const result = await agiApi.think(cycles);
      set({ lastThinkResult: result, isThinking: false });
      get().fetchState();
    } catch {
      set({ isThinking: false });
    }
  },

  triggerReflect: async () => {
    set({ isReflecting: true });
    try {
      const reflection = await agiApi.reflect();
      set({ lastReflection: reflection, isReflecting: false });
      get().fetchState();
    } catch {
      set({ isReflecting: false });
    }
  },

  triggerTrain: async (text: string) => {
    set({ isTraining: true });
    try {
      const result = await agiApi.train(text);
      set({ lastTrainLoss: result.loss, isTraining: false });
      get().fetchState();
      get().fetchMemory();
    } catch {
      set({ isTraining: false });
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
      get().fetchMemory();
    } catch {
      // Continue even if one step fails
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
    set({
      selectedModelId: modelId,
      selectedModel: model,
      modelCategory: model?.category || 'chat',
      showModelSelector: false,
    });
  },

  setModelCategory: (category: ModelCategory) => {
    set({ modelCategory: category });
  },

  setApiKey: (keyName: string, value: string) => {
    set((s) => ({
      apiKeys: { ...s.apiKeys, [keyName]: value },
    }));
    // Also persist to localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('liquidbrain_api_keys') || '{}');
      stored[keyName] = value;
      localStorage.setItem('liquidbrain_api_keys', JSON.stringify(stored));
    } catch {}
  },

  toggleModelSelector: () => {
    set((s) => ({ showModelSelector: !s.showModelSelector }));
  },

  toggleSettings: () => {
    set((s) => ({ showSettings: !s.showSettings }));
  },

  // ─── Specialized Actions ───

  setImagePrompt: (prompt: string) => {
    set({ imagePrompt: prompt });
  },

  setVisionImageUrl: (url: string) => {
    set({ visionImageUrl: url });
  },

  generateImage: async (prompt: string) => {
    const { selectedModelId, apiKeys } = get();
    set({ isImageGenerating: true });
    try {
      const res = await fetch('/api/agi/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: selectedModelId,
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      set((s) => ({
        generatedImages: [...(data.images || []).map((img: any) => ({ ...img, prompt })), ...s.generatedImages].slice(0, 20),
        isImageGenerating: false,
      }));
    } catch (error: any) {
      set({ isImageGenerating: false });
      console.error('[Image Gen]', error);
    }
  },

  generateTTS: async (text: string) => {
    const { selectedModelId, apiKeys } = get();
    set({ isTTSGenerating: true });
    try {
      const res = await fetch('/api/agi/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model: selectedModelId,
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      set({ audioData: data.audio, isTTSGenerating: false });
    } catch (error: any) {
      set({ isTTSGenerating: false });
      console.error('[TTS]', error);
    }
  },

  checkSafety: async (text: string) => {
    const { selectedModelId, apiKeys } = get();
    set({ isSafetyChecking: true });
    try {
      const res = await fetch('/api/agi/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model: selectedModelId,
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      set({ safetyResult: data, isSafetyChecking: false });
    } catch (error: any) {
      set({ isSafetyChecking: false });
      console.error('[Safety]', error);
    }
  },

  analyzeImage: async (imageUrl: string, prompt?: string) => {
    const { selectedModelId, apiKeys } = get();
    set({ isVisionAnalyzing: true });
    try {
      const res = await fetch('/api/agi/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: prompt || 'Describe what you see in this image in detail.',
          model: selectedModelId,
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      set({ visionResult: data.analysis, isVisionAnalyzing: false });
    } catch (error: any) {
      set({ isVisionAnalyzing: false });
      console.error('[Vision]', error);
    }
  },
}));

// ─── Load persisted API keys on startup ───
if (typeof window !== 'undefined') {
  try {
    const stored = JSON.parse(localStorage.getItem('liquidbrain_api_keys') || '{}');
    if (Object.keys(stored).length > 0) {
      useAgiStore.setState({ apiKeys: stored });
    }
  } catch {}
}
