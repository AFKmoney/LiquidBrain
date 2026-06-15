'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useAgiStore } from '@/lib/agi/store';

// Mandelbrot parameters
const MAX_ITER = 40;
const RE_START = -2.0;
const RE_END = 1.0;
const IM_START = -1.5;
const IM_END = 1.5;

// Cache the Mandelbrot background
let bgCacheKey = '';
let bgCacheData: ImageData | null = null;

function generateMandelbrot(width: number, height: number): ImageData {
  const cacheKey = `${width}x${height}`;
  if (bgCacheKey === cacheKey && bgCacheData) return bgCacheData;

  const imgData = new ImageData(width, height);
  const data = imgData.data;

  for (let px = 0; px < width; px++) {
    for (let py = 0; py < height; py++) {
      const c_re = RE_START + (px / width) * (RE_END - RE_START);
      const c_im = IM_START + (py / height) * (IM_END - IM_START);
      let x0 = 0,
        y0 = 0;
      let iter = 0;

      while (x0 * x0 + y0 * y0 <= 4 && iter < MAX_ITER) {
        const x_temp = x0 * x0 - y0 * y0 + c_re;
        y0 = 2 * x0 * y0 + c_im;
        x0 = x_temp;
        iter++;
      }

      const idx = (py * width + px) * 4;
      if (iter === MAX_ITER) {
        data[idx] = 5;
        data[idx + 1] = 5;
        data[idx + 2] = 15;
      } else {
        const t = iter / MAX_ITER;
        const r = Math.floor(10 + 30 * t);
        const g = Math.floor(5 + 20 * t * t);
        const b = Math.floor(40 + 100 * t);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      }
      data[idx + 3] = 255;
    }
  }

  bgCacheKey = cacheKey;
  bgCacheData = imgData;
  return imgData;
}

