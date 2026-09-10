import React from 'react';
import EmojiPickerReact, { Theme, EmojiStyle, EmojiClickData } from 'emoji-picker-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const QUICK_POPULAR = ['🔥', '🐐', '⚽', '🎯', '🤡', '😂', '👏', '🥶', '👀', '💪'];

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
    onClose();
  };

  return (
    <div className="flex flex-col w-full max-w-full overflow-hidden rounded-2xl bg-[#111114] p-2 space-y-2">
      {/* Quick Picks Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-none border-b border-zinc-800/80">
        <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0 select-none mr-1">Rápidos:</span>
        {QUICK_POPULAR.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-zinc-800 rounded-lg transition-transform active:scale-90 shrink-0 select-none cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Professional Emoji Picker Component */}
      <div className="w-full flex justify-center emoji-picker-wrapper [&_.EmojiPickerReact]:!border-0 [&_.EmojiPickerReact]:!bg-transparent [&_.EmojiPickerReact]:!font-sans">
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          theme={Theme.DARK}
          emojiStyle={EmojiStyle.APPLE}
          width="100%"
          height={360}
          searchPlaceHolder="Buscar emoji..."
          previewConfig={{
            showPreview: false
          }}
          lazyLoadEmojis={true}
        />
      </div>
    </div>
  );
}
