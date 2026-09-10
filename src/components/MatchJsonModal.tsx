import React, { useState, useEffect } from 'react';
import { Match, Setting } from '../types';
import { BaseBottomSheet } from './BaseBottomSheet';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { syncMatchPredictionsAndPoints } from '../lib/sync';
import { vibrateSuccess, vibrateError, vibrateTap } from '../lib/haptics';
import { 
  FileCode, 
  Save, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  RotateCcw, 
  Loader2, 
  ClipboardPaste 
} from 'lucide-react';

interface MatchJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  settings?: Setting | null;
  onSuccess?: () => void;
}

export function MatchJsonModal({
  isOpen,
  onClose,
  match,
  settings = null,
  onSuccess
}: MatchJsonModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate reference template based on the current match
  const generateTemplate = (m: Match) => {
    const estadoStr = m.status === 'finished' 
      ? 'Finalizado' 
      : m.status === 'in_progress' 
        ? 'En Vivo' 
        : 'Programado';

    const existingGoals = (m as any).goles || m.goalscorers || [];
    const existingCards = (m as any).tarjetas || m.cards || [];
    const existingLesiones = (m as any).lesiones || [];

    const templateObj = {
      partido: `${m.homeTeam} vs ${m.awayTeam}`,
      estado: estadoStr,
      marcador: {
        local: m.homeScore ?? (m.status === 'finished' || m.status === 'in_progress' ? 0 : 0),
        visitante: m.awayScore ?? (m.status === 'finished' || m.status === 'in_progress' ? 0 : 0)
      },
      goles: existingGoals.length > 0 ? existingGoals : [
        {
          minuto: 24,
          jugador: "Nombre Goleador",
          asistencia: null,
          tipo: "jugada",
          equipo: m.homeTeam
        }
      ],
      tarjetas: existingCards.length > 0 ? existingCards : [
        {
          minuto: 75,
          jugador: "Nombre Amonestado",
          tipo: "Amarilla",
          equipo: m.awayTeam
        }
      ],
      lesiones: existingLesiones.length > 0 ? existingLesiones : []
    };

    return JSON.stringify(templateObj, null, 2);
  };

  useEffect(() => {
    if (isOpen && match) {
      setError(null);
      setSuccessMsg(null);
      setJsonText(generateTemplate(match));
    }
  }, [isOpen, match]);

  if (!match) return null;

  const handlePasteClipboard = async () => {
    vibrateTap();
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setJsonText(text);
          setError(null);
        }
      }
    } catch (err) {
      console.warn('[MatchJsonModal] No se pudo leer del portapapeles:', err);
    }
  };

  const handleResetTemplate = () => {
    vibrateTap();
    setJsonText(generateTemplate(match));
    setError(null);
  };

  const handleProcessAndSave = async () => {
    vibrateTap();
    setError(null);
    setSuccessMsg(null);

    if (!jsonText.trim()) {
      setError('Por favor ingresa o pega el JSON con los datos del partido.');
      vibrateError();
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr: any) {
      setError(`Error de sintaxis JSON: ${parseErr.message || 'El formato JSON no es válido'}`);
      vibrateError();
      return;
    }

    // 1. Validar campos requeridos de la estructura de referencia obligatoria
    if (!parsed || typeof parsed !== 'object') {
      setError('El JSON debe contener un objeto raíz válido.');
      vibrateError();
      return;
    }

    if (!parsed.marcador || typeof parsed.marcador !== 'object') {
      setError('El JSON debe contener el objeto "marcador" con las propiedades "local" y "visitante".');
      vibrateError();
      return;
    }

    const homeScore = Number(parsed.marcador.local ?? 0);
    const awayScore = Number(parsed.marcador.visitante ?? 0);

    if (isNaN(homeScore) || isNaN(awayScore)) {
      setError('Los valores del marcador local y visitante deben ser números.');
      vibrateError();
      return;
    }

    // 2. Mapear estado
    const rawEstado = String(parsed.estado || '').toLowerCase().trim();
    let status: 'pending' | 'in_progress' | 'finished' = 'finished';

    if (rawEstado.includes('vivo') || rawEstado.includes('curso') || rawEstado.includes('live')) {
      status = 'in_progress';
    } else if (rawEstado.includes('prog') || rawEstado.includes('pend') || rawEstado.includes('abierto')) {
      status = 'pending';
    } else {
      status = 'finished';
    }

    // Normalizar arrays
    const cleanGoles = Array.isArray(parsed.goles) ? parsed.goles : [];
    const cleanTarjetas = Array.isArray(parsed.tarjetas) ? parsed.tarjetas : [];
    const cleanLesiones = Array.isArray(parsed.lesiones) ? parsed.lesiones : [];

    setIsProcessing(true);

    try {
      // 3. Preparar payload para updateDoc en Firestore sin sobreescribir metadatos críticos
      const updatePayload: Record<string, any> = {
        estado: parsed.estado || (status === 'finished' ? 'Finalizado' : status === 'in_progress' ? 'En Vivo' : 'Programado'),
        status,
        homeScore,
        awayScore,
        marcador: {
          local: homeScore,
          visitante: awayScore
        },
        goles: cleanGoles,
        goalscorers: cleanGoles, // Mapeo de compatibilidad para el timeline
        tarjetas: cleanTarjetas,
        cards: cleanTarjetas, // Mapeo de compatibilidad para el timeline
        lesiones: cleanLesiones,
        is_synced: status === 'finished',
        is_updating: false,
        updatedAt: Date.now()
      };

      const matchRef = doc(db, 'matches', match.id);
      await updateDoc(matchRef, updatePayload);

      // 4. Si el partido finalizó o está en curso, recalcular puntos de pronósticos
      if (status === 'finished' || status === 'in_progress') {
        try {
          await syncMatchPredictionsAndPoints(match.id, homeScore, awayScore, settings);
        } catch (syncErr) {
          console.warn('[MatchJsonModal] Aviso al sincronizar pronósticos:', syncErr);
        }
      }

      vibrateSuccess();
      setSuccessMsg('¡Datos del partido actualizados y guardados exitosamente!');
      
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (saveErr: any) {
      console.error('[MatchJsonModal] Error guardando en Firestore:', saveErr);
      setError(`Error al guardar en Firestore: ${saveErr.message || 'Error desconocido'}`);
      vibrateError();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Inyección Manual de Datos (Admin)"
      zIndexClassName="z-[1100]"
      contentClassName="p-4"
    >
      <div className="space-y-4 pb-20 max-h-[82vh] overflow-y-auto px-0.5">
        
        {/* Match Header Info */}
        <div className="bg-[#18181b] border border-zinc-800/80 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block mb-0.5">
              Partido Seleccionado · {match.group || 'Fase de Liga'}
            </span>
            <h3 className="text-sm sm:text-base font-black text-white truncate">
              {match.homeTeam} <span className="text-zinc-500 font-normal">vs</span> {match.awayTeam}
            </h3>
          </div>
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
            match.status === 'finished'
              ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
              : match.status === 'in_progress'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {match.status === 'finished' ? 'Finalizado' : match.status === 'in_progress' ? 'En Vivo' : 'Programado'}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>Editor JSON Estructurado:</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="py-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-bold rounded-lg border border-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
              title="Pegar desde el portapapeles"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Pegar</span>
            </button>

            <button
              type="button"
              onClick={handleResetTemplate}
              className="py-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-bold rounded-lg border border-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
              title="Restablecer plantilla inicial"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Plantilla</span>
            </button>
          </div>
        </div>

        {/* Textarea for JSON injection */}
        <div className="relative">
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              if (error) setError(null);
            }}
            placeholder='Pega aquí tu JSON con la estructura: partido, estado, marcador, goles, tarjetas, lesiones...'
            rows={14}
            spellCheck={false}
            className="w-full bg-[#0d0d10] border border-zinc-800 rounded-2xl p-3.5 font-mono text-xs text-emerald-300 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none transition-colors leading-relaxed selection:bg-blue-500/30 selection:text-white resize-y"
          />
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 font-medium flex items-start gap-2 animate-in fade-in duration-150">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="flex-1 whitespace-pre-wrap">{error}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-in zoom-in-95 duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleProcessAndSave}
            className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isProcessing ? 'Procesando y Guardando...' : 'Procesar y Guardar'}</span>
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="w-full sm:w-auto py-3 px-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>

      </div>
    </BaseBottomSheet>
  );
}
