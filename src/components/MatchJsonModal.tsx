import React, { useState, useEffect } from 'react';
import { Match, Setting } from '../types';
import { BaseBottomSheet } from './BaseBottomSheet';
import { TeamBadge } from './TeamBadge';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { syncMatchPredictionsAndPoints } from '../lib/sync';
import { vibrateSuccess, vibrateError, vibrateTap } from '../lib/haptics';
import { 
  FileCode, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Loader2, 
  ClipboardPaste,
  Minus,
  Plus,
  Radio,
  Clock,
  CheckCircle,
  Sliders,
  Sparkles,
  RefreshCw,
  Search,
  Check
} from 'lucide-react';
import { fetchSingleMatchStatsWithGemini, areTeamsEquivalent } from '../lib/geminiSync';

interface MatchJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  settings?: Setting | null;
  initialMode?: 'manual' | 'json' | 'ai';
  onSuccess?: () => void;
}

// Helper para deducir el status de Firestore a partir del texto libre del estado (soporta dinámicos: "En Vivo 74'", "Entretiempo", "Programado", etc.)
export function deriveMatchStatus(rawEstado: any): 'pending' | 'in_progress' | 'finished' {
  if (!rawEstado) return 'pending';
  const s = String(rawEstado).toLowerCase().trim();

  // 1. Estados Finalizados explícitos
  if (
    s.includes('final') || 
    s.includes('termin') || 
    s.includes('concl') || 
    s === 'ft' || 
    s.startsWith('ft ') || 
    s.includes('ended') ||
    s.includes('completo')
  ) {
    return 'finished';
  }

  // 2. Estados Programados / Pendientes / No iniciados explícitos
  if (
    s.includes('prog') || 
    s.includes('no inici') || 
    s.includes('por jugar') || 
    s.includes('por com') || 
    s.includes('pend') || 
    s.includes('abierto') ||
    s.includes('schedul') ||
    s.includes('not started')
  ) {
    return 'pending';
  }

  // 3. Cualquier estado en curso: "Entretiempo", "Descanso", "En Vivo 74'", "En Vivo 45'", "1T 40'", "HT", etc.
  return 'in_progress';
}

