'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAgiStore } from '@/lib/agi/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  Send,
  Cpu,
  Sparkles,
  Save,
  Activity,
  Wifi,
  WifiOff,
  Loader2,
  Zap,
} from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const {
    isOnline,
    isConnecting,
    brainState,
    chatMessages,
    isChatLoading,
    isThinking,
    isTraining,
    lastTrainLoss,
    sendChat,
    triggerThink,
    triggerReflect,
    triggerTrain,
  } = useAgiStore();

  const [chatInput, setChatInput] = useState('');
  const [trainText, setTrainText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChatSend = () => {
    if (!chatInput.trim() || isChatLoading) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  const handleTrain = () => {
    if (!trainText.trim() || isTraining) return;
    triggerTrain(trainText.trim());
    setTrainText('');
  };

  const coherenceColor =
    brainState.coherence > 0.7
      ? 'text-emerald-400'
      : brainState.coherence > 0.4
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Brain className="w-7 h-7 text-cyan-400" />
          {isOnline && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-wider text-cyan-300 font-mono truncate">
            LIQUID2
          </h1>
          <p className="text-[10px] text-slate-500 tracking-widest uppercase">
            Fractal AGI Engine
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] font-mono px-2 py-0.5 ${
            isOnline
              ? 'border-emerald-500/50 text-emerald-400'
              : isConnecting
                ? 'border-amber-500/50 text-amber-400'
                : 'border-red-500/50 text-red-400'
          }`}
        >
          {isOnline ? (
            <Wifi className="w-3 h-3 mr-1" />
          ) : isConnecting ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <WifiOff className="w-3 h-3 mr-1" />
          )}
          {isOnline ? 'ONLINE' : isConnecting ? 'CONNECTING' : 'OFFLINE'}
        </Badge>
      </div>

      <Separator className="bg-slate-800" />

      {/* Brain Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Status" value={brainState.status.toUpperCase()} accent={isOnline} />
        <MetricCard label="Model" value={brainState.model.split(' ').slice(0, 2).join(' ')} />
        <MetricCard label="Nodes" value={String(brainState.brain_nodes)} accent />
        <MetricCard label="Layers" value={String(brainState.language_depth)} />
        <MetricCard label="Dimension" value={String(brainState.embedding_dim)} />
        <MetricCard label="Memory" value={String(brainState.memory_concepts)} accent />
        <MetricCard
          label="Coherence"
          value={brainState.coherence.toFixed(3)}
          className={coherenceColor}
        />
        <MetricCard label="Insight" value={brainState.last_insight || '—'} truncate />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-cyan-800 text-cyan-400 hover:bg-cyan-950 hover:text-cyan-300 h-8 text-xs"
          onClick={() => triggerThink(5)}
          disabled={isThinking || !isOnline}
        >
          {isThinking ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <Cpu className="w-3.5 h-3.5 mr-1" />
          )}
          Think
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-amber-800 text-amber-400 hover:bg-amber-950 hover:text-amber-300 h-8 text-xs"
          onClick={() => triggerReflect()}
          disabled={useAgiStore.getState().isReflecting || !isOnline}
        >
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          Reflect
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-emerald-800 text-emerald-400 hover:bg-emerald-950 hover:text-emerald-300 h-8 text-xs"
          onClick={() => {
            triggerTrain('save');
          }}
          disabled={!isOnline}
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          Save
        </Button>
      </div>

      <Separator className="bg-slate-800" />

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-mono text-slate-400 tracking-wider">CHAT</span>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mb-2 pr-1 scrollbar-thin">
          {chatMessages.length === 0 && (
            <div className="text-center py-6">
              <Brain className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">Talk to the brain...</p>
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`text-xs p-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-cyan-950/50 border border-cyan-900/30 ml-4'
                  : 'bg-slate-800/50 border border-slate-700/30 mr-4'
              }`}
            >
              <span
                className={`font-mono text-[10px] ${
                  msg.role === 'user' ? 'text-cyan-500' : 'text-amber-500'
                }`}
              >
                {msg.role === 'user' ? 'YOU' : 'BRAIN'}
              </span>
              <p className="text-slate-300 mt-0.5 break-words">{msg.content}</p>
            </div>
          ))}
          {isChatLoading && (
            <div className="text-xs p-2 rounded-lg bg-slate-800/50 border border-slate-700/30 mr-4">
              <span className="font-mono text-[10px] text-amber-500">BRAIN</span>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSend();
              }
            }}
            placeholder="Speak to the brain..."
            disabled={isChatLoading || !isOnline}
            className="h-8 text-xs bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:ring-cyan-500/30"
          />
          <Button
            size="sm"
            onClick={handleChatSend}
            disabled={isChatLoading || !chatInput.trim() || !isOnline}
            className="h-8 px-3 bg-cyan-700 hover:bg-cyan-600 text-white"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Training Panel */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-mono text-slate-400 tracking-wider">TRAIN</span>
          {lastTrainLoss !== null && (
            <Badge variant="outline" className="text-[10px] font-mono border-amber-800 text-amber-400">
              Loss: {lastTrainLoss.toFixed(3)}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={trainText}
            onChange={(e) => setTrainText(e.target.value)}
            placeholder="Paste text to train the brain..."
            disabled={isTraining || !isOnline}
            className="min-h-[48px] max-h-[80px] text-xs bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 resize-none focus-visible:ring-amber-500/30"
          />
          <Button
            size="sm"
            onClick={handleTrain}
            disabled={isTraining || !trainText.trim() || !isOnline}
            className="h-auto px-3 bg-amber-700 hover:bg-amber-600 text-white"
          >
            {isTraining ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Small Metric Card ─────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
  truncate?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  accent,
  className,
  truncate,
}) => (
  <div className="p-2 rounded-md bg-slate-900/80 border border-slate-800/50">
    <div className="text-[10px] text-slate-500 font-mono tracking-wider">{label}</div>
    <div
      className={`text-sm font-mono font-bold mt-0.5 ${
        className || (accent ? 'text-cyan-400' : 'text-slate-300')
      } ${truncate ? 'truncate' : ''}`}
      title={value}
    >
      {value}
    </div>
  </div>
);
