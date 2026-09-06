import React from 'react';

const EMOJIS = ['🤡', '🥶', '💨', '🐢', '🚑', '🐐', '🎯', '🔥', '👑', '⚽', '😂', '🤬', '🤯', '🤑', '👀'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-2 p-4 min-w-[300px]">
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-12 h-12 flex items-center justify-center text-3xl hover:bg-zinc-800 rounded-2xl transition-transform active:scale-90"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
