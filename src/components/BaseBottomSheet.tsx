import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface BaseBottomSheetProps {
  id?: string;
  closeButtonId?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BaseBottomSheet({ id, closeButtonId, isOpen, onClose, title, children }: BaseBottomSheetProps) {
  const [isRendered, setIsRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = 'hidden';
    } else {
      setTimeout(() => setIsRendered(false), 300);
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isRendered) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex flex-col justify-end transition-opacity duration-300",
      isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
    )}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Sheet Content */}
      <div 
        id={id}
        className={cn(
          "relative bg-[#111114] border-t border-zinc-800 w-full max-w-4xl mx-auto rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 max-h-[90vh]",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Drag handle area */}
        <div className="flex justify-center pt-3 pb-2 w-full" onClick={onClose}>
          <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
          <button 
            id={closeButtonId}
            onClick={onClose}
            className="p-1.5 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-zinc-800">
          {children}
        </div>
      </div>
    </div>
  );
}
