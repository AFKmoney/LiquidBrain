'use client';

import React, { useState } from 'react';
import {
  MODEL_REGISTRY,
  AIModel,
  ModelCategory,
  CATEGORIES,
  getCategoryLabel,
  PROVIDERS,
  ProviderId,
} from '@/lib/models/registry';
import {
  Brain,
  ChevronRight,
  Search,
  X,
  Key,
  Check,
  Eye,
  Image,
  Video,
  Mic,
  Shield,
  Settings,
  Sparkles,
  Cpu,
} from 'lucide-react';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  apiKeys: Record<string, string>;
  onSetApiKey: (keyName: string, value: string) => void;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<ModelCategory, React.ReactNode> = {
  chat: <Cpu className="w-4 h-4" />,
  vision: <Eye className="w-4 h-4" />,
  'image-gen': <Image className="w-4 h-4" />,
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
  apiKeys,
  onSetApiKey,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ModelCategory>('chat');
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({
    NVIDIA_API_KEY: apiKeys.NVIDIA_API_KEY || '',
    MINIMAX_API_KEY: apiKeys.MINIMAX_API_KEY || '',
  });

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

  const handleSaveKeys = () => {
    for (const [keyName, value] of Object.entries(keyInputs)) {
      if (value.trim()) {
        onSetApiKey(keyName, value.trim());
      }
    }
    setShowApiKeys(false);
  };

  const hasNvidiaKey = !!(apiKeys.NVIDIA_API_KEY || keyInputs.NVIDIA_API_KEY);

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
                  : hasNvidiaKey
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              API Keys
              {hasNvidiaKey && <Check className="w-3 h-3" />}
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
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">NVIDIA_API_KEY</label>
                <input
                  type="password"
                  value={keyInputs.NVIDIA_API_KEY}
                  onChange={(e) =>
                    setKeyInputs((prev) => ({ ...prev, NVIDIA_API_KEY: e.target.value }))
                  }
                  placeholder="nvapi-..."
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/30"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">MINIMAX_API_KEY</label>
                <input
                  type="password"
                  value={keyInputs.MINIMAX_API_KEY}
                  onChange={(e) =>
                    setKeyInputs((prev) => ({ ...prev, MINIMAX_API_KEY: e.target.value }))
                  }
                  placeholder="Optional — MiniMax is also on NVIDIA NIM"
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/30"
                />
              </div>
            </div>
            <button
              onClick={handleSaveKeys}
              className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
            >
              Save Keys
            </button>
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
            const needsKey = model.requiresApiKey && !apiKeys[model.apiKeyName];
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
