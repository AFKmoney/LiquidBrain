// ─── Model Types & Registry ─────────────────────────────────────
// Defines all available AI models, their capabilities, and providers

export type ModelCapability =
  | 'chat'          // Text conversation
  | 'reasoning'     // Advanced reasoning
  | 'coding'        // Code generation
  | 'vision'        // Image understanding
  | 'image-gen'     // Image generation
  | 'video-gen'     // Video generation
  | 'tts'           // Text-to-speech
  | 'safety'        // Content safety/moderation
  | 'embedding'     // Text embeddings
  | 'ocr'           // Optical character recognition
  | 'multimodal'    // Multi-modal input
  | 'agentic'       // Agent/tool-calling
  | 'translation';  // Language translation

export type ModelCategory =
  | 'chat'
  | 'vision'
  | 'image-gen'
  | 'video-gen'
  | 'tts'
  | 'safety'
  | 'specialized';

export interface AIModel {
  id: string;           // e.g. "nvidia/nemotron-3-ultra-550b-a55b"
  name: string;         // Display name
  provider: ProviderId;
  category: ModelCategory;
  capabilities: ModelCapability[];
  description: string;
  contextWindow: number;  // Max context tokens
  isFree: boolean;
  requiresApiKey: boolean;
  apiKeyName: string;     // env var name, e.g. "NVIDIA_API_KEY"
  params?: number;        // Model parameter count description
  tags: string[];
}

export type ProviderId = 'nvidia' | 'z-ai' | 'minimax';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  icon: string;         // Emoji or icon identifier
  color: string;        // Brand color
}

// ─── Provider Definitions ────────────────────────────────────────

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnvVar: 'NVIDIA_API_KEY',
    icon: '🟢',
    color: '#76b900',
  },
  'z-ai': {
    id: 'z-ai',
    name: 'Z.ai',
    baseUrl: '/api/agi/chat',  // Internal route
    apiKeyEnvVar: 'ZAI_API_KEY',
    icon: '🔵',
    color: '#00aaff',
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax AI',
    baseUrl: 'https://api.minimax.chat/v1',
    apiKeyEnvVar: 'MINIMAX_API_KEY',
    icon: '🟣',
    color: '#8b5cf6',
  },
};

// ─── Model Registry ──────────────────────────────────────────────

