'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAgiStore } from '@/lib/agi/store';
import { FractalSNN } from '@/components/agi/FractalSNN';
import { MemoryMap } from '@/components/agi/MemoryMap';
import { ModelSelector } from '@/components/agi/ModelSelector';
import { ModelCategory, MODEL_REGISTRY, getCategoryLabel } from '@/lib/models/registry';
import {
  Brain,
  Send,
  Sparkles,
  Cpu,
  Wifi,
  WifiOff,
  Loader2,
  Map,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Eye,
  X,
  Zap,
  Lightbulb,
  Activity,
  Plus,
  Image,
  Mic,
  Shield,
  Video,
  Upload,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings,
} from 'lucide-react';

export default function Home() {
  const {
    fetchState,
    fetchMemory,
    isOnline,
    brainState,
    chatMessages,
    isChatLoading,
    sendChat,
    triggerThink,
    triggerReflect,
    lastReflection,
    isReflecting,
    isThinking,
    memory,
    // Model selection
    selectedModelId,
    selectedModel,
    modelCategory,
    apiKeys,
    showModelSelector,
    setSelectedModel,
    setApiKey,
    toggleModelSelector,
    // Image generation
    imagePrompt,
    generatedImages,
    isImageGenerating,
    generateImage,
    setImagePrompt,
    // TTS
    isTTSGenerating,
    audioData,
    generateTTS,
    // Safety
    isSafetyChecking,
    safetyResult,
    checkSafety,
    // Vision
    isVisionAnalyzing,
    visionResult,
    visionImageUrl,
    analyzeImage,
    setVisionImageUrl,
  } = useAgiStore();

  const [chatInput, setChatInput] = useState('');
  const [showViz, setShowViz] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [safetyInput, setSafetyInput] = useState('');
  const [ttsInput, setTtsInput] = useState('');
  const [visionPrompt, setVisionPrompt] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Polling
  useEffect(() => {
    fetchState();
    const si = setInterval(fetchState, 3000);
    return () => clearInterval(si);
  }, [fetchState]);

  useEffect(() => {
    fetchMemory();
    const mi = setInterval(fetchMemory, 5000);
    return () => clearInterval(mi);
  }, [fetchMemory]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const handleSend = useCallback(() => {
    if (!chatInput.trim() || isChatLoading) return;
    sendChat(chatInput.trim());
    setChatInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [chatInput, isChatLoading, sendChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const coherence = lastReflection?.coherence ?? brainState.coherence;
  const insight = lastReflection?.insight ?? brainState.last_insight;

  return (
    <div className="h-dvh flex bg-[#212121] text-white overflow-hidden">
      {/* ═══════════════ SIDEBAR ═══════════════ */}
      {showSidebar && (
        <aside className="w-[260px] shrink-0 flex flex-col bg-[#171717] overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">LiquidBrain</span>
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-1 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Online Status */}
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03]">
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-500 shrink-0" />
              )}
              <span className={`text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <span className="text-[10px] font-mono text-slate-600 ml-auto">
                {brainState.brain_nodes} nodes
              </span>
            </div>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* Brain Stats Section */}
          <div className="p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Brain</span>
            </div>
            <div className="space-y-1.5">
              <SidebarStat label="Nodes" value={brainState.brain_nodes} />
              <SidebarStat label="Layers" value={brainState.language_depth} />
              <SidebarStat label="Memory" value={`${brainState.memory_concepts} concepts`} accent />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">Coherence</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(coherence * 100, 2)}%`,
                      backgroundColor: coherence > 0.7 ? '#22c55e' : coherence > 0.4 ? '#eab308' : '#ef4444',
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono font-semibold text-slate-400">
                  {coherence.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* Quick Actions */}
          <div className="p-3 space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</span>
            </div>
            <button
              onClick={() => triggerThink(5)}
              disabled={isThinking || !isOnline}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-slate-300 transition-colors disabled:opacity-30"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Think (5 cycles)
              {isThinking && <Loader2 className="w-3 h-3 ml-auto animate-spin text-cyan-400" />}
            </button>
            <button
              onClick={() => triggerReflect()}
              disabled={isReflecting || !isOnline}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-slate-300 transition-colors disabled:opacity-30"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Reflect
              {isReflecting && <Loader2 className="w-3 h-3 ml-auto animate-spin text-amber-400" />}
            </button>
            <button
              onClick={() => setShowViz(!showViz)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                showViz ? 'bg-cyan-600/15 text-cyan-400' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Fractal View
            </button>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* Memory - scrollable bottom section */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <div className="flex items-center gap-2 mb-2">
              <Map className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Memory</span>
              <span className="text-[10px] font-mono text-slate-600 ml-auto">{memory.concepts.length}</span>
            </div>
            <div className="space-y-0.5">
              {memory.concepts.length === 0 && (
                <p className="text-[11px] text-slate-600 text-center py-3">Chat to create memories</p>
              )}
              {memory.concepts
                .sort((a, b) => b.salience - a.salience)
                .slice(0, 30)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: `hsl(${180 + c.salience * 60}, 70%, 55%)` }}
                    />
                    <span className="text-[11px] text-slate-400 truncate flex-1">
                      {c.label || `Concept #${c.id}`}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">{c.salience.toFixed(1)}</span>
                  </div>
                ))}
            </div>
          </div>
        </aside>
      )}

      {/* ═══════════════ MAIN AREA ═══════════════ */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* Top Bar */}
        <header className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-white/5 bg-[#212121]">
          <div className="flex items-center gap-3">
            {!showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                className="p-1 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {/* Model Selector Button */}
            <button
              onClick={toggleModelSelector}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <span className="text-sm font-medium text-white">
                {selectedModel?.name || 'GLM-5.1'}
              </span>
              <ChevronRight className="w-3 h-3 text-slate-500 rotate-90" />
            </button>
            {selectedModel && (
              <div className="flex items-center gap-1.5">
                {modelCategory === 'chat' && <Cpu className="w-3 h-3 text-cyan-400" />}
                {modelCategory === 'vision' && <Eye className="w-3 h-3 text-violet-400" />}
                {modelCategory === 'image-gen' && <Image className="w-3 h-3 text-pink-400" />}
                {modelCategory === 'video-gen' && <Video className="w-3 h-3 text-orange-400" />}
                {modelCategory === 'tts' && <Mic className="w-3 h-3 text-emerald-400" />}
                {modelCategory === 'safety' && <Shield className="w-3 h-3 text-amber-400" />}
                <span className="text-[10px] text-slate-500">
                  {getCategoryLabel(modelCategory)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-emerald-500">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-red-500">Offline</span>
              </div>
            )}
          </div>
        </header>

        {/* Model Selector Overlay */}
        {showModelSelector && (
          <ModelSelector
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModel}
            apiKeys={apiKeys}
            onSetApiKey={setApiKey}
            onClose={toggleModelSelector}
          />
        )}

        {/* Visualization Panel (overlay) */}
        {showViz && !showModelSelector && (
          <div className="absolute inset-0 top-11 z-20 bg-[#212121]/95 backdrop-blur-sm flex">
            <div className="flex-1 min-h-0 min-w-0 p-3">
              <FractalSNN />
            </div>
            <div className="w-72 shrink-0 border-l border-white/5 p-3 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Memory Map</span>
                <button
                  onClick={() => setShowViz(false)}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <MemoryMap />
              </div>
            </div>
          </div>
        )}

        {/* ─── Dynamic Content Based on Model Category ─── */}
        {!showModelSelector && !showViz && (
          <>
            {modelCategory === 'chat' && <ChatPanel />}
            {modelCategory === 'vision' && <VisionPanel />}
            {modelCategory === 'image-gen' && <ImageGenPanel />}
            {modelCategory === 'video-gen' && <VideoGenPanel />}
            {modelCategory === 'tts' && <TTSPanel />}
            {modelCategory === 'safety' && <SafetyPanel />}
            {modelCategory === 'specialized' && <ChatPanel />}
          </>
        )}
      </main>
    </div>
  );
}

