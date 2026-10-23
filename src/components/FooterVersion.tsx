import React from 'react';

interface FooterVersionProps {
  className?: string;
}

export function FooterVersion({ className = '' }: FooterVersionProps) {
  const handleForceReload = async () => {
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
    } catch (e) {
      console.warn('Error clearing caches:', e);
    } finally {
      window.location.reload();
    }
  };

  return (
    <footer 
      onClick={handleForceReload}
      className={`w-full py-3 text-center text-[10px] sm:text-[11px] text-zinc-500/70 select-none tracking-wide font-mono cursor-pointer hover:text-zinc-400 active:scale-95 transition-all ${className}`}
      title="Toca para forzar actualización de la app y limpiar caché"
    >
      LaCabraGol - by Richard Bouryssieres - v0.5.45
    </footer>
  );
}