export const MODEL_REGISTRY: AIModel[] = [
  // ═══════════ Z-AI (Default, always available) ═══════════
  {
    id: 'z-ai/glm-5.1',
    name: 'GLM-5.1',
    provider: 'z-ai',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'agentic'],
    description: 'Flagship LLM for agentic workflows, coding, and long-horizon reasoning',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: false,
    apiKeyName: 'ZAI_API_KEY',
    params: undefined,
    tags: ['Agentic AI', 'Default'],
  },

  // ═══════════ NVIDIA NIM — Chat Models ═══════════
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    name: 'Nemotron Ultra 550B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'agentic'],
    description: 'Hybrid Mamba-Transformer MoE with 1M context. Excels at agentic reasoning, coding, planning, tool calling.',
    contextWindow: 1000000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '550B (55B active)',
    tags: ['MoE', 'Agent', '1M ctx'],
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron Super 120B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'agentic'],
    description: 'Efficient hybrid Mamba-Transformer MoE with 1M context for reasoning, coding, and tool calling.',
    contextWindow: 1000000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '120B (12B active)',
    tags: ['MoE', 'Agent'],
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    name: 'Nemotron Nano 30B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding'],
    description: 'Efficient MoE model with 1M context for coding, reasoning, and instruction following.',
    contextWindow: 1000000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '30B (3B active)',
    tags: ['MoE', 'Fast'],
  },
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    name: 'Llama Nemotron Super 49B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding'],
    description: 'High efficiency with leading accuracy for reasoning, tool calling, chat, and instruction following.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '49B',
    tags: ['Reasoning', 'Tools'],
  },

  // ═══════════ DeepSeek (via NVIDIA NIM) ═══════════
  {
    id: 'deepseek-ai/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'agentic'],
    description: '284B MoE model with 1M-token context optimized for fast coding and agents.',
    contextWindow: 1000000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '284B MoE',
    tags: ['MoE', 'Coding', '1M ctx'],
  },
  {
    id: 'deepseek-ai/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'agentic'],
    description: '1M-token context with efficient MoE architecture for complex coding tasks.',
    contextWindow: 1000000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: 'MoE',
    tags: ['MoE', 'Coding', '1M ctx'],
  },

  // ═══════════ MiniMax (via NVIDIA NIM) ═══════════
  {
    id: 'minimaxai/minimax-m3',
    name: 'MiniMax M3',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'vision', 'agentic'],
    description: 'Multimodal MoE vision-language model with strong reasoning, coding, and tool-calling capabilities.',
    contextWindow: 136000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: 'MoE',
    tags: ['Multimodal', 'MoE', 'Vision'],
  },
  {
    id: 'minimaxai/minimax-m2.7',
    name: 'MiniMax M2.7',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding'],
    description: '230B-parameter text model excelling in coding, reasoning, and office tasks.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '230B',
    tags: ['Reasoning', 'Coding'],
  },

  // ═══════════ Open Models via NVIDIA NIM ═══════════
  {
    id: 'moonshotai/kimi-k2.6',
    name: 'Kimi K2.6',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'vision', 'agentic'],
    description: '1T multimodal MoE for long-horizon coding, agentic tool use, and image/video understanding.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '1T MoE',
    tags: ['Multimodal', 'MoE', 'Agent'],
  },
  {
    id: 'stepfun-ai/step-3.7-flash',
    name: 'Step 3.7 Flash',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'agentic'],
    description: 'Sparse MoE multimodal reasoning model for enterprise, agentic and coding tasks.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: 'MoE',
    tags: ['Enterprise', 'MoE'],
  },
  {
    id: 'qwen/qwen3.5-397b-a17b',
    name: 'Qwen 3.5 397B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'vision', 'agentic'],
    description: '400B MoE with advanced vision, chat, RAG, and agentic capabilities.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '397B (17B active)',
    tags: ['MoE', 'VLM', 'Agent'],
  },
  {
    id: 'qwen/qwen3.5-122b-a10b',
    name: 'Qwen 3.5 122B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding', 'agentic'],
    description: '122B MoE (10B active) for coding, reasoning, multimodal chat. Agent-ready.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '122B (10B active)',
    tags: ['MoE', 'Agent'],
  },
  {
    id: 'mistralai/mistral-medium-3.5-128b',
    name: 'Mistral Medium 3.5',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding'],
    description: 'High performing model for text generation, coding and agentic use cases.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '128B',
    tags: ['Coding', 'Agent'],
  },
  {
    id: 'meta/llama-4-maverick-17b-128e-instruct',
    name: 'Llama 4 Maverick',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'multimodal'],
    description: 'Multimodal, multilingual 128 MoE model with 17B parameters.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '17B x 128E MoE',
    tags: ['Multimodal', 'MoE'],
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning'],
    description: 'MoE reasoning LLM designed to fit within 80GB GPU.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '120B MoE',
    tags: ['Reasoning', 'Open'],
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'reasoning', 'coding'],
    description: 'Advanced LLM for reasoning, math, general knowledge, and function calling.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '70B',
    tags: ['General', 'Tools'],
  },
  {
    id: 'google/gemma-3n-e4b-it',
    name: 'Gemma 3n E4B',
    provider: 'nvidia',
    category: 'chat',
    capabilities: ['chat', 'multimodal'],
    description: 'Edge computing AI accepting text, audio and image input.',
    contextWindow: 32000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '4B',
    tags: ['Edge', 'Multimodal'],
  },

  // ═══════════ Vision Models ═══════════
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    name: 'Nemotron Omni 30B',
    provider: 'nvidia',
    category: 'vision',
    capabilities: ['vision', 'chat', 'reasoning', 'multimodal'],
    description: 'Omni-modal reasoning model that understands images, video, speech, and text.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '30B (3B active)',
    tags: ['Omni-modal', 'Video', 'Speech'],
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl',
    name: 'Nemotron Nano 12B VL',
    provider: 'nvidia',
    category: 'vision',
    capabilities: ['vision', 'chat', 'multimodal'],
    description: 'Multi-image and video understanding with visual Q&A and summarization.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '12B',
    tags: ['VLM', 'Video'],
  },
  {
    id: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
    name: 'Nemotron Nano VL 8B',
    provider: 'nvidia',
    category: 'vision',
    capabilities: ['vision', 'chat', 'multimodal'],
    description: 'Multi-modal vision-language model that understands text and images.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '8B',
    tags: ['VLM', 'Lightweight'],
  },
  {
    id: 'meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 11B Vision',
    provider: 'nvidia',
    category: 'vision',
    capabilities: ['vision', 'chat'],
    description: 'Cutting-edge vision-language model for high-quality reasoning from images.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '11B',
    tags: ['VLM'],
  },
  {
    id: 'meta/llama-3.2-90b-vision-instruct',
    name: 'Llama 3.2 90B Vision',
    provider: 'nvidia',
    category: 'vision',
    capabilities: ['vision', 'chat', 'reasoning'],
    description: 'Cutting-edge vision-language model with superior reasoning from images.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '90B',
    tags: ['VLM', 'High-capacity'],
  },
  {
    id: 'nvidia/cosmos3-nano-reasoner',
    name: 'Cosmos3 Nano Reasoner',
    provider: 'nvidia',
    category: 'vision',
    capabilities: ['vision', 'reasoning'],
    description: 'Excels in understanding the physical world using structured reasoning on videos or images.',
    contextWindow: 64000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: 'Nano',
    tags: ['Physical World', 'Video'],
  },

  // ═══════════ Image Generation ═══════════
  {
    id: 'black-forest-labs/flux.1-schnell',
    name: 'FLUX.1 Schnell',
    provider: 'nvidia',
    category: 'image-gen',
    capabilities: ['image-gen'],
    description: 'Distilled image generation model producing high quality images at fast speeds.',
    contextWindow: 0,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '12B',
    tags: ['Fast', 'Quality'],
  },
  {
    id: 'stabilityai/stable-diffusion-3-5-large',
    name: 'Stable Diffusion 3.5',
    provider: 'nvidia',
    category: 'image-gen',
    capabilities: ['image-gen'],
    description: 'Popular text-to-image generation model with excellent quality.',
    contextWindow: 0,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '8B',
    tags: ['Quality', 'Popular'],
  },

  // ═══════════ Video Generation ═══════════
  {
    id: 'nvidia/cosmos3-nano',
    name: 'Cosmos3 Nano',
    provider: 'nvidia',
    category: 'video-gen',
    capabilities: ['video-gen'],
    description: 'Generates physics-aware videos from text prompts or images for physical AI development.',
    contextWindow: 0,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: 'Nano',
    tags: ['Physics-aware', 'Physical AI'],
  },

  // ═══════════ TTS ═══════════
  {
    id: 'nvidia/magpie-tts-zeroshot',
    name: 'Magpie TTS Zero-shot',
    provider: 'nvidia',
    category: 'tts',
    capabilities: ['tts'],
    description: 'Expressive and engaging text-to-speech generated from a short audio sample.',
    contextWindow: 0,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: undefined,
    tags: ['Zero-shot', 'Expressive'],
  },
  {
    id: 'resemble-ai/chatterbox-multilingual-tts',
    name: 'Chatterbox Multilingual TTS',
    provider: 'nvidia',
    category: 'tts',
    capabilities: ['tts'],
    description: 'Natural and expressive voices in 23 languages for voice agents and brand ambassadors.',
    contextWindow: 0,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: undefined,
    tags: ['Multilingual', '23 languages'],
  },

  // ═══════════ Safety ═══════════
  {
    id: 'nvidia/nemotron-3.5-content-safety',
    name: 'Nemotron Content Safety 3.5',
    provider: 'nvidia',
    category: 'safety',
    capabilities: ['safety'],
    description: 'Multilingual, multimodal model for detecting unsafe and toxic content.',
    contextWindow: 32000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: undefined,
    tags: ['Multilingual', 'Multimodal'],
  },
  {
    id: 'meta/llama-guard-4-12b',
    name: 'Llama Guard 4',
    provider: 'nvidia',
    category: 'safety',
    capabilities: ['safety'],
    description: 'Multi-modal model to classify safety for input prompts as well as output responses.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '12B',
    tags: ['Multimodal', 'Guard'],
  },

  // ═══════════ Specialized ═══════════
  {
    id: 'nvidia/riva-translate-4b-instruct-v1_1',
    name: 'Riva Translate',
    provider: 'nvidia',
    category: 'specialized',
    capabilities: ['translation'],
    description: 'Translation model in 12 languages with few-shot example prompts capability.',
    contextWindow: 32000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '4B',
    tags: ['12 languages', 'Translation'],
  },
  {
    id: 'microsoft/phi-4-multimodal-instruct',
    name: 'Phi-4 Multimodal',
    provider: 'nvidia',
    category: 'vision',
    capabilities: ['vision', 'chat', 'multimodal'],
    description: 'Cutting-edge open multimodal model exceling in reasoning from image and audio inputs.',
    contextWindow: 128000,
    isFree: true,
    requiresApiKey: true,
    apiKeyName: 'NVIDIA_API_KEY',
    params: '5.6B',
    tags: ['Multimodal', 'Audio', 'Lightweight'],
  },
];

// ─── Helper Functions ────────────────────────────────────────────

export function getModelsByCategory(category: ModelCategory): AIModel[] {
  return MODEL_REGISTRY.filter((m) => m.category === category);
}

export function getModelById(id: string): AIModel | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function getModelsByProvider(provider: ProviderId): AIModel[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider);
}

export function getCategoryLabel(category: ModelCategory): string {
  const labels: Record<ModelCategory, string> = {
    chat: '💬 Chat & Reasoning',
    vision: '👁️ Vision & Multimodal',
    'image-gen': '🎨 Image Generation',
    'video-gen': '🎬 Video Generation',
    tts: '🔊 Text-to-Speech',
    safety: '🛡️ Content Safety',
    specialized: '⚙️ Specialized',
  };
  return labels[category];
}

export const CATEGORIES: ModelCategory[] = [
  'chat',
  'vision',
  'image-gen',
  'video-gen',
  'tts',
  'safety',
  'specialized',
];
