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
  violation?: string | null;
}

// ─── NVIDIA NIM Provider ─────────────────────────────────────────

/** OpenAI-compatible chat endpoints, shared by the blocking and streaming paths. */
const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MINIMAX_CHAT_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

async function nvidiaChatCompletion(
  request: ChatCompletionRequest,
  apiKey: string
): Promise<ChatCompletionResponse> {
  const response = await fetch(NVIDIA_CHAT_URL, {
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

/**
 * The bundled SDK only reads credentials from a `.z-ai-config` file on disk,
 * which is unavailable in read-only / serverless deployments. When the env
 * vars are set we talk to the same OpenAI-compatible endpoint directly, and
 * otherwise fall back to the SDK.
 */
function zaiEnvConfig(apiKeyOverride = ''): { baseUrl: string; apiKey: string } | null {
  const baseUrl = (process.env.ZAI_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = apiKeyOverride || process.env.ZAI_API_KEY || '';
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

function flattenContent(content: string | MessageContent[]): string {
  return typeof content === 'string'
    ? content
    : content.map((c) => c.text || '').join('');
}

async function zaiChatCompletion(
  request: ChatCompletionRequest,
  apiKey = ''
): Promise<ChatCompletionResponse> {
  const messages = request.messages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: flattenContent(m.content),
  }));
  const body = {
    model: request.model,
    messages,
    temperature: request.temperature ?? 0.8,
    max_tokens: request.max_tokens ?? 512,
    thinking: { type: 'disabled' as const },
  };

  const env = zaiEnvConfig(apiKey);
  if (env) {
    const response = await fetch(`${env.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.apiKey}`,
        'X-Z-AI-From': 'Z',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Z-AI API Error (${response.status}): ${detail.slice(0, 400)}`);
    }
    return normalise(await response.json(), 'zai');
  }

  // Use the z-ai-web-dev-sdk (must be called from server-side)
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch {
    throw new Error(
      'Z-AI is not configured: create .z-ai-config with { "baseUrl", "apiKey" } ' +
        'in the project root, or set ZAI_API_KEY + ZAI_BASE_URL, or pick another provider.'
    );
  }

  const completion = await zai.chat.completions.create(body);

  return normalise(completion, 'zai');
}

/** Tolerate the small shape differences between providers. */
function normalise(data: unknown, prefix = 'llm'): ChatCompletionResponse {
  const payload = (data ?? {}) as {
    id?: string;
    choices?: Array<{
      message?: { role?: string; content?: string | null };
      finish_reason?: string;
    }>;
    usage?: ChatCompletionResponse['usage'];
  };

  return {
    id: payload.id || `${prefix}-${Date.now()}`,
    choices: (payload.choices || []).map((choice) => ({
      message: {
        role: choice.message?.role || 'assistant',
        content: choice.message?.content || '',
      },
      finish_reason: choice.finish_reason || 'stop',
    })),
    usage: payload.usage,
  };
}

// ─── MiniMax Direct Provider ─────────────────────────────────────

async function minimaxChatCompletion(
  request: ChatCompletionRequest,
  apiKey: string
): Promise<ChatCompletionResponse> {
  const response = await fetch(MINIMAX_CHAT_URL, {
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
  return normalise(data, 'mm');
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
      const apiKey = resolveApiKey(model, apiKeys);
      if (!apiKey) throw new Error('NVIDIA API key required. Get one at build.nvidia.com');
      return nvidiaChatCompletion(request, apiKey);
    }
    case 'z-ai': {
      // Z-AI works without a key via its SDK, so no require-check here.
      return zaiChatCompletion(request, resolveApiKey(model, apiKeys));
    }
    case 'minimax': {
      const apiKey = resolveApiKey(model, apiKeys);
      if (!apiKey) throw new Error('MiniMax API key required');
      return minimaxChatCompletion(request, apiKey);
    }
    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

export interface StreamError extends Error {
  /** True when the provider refused the stream itself (not a model error). */
  unsupported?: boolean;
}

/**
 * OpenAI-compatible SSE reader: yields each `choices[0].delta.content` as it
 * arrives and stops at `data: [DONE]`. Providers are free to interleave blank
 * heartbeats (`: ping`) and comments, which are skipped.
 */
async function* readSseDeltas(body: ReadableStream<Uint8Array>, label: string): AsyncGenerator<string, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return;
          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string | null } }>;
              error?: { message?: string };
            };
            if (chunk.error?.message) throw new Error(`${label} stream error: ${chunk.error.message.slice(0, 300)}`);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) yield delta;
          } catch (error) {
            // A malformed keep-alive line is noise; a thrown provider error is not.
            if (error instanceof SyntaxError) continue;
            throw error;
          }
        }
        newline = buffer.indexOf('\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* openAiCompatibleStream(
  url: string,
  apiKey: string,
  payload: Record<string, unknown>,
  label: string,
  extraHeaders: Record<string, string> = {}
): AsyncGenerator<string, void, void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ ...payload, stream: true }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${label} API Error (${response.status}): ${detail.slice(0, 400)}`);
  }
  yield* readSseDeltas(response.body, label);
}

/**
 * Streaming counterpart of {@link chatCompletion}: text deltas as they arrive.
 *
 * Providers that only expose a blocking call (the Z-AI SDK path, which reads a
 * `.z-ai-config` file from disk) fall back to one whole-text chunk instead of
 * failing, so the UI can always render incrementally.
 */
export async function* chatCompletionStream(
  model: AIModel,
  request: ChatCompletionRequest,
  apiKeys: Record<string, string>
): AsyncGenerator<string, void, void> {
  request.model = model.id;
  const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));

  switch (model.provider) {
    case 'nvidia': {
      const apiKey = resolveApiKey(model, apiKeys);
      if (!apiKey) throw new Error('NVIDIA API key required. Get one at build.nvidia.com');
      yield* openAiCompatibleStream(
        NVIDIA_CHAT_URL,
        apiKey,
        {
          model: request.model,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 1024,
          top_p: request.top_p ?? 0.9,
        },
        'NVIDIA'
      );
      return;
    }
    case 'minimax': {
      const apiKey = resolveApiKey(model, apiKeys);
      if (!apiKey) throw new Error('MiniMax API key required');
      yield* openAiCompatibleStream(
        MINIMAX_CHAT_URL,
        apiKey,
        {
          model: request.model,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 1024,
        },
        'MiniMax'
      );
      return;
    }
    case 'z-ai': {
      const env = zaiEnvConfig(resolveApiKey(model, apiKeys));
      if (env) {
        yield* openAiCompatibleStream(
          `${env.baseUrl}/chat/completions`,
          env.apiKey,
          {
            model: request.model,
            messages: messages.map((m) => ({ ...m, content: flattenContent(m.content) })),
            temperature: request.temperature ?? 0.8,
            max_tokens: request.max_tokens ?? 512,
            thinking: { type: 'disabled' },
          },
          'Z-AI',
          { 'X-Z-AI-From': 'Z' }
        );
        return;
      }
      // SDK fallback: no streaming, so emit the completed reply in one chunk.
      const once = await zaiChatCompletion(request, resolveApiKey(model, apiKeys));
      const text = once.choices[0]?.message?.content || '';
      if (text) yield text;
      return;
    }
    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

/**
 * Resolve the API key for a model: the key held for this session first (see
 * `src/lib/server/keys.ts`), then the server environment.
 */
function resolveApiKey(model: AIModel, apiKeys: Record<string, string>): string {
  const envKey = model.provider === 'nvidia'
    ? process.env.NVIDIA_API_KEY
    : model.provider === 'minimax'
      ? process.env.MINIMAX_API_KEY
      : process.env.ZAI_API_KEY;

  return apiKeys[model.apiKeyName] || envKey || '';
}

function requireNvidiaKey(model: AIModel, apiKeys: Record<string, string>, what: string): string {
  if (model.provider !== 'nvidia') {
    throw new Error(`${what} is not implemented for provider "${model.provider}"`);
  }
  const apiKey = resolveApiKey(model, apiKeys);
  if (!apiKey) throw new Error(`NVIDIA API key required for ${what}`);
  return apiKey;
}

export async function imageGeneration(
  model: AIModel,
  prompt: string,
  apiKeys: Record<string, string>
): Promise<ImageGenResponse> {
  const apiKey = requireNvidiaKey(model, apiKeys, 'image generation');
  return nvidiaImageGeneration(model.id, prompt, apiKey);
}

export async function textToSpeech(
  model: AIModel,
  text: string,
  apiKeys: Record<string, string>
): Promise<TTSResponse> {
  const apiKey = requireNvidiaKey(model, apiKeys, 'text-to-speech');
  return nvidiaTTS(model.id, text, apiKey);
}

export async function safetyCheck(
  model: AIModel,
  text: string,
  apiKeys: Record<string, string>
): Promise<SafetyResponse> {
  const apiKey = requireNvidiaKey(model, apiKeys, 'safety checks');
  return nvidiaSafetyCheck(text, model.id, apiKey);
}