export const FractalSNN: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const { memory, mostActiveNodes, isOnline } = useAgiStore();
  const concepts = memory.concepts;

  // Use refs for values accessed in animation loop to avoid stale closures
  const conceptsRef = useRef(concepts);
  const mostActiveRef = useRef(mostActiveNodes);
  const isOnlineRef = useRef(isOnline);
  const dimsRef = useRef(dimensions);

  useEffect(() => { conceptsRef.current = concepts; }, [concepts]);
  useEffect(() => { mostActiveRef.current = mostActiveNodes; }, [mostActiveNodes]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { dimsRef.current = dimensions; }, [dimensions]);

  // Handle resize using the container div
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

      // Update canvas size
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      timeRef.current += 0.016;
      const time = timeRef.current;
      const currentConcepts = conceptsRef.current;
      const activeNodes = mostActiveRef.current;
      const online = isOnlineRef.current;

      // Draw Mandelbrot background
      const bg = generateMandelbrot(width, height);
      ctx.putImageData(bg, 0, 0);

      // Semi-transparent overlay for depth
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.03)';
      ctx.lineWidth = 0.5;
      const gridStep = 40;
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

      // Draw memory concepts on the complex plane
      if (currentConcepts.length > 0) {
        // Find bounds for auto-zoom
        let minRe = Infinity, maxRe = -Infinity;
        let minIm = Infinity, maxIm = -Infinity;
        for (const c of currentConcepts) {
          if (c.position_re < minRe) minRe = c.position_re;
          if (c.position_re > maxRe) maxRe = c.position_re;
          if (c.position_im < minIm) minIm = c.position_im;
          if (c.position_im > maxIm) maxIm = c.position_im;
        }

        // Add padding
        const padRe = Math.max((maxRe - minRe) * 0.2, 0.5);
        const padIm = Math.max((maxIm - minIm) * 0.2, 0.5);
        minRe -= padRe;
        maxRe += padRe;
        minIm -= padIm;
        maxIm += padIm;

        // Map concept position to screen
        const mapX = (re: number) =>
          ((re - minRe) / (maxRe - minRe)) * width;
        const mapY = (im: number) =>
          ((im - minIm) / (maxIm - minIm)) * height;

        // Draw connections between nearby concepts
        ctx.lineWidth = 0.8;
        for (let i = 0; i < currentConcepts.length; i++) {
          for (let j = i + 1; j < currentConcepts.length; j++) {
            const a = currentConcepts[i];
            const b = currentConcepts[j];
            const dist = Math.sqrt(
              (a.position_re - b.position_re) ** 2 +
              (a.position_im - b.position_im) ** 2
            );
            if (dist < 0.8) {
              const alpha = Math.max(0, 0.3 - dist * 0.3);
              const ax = mapX(a.position_re);
              const ay = mapY(a.position_im);
              const bx = mapX(b.position_re);
              const by = mapY(b.position_im);

              ctx.beginPath();
              ctx.strokeStyle = `rgba(0, 220, 255, ${alpha})`;
              ctx.moveTo(ax, ay);
              ctx.lineTo(bx, by);
              ctx.stroke();
            }
          }
        }

        // Draw concepts
        for (const concept of currentConcepts) {
          const x = mapX(concept.position_re);
          const y = mapY(concept.position_im);
          const isActive = activeNodes.includes(concept.id);
          const salienceSize = 4 + concept.salience * 12;
          const pulsePhase = Math.sin(time * 2 + concept.id * 0.7) * 0.3 + 0.7;

          // Glow for active nodes
          if (isActive) {
            const glowSize = salienceSize * 3;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
            gradient.addColorStop(0, `rgba(255, 200, 50, ${0.4 * pulsePhase})`);
            gradient.addColorStop(0.5, `rgba(255, 150, 30, ${0.15 * pulsePhase})`);
            gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - glowSize, y - glowSize, glowSize * 2, glowSize * 2);
          }

          // Outer ring pulse
          const ringPulse = Math.sin(time * 1.5 + concept.id) * 0.5 + 0.5;
          ctx.beginPath();
          ctx.arc(x, y, salienceSize + 2 + ringPulse * 3, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 200, 255, ${0.1 + ringPulse * 0.1})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();

          // Core dot
          ctx.beginPath();
          ctx.arc(x, y, salienceSize, 0, Math.PI * 2);
          const heatT = Math.min(concept.access_count / 20, 1);
          const r = Math.floor(50 + 205 * heatT);
          const g = Math.floor(200 - 100 * heatT);
          const b = Math.floor(255 - 200 * heatT);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.6 + pulsePhase * 0.3})`;
          ctx.fill();

          // Bright center
          ctx.beginPath();
          ctx.arc(x, y, salienceSize * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = isActive
            ? `rgba(255, 255, 200, ${0.8 * pulsePhase})`
            : `rgba(200, 240, 255, ${0.5 * pulsePhase})`;
          ctx.fill();

          // Label
          if (concept.label) {
            ctx.font = '10px monospace';
            ctx.fillStyle = `rgba(200, 230, 255, ${0.7 + pulsePhase * 0.2})`;
            ctx.fillText(concept.label, x + salienceSize + 4, y + 3);
          }
        }
      }

      // Overlay: status
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(0, 200, 255, 0.5)';
      ctx.fillText('FRACTAL SNN — MANDELBROT SPACE', 8, 16);
      ctx.fillText(`Concepts: ${currentConcepts.length}`, 8, 28);

      if (!online) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);
        ctx.font = '14px monospace';
        ctx.fillStyle = 'rgba(0, 200, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('AWAITING BRAIN CONNECTION...', width / 2, height / 2);
        ctx.textAlign = 'start';
      }

      animRef.current = requestAnimationFrame(renderFrame);
    };

    animRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-black rounded-lg overflow-hidden border border-white/5"
      style={{ contain: 'strict' }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
        style={{ width: '100%', height: '100%' }}
        role="img"
        aria-label={`Fractal SNN visualization with ${concepts.length} concepts`}
      />
    </div>
  );
};
