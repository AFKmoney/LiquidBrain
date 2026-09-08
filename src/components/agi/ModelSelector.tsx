'use client';

import React, { useState } from 'react';
import {
  MODEL_REGISTRY,
  ModelCategory,
  CATEGORIES,
  getCategoryLabel,
  PROVIDERS,
} from '@/lib/models/registry';
import {
  Search,
  X,
  Key,
  Check,
  Eye,
  Image as ImageIcon,
  Video,
  Mic,
  Shield,
  Settings,
  Cpu,
} from 'lucide-react';

import type { KeyStatus } from '@/lib/agi/api';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  /** Server-side custody: masks only. The real keys never reach this component. */
  keyStatus: KeyStatus[];
  /** Resolves false when the server refused the patch (see `message`). */
  onSaveKeys: (patch: Record<string, string>) => Promise<boolean>;
  onForgetKeys: () => void;
  isSaving: boolean;
  message: string | null;
  onClose: () => void;
}

const KEY_FIELDS = [
  { name: 'NVIDIA_API_KEY', label: 'NVIDIA_API_KEY', placeholder: 'nvapi-…' },
  { name: 'MINIMAX_API_KEY', label: 'MINIMAX_API_KEY', placeholder: 'Optional — MiniMax is also on NVIDIA NIM' },
  { name: 'ZAI_API_KEY', label: 'ZAI_API_KEY', placeholder: 'Optional — only needed with ZAI_BASE_URL' },
] as const;

