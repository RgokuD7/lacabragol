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
  const [adjustedPos, setAdjustedPos] = useState(position);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const margin = 10;
      let newLeft = position.left;
      let newTop = position.top;
      
      // Calculate boundaries
      const isTooFarRight = (position.left + (rect.width / 2)) > (window.innerWidth - margin);
      const isTooFarLeft = (position.left - (rect.width / 2)) < margin;
      
      const isTooFarBottom = position.top > (window.innerHeight - margin);
      const isTooFarTop = (position.top - rect.height) < margin;

      if (isTooFarBottom) {
        newTop = window.innerHeight - margin;
      } else if (isTooFarTop) {
        newTop = rect.height + margin;
      }
      
      if (isTooFarRight) {
        newLeft = window.innerWidth - (rect.width / 2) - margin;
      } else if (isTooFarLeft) {
        newLeft = (rect.width / 2) + margin;
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
    <div 
      ref={ref}
      className="fixed z-[100] bg-[#1a1a1f] border border-zinc-700/80 rounded-2xl shadow-2xl p-2 flex flex-col gap-1.5 max-w-[95vw] sm:max-w-[360px] animate-in zoom-in-95 duration-150"
      style={{ top: adjustedPos.top, left: adjustedPos.left, transform: 'translate(-50%, -100%)', marginTop: '-10px' }}
    >
      {/* Emojis row forced to flex-row and scrollable if needed */}
      <div className="flex flex-row items-center gap-1 overflow-x-auto py-0.5 px-0.5 scrollbar-none">
        {QUICK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => {
              vibrateTap();
              onSelectEmoji(emoji);
              onClose();
            }}
            className="w-9 h-9 flex items-center justify-center text-xl hover:bg-zinc-800 rounded-full transition-transform active:scale-90 shrink-0 select-none"
          >
            {emoji}
          </button>
        ))}
        <button 
          onClick={() => {
            vibrateTap();
            onMoreEmojis();
            onClose();
          }}
          className="w-9 h-9 flex items-center justify-center text-xl hover:bg-zinc-800 rounded-full transition-transform active:scale-90 shrink-0 select-none"
          title="Más emojis"
        >
          ➕
        </button>
      </div>

      {/* Responder in dedicated row below emojis */}
      {onReply && (
        <button 
          onClick={() => {
            vibrateTap();
            onReply();
            onClose();
          }}
          className="w-full py-1.5 px-3 flex items-center justify-center gap-2 text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all active:scale-95 shrink-0"
        >
          <Reply className="w-3.5 h-3.5" />
          <span>Responder</span>
        </button>
      )}
    </div>
  );
}
