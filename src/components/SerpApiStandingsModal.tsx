import React, { useState } from 'react';
import { 
  Trophy, 
  X, 
  Check, 
  Copy, 
  Code2, 
  Loader2, 
  Table2,
  AlertCircle
} from 'lucide-react';
import { SerpApiStandingItem } from '../lib/serpapiSync';
import { TeamBadge } from './TeamBadge';
import { findUclTeam } from '../lib/standings';
import { vibrateTap, vibrateSuccess } from '../lib/haptics';

interface SerpApiStandingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabla: SerpApiStandingItem[];
  rawJson: string;
  onConfirm: () => Promise<void>;
  isSaving: boolean;
}

export function SerpApiStandingsModal({
  isOpen,
  onClose,
  tabla,
  rawJson,
  onConfirm,
  isSaving
}: SerpApiStandingsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    vibrateTap();
    navigator.clipboard.writeText(rawJson);
    setCopied(true);
    vibrateSuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#121215] border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800 bg-[#16161b] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Trophy className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Tabla de Posiciones (SerpAPI + Gemini)
                </h2>
                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded">
                  Auditoría Previa
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {tabla.length} equipos detectados en Google Search. Revisa antes de inyectar en Firestore.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-800/60 hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800">
          {/* SECCIÓN 1: VISTA PREVIA DE LA TABLA FORMATEADA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Table2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Posiciones Extraídas ({tabla.length} Clubes)</span>
              </h3>
              <span className="text-[10px] text-zinc-400 font-medium">
                UEFA Champions League
              </span>
            </div>

            {tabla.length === 0 ? (
              <div className="p-6 text-center bg-zinc-900/50 border border-zinc-800/80 rounded-xl text-zinc-400 space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto text-amber-400 opacity-80" />
                <p className="text-xs font-bold text-white">No se detectaron filas de tabla en la respuesta</p>
                <p className="text-[11px] text-zinc-500">Verifica el JSON devuelto abajo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#15151a]">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/60 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">Club</th>
                      <th className="py-2.5 px-2 text-center">PJ</th>
                      <th className="py-2.5 px-2 text-center">GF</th>
                      <th className="py-2.5 px-2 text-center">GC</th>
                      <th className="py-2.5 px-2 text-center">DG</th>
                      <th className="py-2.5 px-3 text-center font-black text-amber-400">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {tabla.map((item, idx) => {
                      const pos = item.posicion || idx + 1;
                      const uclTeam = findUclTeam(item.equipo);
                      const displayName = uclTeam ? uclTeam.name : item.equipo;
                      const isTop8 = pos <= 8;
                      const isPlayoffs = pos > 8 && pos <= 24;

                      return (
                        <tr 
                          key={idx} 
                          className="hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-2 px-3 text-center font-mono font-bold text-zinc-400">
                            <span className={`inline-block w-5 h-5 rounded text-center leading-5 text-[10px] font-black ${
                              isTop8 
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                : isPlayoffs 
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'text-zinc-500'
                            }`}>
                              {pos}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <TeamBadge teamName={displayName} size="sm" />
                              <span className="font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
                                {displayName}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-zinc-300">{item.partidos_jugados}</td>
                          <td className="py-2 px-2 text-center font-mono text-zinc-400">{item.goles_favor}</td>
                          <td className="py-2 px-2 text-center font-mono text-zinc-400">{item.goles_contra}</td>
                          <td className={`py-2 px-2 text-center font-mono font-bold ${
                            item.diferencia_goles > 0 
                              ? 'text-emerald-400' 
                              : item.diferencia_goles < 0 
                                ? 'text-rose-400' 
                                : 'text-zinc-400'
                          }`}>
                            {item.diferencia_goles > 0 ? `+${item.diferencia_goles}` : item.diferencia_goles}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-black text-amber-400 text-sm">
                            {item.puntos}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: AUDITORÍA RAW JSON */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Auditoría Raw JSON (Estructurado por Gemini)</span>
              </h3>
              <button
                onClick={handleCopy}
                className="text-[10px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
                title="Copiar JSON"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
              </button>
            </div>

            <div className="bg-black/90 border border-zinc-800 rounded-xl p-3 max-h-40 overflow-y-auto overflow-x-auto select-text scrollbar-thin scrollbar-thumb-zinc-800">
              <pre className="font-mono text-[10.5px] leading-relaxed text-emerald-400 whitespace-pre">
                {rawJson || '// Sin datos JSON'}
              </pre>
            </div>
          </div>
        </div>

        {/* Acciones Inferiores */}
        <div className="px-4 py-3 bg-[#16161b] border-t border-zinc-800 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving || tabla.length === 0}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Inyectando en Firestore...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Confirmar y Aplicar Tabla a Firestore</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