// ═══════════════ CHAT PANEL ═══════════════

function ChatPanel() {
  const { chatMessages, isChatLoading, sendChat } = useAgiStore();
  const [chatInput, setChatInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const handleSend = () => {
    if (!chatInput.trim() || isChatLoading) return;
    sendChat(chatInput.trim());
    setChatInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {chatMessages.length === 0 && <WelcomeScreen />}
          {chatMessages.map((msg, i) => (
            <div key={i} className="mb-5">
              {msg.role === 'assistant' ? (
                <div className="flex gap-3 max-w-full">
                  <div className="w-7 h-7 rounded-sm bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-[15px] text-slate-200 leading-7 whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 max-w-full justify-end">
                  <div className="flex-1 min-w-0 flex justify-end">
                    <div className="max-w-[85%]">
                      <div className="text-[15px] text-slate-200 leading-7 whitespace-pre-wrap break-words bg-[#2f2f2f] rounded-2xl px-4 py-2.5">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-sm bg-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-300">U</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isChatLoading && (
            <div className="flex gap-3 mb-5">
              <div className="w-7 h-7 rounded-sm bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-center gap-1.5 pt-2">
                <span className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>
      {/* Input */}
      <div className="shrink-0 bg-[#212121] pb-4 pt-2">
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative flex items-end bg-[#2f2f2f] rounded-2xl border border-white/5 focus-within:border-white/10 transition-colors">
            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message LiquidBrain..."
              disabled={isChatLoading}
              rows={1}
              className="flex-1 bg-transparent px-4 py-3 text-[15px] text-white placeholder:text-slate-500 resize-none outline-none max-h-40 min-h-[44px] leading-6"
            />
            <button
              onClick={handleSend}
              disabled={isChatLoading || !chatInput.trim()}
              className="p-1.5 mr-2 mb-2 rounded-lg bg-white text-black hover:bg-slate-200 disabled:bg-white/10 disabled:text-slate-600 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-600 text-center mt-2">
            LiquidBrain Fractal AGI — Memory persists across conversation
          </p>
        </div>
      </div>
    </>
  );
}

// ═══════════════ VISION PANEL ═══════════════

function VisionPanel() {
  const { isVisionAnalyzing, visionResult, analyzeImage, visionImageUrl, setVisionImageUrl, selectedModel } = useAgiStore();
  const [prompt, setPrompt] = useState('Describe what you see in this image in detail.');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center mb-5 mx-auto border border-violet-500/10">
            <Eye className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Vision Analysis</h2>
          <p className="text-slate-500 text-sm">Upload an image URL and ask questions about it</p>
          <p className="text-slate-600 text-xs mt-1">Using: {selectedModel?.name || 'Vision Model'}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Image URL</label>
            <input
              type="url"
              value={visionImageUrl}
              onChange={(e) => setVisionImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-3 rounded-xl bg-[#2f2f2f] border border-white/5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/20"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Question / Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What do you see in this image?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#2f2f2f] border border-white/5 text-sm text-white placeholder:text-slate-600 resize-none outline-none focus:border-violet-500/20"
            />
          </div>
          <button
            onClick={() => visionImageUrl && analyzeImage(visionImageUrl, prompt)}
            disabled={!visionImageUrl || isVisionAnalyzing}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-white/5 disabled:text-slate-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isVisionAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {isVisionAnalyzing ? 'Analyzing...' : 'Analyze Image'}
          </button>

          {visionImageUrl && (
            <div className="rounded-xl overflow-hidden border border-white/5">
              <img src={visionImageUrl} alt="Preview" className="w-full max-h-80 object-contain bg-black/30" />
            </div>
          )}

          {visionResult && (
            <div className="p-4 rounded-xl bg-[#2f2f2f] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-violet-400">Analysis Result</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{visionResult}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ IMAGE GENERATION PANEL ═══════════════

function ImageGenPanel() {
  const { imagePrompt, setImagePrompt, generateImage, isImageGenerating, generatedImages, selectedModel } = useAgiStore();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center mb-5 mx-auto border border-pink-500/10">
            <Image className="w-7 h-7 text-pink-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Image Generation</h2>
          <p className="text-slate-500 text-sm">Generate images from text descriptions</p>
          <p className="text-slate-600 text-xs mt-1">Using: {selectedModel?.name || 'FLUX.1'}</p>
        </div>

        <div className="space-y-4">
          <textarea
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            placeholder="A majestic fractal cathedral in a neon-lit cyberpunk city, digital art, 4K..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-[#2f2f2f] border border-white/5 text-sm text-white placeholder:text-slate-600 resize-none outline-none focus:border-pink-500/20"
          />
          <button
            onClick={() => imagePrompt && generateImage(imagePrompt)}
            disabled={!imagePrompt || isImageGenerating}
            className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:bg-white/5 disabled:text-slate-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isImageGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
            {isImageGenerating ? 'Generating...' : 'Generate Image'}
          </button>

          {generatedImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {generatedImages.map((img, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-white/5">
                  {img.url && <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover" />}
                  {img.b64_json && <img src={`data:image/png;base64,${img.b64_json}`} alt={img.prompt} className="w-full aspect-square object-cover" />}
                  <div className="p-2 bg-black/30">
                    <p className="text-[10px] text-slate-500 line-clamp-2">{img.prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ VIDEO GENERATION PANEL ═══════════════

function VideoGenPanel() {
  const { selectedModel } = useAgiStore();
  const [prompt, setPrompt] = useState('');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-5 mx-auto border border-orange-500/10">
            <Video className="w-7 h-7 text-orange-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Video Generation</h2>
          <p className="text-slate-500 text-sm">Generate physics-aware videos from text descriptions</p>
          <p className="text-slate-600 text-xs mt-1">Using: {selectedModel?.name || 'Cosmos3'}</p>
        </div>

        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A robot walking through a field of flowers in slow motion..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-[#2f2f2f] border border-white/5 text-sm text-white placeholder:text-slate-600 resize-none outline-none focus:border-orange-500/20"
          />
          <button
            disabled={!prompt}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:bg-white/5 disabled:text-slate-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            Generate Video (Coming Soon)
          </button>
          <p className="text-xs text-slate-600 text-center">
            Video generation requires extended processing. Stay tuned for full integration.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ TTS PANEL ═══════════════

function TTSPanel() {
  const { isTTSGenerating, audioData, generateTTS, selectedModel } = useAgiStore();
  const [text, setText] = useState('');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-5 mx-auto border border-emerald-500/10">
            <Mic className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Text-to-Speech</h2>
          <p className="text-slate-500 text-sm">Convert text to natural speech</p>
          <p className="text-slate-600 text-xs mt-1">Using: {selectedModel?.name || 'TTS Model'}</p>
        </div>

        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl bg-[#2f2f2f] border border-white/5 text-sm text-white placeholder:text-slate-600 resize-none outline-none focus:border-emerald-500/20"
          />
          <button
            onClick={() => text && generateTTS(text)}
            disabled={!text || isTTSGenerating}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-slate-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isTTSGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {isTTSGenerating ? 'Generating...' : 'Generate Speech'}
          </button>

          {audioData && (
            <div className="p-4 rounded-xl bg-[#2f2f2f] border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Play className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">Audio Output</span>
              </div>
              <audio controls className="w-full">
                <source src={`data:audio/wav;base64,${audioData}`} type="audio/wav" />
                Your browser does not support audio playback.
              </audio>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ SAFETY PANEL ═══════════════

function SafetyPanel() {
  const { isSafetyChecking, safetyResult, checkSafety, selectedModel } = useAgiStore();
  const [text, setText] = useState('');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center mb-5 mx-auto border border-amber-500/10">
            <Shield className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Content Safety Check</h2>
          <p className="text-slate-500 text-sm">Analyze text for unsafe or toxic content</p>
          <p className="text-slate-600 text-xs mt-1">Using: {selectedModel?.name || 'Safety Model'}</p>
        </div>

        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to check for safety..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl bg-[#2f2f2f] border border-white/5 text-sm text-white placeholder:text-slate-600 resize-none outline-none focus:border-amber-500/20"
          />
          <button
            onClick={() => text && checkSafety(text)}
            disabled={!text || isSafetyChecking}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-white/5 disabled:text-slate-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isSafetyChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {isSafetyChecking ? 'Checking...' : 'Check Safety'}
          </button>

          {safetyResult && (
            <div className={`p-4 rounded-xl border ${
              safetyResult.is_safe
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-red-500/5 border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {safetyResult.is_safe ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={`text-sm font-medium ${
                  safetyResult.is_safe ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {safetyResult.is_safe ? 'Content is Safe' : 'Unsafe Content Detected'}
                </span>
              </div>
              {safetyResult.violation && (
                <p className="text-sm text-slate-400 mb-2">
                  Violation: {safetyResult.violation}
                </p>
              )}
              {safetyResult.categories && (
                <div className="space-y-1">
                  {Object.entries(safetyResult.categories).map(([cat, info]) => (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{cat}</span>
                      <div className="flex items-center gap-2">
                        <span className={info.is_safe ? 'text-emerald-400' : 'text-red-400'}>
                          {info.is_safe ? 'Safe' : 'Unsafe'}
                        </span>
                        <span className="text-slate-600">{(info.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ WELCOME SCREEN ═══════════════

function WelcomeScreen() {
  const { sendChat } = useAgiStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center mb-5 border border-cyan-500/10">
        <Brain className="w-7 h-7 text-cyan-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">LiquidBrain</h2>
      <p className="text-slate-500 text-sm mb-8 max-w-md leading-relaxed">
        A fractal AGI with memory, reflection, and self-awareness. Start a conversation to engage the neural graph.
      </p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {[
          { icon: <Cpu className="w-4 h-4" />, text: 'How does your fractal brain work?' },
          { icon: <Sparkles className="w-4 h-4" />, text: 'Reflect on your current state' },
          { icon: <Activity className="w-4 h-4" />, text: 'What is your coherence level?' },
          { icon: <MessageSquare className="w-4 h-4" />, text: 'Tell me about Mandelbrot sets' },
        ].map((suggestion, i) => (
          <button
            key={i}
            onClick={() => sendChat(suggestion.text)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 text-sm text-slate-400 hover:text-slate-300 transition-colors text-left"
          >
            <span className="text-cyan-500/60 shrink-0">{suggestion.icon}</span>
            <span className="truncate">{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════ SMALL COMPONENTS ═══════════════

function SidebarStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-mono font-semibold ${accent ? 'text-cyan-400' : 'text-slate-300'}`}>
        {value}
      </span>
    </div>
  );
}
