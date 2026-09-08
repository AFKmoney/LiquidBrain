'use client';

import React, { useState } from 'react';
import { useAgiStore } from '@/lib/agi/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  Cpu,
  Sparkles,
  Activity,
  Wifi,
  WifiOff,
  Loader2,
  Zap,
  RefreshCw,
} from 'lucide-react';

/**
 * Brain console: live metrics from the FractalBrain engine plus the manual
 * cognitive actions (think / reflect / train). Conversation lives in ChatPanel.
 */
export const ControlPanel: React.FC = () => {
  const {
    isOnline,
    isConnecting,
    brainState,
    isThinking,
    isReflecting,
    isTraining,
    lastTrainLoss,
    lastReflection,
    triggerThink,
    triggerReflect,
    triggerTrain,
    fetchState,
    fetchMemory,
  } = useAgiStore();

  const [trainText, setTrainText] = useState('');

  const handleTrain = () => {
    if (!trainText.trim() || isTraining) return;
    triggerTrain(trainText.trim());
    setTrainText('');
  };

  const coherence = lastReflection?.coherence ?? brainState.coherence;
  const coherenceColor =
    coherence > 0.7 ? 'text-emerald-400' : coherence > 0.4 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Brain className="w-6 h-6 text-cyan-400" />
          {isOnline && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold tracking-wider text-cyan-300 font-mono truncate">
            BRAIN CONSOLE
          </h2>
          <p className="text-[10px] text-slate-500 tracking-widest uppercase">
            Fractal engine controls
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

      {/* Brain Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Status" value={brainState.status.toUpperCase()} accent={isOnline} />
        <MetricCard
          label="Model"
          value={brainState.model.split(' ').slice(0, 2).join(' ')}
        />
        <MetricCard label="Nodes" value={String(brainState.brain_nodes)} accent />
        <MetricCard label="Layers" value={String(brainState.language_depth)} />
        <MetricCard label="Dimension" value={String(brainState.embedding_dim)} />
        <MetricCard label="Memory" value={String(brainState.memory_concepts)} accent />
        <MetricCard
          label="Coherence"
          value={coherence.toFixed(3)}
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
          disabled={isReflecting || !isOnline}
        >
          {isReflecting ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 mr-1" />
          )}
          Reflect
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white h-8 text-xs"
          onClick={() => {
            fetchState();
            fetchMemory();
          }}
          title="Refresh brain state"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Sync
        </Button>
      </div>

      <Separator className="bg-slate-800" />

      {/* Training Panel */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-mono text-slate-400 tracking-wider">TRAIN</span>
          {lastTrainLoss !== null && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-amber-800 text-amber-400"
            >
              Loss: {lastTrainLoss.toFixed(3)}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Feed text into the fractal network. Requires the FractalBrain engine — online only.
        </p>
        <div className="flex gap-2">
          <Textarea
            value={trainText}
            onChange={(e) => setTrainText(e.target.value)}
            placeholder="Paste text to train the brain..."
            disabled={isTraining || !isOnline}
            className="min-h-[56px] max-h-[120px] text-xs bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 resize-none focus-visible:ring-amber-500/30"
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

      {lastReflection && (
        <>
          <Separator className="bg-slate-800" />
          <div className="flex items-start gap-2">
            <Activity className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
            <div className="text-[11px] text-slate-500 leading-relaxed">
              Last reflection: surprise {lastReflection.avg_surprise.toFixed(2)}, confidence{' '}
              {lastReflection.avg_confidence.toFixed(2)}, memory utilization{' '}
              {(lastReflection.memory_utilization * 100).toFixed(1)}%
              {lastReflection.should_rewire ? ' — rewire suggested' : ' — stable'}.
            </div>
          </div>
        </>
      )}
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

const MetricCard: React.FC<MetricCardProps> = ({ label, value, accent, className, truncate }) => (
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
