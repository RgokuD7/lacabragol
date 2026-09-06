import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Instalar App"
        className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 text-blue-400 flex items-center justify-center transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Instalar en iOS"
          className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 text-blue-400 flex items-center justify-center transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-[#121215] border border-zinc-800 p-6 shadow-2xl relative animate-in zoom-in-95">
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-white mb-4">Instalar en iPhone / iPad</h3>
              <div className="text-sm text-zinc-300 space-y-4 font-medium">
                <p>1. Toca el botón <strong>Compartir</strong> <span className="inline-block bg-white/10 p-1 rounded align-middle"><svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></span> en la barra de Safari.</p>
                <p>2. Desliza hacia abajo y toca <strong>Agregar a Inicio</strong> <span className="inline-block bg-white/10 p-1 rounded align-middle"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg></span>.</p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white hover:bg-blue-500 transition-colors uppercase tracking-widest"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
