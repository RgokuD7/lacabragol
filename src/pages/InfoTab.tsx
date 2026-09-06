import React from 'react';
import { useSettings } from '../components/SettingsProvider';
import { Trophy, Clock, Award, BookOpen } from 'lucide-react';

export function InfoTab() {
  const { settings } = useSettings();

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4 font-sans text-[#e4e4e7] max-w-4xl mx-auto pb-[120px]">
      {/* Header Premium */}
      <div className="border-b border-zinc-800/80 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
            Manual del Juego
          </h1>
          <p className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-widest font-bold">
            Guía Oficial de Puntuación
          </p>
        </div>
      </div>
      
      {settings?.rulesText && (
        <div className="bg-gradient-to-br from-zinc-900/80 to-[#121215] border border-zinc-800 rounded-xl p-4 shadow-sm">
          <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-2">Reglas Especiales del Grupo</h3>
          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{settings.rulesText}</p>
        </div>
      )}

      {/* Sistema de Puntuación (Partidos) */}
      <div className="space-y-3 pt-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 border-b border-zinc-800 pb-2 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" />
          <span>Sistema de Puntuación (Partidos)</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-zinc-900 to-[#121215] border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl shadow-inner shadow-emerald-500/10">🎯</div>
              <div>
                <span className="block text-xs font-black text-white">Pleno / Exacto</span>
                <span className="block text-[10px] text-zinc-500">Aciertas el resultado exacto</span>
              </div>
            </div>
            <span className="text-xl font-black text-emerald-400 drop-shadow-md">+{settings?.pointsExactMatch ?? 3}</span>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-[#121215] border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl shadow-inner shadow-blue-500/10">⚽</div>
              <div>
                <span className="block text-xs font-black text-white">Ganador / Empate</span>
                <span className="block text-[10px] text-zinc-500">Aciertas la tendencia</span>
              </div>
            </div>
            <span className="text-xl font-black text-blue-400 drop-shadow-md">+{settings?.pointsWinnerTie ?? 1}</span>
          </div>
        </div>
      </div>

      {/* Premios a Largo Plazo */}
      <div className="space-y-3 pt-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400 border-b border-zinc-800 pb-2 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" />
          <span>Premios a Largo Plazo</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-amber-500/10 to-[#121215] border border-amber-500/20 rounded-xl p-4 flex flex-col items-center text-center gap-2 shadow-sm">
            <div className="text-3xl drop-shadow-md">🏆</div>
            <div>
              <span className="block text-xs font-black text-amber-400 uppercase tracking-wide">Campeón</span>
              <span className="block text-[10px] text-amber-500/70 mt-0.5">Acertar al ganador del torneo</span>
            </div>
            <span className="text-2xl font-black text-amber-400 mt-1 drop-shadow-md">+{settings?.pointsChampion ?? 10}</span>
          </div>

          <div className="bg-gradient-to-br from-zinc-500/10 to-[#121215] border border-zinc-500/30 rounded-xl p-4 flex flex-col items-center text-center gap-2 shadow-sm">
            <div className="text-3xl drop-shadow-md">🥈</div>
            <div>
              <span className="block text-xs font-black text-zinc-300 uppercase tracking-wide">Subcampeón</span>
              <span className="block text-[10px] text-zinc-500 mt-0.5">Acertar al 2do lugar</span>
            </div>
            <span className="text-2xl font-black text-zinc-300 mt-1 drop-shadow-md">+{settings?.pointsRunnerUp ?? 5}</span>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-[#121215] border border-purple-500/20 rounded-xl p-4 flex flex-col items-center text-center gap-2 shadow-sm">
            <div className="text-3xl drop-shadow-md">🌟</div>
            <div>
              <span className="block text-xs font-black text-purple-400 uppercase tracking-wide">Especiales</span>
              <span className="block text-[10px] text-purple-500/70 mt-0.5">Goleador, MVP, etc.</span>
            </div>
            <span className="text-2xl font-black text-purple-400 mt-1 drop-shadow-md">+{settings?.pointsSpecial ?? 3}</span>
          </div>
        </div>
      </div>
      
      {/* Reglas Técnicas */}
      <div className="space-y-3 pt-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-400 border-b border-zinc-800 pb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Reglas Técnicas y Desempates</span>
        </h3>
        <div className="bg-[#121215] rounded-xl border border-zinc-800 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
             <div className="flex items-center gap-2">
               <span className="text-xl">⏳</span>
               <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Cierre de Pronósticos</span>
             </div>
             <span className="text-xs font-black text-white bg-zinc-800 px-2.5 py-1 rounded-md">{settings?.blockMinutesBeforeMatch ?? 15} minutos antes</span>
          </div>
          
          <ul className="text-[11px] text-zinc-400 space-y-3 list-disc pl-4 leading-relaxed">
            <li><strong>Tiempo Reglamentario (90 Minutos):</strong> Todos los pronósticos aplican <strong>únicamente para el tiempo regular de 90 minutos</strong>. Si un partido se va a Tiempos Extras (AET) o Penales (PEN), se ignorarán los goles anotados en esas instancias. El marcador válido será el del pitazo final del tiempo regular.</li>
            <li><strong>Criterios de Desempate:</strong> En caso de que dos o más usuarios terminen con la misma cantidad de puntos totales, la posición en el Ranking se decidirá favoreciendo al usuario con la mayor cantidad de <strong>Plenos (Marcadores Exactos)</strong> acertados.</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
