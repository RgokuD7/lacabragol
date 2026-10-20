import React, { useState, useMemo } from 'react';
import { 
  X, 
  Bot, 
  Sparkles, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Globe, 
  Shield, 
  ArrowRight, 
  FileCode, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Image as ImageIcon,
  Users
} from 'lucide-react';
import { PlayerItem, deduplicatePlayers, cleanPlayerForStorage } from '../data/players';
import { copyTextToClipboard } from '../lib/clipboard';
import { vibrateTap, vibrateSuccess, vibrateError } from '../lib/haptics';
import { cn } from '../lib/utils';

interface AiPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerItem[];
  onSavePlayers: (updatedList: PlayerItem[], message: string) => Promise<void>;
  isSaving: boolean;
}

export function AiPlayersModal({
  isOpen,
  onClose,
  players,
  onSavePlayers,
  isSaving
}: AiPlayersModalProps) {
  const [copyFeedback, setCopyFeedback] = useState<'all' | 'incomplete' | 'prompt' | null>(null);
  const [pastedJson, setPastedJson] = useState<string>('');
  const [showPromptPreview, setShowPromptPreview] = useState<boolean>(false);
  const [processFeedback, setProcessFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Estadísticas del catálogo
  const stats = useMemo(() => {
    const total = players.length;
    const withoutNationality = players.filter(p => !p.nationality || !p.nationality.trim());
    const withoutTeam = players.filter(p => !p.team || !p.team.trim());
    const withPhoto = players.filter(p => !!(p.imageUrl || p.image || p.photo));
    const incomplete = players.filter(p => !p.nationality || !p.nationality.trim() || !p.team || !p.team.trim());

    return {
      total,
      withoutNationalityCount: withoutNationality.length,
      withoutTeamCount: withoutTeam.length,
      withPhotoCount: withPhoto.length,
      incompleteCount: incomplete.length
    };
  }, [players]);

  // Generador de JSON limpio para la IA
  const getJsonString = (onlyIncomplete: boolean = false): string => {
    let list = players;
    if (onlyIncomplete) {
      list = players.filter(p => !p.nationality || !p.nationality.trim() || !p.team || !p.team.trim());
    }

    const exportData = list.map(p => {
      // Limpiar bandera de la nacionalidad para enviar nombre limpio a la IA
      const cleanNat = p.nationality
        ? p.nationality.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '').trim()
        : '';

      const item: Record<string, any> = {
        name: p.name,
        team: p.team || '',
        position: p.position || '',
        nationality: cleanNat
      };

      const photo = p.imageUrl || p.image || p.photo;
      if (photo && photo.trim()) {
        item.photo = photo.trim();
      }

      return item;
    });

    return JSON.stringify(exportData, null, 2);
  };

  // Generador de Prompt completo
  const getFullAiPrompt = (onlyIncomplete: boolean = false): string => {
    const jsonStr = getJsonString(onlyIncomplete);
    return `Eres un experto en fútbol europeo y en la UEFA Champions League.
A continuación te proporciono un JSON con la lista de jugadores de nuestra aplicación de pronósticos.

Tu objetivo:
1. Revisa y completa el campo "nationality" para cada jugador que lo tenga vacío (""). Pon el país de origen/nacionalidad deportiva en español (ejemplo: "Francia", "España", "Brasil", "Alemania", "Inglaterra", "Portugal", etc.).
2. Revisa el campo "team": debe ser el club actual donde juega el jugador en la temporada actual de la UEFA Champions League (ej: "Real Madrid", "Barcelona", "Bayern Munich", "Liverpool", etc.).
3. Revisa el campo "position": debe ser una de las siguientes opciones: "Delantero", "Centrocampista", "Defensa", "Portero".
4. REGLA ESTRICTA: Conserva intactos los campos "photo" (o "imageUrl") si ya existen. NO los elimines.
5. Devuélveme ÚNICAMENTE el JSON válido con el arreglo de objetos (sin texto conversacional antes ni después, ni saludos, ni markdown fuera del bloque JSON).

Estructura requerida para cada jugador:
{
  "name": "Nombre Jugador",
  "team": "Nombre del Club",
  "position": "Delantero | Centrocampista | Defensa | Portero",
  "nationality": "País en español",
  "photo": "https://..." // si existe
}

Aquí está la lista de jugadores a actualizar:
${jsonStr}`;
  };

  // Copiar al portapapeles con feedback temporal
  const handleCopy = async (type: 'all' | 'incomplete' | 'prompt') => {
    vibrateTap();
    let textToCopy = '';
    if (type === 'all') {
      textToCopy = getJsonString(false);
    } else if (type === 'incomplete') {
      textToCopy = getJsonString(true);
    } else {
      textToCopy = getFullAiPrompt(false);
    }

    const ok = await copyTextToClipboard(textToCopy);
    if (ok) {
      vibrateSuccess();
      setCopyFeedback(type);
      setTimeout(() => setCopyFeedback(null), 2500);
    } else {
      vibrateError();
      alert("No se pudo copiar automáticamente. Por favor permite los permisos de portapapeles en tu navegador.");
    }
  };

  // Procesar y guardar el JSON que entregó la IA
  const handleProcessPastedJson = async () => {
    if (!pastedJson.trim()) return;
    setProcessFeedback(null);

    try {
      // Limpiar posibles bloques markdown de código ```json ... ```
      let cleaned = pastedJson.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '');
      cleaned = cleaned.replace(/^```\s*/i, '');
      cleaned = cleaned.replace(/\s*```$/i, '');
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      let incomingList: PlayerItem[] = [];

      if (Array.isArray(parsed)) {
        incomingList = parsed;
      } else if (Array.isArray(parsed.top_players)) {
        incomingList = parsed.top_players;
      } else if (Array.isArray(parsed.players)) {
        incomingList = parsed.players;
      } else {
        throw new Error('El texto no contiene una lista válida de jugadores ni la propiedad "players" / "top_players".');
      }

      if (incomingList.length === 0) {
        throw new Error('La lista de jugadores recibida está vacía.');
      }

      // Analizar cambios antes de aplicar
      let updatedNatCount = 0;
      let updatedTeamCount = 0;

      incomingList.forEach(inc => {
        if (!inc.name) return;
        const existing = players.find(p => p.name.trim().toLowerCase() === inc.name.trim().toLowerCase());
        if (existing) {
          if ((!existing.nationality || !existing.nationality.trim()) && inc.nationality && inc.nationality.trim()) {
            updatedNatCount++;
          }
          if (existing.team !== inc.team && inc.team && inc.team.trim()) {
            updatedTeamCount++;
          }
        }
      });

      // Fusión inteligente y guardado en Firestore
      const { merged, addedCount, updatedCount } = deduplicatePlayers(players, incomingList);
      
      const summaryMsg = `¡Actualización de IA exitosa! Se actualizaron ${updatedCount} jugadores (${updatedNatCount} nuevas nacionalidades, ${updatedTeamCount} clubes) y se agregaron ${addedCount} nuevos. Todas las fotos se conservaron intactas.`;

      await onSavePlayers(merged, summaryMsg);
      setPastedJson('');
      setProcessFeedback({
        type: 'success',
        message: summaryMsg
      });
      vibrateSuccess();
    } catch (err: any) {
      console.error("[AiPlayersModal] Error parsing AI response:", err);
      vibrateError();
      setProcessFeedback({
        type: 'error',
        message: `Error al procesar la respuesta: ${err?.message || 'JSON inválido'}. Verifica que la IA haya entregado un JSON válido.`
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121217] border border-purple-500/40 rounded-2xl max-w-3xl w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col text-white custom-scrollbar overflow-y-auto">
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 shadow-lg shadow-purple-900/20">
              <Bot className="w-5 h-5 text-purple-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                <span>Asistente IA para Jugadores</span>
                <span className="text-[10px] bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold px-2 py-0.5 rounded-full shrink-0">
                  ChatGPT · Claude · Gemini
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                Copia el JSON de los jugadores, entrégaselo a una IA y pega la respuesta actualizada.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* METRICS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-2.5 flex items-center gap-2.5 shadow-inner">
            <Users className="w-4 h-4 text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block truncate">Total Jugadores</span>
              <span className="font-mono font-black text-sm text-white">{stats.total}</span>
            </div>
          </div>

          <div className={cn(
            "rounded-xl p-2.5 flex items-center gap-2.5 border shadow-inner transition-colors",
            stats.withoutNationalityCount > 0 
              ? "bg-amber-950/25 border-amber-500/40 text-amber-300" 
              : "bg-emerald-950/25 border-emerald-500/40 text-emerald-300"
          )}>
            <Globe className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold block truncate">Sin Nacionalidad</span>
              <span className="font-mono font-black text-sm">
                {stats.withoutNationalityCount > 0 ? `⚠️ ${stats.withoutNationalityCount}` : '0 (Todos tienen)'}
              </span>
            </div>
          </div>

          <div className={cn(
            "rounded-xl p-2.5 flex items-center gap-2.5 border shadow-inner transition-colors",
            stats.withoutTeamCount > 0 
              ? "bg-amber-950/25 border-amber-500/40 text-amber-300" 
              : "bg-zinc-900/80 border-zinc-800/80 text-zinc-300"
          )}>
            <Shield className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block truncate">Sin Club Oficial</span>
              <span className="font-mono font-black text-sm">
                {stats.withoutTeamCount > 0 ? `⚠️ ${stats.withoutTeamCount}` : '0'}
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-2.5 flex items-center gap-2.5 shadow-inner">
            <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block truncate">Con Foto</span>
              <span className="font-mono font-black text-sm text-emerald-400">{stats.withPhotoCount}</span>
            </div>
          </div>
        </div>

        {/* PASO 1: COPIAR AL PORTAPAPELES */}
        <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-purple-300 tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px] text-purple-300 font-bold">1</span>
              Paso 1: Copiar Datos al Portapapeles
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Botón 1: Copiar JSON Completo */}
            <button
              type="button"
              onClick={() => handleCopy('all')}
              className={cn(
                "py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md",
                copyFeedback === 'all'
                  ? "bg-emerald-600 text-white shadow-emerald-900/40"
                  : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30 hover:scale-[1.01]"
              )}
            >
              {copyFeedback === 'all' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡JSON Copiado! ({stats.total})</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-purple-200" />
                  <span>Copiar JSON ({stats.total})</span>
                </>
              )}
            </button>

            {/* Botón 2: Copiar Prompt Completo con JSON */}
            <button
              type="button"
              onClick={() => handleCopy('prompt')}
              className={cn(
                "py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md",
                copyFeedback === 'prompt'
                  ? "bg-emerald-600 text-white shadow-emerald-900/40"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-900/30 hover:scale-[1.01]"
              )}
              title="Copia el mensaje con las instrucciones y el JSON listo para pegar en ChatGPT o Claude"
            >
              {copyFeedback === 'prompt' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡Prompt + JSON Copiado!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Copiar Prompt + JSON</span>
                </>
              )}
            </button>

            {/* Botón 3: Copiar sólo incompletos si hay */}
            <button
              type="button"
              onClick={() => handleCopy('incomplete')}
              disabled={stats.incompleteCount === 0}
              className={cn(
                "py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed",
                copyFeedback === 'incomplete'
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-zinc-800 hover:bg-zinc-700 text-amber-300 border-amber-500/30"
              )}
              title="Copia sólo los jugadores a los que les falta nacionalidad o club para una respuesta más rápida de la IA"
            >
              {copyFeedback === 'incomplete' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡Incompletos Copiados!</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Sólo Incompletos ({stats.incompleteCount})</span>
                </>
              )}
            </button>
          </div>

          {/* Toggle vista previa del prompt */}
          <div>
            <button
              type="button"
              onClick={() => setShowPromptPreview(!showPromptPreview)}
              className="text-[11px] text-zinc-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {showPromptPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showPromptPreview ? 'Ocultar instrucciones del prompt' : 'Ver instrucciones que se enviarán a la IA'}</span>
            </button>
            {showPromptPreview && (
              <pre className="mt-2 p-3 bg-black/60 border border-zinc-800 rounded-lg text-[10px] text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto custom-scrollbar">
                {getFullAiPrompt(false).slice(0, 750)}...
              </pre>
            )}
          </div>
        </div>

        {/* PASO 2: CONSULTAR A LA IA */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-[10px] text-indigo-300 font-bold shrink-0 mt-0.5">
            2
          </div>
          <div className="text-xs text-zinc-300 leading-relaxed">
            <p className="font-bold text-white mb-0.5">Paso 2: Pega el mensaje en ChatGPT, Claude o Gemini</p>
            <p className="text-zinc-400 text-[11px]">
              Abre tu IA favorita, pega lo copiado y presiona Enter. La IA completará las nacionalidades faltantes (en español), verificará los clubes actuales y te devolverá el JSON.
            </p>
          </div>
        </div>

        {/* PASO 3: PEGAR RESPUESTA Y GUARDAR */}
        <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-purple-300 tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px] text-purple-300 font-bold">3</span>
              Paso 3: Pegar la Respuesta de la IA
            </span>
            <span className="text-[10px] text-zinc-400">
              Acepta JSON directo o con bloques ```json
            </span>
          </div>

          <textarea
            value={pastedJson}
            onChange={(e) => {
              setPastedJson(e.target.value);
              setProcessFeedback(null);
            }}
            placeholder={`Pega aquí la respuesta entregada por la IA...\n\n[\n  {\n    "name": "Kylian Mbappé",\n    "team": "Real Madrid",\n    "position": "Delantero",\n    "nationality": "Francia"\n  }\n]`}
            rows={5}
            className="w-full bg-black/60 border border-zinc-700/80 focus:border-purple-500 rounded-xl p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 outline-none custom-scrollbar transition-colors"
          />

          {processFeedback && (
            <div className={cn(
              "p-3 rounded-xl border text-xs font-semibold leading-relaxed flex items-start gap-2.5 animate-in fade-in",
              processFeedback.type === 'success' 
                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                : "bg-rose-950/40 border-rose-500/50 text-rose-300"
            )}>
              {processFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{processFeedback.message}</div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <span className="text-[11px] text-zinc-500">
              ℹ️ Las fotos ya asignadas se conservan y no se crean jugadores duplicados.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleProcessPastedJson}
                disabled={isSaving || !pastedJson.trim()}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando en Firestore...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Actualizar Catálogo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
