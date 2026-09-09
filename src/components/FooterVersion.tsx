import React from 'react';

interface FooterVersionProps {
  className?: string;
}

export function FooterVersion({ className = '' }: FooterVersionProps) {
  return (
    <footer className={`w-full py-3 text-center text-[10px] sm:text-[11px] text-zinc-500/70 select-none tracking-wide font-mono ${className}`}>
      LaCabraGol - by Richard Bouryssieres - v0.3.1
    </footer>
  );
}
