import { vibrateTap } from '../lib/haptics';
import React, { useRef, useEffect, useState } from 'react';
import { Reply, Plus } from 'lucide-react';

const QUICK_EMOJIS = ['🤡', '🐐', '🥶', '😂', '🔥', '🤬', '💩', '👀', '💯'];

interface ContextMenuProps {
  onSelectEmoji: (emoji: string) => void;
  onReply?: () => void;
  onMoreEmojis: () => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function ContextMenu({ onSelectEmoji, onReply, onMoreEmojis, onClose, position }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(() => ({
    top: Math.max(120, Math.min(position.top, typeof window !== 'undefined' ? window.innerHeight - 20 : 600)),
    left: Math.max(140, Math.min(position.left, typeof window !== 'undefined' ? window.innerWidth - 140 : 200))
  }));

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const margin = 12;
      const halfWidth = rect.width ? rect.width / 2 : 130;
      const height = rect.height || 110;

      let newLeft = Math.max(halfWidth + margin, Math.min(position.left, window.innerWidth - halfWidth - margin));
      let newTop = position.top;

      const isTooFarTop = (position.top - height - 10) < margin;
      const isTooFarBottom = position.top > (window.innerHeight - margin);

      if (isTooFarTop) {
        newTop = height + margin + 12;
      } else if (isTooFarBottom) {
        newTop = window.innerHeight - margin;
      }

      setAdjustedPos({ top: newTop, left: newLeft });
    }
  }, [position]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  return (
    <>
      {/* Semi-transparent backdrop to focus and dismiss on tap outside */}
      <div 
        className="fixed inset-0 z-[1190] bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-150 select-none"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div 
        ref={ref}
        className="fixed z-[1200] bg-[#1a1a1f] border border-zinc-700/80 rounded-2xl shadow-2xl p-2.5 flex flex-col gap-2 max-w-[95vw] w-fit animate-in zoom-in-95 duration-150 select-none"
        style={{ top: adjustedPos.top, left: adjustedPos.left, transform: 'translate(-50%, -100%)', marginTop: '-10px' }}
      >
        {/* Grid 2 rows x 5 columns: 5 emojis top, 4 emojis bottom + circular '+' in corner */}
        <div className="grid grid-cols-5 gap-2">
          {QUICK_EMOJIS.slice(0, 9).map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                vibrateTap();
                onSelectEmoji(emoji);
                onClose();
              }}
              className="w-10 h-10 flex items-center justify-center text-xl hover:bg-zinc-800 rounded-full transition-transform active:scale-90 select-none cursor-pointer"
            >
              {emoji}
            </button>
          ))}
          <button 
            type="button"
            onClick={() => {
              vibrateTap();
              onMoreEmojis();
              onClose();
            }}
            className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full border border-zinc-700/70 transition-transform active:scale-90 select-none cursor-pointer shadow-sm"
            title="Más emojis"
          >
            <Plus className="w-5 h-5 text-zinc-300" />
          </button>
        </div>

        {/* Responder in dedicated row below emojis */}
        {onReply && (
          <button 
            type="button"
            onClick={() => {
              vibrateTap();
              onReply();
              onClose();
            }}
            className="w-full py-1.5 px-3 flex items-center justify-center gap-2 text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Reply className="w-3.5 h-3.5" />
            <span>Responder</span>
          </button>
        )}
      </div>
    </>
  );
}
