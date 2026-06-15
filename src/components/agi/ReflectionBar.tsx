'use client';

import React from 'react';
import { useAgiStore } from '@/lib/agi/store';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertTriangle, Lightbulb, Activity } from 'lucide-react';

export const ReflectionBar: React.FC = () => {
  const {
    lastReflection,
    isReflecting,
    brainState,
    triggerReflect,
    isOnline,
  } = useAgiStore();

  const coherence = lastReflection?.coherence ?? brainState.coherence;
  const shouldRewire = lastReflection?.should_rewire ?? false;
  const insight = lastReflection?.insight ?? brainState.last_insight ?? 'No reflection yet';
  const avgSurprise = lastReflection?.avg_surprise ?? 0;
  const avgConfidence = lastReflection?.avg_confidence ?? 0;
  const memoryUtil = lastReflection?.memory_utilization ?? 0;

  // Coherence color: red → yellow → green
  const coherenceColor =
    coherence > 0.7
      ? '#22c55e'
      : coherence > 0.4
        ? '#eab308'
        : '#ef4444';

  const coherenceBg =
    coherence > 0.7
      ? 'rgba(34, 197, 94, 0.15)'
      : coherence > 0.4
        ? 'rgba(234, 179, 8, 0.15)'
        : 'rgba(239, 68, 68, 0.15)';

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-950/80 border-t border-slate-800/50 backdrop-blur-sm">
      {/* Coherence Meter */}
      <div className="flex items-center gap-2 min-w-[160px]">
        <Activity className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[10px] font-mono text-slate-500 tracking-wider">COHERENCE</span>
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.max(coherence * 100, 2)}%`,
              backgroundColor: coherenceColor,
              boxShadow: `0 0 8px ${coherenceColor}`,
            }}
          />
        </div>
        <span
          className="text-xs font-mono font-bold min-w-[36px] text-right"
          style={{ color: coherenceColor }}
        >
          {coherence.toFixed(2)}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-800" />

      {/* Avg Surprise */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-slate-500 tracking-wider">SURPRISE</span>
        <span className="text-xs font-mono text-amber-400 font-bold">
          {avgSurprise.toFixed(2)}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-800" />

      {/* Confidence */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-slate-500 tracking-wider">CONFIDENCE</span>
        <span className="text-xs font-mono text-cyan-400 font-bold">
          {avgConfidence.toFixed(2)}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-800" />

      {/* Memory Utilization */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-slate-500 tracking-wider">MEM UTIL</span>
        <span className="text-xs font-mono text-emerald-400 font-bold">
          {(memoryUtil * 100).toFixed(1)}%
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-800" />

      {/* Should Rewire Indicator */}
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded"
        style={{ backgroundColor: shouldRewire ? 'rgba(239, 68, 68, 0.15)' : 'transparent' }}
      >
        {shouldRewire ? (
          <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-emerald-500/30 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        )}
        <span
          className={`text-[10px] font-mono tracking-wider ${
            shouldRewire ? 'text-red-400' : 'text-emerald-500'
          }`}
        >
          {shouldRewire ? 'REWIRE' : 'STABLE'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-800" />

      {/* Insight */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="text-xs text-slate-400 truncate italic">
          {insight}
        </span>
      </div>

      {/* Reflect Button */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-3 border-amber-800/50 text-amber-400 hover:bg-amber-950 hover:text-amber-300 text-[10px] font-mono shrink-0"
        onClick={() => triggerReflect()}
        disabled={isReflecting || !isOnline}
      >
        <Sparkles className="w-3 h-3 mr-1" />
        {isReflecting ? 'REFLECTING...' : 'REFLECT'}
      </Button>
    </div>
  );
};
