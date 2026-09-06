import React from 'react';

export function UserAvatar({ 
  src, 
  name, 
  size = 'md',
  className = ''
}: { 
  src?: string, 
  name: string, 
  size?: 'sm' | 'md' | 'lg' | 'xl',
  className?: string
}) {
  const sizes = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-2xl'
  };

  const getInitials = (name: string) => {
    return name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase() || '?';
  };

  return (
    <div className={`relative shrink-0 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center overflow-hidden ${sizes[size]} ${className}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-black text-zinc-500">{getInitials(name)}</span>
      )}
    </div>
  );
}
