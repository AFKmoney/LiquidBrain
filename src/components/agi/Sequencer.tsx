'use client';

import React, { useState } from 'react';
import { useAgiStore } from '@/lib/agi/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Square,
  Plus,
  X,
  Loader2,
  Cpu,
} from 'lucide-react';

interface SequencerStep {
  id: number;
  input: string;
  result?: {
    embeddingDim?: number;
    activeNodes?: number;
  };
}

export const Sequencer: React.FC = () => {
  const { isSequencerRunning, runSequencerStep, isOnline, lastThinkResult } = useAgiStore();

  const [steps, setSteps] = useState<SequencerStep[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentStep, setCurrentStep] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [nextId, setNextId] = useState(1);

  const addStep = () => {
    if (!inputValue.trim()) return;
    setSteps((prev) => [
      ...prev,
      { id: nextId, input: inputValue.trim() },
    ]);
    setNextId((n) => n + 1);
    setInputValue('');
  };

  const removeStep = (id: number) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const runSequence = async () => {
    if (steps.length === 0 || isRunning) return;
    setIsRunning(true);

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      const step = steps[i];

      try {
        // Perceive + Think
        await runSequencerStep(step.input);

        // Update step with results
        setSteps((prev) =>
          prev.map((s) =>
            s.id === step.id
              ? {
                  ...s,
                  result: {
                    embeddingDim: useAgiStore.getState().brainState.embedding_dim,
                    activeNodes: useAgiStore.getState().lastThinkResult?.active_nodes ?? 0,
                  },
                }
              : s
          )
        );
      } catch {
        setSteps((prev) =>
          prev.map((s) =>
            s.id === step.id
              ? { ...s, result: { activeNodes: -1 } }
              : s
          )
        );
      }

      // Delay between steps for visualization
      await new Promise((r) => setTimeout(r, 300));
    }

    setCurrentStep(-1);
    setIsRunning(false);
  };

  const clearAll = () => {
    setSteps([]);
    setCurrentStep(-1);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-mono text-slate-400 tracking-wider">SEQUENCER</span>
        <div className="flex-1" />
        {lastThinkResult && (
          <Badge variant="outline" className="text-[10px] font-mono border-emerald-800 text-emerald-400">
            Active: {lastThinkResult.active_nodes}
          </Badge>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-1.5">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addStep();
          }}
          placeholder="Add step (e.g. 'hello world')"
          disabled={isRunning || !isOnline}
          className="h-7 text-xs bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:ring-emerald-500/30"
        />
        <Button
          size="sm"
          onClick={addStep}
          disabled={!inputValue.trim() || isRunning || !isOnline}
          className="h-7 px-2 bg-emerald-700 hover:bg-emerald-600 text-white"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Step List */}
      <div className="max-h-32 overflow-y-auto space-y-1 scrollbar-thin">
        {steps.length === 0 && (
          <div className="text-center py-3">
            <p className="text-[10px] text-slate-600">No steps added</p>
          </div>
        )}
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
              currentStep === idx
                ? 'bg-emerald-950/50 border border-emerald-800/50'
                : step.result?.activeNodes === -1
                  ? 'bg-red-950/30 border border-red-900/30'
                  : step.result
                    ? 'bg-cyan-950/30 border border-cyan-900/30'
                    : 'bg-slate-900/50 border border-slate-800/30'
            }`}
          >
            <span className="text-slate-600 font-mono w-5 text-right">{idx + 1}</span>
            <span className="flex-1 text-slate-300 truncate">{step.input}</span>
            {step.result && step.result.activeNodes !== -1 && (
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 border-cyan-800 text-cyan-400">
                {step.result.activeNodes} nodes
              </Badge>
            )}
            {step.result?.activeNodes === -1 && (
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 border-red-800 text-red-400">
                ERROR
              </Badge>
            )}
            {currentStep === idx && (
              <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
            )}
            <button
              onClick={() => removeStep(step.id)}
              disabled={isRunning}
              className="text-slate-600 hover:text-red-400 disabled:opacity-30"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          onClick={runSequence}
          disabled={steps.length === 0 || isRunning || !isOnline}
          className="flex-1 h-7 text-[10px] font-mono bg-emerald-700 hover:bg-emerald-600 text-white"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              RUNNING STEP {currentStep + 1}/{steps.length}
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1" />
              RUN SEQUENCE
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={clearAll}
          disabled={steps.length === 0 || isRunning}
          className="h-7 px-3 border-slate-700 text-slate-400 hover:text-white"
        >
          <Square className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};
