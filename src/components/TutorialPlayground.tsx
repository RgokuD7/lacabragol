import React, { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Trophy, Users, MessageCircle, Reply, X, Sparkles } from 'lucide-react';
import { TeamBadge } from './TeamBadge';

interface TutorialPlaygroundProps {
  onFinish: () => void;
}

export function TutorialPlayground({ onFinish }: TutorialPlaygroundProps) {
  const finishedRef = useRef(false);

  const handleFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  };

  useEffect(() => {
    let driverInstance: any = null;

    const timer = setTimeout(() => {
      try {
        driverInstance = driver({
          showProgress: true,
          animate: true,
          allowClose: true,
          nextBtnText: 'Siguiente →',
          prevBtnText: '← Anterior',
          doneBtnText: '¡Entendido!',
          progressText: 'Paso {{current}} de {{total}}',
          onPopoverRender: (_popover) => {
            const ghostPopovers = document.querySelectorAll('.driver-popover:not(:last-child)');
            ghostPopovers.forEach(el => el.remove());
          },
          steps: [
            {
              element: '#tutorial-step-input',
              popover: {
                title: 'El Pronóstico',
                description: '¡Aquí haces tu magia! Ingresa tu pronóstico antes del cierre.',
                side: 'bottom',
                align: 'center',
              },
            },
            {
              element: '#tutorial-step-companion-btn',
              popover: {
                title: 'Anti-Copia y Compañeros',
                description: 'Cuando el partido empieza (En Juego), las apuestas se revelan. Aquí verás qué apostó tu grupo.',
                side: 'bottom',
                align: 'center',
              },
            },
            {
              element: '#tutorial-step-points-badge',
              popover: {
                title: 'Reacciones y Puntos',
                description: 'Mantén presionado un pronóstico para reaccionar. ¡Al finalizar, sumas 5 puntos si aciertas el resultado exacto!',
                side: 'top',
                align: 'center',
              },
            },
            {
              element: '#tutorial-step-reply-btn',
              popover: {
                title: 'Chat y Respuestas',
                description: 'Usa este botón para responder directamente, o mantén presionado un mensaje para reaccionar con emojis.',
                side: 'top',
                align: 'center',
              },
            },
          ],
          onDestroyStarted: () => {
            handleFinish();
            if (driverInstance) {
              try {
                driverInstance.destroy();
              } catch (e) {}
            }
          },
          onDestroyed: () => {
            handleFinish();
          },
        });

        driverInstance.drive();
      } catch (err) {
        console.error("Driver initialization error:", err);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (driverInstance) {
        try {
          driverInstance.destroy();
        } catch (e) {}
      }
      const ghostPopovers = document.querySelectorAll('.driver-popover, .driver-overlay');
      ghostPopovers.forEach(el => el.remove());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex flex-col items-center justify-start overflow-y-auto px-4 py-6 sm:py-10 animate-in fade-in duration-300">
      {/* Top Bar with Skip */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="text-xs font-black text-white uppercase tracking-wider">
            Tutorial Guiado
          </span>
        </div>
        <button
          onClick={handleFinish}
          className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 px-3 py-1.5 rounded-xl border border-zinc-700 transition-colors"
          title="Saltar Tutorial"
        >
          <X className="w-3.5 h-3.5" />
          Saltar
        </button>
      </div>

      {/* Mock Playground Container */}
      <div className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4">
        
        {/* Mock Match Card: Barcelona vs Real Madrid */}
        <div className="bg-[#18181c] border border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-800/80">
            <span>UEFA Champions League</span>
            <span className="text-amber-400 font-black">Cierra pronto</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            {/* Home: Barcelona */}
            <div className="flex flex-col items-center gap-1.5 flex-1 text-center">
              <TeamBadge
                teamName="Barcelona"
                src="https://img.sofascore.com/api/v1/team/2817/image"
                size="md"
              />
              <span className="text-xs font-black text-white">FC Barcelona</span>
            </div>

            {/* Prediction Input Container (Step 1 Target) */}
            <div
              id="tutorial-step-input"
              className="flex items-center justify-center gap-2.5 bg-zinc-900 border-2 border-blue-500/50 rounded-2xl px-4 py-2.5 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
            >
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-blue-400 uppercase">BAR</span>
                <span className="text-xl font-black text-white font-mono">2</span>
              </div>
              <span className="text-zinc-500 font-black text-lg">:</span>
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-blue-400 uppercase">RMA</span>
                <span className="text-xl font-black text-white font-mono">1</span>
              </div>
            </div>

            {/* Away: Real Madrid */}
            <div className="flex flex-col items-center gap-1.5 flex-1 text-center">
              <TeamBadge
                teamName="Real Madrid"
                src="https://img.sofascore.com/api/v1/team/2829/image"
                size="md"
              />
              <span className="text-xs font-black text-white">Real Madrid</span>
            </div>
          </div>

          {/* Mock Companion Button (Step 2 Target) */}
          <div className="pt-2">
            <button
              id="tutorial-step-companion-btn"
              type="button"
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl py-2.5 px-3.5 flex items-center justify-between text-xs font-bold text-zinc-200 shadow-sm"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Ver Pronósticos del Grupo
              </span>
              <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                2 pronósticos
              </span>
            </button>
          </div>
        </div>

        {/* Mock Companion Predictions List (Step 3 Target) */}
        <div className="bg-[#18181c] border border-zinc-800 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-black text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-800/80">
            <span>Pronósticos de Compañeros</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px]">
              <Trophy className="w-3 h-3" /> Final: 2 - 1
            </span>
          </div>

          {/* User 1: Carlos M. (+5 pts Pleno) */}
          <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
            <div className="flex items-center gap-2.5">
              <img
                src="https://ui-avatars.com/api/?name=Carlos+M&background=3b82f6&color=fff&size=64&bold=true"
                alt="Carlos M"
                className="w-8 h-8 rounded-full border border-zinc-700 object-cover"
              />
              <div>
                <span className="text-xs font-bold text-white block leading-tight">Carlos M.</span>
                <span className="text-[10px] text-zinc-400 font-mono">Pronóstico: 2 - 1</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs">🔥 🐐</span>
              <span
                id="tutorial-step-points-badge"
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black tracking-wider shadow-sm"
              >
                +5 pts Pleno
              </span>
            </div>
          </div>

          {/* User 2: Mateo G. (0 pts Fallo) */}
          <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-2.5 opacity-75">
            <div className="flex items-center gap-2.5">
              <img
                src="https://ui-avatars.com/api/?name=Mateo+G&background=71717a&color=fff&size=64&bold=true"
                alt="Mateo G"
                className="w-8 h-8 rounded-full border border-zinc-700 object-cover"
              />
              <div>
                <span className="text-xs font-bold text-zinc-300 block leading-tight">Mateo G.</span>
                <span className="text-[10px] text-zinc-500 font-mono">Pronóstico: 1 - 1</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-bold">
              0 pts Fallo
            </span>
          </div>
        </div>

        {/* Mock Chat Bubble (Step 4 Target) */}
        <div className="bg-[#18181c] border border-zinc-800 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-black text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-800/80">
            <span className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
              Chat del Grupo
            </span>
            <span className="text-[9px] text-emerald-400 font-bold uppercase">En vivo</span>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src="https://ui-avatars.com/api/?name=Carlos+M&background=3b82f6&color=fff&size=64&bold=true"
                  alt="Carlos"
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-xs font-bold text-blue-400">Carlos M.</span>
                <span className="text-[9px] text-zinc-500">21:45</span>
              </div>

              {/* Reply Button (Step 4 Target) */}
              <button
                id="tutorial-step-reply-btn"
                type="button"
                className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-zinc-700 transition-colors shadow-sm"
              >
                <Reply className="w-3.5 h-3.5 text-blue-400" />
                Responder
              </button>
            </div>

            <p className="text-xs text-zinc-200 pl-1 leading-relaxed">
              ¡Qué partidazo señores! ¿Vieron ese golazo al ángulo? ⚽🔥
            </p>

            <div className="flex items-center gap-1.5 pt-0.5 pl-1">
              <span className="inline-flex items-center gap-1 bg-zinc-800/80 border border-zinc-700/80 rounded-full px-2 py-0.5 text-[10px] text-zinc-300">
                ❤️ 2
              </span>
              <span className="inline-flex items-center gap-1 bg-zinc-800/80 border border-zinc-700/80 rounded-full px-2 py-0.5 text-[10px] text-zinc-300">
                🔥 3
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
