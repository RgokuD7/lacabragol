import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

export interface StageInfo {
  id: number;
  short: string;
  full: string;
  count: number;
}

interface AppleSportsRangeScrubberProps {
  stages: StageInfo[];
  startIdx: number;
  endIdx: number;
  onChange: (start: number, end: number) => void;
}

export const AppleSportsRangeScrubber: React.FC<AppleSportsRangeScrubberProps> = ({
  stages,
  startIdx,
  endIdx,
  onChange,
}) => {
  const totalStages = stages.length;
  const barRef = useRef<HTMLDivElement>(null);

  // Drag tracking state
  // dragMode: null | 'body' (move window) | 'left' (resize left edge) | 'right' (resize right edge)
  const [dragMode, setDragMode] = useState<'body' | 'left' | 'right' | null>(null);
  const dragStartRef = useRef<{ clientX: number; initialStart: number; initialEnd: number }>({
    clientX: 0,
    initialStart: 0,
    initialEnd: 0,
  });

  const getIdxFromClientX = useCallback(
    (clientX: number): number => {
      if (!barRef.current) return 0;
      const rect = barRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const ratio = relativeX / rect.width;
      const idx = Math.floor(ratio * totalStages);
      return Math.max(0, Math.min(totalStages - 1, idx));
    },
    [totalStages]
  );

  // Start dragging
  const handlePointerDown = (
    e: React.PointerEvent,
    mode: 'body' | 'left' | 'right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setDragMode(mode);
    dragStartRef.current = {
      clientX: e.clientX,
      initialStart: startIdx,
      initialEnd: endIdx,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragMode || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const stageWidth = rect.width / totalStages;
    const deltaX = e.clientX - dragStartRef.current.clientX;
    const deltaStages = Math.round(deltaX / stageWidth);

    const { initialStart, initialEnd } = dragStartRef.current;
    const windowSpan = initialEnd - initialStart;

    if (dragMode === 'body') {
      let newStart = initialStart + deltaStages;
      let newEnd = newStart + windowSpan;

      if (newStart < 0) {
        newStart = 0;
        newEnd = newStart + windowSpan;
      }
      if (newEnd > totalStages - 1) {
        newEnd = totalStages - 1;
        newStart = newEnd - windowSpan;
      }

      if (newStart !== startIdx || newEnd !== endIdx) {
        onChange(newStart, newEnd);
      }
    } else if (dragMode === 'left') {
      let newStart = initialStart + deltaStages;
      newStart = Math.max(0, Math.min(initialEnd, newStart));
      if (newStart !== startIdx) {
        onChange(newStart, endIdx);
      }
    } else if (dragMode === 'right') {
      let newEnd = initialEnd + deltaStages;
      newEnd = Math.max(initialStart, Math.min(totalStages - 1, newEnd));
      if (newEnd !== endIdx) {
        onChange(startIdx, newEnd);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragMode) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setDragMode(null);
    }
  };

  // Direct click on column track to jump/set window
  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragMode) return;
    const clickedIdx = getIdxFromClientX(e.clientX);
    if (clickedIdx < startIdx) {
      onChange(clickedIdx, endIdx);
    } else if (clickedIdx > endIdx) {
      onChange(startIdx, clickedIdx);
    } else {
      if (startIdx === clickedIdx && endIdx === clickedIdx) {
        onChange(0, totalStages - 1);
      } else {
        onChange(clickedIdx, clickedIdx);
      }
    }
  };

  const leftPercent = (startIdx / totalStages) * 100;
  const widthPercent = ((endIdx - startIdx + 1) / totalStages) * 100;

  // Glyph lines for match representations
  const renderGlyph = (stage: StageInfo, isSelected: boolean) => {
    if (stage.id === 4) {
      return (
        <div className="flex items-center justify-center h-full">
          <Trophy
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
              isSelected
                ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)] scale-110'
                : 'text-blue-300/40'
            }`}
          />
        </div>
      );
    }

    const lines = Array.from({ length: stage.count });
    return (
      <div className="flex flex-col items-center justify-center gap-[1.5px] h-full w-5 sm:w-6 mx-auto py-1">
        {lines.map((_, i) => (
          <div
            key={i}
            className={`w-full rounded-full transition-colors ${
              stage.count <= 2 ? 'h-[2px]' : stage.count <= 4 ? 'h-[1.5px]' : 'h-[1px]'
            } ${isSelected ? 'bg-white shadow-[0_0_3px_rgba(255,255,255,0.9)]' : 'bg-zinc-600'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full select-none">
      {/* Stage Labels Row */}
      <div className="grid grid-cols-5 text-center mb-1.5 px-0.5 text-[11px] sm:text-xs font-semibold tracking-tight">
        {stages.map((stage) => {
          const isSelected = stage.id >= startIdx && stage.id <= endIdx;
          return (
            <button
              key={stage.id}
              onClick={() => {
                if (startIdx === stage.id && endIdx === stage.id) {
                  onChange(0, totalStages - 1);
                } else {
                  onChange(stage.id, stage.id);
                }
              }}
              className={`transition-colors cursor-pointer text-center truncate py-0.5 ${
                isSelected ? 'text-white font-black scale-105' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {stage.short}
            </button>
          );
        })}
      </div>

      {/* Main Scrubber Capsule Bar */}
      <div
        ref={barRef}
        onClick={handleTrackClick}
        className="relative h-10 sm:h-11 bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden shadow-inner flex items-center cursor-pointer touch-none"
      >
        {/* 5 Column Glyphs Background */}
        <div className="absolute inset-0 grid grid-cols-5 w-full h-full z-0 pointer-events-none">
          {stages.map((stage) => {
            const isSelected = stage.id >= startIdx && stage.id <= endIdx;
            return (
              <div
                key={stage.id}
                className="h-full flex items-center justify-center border-r border-zinc-800/80 last:border-r-0"
              >
                {renderGlyph(stage, isSelected)}
              </div>
            );
          })}
        </div>

        {/* Draggable Active Capsule Window (Pure Crisp White Apple Sports Capsule) */}
        <div
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
          }}
          onPointerDown={(e) => handlePointerDown(e, 'body')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute top-0.5 bottom-0.5 rounded-xl border-2 border-white bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.2)] flex items-center justify-between z-10 cursor-grab active:cursor-grabbing touch-none transition-all ${
            dragMode ? 'duration-0 scale-[0.99] border-white' : 'duration-150'
          }`}
        >
          {/* Left Handle Gripper (<) */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'left')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-4 sm:w-5 h-full bg-white text-zinc-900 rounded-l-[9px] flex items-center justify-center cursor-ew-resize active:scale-95 shadow-md shrink-0 touch-none"
            title="Arrastrar para ajustar inicio"
          >
            <ChevronLeft className="w-3 h-3 stroke-[3]" />
          </div>

          {/* Center drag hit area indicator */}
          <div className="flex-1 h-full flex items-center justify-center opacity-0 hover:opacity-40 transition-opacity">
            <div className="w-4 h-1 bg-white rounded-full" />
          </div>

          {/* Right Handle Gripper (>) */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'right')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-4 sm:w-5 h-full bg-white text-zinc-900 rounded-r-[9px] flex items-center justify-center cursor-ew-resize active:scale-95 shadow-md shrink-0 touch-none"
            title="Arrastrar para ajustar fin"
          >
            <ChevronRight className="w-3 h-3 stroke-[3]" />
          </div>
        </div>
      </div>
    </div>
  );
};
