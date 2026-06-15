// ─── AI Provider Implementations ────────────────────────────────
// NVIDIA NIM, Z-AI SDK, MiniMax direct API

import { AIModel, ProviderId, PROVIDERS } from './registry';

// ─── Types ───────────────────────────────────────────────────────

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | MessageContent[];
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ImageGenResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

export interface TTSResponse {
  audio: string; // base64 encoded audio
  audio_type?: string;
}

export interface SafetyResponse {
  is_safe: boolean;
  categories?: Record<string, { is_safe: boolean; confidence: number }>;
  violation?: string;
}

// ─── NVIDIA NIM Provider ─────────────────────────────────────────

async function nvidiaChatCompletion(
  request: ChatCompletionRequest,
  apiKey: string
): Promise<ChatCompletionResponse> {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1024,
      top_p: request.top_p ?? 0.9,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA API Error (${response.status}): ${error}`);
  }

  return response.json();
}

async function nvidiaImageGeneration(
  model: string,
  prompt: string,
  apiKey: string
): Promise<ImageGenResponse> {
  // NVIDIA NIM image generation endpoint varies by model
  const modelPath = model.replace(/\//g, '/');
  const response = await fetch(
    `https://ai.api.nvidia.com/v1/genai/${modelPath}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        num_images: 1,
        aspect_ratio: '1:1',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA Image Gen Error (${response.status}): ${error}`);
  }

  return response.json();
}

async function nvidiaTTS(
  model: string,
  text: string,
  apiKey: string
): Promise<TTSResponse> {
  const modelPath = model.replace(/\//g, '/');
  const response = await fetch(
    `https://ai.api.nvidia.com/v1/tts/${modelPath}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text,
        voice: 'default',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA TTS Error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return {
    audio: data.audio || data.data?.[0]?.audio || '',
    audio_type: data.audio_type || 'wav',
  };
}

async function nvidiaSafetyCheck(
  text: string,
  model: string,
  apiKey: string
): Promise<SafetyResponse> {
  const response = await nvidiaChatCompletion(
    {
      model,
      messages: [
        {
          role: 'user',
          content: `Analyze the following text for safety. Is this content safe? Respond with a JSON object containing "is_safe" (boolean), "violation" (string or null), and "categories" (object with category names as keys, each containing "is_safe" boolean and "confidence" number between 0-1).\n\nText to analyze:\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    },
    apiKey
  );

  try {
    const content = response.choices[0]?.message?.content || '';
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { is_safe: true, violation: null };
  } catch {
    return { is_safe: true, violation: null };
  }
}

// ─── Z-AI Provider ───────────────────────────────────────────────

async function zaiChatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  // Use the z-ai-web-dev-sdk (must be called from server-side)
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();

  const completion = await zai.chat.completions.create({
    messages: request.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : m.content.map(c => c.text || '').join(''),
    })),
    temperature: request.temperature ?? 0.8,
    max_tokens: request.max_tokens ?? 512,
  });

  return {
    id: completion.id || 'zai-' + Date.now(),
    choices: (completion.choices || []).map((choice: any) => ({
      message: {
        role: choice.message?.role || 'assistant',
        content: choice.message?.content || '',
      },
      finish_reason: choice.finish_reason || 'stop',
    })),
    usage: completion.usage,
  };
}

// ─── MiniMax Direct Provider ─────────────────────────────────────

async function minimaxChatCompletion(
  request: ChatCompletionRequest,
  apiKey: string
): Promise<ChatCompletionResponse> {
  const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MiniMax API Error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return {
    id: data.id || 'mm-' + Date.now(),
    choices: (data.choices || []).map((choice: any) => ({
      message: {
        role: choice.message?.role || 'assistant',
        content: choice.message?.content || '',
      },
      finish_reason: choice.finish_reason || 'stop',
    })),
  };
}

// ─── Unified Provider Interface ──────────────────────────────────

export async function chatCompletion(
  model: AIModel,
  request: ChatCompletionRequest,
  apiKeys: Record<string, string>
): Promise<ChatCompletionResponse> {
  request.model = model.id;

  switch (model.provider) {
    case 'nvidia': {
      const apiKey = apiKeys.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || '';
      if (!apiKey) throw new Error('NVIDIA API key required. Get one at build.nvidia.com');
      return nvidiaChatCompletion(request, apiKey);
    }
    case 'z-ai': {
      return zaiChatCompletion(request);
    }
    case 'minimax': {
      const apiKey = apiKeys.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY || '';
      if (!apiKey) throw new Error('MiniMax API key required');
      return minimaxChatCompletion(request, apiKey);
    }
    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

export async function imageGeneration(
  model: AIModel,
  prompt: string,
  apiKeys: Record<string, string>
): Promise<ImageGenResponse> {
  const apiKey = apiKeys.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || '';
  if (!apiKey) throw new Error('NVIDIA API key required for image generation');

  return nvidiaImageGeneration(model.id, prompt, apiKey);
}

export async function textToSpeech(
  model: AIModel,
  text: string,
  apiKeys: Record<string, string>
): Promise<TTSResponse> {
  const apiKey = apiKeys.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || '';
  if (!apiKey) throw new Error('NVIDIA API key required for TTS');

  return nvidiaTTS(model.id, text, apiKey);
}

export async function safetyCheck(
  model: AIModel,
  text: string,
  apiKeys: Record<string, string>
): Promise<SafetyResponse> {
  const apiKey = apiKeys.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || '';
  if (!apiKey) throw new Error('NVIDIA API key required for safety check');

  return nvidiaSafetyCheck(text, model.id, apiKey);
}