export function MatchJsonModal({
  isOpen,
  onClose,
  match,
  settings = null,
  initialMode = 'manual',
  onSuccess
}: MatchJsonModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | 'json'>(initialMode);
  
  // JSON Mode State
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // AI Mode State
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);

  // Manual Mode State
  const [manualStatus, setManualStatus] = useState<'pending' | 'in_progress' | 'finished'>('finished');
  const [manualHomeScore, setManualHomeScore] = useState<number>(0);
  const [manualAwayScore, setManualAwayScore] = useState<number>(0);

  // Generate reference template based on the current match
  const generateTemplate = (m: Match) => {
    const estadoStr = m.estado || (
      m.status === 'finished' 
        ? 'Finalizado' 
        : m.status === 'in_progress' 
          ? 'En Vivo' 
          : 'Programado'
    );

    const existingGoals = (m as any).goles || m.goalscorers || [];
    const existingCards = (m as any).tarjetas || m.cards || [];
    const existingCambios = (m as any).cambios || (m as any).sustituciones || [];
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
      cambios: existingCambios.length > 0 ? existingCambios : [
        {
          minuto: 60,
          jugador_entra: "Jugador Que Entra",
          jugador_sale: "Jugador Que Sale",
          equipo: m.homeTeam
        }
      ],
      lesiones: existingLesiones.length > 0 ? existingLesiones : []
    };

    return JSON.stringify(templateObj, null, 2);
  };

  const handleAutoSearchGemini = async () => {
    if (!match) return;
    vibrateTap();
    setError(null);
    setSuccessMsg(null);
    setIsAiSearching(true);

    try {
      const res = await fetchSingleMatchStatsWithGemini(match);
      if (!res.success) {
        setError(res.message || 'No se pudieron obtener estadísticas de este partido.');
        vibrateError();
        return;
      }

      setAiSummary(res.searchSummary || null);
      if (res.jsonText) {
        setJsonText(res.jsonText);
      }
      if (res.matchData) {
        setParsedData(res.matchData);
      }
      vibrateSuccess();
    } catch (err: any) {
      console.error('[MatchJsonModal] Error en búsqueda IA:', err);
      setError(`Error al consultar con Gemini 3.8 Flash: ${err.message || 'Error de conexión'}`);
      vibrateError();
    } finally {
      setIsAiSearching(false);
    }
  };

  useEffect(() => {
    if (isOpen && match) {
      setError(null);
      setSuccessMsg(null);
      setActiveTab(initialMode || 'manual');
      setJsonText(generateTemplate(match));
      setParsedData(null);
      setAiSummary(null);

      setManualHomeScore(match.homeScore ?? 0);
      setManualAwayScore(match.awayScore ?? 0);
      setManualStatus(match.status || 'finished');

      if (initialMode === 'ai') {
        handleAutoSearchGemini();
      }
    }
  }, [isOpen, match, initialMode]);

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

  // Reasignar equipo de un gol en tiempo real (Local vs Visitante)
  const handleToggleGoalTeam = (goalIndex: number, targetSide: 'home' | 'away') => {
    vibrateTap();
    if (!parsedData || !Array.isArray(parsedData.goles)) return;
    const updatedGoles = [...parsedData.goles];
    const targetTeam = targetSide === 'home' ? match.homeTeam : match.awayTeam;
    updatedGoles[goalIndex] = {
      ...updatedGoles[goalIndex],
      equipo: targetTeam,
      is_home: targetSide === 'home'
    };
    const updatedData = { ...parsedData, goles: updatedGoles };
    setParsedData(updatedData);
    setJsonText(JSON.stringify(updatedData, null, 2));
  };

  // Reasignar equipo de una tarjeta en tiempo real (Local vs Visitante)
  const handleToggleCardTeam = (cardIndex: number, targetSide: 'home' | 'away') => {
    vibrateTap();
    if (!parsedData || !Array.isArray(parsedData.tarjetas)) return;
    const updatedTarjetas = [...parsedData.tarjetas];
    const targetTeam = targetSide === 'home' ? match.homeTeam : match.awayTeam;
    updatedTarjetas[cardIndex] = {
      ...updatedTarjetas[cardIndex],
      equipo: targetTeam,
      is_home: targetSide === 'home'
    };
    const updatedData = { ...parsedData, tarjetas: updatedTarjetas };
    setParsedData(updatedData);
    setJsonText(JSON.stringify(updatedData, null, 2));
  };

  // --- GUARDADO MANUAL DE RESULTADO ---
  const handleSaveManual = async () => {
    vibrateTap();
    setError(null);
    setSuccessMsg(null);

    const home = Number(manualHomeScore);
    const away = Number(manualAwayScore);

    if (isNaN(home) || home < 0 || isNaN(away) || away < 0) {
      setError('Los goles no pueden ser negativos ni contener valores inválidos.');
      vibrateError();
      return;
    }

    setIsProcessing(true);

    try {
      const estadoStr = manualStatus === 'finished' 
        ? 'Finalizado' 
        : manualStatus === 'in_progress' 
          ? 'En Vivo' 
          : 'Programado';

      const updatePayload: Record<string, any> = {
        estado: estadoStr,
        status: manualStatus,
        homeScore: home,
        awayScore: away,
        marcador: {
          local: home,
          visitante: away
        },
        is_synced: manualStatus === 'finished',
        is_updating: false,
        updatedAt: Date.now()
      };

      const matchRef = doc(db, 'matches', match.id);
      await updateDoc(matchRef, updatePayload);

      // Si el partido finalizó, recalcular puntos de pronósticos
      if (manualStatus === 'finished') {
        try {
          await syncMatchPredictionsAndPoints(match.id, home, away, settings);
        } catch (syncErr) {
          console.warn('[MatchJsonModal] Error sincronizando pronósticos en modo manual:', syncErr);
        }
      }

      vibrateSuccess();
      setSuccessMsg('¡Resultado y estado del partido actualizados correctamente!');
      
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (saveErr: any) {
      console.error('[MatchJsonModal] Error guardando manual:', saveErr);
      setError(`Error al guardar: ${saveErr.message || 'Error desconocido'}`);
      vibrateError();
    } finally {
      setIsProcessing(false);
    }
  };

  // --- GUARDADO DE RESULTADOS OBTENIDOS POR IA ---
  const handleSaveAiStats = async () => {
    if (!parsedData) return;
    vibrateTap();
    setError(null);
    setSuccessMsg(null);
    setIsProcessing(true);

    try {
      const rawEstado = parsedData.estado !== undefined && parsedData.estado !== null ? String(parsedData.estado).trim() : '';
      const status = deriveMatchStatus(rawEstado);
      const finalEstado = rawEstado || (status === 'finished' ? 'Finalizado' : status === 'in_progress' ? 'En Vivo' : 'Programado');

      const homeScore = Number(parsedData.marcador?.local ?? 0);
      const awayScore = Number(parsedData.marcador?.visitante ?? 0);

      const cleanGoles = (Array.isArray(parsedData.goles) ? parsedData.goles : []).map((g: any) => {
        const isHome = g.is_home !== undefined 
          ? Boolean(g.is_home) 
          : areTeamsEquivalent(g.equipo, match.homeTeam);
        return {
          minuto: Number(g.minuto ?? 0),
          jugador: String(g.jugador || 'Gol').trim(),
          asistencia: g.asistencia ? String(g.asistencia).trim() : (g.assist ? String(g.assist).trim() : null),
          tipo: String(g.tipo || 'jugada').trim(),
          equipo: isHome ? match.homeTeam : match.awayTeam,
          is_home: isHome
        };
      });

      const cleanTarjetas = (Array.isArray(parsedData.tarjetas) ? parsedData.tarjetas : []).map((t: any) => {
        const isHome = t.is_home !== undefined 
          ? Boolean(t.is_home) 
          : areTeamsEquivalent(t.equipo, match.homeTeam);
        return {
          minuto: Number(t.minuto ?? 0),
          jugador: String(t.jugador || 'Amonestado').trim(),
          tipo: String(t.tipo || 'Amarilla').trim(),
          equipo: isHome ? match.homeTeam : match.awayTeam,
          is_home: isHome
        };
      });

      const cleanCambios = (Array.isArray(parsedData.cambios) ? parsedData.cambios : []).map((c: any) => {
        const isHome = c.is_home !== undefined 
          ? Boolean(c.is_home) 
          : areTeamsEquivalent(c.equipo, match.homeTeam);
        return {
          minuto: Number(c.minuto ?? 0),
          jugador_entra: String(c.jugador_entra || '').trim(),
          jugador_sale: String(c.jugador_sale || '').trim(),
          equipo: isHome ? match.homeTeam : match.awayTeam,
          is_home: isHome
        };
      });

      const cleanLesiones = Array.isArray(parsedData.lesiones) ? parsedData.lesiones : [];

      const updatePayload: Record<string, any> = {
        estado: finalEstado,
        status,
        homeScore,
        awayScore,
        marcador: {
          local: homeScore,
          visitante: awayScore
        },
        goles: cleanGoles,
        goalscorers: cleanGoles,
        tarjetas: cleanTarjetas,
        cards: cleanTarjetas,
        cambios: cleanCambios,
        sustituciones: cleanCambios,
        lesiones: cleanLesiones,
        is_synced: status === 'finished',
        is_updating: false,
        updatedAt: Date.now()
      };

      const matchRef = doc(db, 'matches', match.id);
      await updateDoc(matchRef, updatePayload);

      if (status === 'finished') {
        try {
          await syncMatchPredictionsAndPoints(match.id, homeScore, awayScore, settings);
        } catch (syncErr) {
          console.warn('[MatchJsonModal] Aviso al sincronizar pronósticos:', syncErr);
        }
      }

      vibrateSuccess();
      setSuccessMsg('¡Estadísticas del partido guardadas exitosamente en la base de datos!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (saveErr: any) {
      console.error('[MatchJsonModal] Error guardando estadísticas IA:', saveErr);
      setError(`Error al guardar en Firestore: ${saveErr.message || 'Error desconocido'}`);
      vibrateError();
    } finally {
      setIsProcessing(false);
    }
  };

  // --- GUARDADO VIA JSON ESTRUCTURADO ---
  const handleProcessAndSaveJson = async () => {
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

    // 1. Validar campos requeridos y estructura general
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

    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
      setError('Los valores del marcador local y visitante deben ser números iguales o mayores a 0.');
      vibrateError();
      return;
    }

    // Validar listas opcionales
    if (parsed.goles !== undefined && !Array.isArray(parsed.goles)) {
      setError('El campo "goles" debe ser un array/lista válido.');
      vibrateError();
      return;
    }
    if (parsed.tarjetas !== undefined && !Array.isArray(parsed.tarjetas)) {
      setError('El campo "tarjetas" debe ser un array/lista válido.');
      vibrateError();
      return;
    }
    if (parsed.cambios !== undefined && !Array.isArray(parsed.cambios) && parsed.sustituciones !== undefined && !Array.isArray(parsed.sustituciones)) {
      setError('El campo "cambios" o "sustituciones" debe ser un array/lista válido.');
      vibrateError();
      return;
    }
    if (parsed.lesiones !== undefined && !Array.isArray(parsed.lesiones)) {
      setError('El campo "lesiones" debe ser un array/lista válido.');
      vibrateError();
      return;
    }

    // 2. Mapear estado dinámico exacto
    const rawEstado = parsed.estado !== undefined && parsed.estado !== null ? String(parsed.estado).trim() : '';
    const status = deriveMatchStatus(rawEstado);
    const finalEstado = rawEstado || (status === 'finished' ? 'Finalizado' : status === 'in_progress' ? 'En Vivo' : 'Programado');

    // Normalizar arrays con equivalencia estricta a match.homeTeam y match.awayTeam
    const cleanGoles = (Array.isArray(parsed.goles) ? parsed.goles : []).map((g: any) => {
      const rawTeam = String(g.equipo || '').trim();
      const isHome = areTeamsEquivalent(rawTeam, match.homeTeam) ? true :
                     areTeamsEquivalent(rawTeam, match.awayTeam) ? false :
                     (g.is_home ?? true);
      return {
        minuto: Number(g.minuto ?? 0),
        jugador: String(g.jugador || 'Gol').trim(),
        asistencia: g.asistencia ? String(g.asistencia).trim() : (g.assist ? String(g.assist).trim() : null),
        tipo: String(g.tipo || 'jugada').trim(),
        equipo: isHome ? match.homeTeam : match.awayTeam,
        is_home: isHome
      };
    });

    const cleanTarjetas = (Array.isArray(parsed.tarjetas) ? parsed.tarjetas : []).map((t: any) => {
      const rawTeam = String(t.equipo || '').trim();
      const isHome = areTeamsEquivalent(rawTeam, match.homeTeam) ? true :
                     areTeamsEquivalent(rawTeam, match.awayTeam) ? false :
                     (t.is_home ?? false);
      return {
        minuto: Number(t.minuto ?? 0),
        jugador: String(t.jugador || 'Amonestado').trim(),
        tipo: String(t.tipo || 'Amarilla').trim(),
        equipo: isHome ? match.homeTeam : match.awayTeam,
        is_home: isHome
      };
    });

    const rawCambios = Array.isArray(parsed.cambios) 
      ? parsed.cambios 
      : (Array.isArray(parsed.sustituciones) ? parsed.sustituciones : []);

    const cleanCambios = rawCambios.map((c: any) => {
      const rawTeam = String(c.equipo || '').trim();
      const isHome = areTeamsEquivalent(rawTeam, match.homeTeam) ? true :
                     areTeamsEquivalent(rawTeam, match.awayTeam) ? false :
                     (c.is_home ?? true);
      return {
        minuto: Number(c.minuto ?? 0),
        jugador_entra: String(c.jugador_entra || '').trim(),
        jugador_sale: String(c.jugador_sale || '').trim(),
        equipo: isHome ? match.homeTeam : match.awayTeam,
        is_home: isHome
      };
    });

    const cleanLesiones = Array.isArray(parsed.lesiones) ? parsed.lesiones : [];

    setIsProcessing(true);

    try {
      // 3. Preparar payload para updateDoc en Firestore con el estado dinámico exacto
      const updatePayload: Record<string, any> = {
        estado: finalEstado,
        status,
        homeScore,
        awayScore,
        marcador: {
          local: homeScore,
          visitante: awayScore
        },
        goles: cleanGoles,
        goalscorers: cleanGoles,
        tarjetas: cleanTarjetas,
        cards: cleanTarjetas,
        cambios: cleanCambios,
        sustituciones: cleanCambios,
        lesiones: cleanLesiones,
        is_synced: status === 'finished',
        is_updating: false,
        updatedAt: Date.now()
      };

      const matchRef = doc(db, 'matches', match.id);
      await updateDoc(matchRef, updatePayload);

      // 4. Si el partido finalizó, recalcular puntos de pronósticos
      if (status === 'finished') {
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
      title="Administrar Partido (Admin)"
      zIndexClassName="z-[1100]"
      contentClassName="p-4"
    >
      <div className="space-y-4 pb-20 max-h-[82vh] overflow-y-auto px-0.5">
        
        {/* Match Header Info */}
        <div className="bg-[#18181b] border border-zinc-800/80 rounded-2xl p-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block mb-0.5">
              {match.group || 'Fase de Liga'}
            </span>
            <h3 className="text-sm sm:text-base font-black text-white truncate">
              {match.homeTeam} <span className="text-zinc-500 font-normal">vs</span> {match.awayTeam}
            </h3>
          </div>
          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border shrink-0 ${
            match.status === 'finished'
              ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
              : (match.status === 'in_progress' || (match.estado && (match.estado.toLowerCase().includes('vivo') || /\d+['’]/.test(match.estado))))
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {match.estado || (match.status === 'finished' ? 'Finalizado' : match.status === 'in_progress' ? 'En Vivo' : 'Programado')}
          </span>
        </div>

        {/* Tab Selector: Manual vs Auto IA vs JSON */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              vibrateTap();
              setActiveTab('manual');
              setError(null);
            }}
            className={`py-2 px-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Manual</span>
          </button>

          <button
            type="button"
            onClick={() => {
              vibrateTap();
              setActiveTab('ai');
              setError(null);
              if (!parsedData && !isAiSearching) {
                handleAutoSearchGemini();
              }
            }}
            className={`py-2 px-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/30'
                : 'text-purple-300/80 hover:text-purple-200 hover:bg-purple-950/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">Auto IA</span>
          </button>

          <button
            type="button"
            onClick={() => {
              vibrateTap();
              setActiveTab('json');
              setError(null);
            }}
            className={`py-2 px-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Editor JSON</span>
          </button>
        </div>

        {/* MODO MANUAL */}
        {activeTab === 'manual' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Status Selection */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block mb-2">
                Estado del Encuentro
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    vibrateTap();
                    setManualStatus('pending');
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    manualStatus === 'pending'
                      ? 'bg-blue-500/15 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Programado</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    vibrateTap();
                    setManualStatus('in_progress');
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    manualStatus === 'in_progress'
                      ? 'bg-orange-500/15 border-orange-500 text-orange-300 ring-1 ring-orange-500/50'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  <span>En Vivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    vibrateTap();
                    setManualStatus('finished');
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    manualStatus === 'finished'
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Finalizado</span>
                </button>
              </div>
            </div>

            {/* Score Steppers */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block mb-2">
                Marcador Oficial
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Local */}
                <div className="bg-[#121215] border border-zinc-800/90 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <TeamBadge 
                    src={match.homeFlag} 
                    teamName={match.homeTeam} 
                    className="w-9 h-9 drop-shadow-md" 
                  />
                  <span className="text-xs font-bold text-zinc-200 text-center line-clamp-1">
                    {match.homeTeam}
                  </span>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        vibrateTap();
                        setManualHomeScore(prev => Math.max(0, prev - 1));
                      }}
                      className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white flex items-center justify-center text-lg font-bold border border-zinc-700 transition cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      min={0}
                      value={manualHomeScore}
                      onChange={(e) => setManualHomeScore(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-12 h-9 text-center bg-zinc-900 border border-zinc-700 rounded-xl text-lg font-black text-white focus:border-blue-500 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        vibrateTap();
                        setManualHomeScore(prev => prev + 1);
                      }}
                      className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white flex items-center justify-center text-lg font-bold border border-zinc-700 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Visitante */}
                <div className="bg-[#121215] border border-zinc-800/90 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <TeamBadge 
                    src={match.awayFlag} 
                    teamName={match.awayTeam} 
                    className="w-9 h-9 drop-shadow-md" 
                  />
                  <span className="text-xs font-bold text-zinc-200 text-center line-clamp-1">
                    {match.awayTeam}
                  </span>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        vibrateTap();
                        setManualAwayScore(prev => Math.max(0, prev - 1));
                      }}
                      className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white flex items-center justify-center text-lg font-bold border border-zinc-700 transition cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      min={0}
                      value={manualAwayScore}
                      onChange={(e) => setManualAwayScore(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-12 h-9 text-center bg-zinc-900 border border-zinc-700 rounded-xl text-lg font-black text-white focus:border-blue-500 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        vibrateTap();
                        setManualAwayScore(prev => prev + 1);
                      }}
                      className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white flex items-center justify-center text-lg font-bold border border-zinc-700 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
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

            {/* Manual Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSaveManual}
                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isProcessing ? 'Guardando...' : 'Guardar Marcador Manual'}</span>
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
        )}

        {/* MODO AUTO IA (GEMINI 3.8 FLASH) */}
        {activeTab === 'ai' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header / Info IA */}
            <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/20 text-purple-300 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Google Gemini 3.8 Flash</h4>
                  <p className="text-[10px] text-zinc-400">Búsqueda web en vivo de estadísticas y eventos</p>
                </div>
              </div>

              <button
                type="button"
                disabled={isAiSearching || isProcessing}
                onClick={handleAutoSearchGemini}
                className="py-1 px-2.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                title="Volver a buscar estadísticas"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAiSearching ? 'animate-spin' : ''}`} />
                <span>{isAiSearching ? 'Buscando...' : 'Re-buscar'}</span>
              </button>
            </div>

            {/* Loading State */}
            {isAiSearching && (
              <div className="p-6 bg-[#121215] border border-purple-500/30 rounded-2xl flex flex-col items-center justify-center text-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/40 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Buscando estadísticas con Gemini 3.8 Flash...</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                    Consultando marcadores, goleadores, asistencias y tarjetas con Google Search Grounding.
                  </p>
                </div>
              </div>
            )}

            {/* Error Feedback */}
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 font-medium flex items-start gap-2 animate-in fade-in duration-150">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="whitespace-pre-wrap">{error}</span>
                  <button
                    type="button"
                    onClick={handleAutoSearchGemini}
                    className="mt-2 block text-xs underline font-bold text-rose-200 hover:text-white"
                  >
                    Reintentar búsqueda
                  </button>
                </div>
              </div>
            )}

            {/* Success Feedback */}
            {successMsg && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-in zoom-in-95 duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Results Preview & Team Assignment */}
            {!isAiSearching && parsedData && (
              <div className="space-y-3">
                {/* Result Summary Card */}
                <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamBadge src={match.homeFlag} teamName={match.homeTeam} className="w-7 h-7" />
                    <span className="text-xs font-bold text-white truncate max-w-[90px]">{match.homeTeam}</span>
                  </div>

                  <div className="text-center px-2">
                    <div className="font-mono text-base font-black text-white bg-black/60 px-3 py-1 rounded-xl border border-zinc-700">
                      {parsedData.marcador?.local ?? 0} - {parsedData.marcador?.visitante ?? 0}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mt-0.5">
                      {parsedData.estado || 'Finalizado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs font-bold text-white truncate max-w-[90px] text-right">{match.awayTeam}</span>
                    <TeamBadge src={match.awayFlag} teamName={match.awayTeam} className="w-7 h-7" />
                  </div>
                </div>

                {/* Grounding Summary */}
                {aiSummary && (
                  <p className="text-[10px] text-zinc-400 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80 italic">
                    ℹ️ {aiSummary}
                  </p>
                )}

                {/* GOLES & ASISTENCIAS CON ASIGNADOR DE EQUIPO */}
                <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>⚽ Goles y Asistencias</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-mono">
                        {parsedData.goles?.length || 0}
                      </span>
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Toca [Local] o [Visitante] para corregir club
                    </span>
                  </div>

                  {(!parsedData.goles || parsedData.goles.length === 0) ? (
                    <p className="text-xs text-zinc-500 italic py-2 text-center">No se registraron goles</p>
                  ) : (
                    <div className="space-y-2 pt-1">
                      {parsedData.goles.map((g: any, idx: number) => {
                        const isHome = g.equipo === match.homeTeam || g.is_home === true;
                        return (
                          <div 
                            key={`goal-${idx}`} 
                            className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-xl space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                  {g.minuto ? `${g.minuto}'` : 'GOL'}
                                </span>
                                <span className="text-xs font-black text-white truncate">
                                  {g.jugador}
                                </span>
                                {g.tipo && g.tipo !== 'jugada' && (
                                  <span className="text-[9px] text-zinc-400 uppercase bg-zinc-800 px-1.5 py-0.5 rounded">
                                    {g.tipo}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Asistencia si existe */}
                            {g.asistencia && (
                              <div className="text-[11px] text-zinc-300 flex items-center gap-1 pl-1">
                                <span className="text-xs">👟</span>
                                <span className="text-zinc-500 text-[10px] font-bold uppercase">(Asist)</span>
                                <span className="font-semibold text-blue-300">{g.asistencia}</span>
                              </div>
                            )}

                            {/* Selector / Asignador interactivo de equipo para evitar discrepancias de nombres */}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider shrink-0 mr-1">
                                Asignar a:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleGoalTeam(idx, 'home')}
                                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 truncate ${
                                  isHome
                                    ? 'bg-blue-600/25 border-blue-500 text-blue-200 ring-1 ring-blue-500/40'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                                }`}
                                title={`Asignar gol a ${match.homeTeam}`}
                              >
                                <span>🏠</span>
                                <span className="truncate">{match.homeTeam}</span>
                                {isHome && <Check className="w-3 h-3 text-blue-400 shrink-0 ml-0.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleGoalTeam(idx, 'away')}
                                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 truncate ${
                                  !isHome
                                    ? 'bg-blue-600/25 border-blue-500 text-blue-200 ring-1 ring-blue-500/40'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                                }`}
                                title={`Asignar gol a ${match.awayTeam}`}
                              >
                                <span>✈️</span>
                                <span className="truncate">{match.awayTeam}</span>
                                {!isHome && <Check className="w-3 h-3 text-blue-400 shrink-0 ml-0.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* TARJETAS */}
                {parsedData.tarjetas && parsedData.tarjetas.length > 0 && (
                  <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-3 space-y-2">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span>🟨 Tarjetas</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full font-mono">
                        {parsedData.tarjetas.length}
                      </span>
                    </span>

                    <div className="space-y-1.5">
                      {parsedData.tarjetas.map((t: any, idx: number) => {
                        const isHome = t.equipo === match.homeTeam || t.is_home === true;
                        const isRed = String(t.tipo || '').toLowerCase().includes('roja');
                        return (
                          <div key={`card-${idx}`} className="bg-zinc-900/90 border border-zinc-800 p-2 rounded-xl space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{isRed ? '🟥' : '🟨'}</span>
                                <span className="font-mono text-xs text-zinc-400">{t.minuto ? `${t.minuto}'` : ''}</span>
                                <span className="text-xs font-bold text-white">{t.jugador}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleToggleCardTeam(idx, 'home')}
                                className={`flex-1 py-0.5 px-1.5 rounded text-[10px] font-bold border transition cursor-pointer truncate ${
                                  isHome ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                                }`}
                              >
                                🏠 {match.homeTeam}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleCardTeam(idx, 'away')}
                                className={`flex-1 py-0.5 px-1.5 rounded text-[10px] font-bold border transition cursor-pointer truncate ${
                                  !isHome ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                                }`}
                              >
                                ✈️ {match.awayTeam}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleSaveAiStats}
                    className="w-full sm:flex-1 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{isProcessing ? 'Guardando en Base de Datos...' : 'Guardar Estadísticas en Partido'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      vibrateTap();
                      setActiveTab('json');
                    }}
                    className="w-full sm:w-auto py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Ver/Editar JSON</span>
                  </button>
                </div>
              </div>
            )}

            {/* If no data yet and not searching */}
            {!isAiSearching && !parsedData && !error && (
              <div className="p-8 text-center bg-[#121215] border border-zinc-800 rounded-2xl space-y-3">
                <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Búsqueda Automática con Gemini 3.8 Flash</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Presiona el botón a continuación para rastrear el marcador oficial, los goleadores, las asistencias y las tarjetas de este partido en vivo.
                </p>
                <button
                  type="button"
                  onClick={handleAutoSearchGemini}
                  className="py-2.5 px-5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-purple-600/30 cursor-pointer inline-flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Buscar Estadísticas Ahora</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* MODO JSON */}
        {activeTab === 'json' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Toolbar Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>JSON (Goles, Tarjetas, Cambios, Lesiones):</span>
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
                placeholder='Pega aquí tu JSON con la estructura: partido, estado, marcador, goles, tarjetas, cambios, lesiones...'
                rows={13}
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

            {/* JSON Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleProcessAndSaveJson}
                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isProcessing ? 'Procesando y Guardando...' : 'Procesar y Guardar JSON'}</span>
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
        )}

      </div>
    </BaseBottomSheet>
  );
}