const CATEGORY_ICONS: Record<ModelCategory, React.ReactNode> = {
  chat: <Cpu className="w-4 h-4" />,
  vision: <Eye className="w-4 h-4" />,
  'image-gen': <ImageIcon className="w-4 h-4" />,
  'video-gen': <Video className="w-4 h-4" />,
  tts: <Mic className="w-4 h-4" />,
  safety: <Shield className="w-4 h-4" />,
  specialized: <Settings className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<ModelCategory, string> = {
  chat: 'text-cyan-400',
  vision: 'text-violet-400',
  'image-gen': 'text-pink-400',
  'video-gen': 'text-orange-400',
  tts: 'text-emerald-400',
  safety: 'text-amber-400',
  specialized: 'text-slate-400',
};

const CATEGORY_BG: Record<ModelCategory, string> = {
  chat: 'bg-cyan-500/10 border-cyan-500/20',
  vision: 'bg-violet-500/10 border-violet-500/20',
  'image-gen': 'bg-pink-500/10 border-pink-500/20',
  'video-gen': 'bg-orange-500/10 border-orange-500/20',
  tts: 'bg-emerald-500/10 border-emerald-500/20',
  safety: 'bg-amber-500/10 border-amber-500/20',
  specialized: 'bg-slate-500/10 border-slate-500/20',
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onSelectModel,
  keyStatus,
  onSaveKeys,
  onForgetKeys,
  isSaving,
  message,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ModelCategory>('chat');
  const [showApiKeys, setShowApiKeys] = useState(false);
  // Deliberately empty: the browser never holds a key, so there is nothing to
  // prefill. A field left blank is simply not sent, which protects a key that
  // is already stored from being wiped by an unrelated save.
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});

  const statusFor = (name: string) => keyStatus.find((k) => k.name === name);

  // Filter models
  const filteredModels = MODEL_REGISTRY.filter((m) => {
    const matchesCategory = m.category === activeCategory;
    const matchesSearch =
      search.length === 0 ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleSaveKeys = async () => {
    const patch: Record<string, string> = {};
    for (const [name, value] of Object.entries(keyInputs)) {
      const trimmed = (value ?? '').trim();
      if (trimmed.length > 0) patch[name] = trimmed;
    }
    if (Object.keys(patch).length === 0) {
      setShowApiKeys(false);
      return;
    }
    if (await onSaveKeys(patch)) {
      setKeyInputs({});
      setShowApiKeys(false);
    }
  };

  const hasKey = keyStatus.some((k) => k.source !== 'none');

  return (
    <div className="absolute inset-0 z-30 bg-[#212121] flex flex-col">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Select Model</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowApiKeys(!showApiKeys)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showApiKeys
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : hasKey
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              API Keys
              {hasKey && <Check className="w-3 h-3" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* API Keys Panel */}
        {showApiKeys && (
          <div className="mb-3 p-3 rounded-xl bg-[#2f2f2f] border border-white/5 space-y-3">
            <p className="text-xs text-slate-500">
              Get a free NVIDIA API key at{' '}
              <a href="https://build.nvidia.com/" target="_blank" className="text-cyan-400 hover:underline">
                build.nvidia.com
              </a>
            </p>
            <div className="space-y-2">
              {KEY_FIELDS.map((field) => {
                const status = statusFor(field.name);
                return (
                  <div key={field.name}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-500">{field.label}</label>
                      <span
                        className={`text-[10px] ${
                          status?.source === 'session'
                            ? 'text-emerald-400'
                            : status?.source === 'env'
                              ? 'text-cyan-400'
                              : 'text-slate-600'
                        }`}
                      >
                        {status?.masked
                          ? `${status.source === 'env' ? 'from env' : 'held for this session'} ${status.masked}`
                          : 'not set'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={keyInputs[field.name] ?? ''}
                        onChange={(e) =>
                          setKeyInputs((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                        placeholder={status?.masked ? `replace ${status.masked}…` : field.placeholder}
                        className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/30"
                      />
                      {status?.source === 'session' && (
                        <button
                          type="button"
                          onClick={() => void onSaveKeys({ [field.name]: '' })}
                          className="px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-red-300 hover:bg-red-500/10 border border-white/5"
                        >
                          Forget
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void handleSaveKeys()}
                disabled={isSaving}
                className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {isSaving ? 'Storing…' : 'Send to server'}
              </button>
              {hasKey && (
                <button
                  onClick={onForgetKeys}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-red-300 hover:bg-red-500/10 border border-white/5 transition-colors"
                >
                  Forget all
                </button>
              )}
            </div>
            {message && <p className="text-[10px] text-slate-400">{message}</p>}
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Keys are held in the server process for this browser session only — never in
              localStorage, never in a request body, never logged. They disappear when the server
              restarts. Environment variables (NVIDIA_API_KEY…) are used when no session key is set,
              and ZAI_BASE_URL must come from the environment.
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#2f2f2f] border border-white/5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-white/10"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="shrink-0 px-4 py-2 flex gap-1.5 overflow-x-auto border-b border-white/5">
        {CATEGORIES.map((cat) => {
          const count = MODEL_REGISTRY.filter((m) => m.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? `${CATEGORY_BG[cat]} ${CATEGORY_COLORS[cat]}`
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {CATEGORY_ICONS[cat]}
              {getCategoryLabel(cat)}
              <span className="text-[10px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Model List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-1.5">
          {filteredModels.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No models found
            </div>
          )}
          {filteredModels.map((model) => {
            const isSelected = model.id === selectedModelId;
            // A key from either source satisfies the model; the mask list is the
            // only key information this component is allowed to have.
            const needsKey =
              model.requiresApiKey &&
              !keyStatus.some((k) => k.name === model.apiKeyName && k.source !== 'none');
            const providerConfig = PROVIDERS[model.provider];

            return (
              <button
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? `${CATEGORY_BG[model.category]} border-white/10`
                    : 'border-transparent hover:bg-white/[0.03] hover:border-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-medium ${isSelected ? CATEGORY_COLORS[model.category] : 'text-white'}`}>
                        {model.name}
                      </span>
                      {model.isFree && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                          FREE
                        </span>
                      )}
                      {needsKey && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
                          KEY
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                      {model.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-slate-600 font-mono">
                        {providerConfig.icon} {providerConfig.name}
                      </span>
                      {model.params && (
                        <span className="text-[10px] text-slate-600">| {model.params}</span>
                      )}
                      {model.contextWindow > 0 && (
                        <span className="text-[10px] text-slate-600">
                          | {(model.contextWindow / 1000).toFixed(0)}K ctx
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {model.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isSelected && (
                    <div className={`shrink-0 mt-1 ${CATEGORY_COLORS[model.category]}`}>
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
