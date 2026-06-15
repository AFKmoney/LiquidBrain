'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAgiStore } from '@/lib/agi/store';
import { ConceptSummary } from '@/lib/agi/api';

export const MemoryMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [hoveredConcept, setHoveredConcept] = useState<ConceptSummary | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<ConceptSummary | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { memory, mostActiveNodes } = useAgiStore();
  const concepts = memory.concepts;

  // Use refs for animation loop values
  const conceptsRef = useRef(concepts);
  const mostActiveRef = useRef(mostActiveNodes);
  const hoveredRef = useRef(hoveredConcept);
  const selectedRef = useRef(selectedConcept);
  const dimsRef = useRef(dimensions);

  useEffect(() => { conceptsRef.current = concepts; }, [concepts]);
  useEffect(() => { mostActiveRef.current = mostActiveNodes; }, [mostActiveNodes]);
  useEffect(() => { hoveredRef.current = hoveredConcept; }, [hoveredConcept]);
  useEffect(() => { selectedRef.current = selectedConcept; }, [selectedConcept]);
  useEffect(() => { dimsRef.current = dimensions; }, [dimensions]);

  // Handle resize using container div
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Compute coordinate mapping (for mouse interaction)
  const getCoordMap = useCallback(() => {
    const currentConcepts = conceptsRef.current;
    const { width, height } = dimsRef.current;

    if (currentConcepts.length === 0) {
      return {
        mapX: (_re: number) => width / 2,
        mapY: (_im: number) => height / 2,
      };
    }

    let minRe = Infinity, maxRe = -Infinity;
    let minIm = Infinity, maxIm = -Infinity;
    for (const c of currentConcepts) {
      if (c.position_re < minRe) minRe = c.position_re;
      if (c.position_re > maxRe) maxRe = c.position_re;
      if (c.position_im < minIm) minIm = c.position_im;
      if (c.position_im > maxIm) maxIm = c.position_im;
    }

    const padRe = Math.max((maxRe - minRe) * 0.15, 0.3);
    const padIm = Math.max((maxIm - minIm) * 0.15, 0.3);
    minRe -= padRe;
    maxRe += padRe;
    minIm -= padIm;
    maxIm += padIm;

    const margin = 30;

    return {
      mapX: (re: number) =>
        margin + ((re - minRe) / (maxRe - minRe)) * (width - margin * 2),
      mapY: (im: number) =>
        margin + ((im - minIm) / (maxIm - minIm)) * (height - margin * 2),
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animRef.current = requestAnimationFrame(renderFrame);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      const { width, height } = dimsRef.current;
      if (width <= 0 || height <= 0) {
        animRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      timeRef.current += 0.016;
      const time = timeRef.current;
      const currentConcepts = conceptsRef.current;
      const activeNodes = mostActiveRef.current;
      const hovered = hoveredRef.current;
      const selected = selectedRef.current;

      // Background
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(0, 150, 200, 0.04)';
      ctx.lineWidth = 0.5;
      const gridStep = 30;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (currentConcepts.length === 0) {
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(0, 200, 255, 0.3)';
        ctx.textAlign = 'center';
        ctx.fillText('CONCEPT MEMORY', width / 2, 20);
        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(100, 150, 180, 0.3)';
        ctx.fillText('No concepts stored yet', width / 2, height / 2);
        ctx.fillText('Perceive input to create concepts', width / 2, height / 2 + 18);
        ctx.textAlign = 'start';
        animRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      // Compute bounds
      let minRe = Infinity, maxRe = -Infinity;
      let minIm = Infinity, maxIm = -Infinity;
      for (const c of currentConcepts) {
        if (c.position_re < minRe) minRe = c.position_re;
        if (c.position_re > maxRe) maxRe = c.position_re;
        if (c.position_im < minIm) minIm = c.position_im;
        if (c.position_im > maxIm) maxIm = c.position_im;
      }

      const padRe = Math.max((maxRe - minRe) * 0.15, 0.3);
      const padIm = Math.max((maxIm - minIm) * 0.15, 0.3);
      minRe -= padRe; maxRe += padRe;
      minIm -= padIm; maxIm += padIm;
      const margin = 30;

      const mapX = (re: number) =>
        margin + ((re - minRe) / (maxRe - minRe)) * (width - margin * 2);
      const mapY = (im: number) =>
        margin + ((im - minIm) / (maxIm - minIm)) * (height - margin * 2);

      // Draw connections
      for (let i = 0; i < currentConcepts.length; i++) {
        for (let j = i + 1; j < currentConcepts.length; j++) {
          const a = currentConcepts[i];
          const b = currentConcepts[j];
          const dist = Math.sqrt(
            (a.position_re - b.position_re) ** 2 +
            (a.position_im - b.position_im) ** 2
          );
          if (dist < 0.6) {
            const alpha = Math.max(0, 0.25 - dist * 0.35);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 180, 220, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(mapX(a.position_re), mapY(a.position_im));
            ctx.lineTo(mapX(b.position_re), mapY(b.position_im));
            ctx.stroke();
          }
        }
      }

      // Draw concepts
      for (const concept of currentConcepts) {
        const x = mapX(concept.position_re);
        const y = mapY(concept.position_im);
        const isActive = activeNodes.includes(concept.id);
        const isHovered = hovered?.id === concept.id;
        const isSelected = selected?.id === concept.id;

        const baseSize = 5 + concept.salience * 20;
        const pulse = Math.sin(time * 2.5 + concept.id * 1.1) * 0.15 + 1;
        const size = baseSize * pulse;

        const heatT = Math.min(concept.access_count / 15, 1);
        const r = Math.floor(30 + 225 * heatT);
        const g = Math.floor(180 - 80 * heatT);
        const b = Math.floor(220 - 170 * heatT);

        if (isActive) {
          const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
          glowGrad.addColorStop(0, 'rgba(255, 220, 80, 0.35)');
          glowGrad.addColorStop(0.5, 'rgba(255, 180, 40, 0.1)');
          glowGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(x, y, size * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, size + 5, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected
            ? 'rgba(255, 255, 255, 0.6)'
            : 'rgba(0, 220, 255, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(x, y, size + 1, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = isActive
          ? 'rgba(255, 255, 200, 0.9)'
          : 'rgba(220, 240, 255, 0.6)';
        ctx.fill();

        if (concept.label && (isHovered || isSelected || concept.salience > 0.5)) {
          ctx.font = '9px monospace';
          ctx.fillStyle = isHovered || isSelected
            ? 'rgba(255, 255, 255, 0.9)'
            : 'rgba(180, 210, 230, 0.5)';
          ctx.fillText(concept.label, x + size + 4, y + 3);
        }
      }

      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(0, 200, 255, 0.5)';
      ctx.textAlign = 'left';
      ctx.fillText(`CONCEPT MEMORY — ${currentConcepts.length} concepts`, 8, 16);

      animRef.current = requestAnimationFrame(renderFrame);
    };

    animRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Mouse handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const my = ((e.clientY - rect.top) / rect.height) * canvas.height;

    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    const { mapX, mapY } = getCoordMap();

    let closest: ConceptSummary | null = null;
    let minDist = 20;

    for (const c of concepts) {
      const cx = mapX(c.position_re);
      const cy = mapY(c.position_im);
      const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }

    setHoveredConcept(closest);
    canvas.style.cursor = closest ? 'pointer' : 'default';
  };

  const handleClick = () => {
    if (hoveredConcept) {
      setSelectedConcept(
        selectedConcept?.id === hoveredConcept.id ? null : hoveredConcept
      );
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-[#080c14] rounded-lg overflow-hidden border border-white/5"
      style={{ contain: 'strict' }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
        style={{ width: '100%', height: '100%' }}
        role="img"
        aria-label={`Memory map showing ${concepts.length} concepts`}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Tooltip */}
      {hoveredConcept && (
        <div
          className="absolute pointer-events-none bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl z-10"
          style={{
            left: Math.min(mousePos.x + 12, dimensions.width - 180),
            top: Math.min(mousePos.y - 60, dimensions.height - 100),
          }}
        >
          <div className="font-mono text-cyan-400 font-bold mb-1">
            {hoveredConcept.label || `Concept #${hoveredConcept.id}`}
          </div>
          <div className="text-slate-400">
            Position: ({hoveredConcept.position_re.toFixed(3)},{' '}
            {hoveredConcept.position_im.toFixed(3)}i)
          </div>
          <div className="text-slate-400">
            Salience: {hoveredConcept.salience.toFixed(3)}
          </div>
          <div className="text-slate-400">
            Access Count: {hoveredConcept.access_count}
          </div>
        </div>
      )}

      {/* Selected Concept Detail Panel */}
      {selectedConcept && (
        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/95 border border-cyan-900/50 rounded-lg p-3 text-xs z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-cyan-400 font-bold">
              {selectedConcept.label || `Concept #${selectedConcept.id}`}
            </span>
            <button
              onClick={() => setSelectedConcept(null)}
              className="text-slate-500 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 text-slate-400">
            <span>
              Re: {selectedConcept.position_re.toFixed(4)}
            </span>
            <span>
              Im: {selectedConcept.position_im.toFixed(4)}
            </span>
            <span>
              Salience: {selectedConcept.salience.toFixed(3)}
            </span>
            <span>
              Accessed: {selectedConcept.access_count}x
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
