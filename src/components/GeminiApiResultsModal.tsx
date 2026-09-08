import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  Check, 
  Copy, 
  AlertCircle, 
  Loader2, 
  Code2, 
  CheckCircle2, 
  ShieldAlert,
  Flame,
  Clock
} from 'lucide-react';
import { GeminiPartidoPreview } from '../lib/geminiSync';
import { vibrateTap, vibrateSuccess } from '../lib/haptics';

interface GeminiApiResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  partidos: GeminiPartidoPreview[];
  rawJson: string;
  onConfirm: () => Promise<void>;
  isSaving: boolean;
  searchQueries?: string[];
  isGrounded?: boolean;
  searchSummary?: string;
}

export function GeminiApiResultsModal({
  isOpen,
  onClose,
  partidos,
  rawJson,
  onConfirm,
  isSaving,
  searchQueries = [],
  isGrounded = false,
  searchSummary = ''
}: GeminiApiResultsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    vibrateTap();
    navigator.clipboard.writeText(rawJson);
    setCopied(true);
    vibrateSuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (estado: string) => {
    const lower = estado.toLowerCase();
    if (lower.includes('final') || lower.includes('ft')) {
      return (
        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {estado}
        </span>
      );
    }
    if (lower.includes('vivo') || lower.includes("'") || lower.includes('descanso')) {
      return (
        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
          <Flame className="w-3 h-3 text-amber-400" />
          {estado}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {estado}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#121215] border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800 bg-[#16161b] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Resultados de Gemini IA
                </h2>
                <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded">
                  Auditoría Previa
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {partidos.length} partido(s) analizados. Revisa antes de aplicar a la base de datos.
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

        {/* Cuerpo con Scroll (Mitad Superior Visual, Mitad Inferior Raw JSON) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800">
          {/* SECCIÓN 1: MITAD SUPERIOR - VISTA PREVIA FORMATEADA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Marcadores Detectados</span>
                <span className="text-blue-400 text-[10px]">({partidos.length})</span>
              </h3>
              <span className="text-[10px] text-zinc-400 font-medium">
                Goles, Goleadores y Tarjetas
              </span>
            </div>

            {/* Google Search Grounding Status Banner */}
            {isGrounded ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                  <span className="text-sm">🌐</span>
                  <span>Búsqueda Web en Vivo Activada (Google Search Grounding)</span>
                </div>
                {searchQueries.length > 0 && (
                  <div className="text-[10px] text-zinc-400">
                    <span className="text-zinc-500">Consultas web: </span>
                    {searchQueries.map((q, i) => (
                      <span key={i} className="inline-block bg-zinc-800/80 text-zinc-300 px-1.5 py-0.2 rounded mr-1 mb-0.5 border border-zinc-700/60 font-mono">
                        "{q}"
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 flex items-center justify-between text-[11px] text-zinc-300">
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>Modo Inteligente Gemini (Conexión directa con Google AI)</span>
                </div>
                <span className="text-[9px] text-zinc-500 uppercase font-bold">API Conectada</span>
              </div>
            )}

            {partidos.length === 0 ? (
              <div className="p-6 text-center bg-zinc-900/50 border border-zinc-800/80 rounded-xl text-zinc-400 space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto text-amber-400 opacity-80" />
                <p className="text-xs font-bold text-white">No se detectaron partidos en la respuesta</p>
                <p className="text-[11px] text-zinc-500">Verifica la consulta o el JSON devuelto abajo.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {partidos.map((partido, index) => (
                  <div 
                    key={index}
                    className="bg-[#18181d] border border-zinc-800/90 rounded-xl p-3 shadow-md space-y-2.5 transition-all hover:border-zinc-700"
                  >
                    {/* Header del Partido: Local vs Visitante & Marcador */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          {/* Equipo Local */}
                          <div className="flex-1 text-right min-w-0">
                            <span className="font-black text-xs text-white truncate block">
                              {partido.local}
                            </span>
                          </div>

                          {/* Marcador Central */}
                          <div className="shrink-0 flex items-center gap-1.5 bg-[#101014] border border-zinc-700/80 px-2.5 py-1 rounded-lg">
                            <span className="text-sm font-black text-amber-400 font-mono">
                              {partido.goles_local}
                            </span>
                            <span className="text-xs text-zinc-600 font-bold">-</span>
                            <span className="text-sm font-black text-amber-400 font-mono">
                              {partido.goles_visitante}
                            </span>
                          </div>

                          {/* Equipo Visitante */}
                          <div className="flex-1 text-left min-w-0">
                            <span className="font-black text-xs text-white truncate block">
                              {partido.visitante}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Meta info: Estado y Vinculación */}
                    <div className="flex items-center justify-between text-[10px] gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(partido.estado)}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {partido.matchedMatchId ? (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                            ✓ Vinculado con BD
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                            ⚠ No emparejado en BD
                          </span>
                        )}
                        {partido.hasChanges && (
                          <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded">
                            Actualizará marcador
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Goleadores (si existen) */}
                    {partido.goleadores && partido.goleadores.length > 0 && (
                      <div className="bg-[#111114] border border-zinc-800/60 rounded-lg p-2 space-y-1">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                          <span>⚽ Goleadores:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {partido.goleadores.map((g, gi) => (
                            <span 
                              key={gi} 
                              className="text-[10px] bg-zinc-800/80 border border-zinc-700/80 text-zinc-200 px-2 py-0.5 rounded-md flex items-center gap-1"
                            >
                              <span>⚽</span>
                              <span className="font-bold text-white">{g.jugador}</span>
                              <span className="text-zinc-400 font-mono">{g.minuto}'</span>
                              {g.equipo && <span className="text-zinc-500 text-[9px]">({g.equipo})</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tarjetas (si existen) */}
                    {partido.tarjetas && partido.tarjetas.length > 0 && (
                      <div className="bg-[#111114] border border-zinc-800/60 rounded-lg p-2 space-y-1">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                          <span>Tarjetas:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {partido.tarjetas.map((t, ti) => {
                            const isRed = (t.tipo || '').toLowerCase().includes('roja');
                            return (
                              <span 
                                key={ti} 
                                className="text-[10px] bg-zinc-800/80 border border-zinc-700/80 text-zinc-200 px-2 py-0.5 rounded-md flex items-center gap-1"
                              >
                                <span>{isRed ? '🟥' : '🟨'}</span>
                                <span className="font-bold text-white">{t.jugador}</span>
                                <span className="text-zinc-400 font-mono">{t.minuto}'</span>
                                {t.equipo && <span className="text-zinc-500 text-[9px]">({t.equipo})</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: MITAD INFERIOR - AUDITORÍA RAW JSON CONSOLA & RESUMEN */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            {searchSummary && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-emerald-400 text-sm">🌐</span>
                    <span>Paso 1: Resumen de Búsqueda Web en Vivo</span>
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-mono">Google Search Grounding</span>
                </div>
                <div className="bg-[#0e0e11] border border-zinc-800 rounded-xl p-3 max-h-36 overflow-y-auto text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-text font-sans scrollbar-thin scrollbar-thumb-zinc-800">
                  {searchSummary}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Paso 2: Auditoría Raw JSON (Estructurado)</span>
              </h3>
              <button
                onClick={handleCopy}
                className="text-[10px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
                title="Copiar respuesta JSON"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
              </button>
            </div>

            <div className="bg-black/90 border border-zinc-800 rounded-xl p-3 max-h-48 overflow-y-auto overflow-x-auto select-text scrollbar-thin scrollbar-thumb-zinc-800">
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
            disabled={isSaving || partidos.length === 0}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Aplicando a la BD y Recalculando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Confirmar y Aplicar a la BD</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
