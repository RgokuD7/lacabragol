import React, { useState, useEffect } from 'react';
import { X, Sparkles, TrendingUp, Target, ArrowRight, CheckCircle2, ChevronRight, Trophy } from 'lucide-react';
import { vibratePop, vibrateTap } from '../lib/haptics';
import { cn } from '../lib/utils';

interface NewFeaturesModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onNavigateTab: (tab: 'predictions' | 'ranking') => void;
  forceShow?: boolean;
  disabled?: boolean;
}

const STORAGE_KEY = 'hasSeenNewFeatures_v0535';

export function NewFeaturesModal({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  onNavigateTab,
  forceShow = false,
  disabled = false
}: NewFeaturesModalProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleCustomShow = () => {
      setIsOpen(true);
    };
    window.addEventListener('show-new-features', handleCustomShow);
    return () => window.removeEventListener('show-new-features', handleCustomShow);
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      return;
    }

    if (controlledIsOpen !== undefined) {
      setIsOpen(controlledIsOpen);
      return;
    }

    if (forceShow) {
      setIsOpen(true);
      return;
    }

    // Auto-check localStorage on mount
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [controlledIsOpen, forceShow, disabled]);

  const handleDismiss = () => {
    vibratePop();
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    if (controlledOnClose) {
      controlledOnClose();
    }
  };

  const handleGoToFeature = (tab: 'predictions' | 'ranking') => {
    vibrateTap();
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    if (controlledOnClose) {
      controlledOnClose();
    }
    onNavigateTab(tab);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={handleDismiss}
      />

      {/* Modal Dialog Box */}
      <div 
        className="relative bg-gradient-to-b from-[#181822] to-[#101015] border border-zinc-700/80 w-full max-w-md mx-auto rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] transition-all"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar */}
        <div className="relative flex items-center justify-between px-5 pt-4 pb-2 z-10">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[10px] font-black uppercase tracking-wider shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>Nuevas Funciones 🐐</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            onTouchStart={() => vibratePop()}
            className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-400 hover:text-white transition-all cursor-pointer border border-zinc-700/60 flex items-center justify-center shrink-0 active:scale-95"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-5 py-3 overflow-y-auto space-y-4 relative z-10">
          {/* Main Title & Pitch */}
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              ¡Tu experiencia ahora es más inteligente!
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Agregamos 2 nuevas funcionalidades para que tomes mejores decisiones al apostar y analices a tus rivales del grupo:
            </p>
          </div>

          {/* FEATURE 1 CARD */}
          <div className="bg-[#13131a] border border-zinc-800 hover:border-blue-500/50 rounded-2xl p-4 transition-all space-y-2.5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400 shadow-inner">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                  En Partidos y Pronósticos
                </span>
                <h4 className="text-sm font-black text-white leading-snug">
                  Historial y Previa de Equipos
                </h4>
              </div>
            </div>

            <p className="text-[11.5px] text-zinc-300 leading-snug">
              Al ingresar tus goles verás inmediatamente la <strong>posición en la tabla</strong>, <strong>racha reciente con círculos de colores</strong> (<span className="text-emerald-400 font-bold">🟢 V</span> <span className="text-amber-400 font-bold">🟡 E</span> <span className="text-rose-400 font-bold">🔴 D</span>) y sus <strong>últimos resultados con los escudos de los rivales</strong>.
            </p>

            <button
              type="button"
              onClick={() => handleGoToFeature('predictions')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-xs transition-colors cursor-pointer active:scale-98"
            >
              <span className="flex items-center gap-1.5">
                <span>Probar en Pronósticos</span>
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* FEATURE 2 CARD */}
          <div className="bg-[#13131a] border border-zinc-800 hover:border-purple-500/50 rounded-2xl p-4 transition-all space-y-2.5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400 shadow-inner">
                <Target className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                  En la Tabla de Posiciones
                </span>
                <h4 className="text-sm font-black text-white leading-snug">
                  Historial de Apuestas de Rivales
                </h4>
              </div>
            </div>

            <p className="text-[11.5px] text-zinc-300 leading-snug">
              Toca a cualquier usuario en la tabla de <strong>Ranking</strong> para ver cómo le ha ido: cuántos <strong>Plenos 🎯</strong> acertó, aciertos de ganador ⚽, fallos ❌ y su <strong>porcentaje de efectividad</strong> con los marcadores reales.
            </p>

            <button
              type="button"
              onClick={() => handleGoToFeature('ranking')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold text-xs transition-colors cursor-pointer active:scale-98"
            >
              <span className="flex items-center gap-1.5">
                <span>Ver en Ranking</span>
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom CTA Action Bar */}
        <div className="p-4 border-t border-zinc-800/80 bg-[#0e0e13] flex flex-col gap-2 relative z-10">
          <button
            type="button"
            onClick={handleDismiss}
            onTouchStart={() => vibratePop()}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <span>¡Entendido, vamos a probarlas!</span>
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
