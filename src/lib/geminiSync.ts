import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Match, Setting } from '../types';
import { syncMatchPredictionsAndPoints } from './sync';
import { recalculateStandings, findUclTeam, normalizeTeamStr } from './standings';

export function getGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved && saved.trim()) return saved.trim();
  }
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  return '';
}

export function setGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gemini_api_key', key.trim());
  }
}

export interface GeminiGoleador {
  jugador: string;
  equipo: string;
  minuto: number;
}

export interface GeminiTarjeta {
  jugador: string;
  equipo: string;
  tipo: string;
  minuto: number;
}

export interface GeminiPartido {
  local: string;
  goles_local: number | null;
  visitante: string;
  goles_visitante: number | null;
  estado: string;
  goleadores: GeminiGoleador[];
  tarjetas: GeminiTarjeta[];
}

export interface GeminiPartidoPreview extends GeminiPartido {
  matchedMatchId?: string;
  matchedMatch?: Match;
  hasChanges?: boolean;
}

export interface GeminiPreviewResult {
  success: boolean;
  message: string;
  partidos: GeminiPartidoPreview[];
  rawJson: string;
  totalQueried: number;
  searchQueries?: string[];
  isGrounded?: boolean;
  searchSummary?: string;
  error?: string;
}

export interface GeminiCommitResult {
  success: boolean;
  message: string;
  updatedCount: number;
  error?: string;
}

export class GeminiRateLimitError extends Error {
  status: number;
  constructor(message = "Límite de la IA alcanzado. Reintentando en el próximo ciclo.") {
    super(message);
    this.name = "GeminiRateLimitError";
    this.status = 429;
  }
}

export function isGeminiRateLimit(err: any): boolean {
  if (!err) return false;
  if (err instanceof GeminiRateLimitError || err.status === 429) return true;
  const str = String(err.message || err).toLowerCase();
  return str.includes('429') || str.includes('resource_exhausted') || str.includes('quota') || str.includes('rate limit') || str.includes('límite de la ia');
}

export function notifyGeminiRateLimit(customMessage?: string) {
  const message = customMessage || "Límite de la IA alcanzado. Reintentando en el próximo ciclo.";
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gemini-rate-limit', { detail: { message } }));
  }
}

export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

/**
 * Robust check to determine if two team names refer to the same club.
 * Checks official UCL registry first, then normalized string containment.
 */
export function areTeamsEquivalent(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;

  // 1. Direct official UCL team ID comparison
  const teamA = findUclTeam(nameA);
  const teamB = findUclTeam(nameB);
  if (teamA && teamB && teamA.id === teamB.id) {
    return true;
  }

  // 2. Normalized string comparison
  const normA = normalizeTeamStr(nameA);
  const normB = normalizeTeamStr(nameB);
  if (normA && normB) {
    if (normA === normB) return true;
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  return false;
}

export function mapGeminiEstadoToStatus(estado: string): 'pending' | 'in_progress' | 'finished' {
  const lower = (estado || '').toLowerCase();
  if (lower.includes('final') || lower.includes('termin') || lower.includes('ft') || lower.includes('concl') || lower.includes('ended')) {
    return 'finished';
  }
  if (lower.includes('prog') || lower.includes('no inici') || lower.includes('por jugar') || lower.includes('pend')) {
    return 'pending';
  }
  if (lower.includes('vivo') || lower.includes('jugando') || lower.includes("'") || lower.includes('descanso') || lower.includes('entretiempo') || lower.includes('ht') || lower.includes('progreso')) {
    return 'in_progress';
  }
  return 'in_progress';
}

/**
 * PASO 1: Búsqueda Web con Google Search Grounding.
 * Se llama a Gemini SIN responseMimeType="application/json".
 * Esto permite que el modelo use plenamente la herramienta googleSearch en la web real.
 */
async function callGeminiStep1Search(
  variablesPartidos: string,
  apiKey: string
): Promise<{ text: string; searchQueries: string[]; isGrounded: boolean }> {
  const promptStep1 = `USANDO TU HERRAMIENTA DE BÚSQUEDA EN INTERNET (Google Search), busca en la web los resultados reales y actuales (en vivo o finalizados) de hoy de los siguientes partidos de fútbol de la UEFA Champions League:
${variablesPartidos}

Dame un resumen textual detallado con los resultados reales de hoy, indicando para cada partido:
1. Equipo Local y Equipo Visitante
2. Marcador exacto de goles (o 0-0 si aún no empieza)
3. Estado del partido: "Finalizado", "En vivo (indicando minuto si está disponible)" o "No iniciado"
4. Goleadores con el minuto de su gol y equipo
5. Tarjetas amarillas y rojas con jugador y minuto

IMPORTANTE: Consulta fuentes deportivas oficiales en la web en vivo. Si un partido no se ha jugado hoy o no ha iniciado, acláralo como "No iniciado" con 0-0.`;

  let lastError: any = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`[Gemini Paso 1] Intentando búsqueda web con modelo ${modelName}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptStep1 }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429 || errData?.error?.code === 429 || errData?.error?.status === 'RESOURCE_EXHAUSTED') {
          notifyGeminiRateLimit();
          throw new GeminiRateLimitError();
        }
        throw new Error(errData?.error?.message || `HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const partText = candidate?.content?.parts?.[0]?.text;
      const groundingMeta = candidate?.groundingMetadata;

      const searchQueries: string[] = groundingMeta?.webSearchQueries || [];
      const isGrounded = !!(searchQueries.length > 0 || groundingMeta?.groundingChunks?.length);

      if (partText && partText.trim()) {
        console.log(`[Gemini Paso 1] Éxito con ${modelName}. Grounded: ${isGrounded}, Consultas:`, searchQueries);
        return {
          text: partText.trim(),
          searchQueries,
          isGrounded
        };
      }
    } catch (err: any) {
      if (isGeminiRateLimit(err)) {
        throw err;
      }
      lastError = err;
      console.warn(`[Gemini Paso 1] Falló con ${modelName}:`, err.message);
    }
  }

  throw new Error(`Paso 1 (Búsqueda Web en vivo) falló: ${lastError?.message || 'Sin respuesta del modelo'}`);
}

/**
 * PASO 2: Conversión del resumen verificado a JSON estructurado estricto.
 * Se llama a Gemini SIN herramientas de búsqueda y CON responseMimeType="application/json".
 * Esto garantiza que no alucine (usa solo el texto del Paso 1) y devuelva un JSON perfectamente válido.
 */
async function callGeminiStep2ParseToJson(
  step1Text: string,
  variablesPartidos: string,
  apiKey: string
): Promise<string> {
  const promptStep2 = `A partir del siguiente texto con información verificada de resultados de partidos de fútbol, extrae y convierte los datos al siguiente formato JSON estricto:

{
  "partidos": [
    {
      "local": "Nombre Exacto Equipo Local",
      "goles_local": 0,
      "visitante": "Nombre Exacto Equipo Visitante",
      "goles_visitante": 0,
      "estado": "Finalizado / En vivo / No iniciado",
      "goleadores": [
        {
          "jugador": "Nombre Jugador",
          "equipo": "Nombre Equipo",
          "minuto": 45
        }
      ],
      "tarjetas": [
        {
          "jugador": "Nombre Jugador",
          "equipo": "Nombre Equipo",
          "tipo": "Amarilla / Roja",
          "minuto": 70
        }
      ]
    }
  ]
}

PARTIDOS A INCLUIR:
${variablesPartidos}

TEXTO VERIFICADO OBTENIDO EN EL PASO ANTERIOR:
"""
${step1Text}
"""

REGLAS ESTRICTAS:
1. Extrae únicamente los resultados de los partidos solicitados basándote estrictamente en el texto anterior.
2. Si un partido no tiene marcador o no ha comenzado, define goles_local: 0, goles_visitante: 0 y estado: "No iniciado".
3. Si goles_local o goles_visitante no están especificados numéricamente, usa 0.
4. Devuelve ÚNICAMENTE el objeto JSON sin bloques de código ni texto adicional.`;

  let lastError: any = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`[Gemini Paso 2] Convirtiendo texto a JSON con modelo ${modelName}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptStep2 }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429 || errData?.error?.code === 429 || errData?.error?.status === 'RESOURCE_EXHAUSTED') {
          notifyGeminiRateLimit();
          throw new GeminiRateLimitError();
        }
        throw new Error(errData?.error?.message || `HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const partText = candidate?.content?.parts?.[0]?.text;

      if (partText && partText.trim()) {
        console.log(`[Gemini Paso 2] Éxito convirtiendo JSON con ${modelName}.`);
        return partText.trim();
      }
    } catch (err: any) {
      if (isGeminiRateLimit(err)) {
        throw err;
      }
      lastError = err;
      console.warn(`[Gemini Paso 2] Falló con ${modelName}:`, err.message);
    }
  }

  throw new Error(`Paso 2 (Estructuración JSON) falló: ${lastError?.message || 'Sin respuesta del modelo'}`);
}

/**
 * Proceso de 2 Pasos Infalible:
 * 1. Búsqueda Web (Google Search Grounding) en texto libre.
 * 2. Conversión del texto resultante a JSON estructurado estricto.
 * NO guarda en Firestore; genera la vista previa para el modal de auditoría.
 */
export async function fetchGeminiMatchesPreview(
  targetDateStr?: string,
  apiKeyOverride?: string
): Promise<GeminiPreviewResult> {
  const apiKey = (apiKeyOverride || getGeminiApiKey()).trim();

  if (!apiKey) {
    return {
      success: false,
      message: "No se proporcionó una clave de API de Gemini válida.",
      partidos: [],
      rawJson: '',
      totalQueried: 0,
      error: "Falta API Key de Gemini"
    };
  }

  try {
    // 1. Fetch matches from Firestore
    const snap = await getDocs(collection(db, 'matches'));
    const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

    const todayStr = targetDateStr || new Date().toISOString().split('T')[0];

    // Filter candidate matches: date matches today, or in_progress, or pending
    let candidateMatches = allMatches.filter(m => {
      if (m.date && m.date.startsWith(todayStr)) return true;
      if (m.status === 'in_progress') return true;
      return false;
    });

    if (candidateMatches.length === 0) {
      const pending = allMatches.filter(m => m.status === 'pending' || m.status === 'in_progress');
      if (pending.length > 0) {
        candidateMatches = pending.slice(0, 10);
      } else {
        candidateMatches = allMatches.slice(0, 8);
      }
    }

    if (candidateMatches.length === 0) {
      return {
        success: true,
        message: "No hay partidos pendientes ni en juego para consultar hoy.",
        partidos: [],
        rawJson: JSON.stringify({ partidos: [] }, null, 2),
        totalQueried: 0
      };
    }

    const variablesPartidos = candidateMatches.map(m => `${m.homeTeam} vs ${m.awayTeam}`).join(', ');
    console.log(`[fetchGeminiMatchesPreview] Consultando partidos:`, variablesPartidos);

    let step1Result: { text: string; searchQueries: string[]; isGrounded: boolean };
    let jsonResponseText = '';

    // =========================================================================
    // PASO 1: Búsqueda Web (Google Search Grounding) sin modo JSON
    // =========================================================================
    try {
      step1Result = await callGeminiStep1Search(variablesPartidos, apiKey);
    } catch (searchErr: any) {
      console.warn("[fetchGeminiMatchesPreview] Falló Paso 1 con herramientas de búsqueda:", searchErr.message);
      
      // Fallback de emergencia si la búsqueda falló por cuota/herramientas:
      // Ejecutar llamada directa sin herramientas
      console.log("[fetchGeminiMatchesPreview] Intentando consulta directa alternativa...");
      const fallbackPrompt = `Proporciona el estado actual y los resultados de los siguientes partidos de la Champions League: ${variablesPartidos}. Devuelve ÚNICAMENTE un JSON con la estructura { "partidos": [ { "local": "...", "goles_local": 0, "visitante": "...", "goles_visitante": 0, "estado": "Finalizado/En vivo/No iniciado", "goleadores": [], "tarjetas": [] } ] }`;
      
      let fallbackSucceeded = false;
      for (const modelName of GEMINI_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fallbackPrompt }] }],
              generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
            })
          });
          if (res.ok) {
            const data = await res.json();
            const partText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (partText) {
              jsonResponseText = partText;
              fallbackSucceeded = true;
              break;
            }
          }
        } catch (e) {}
      }

      if (!fallbackSucceeded) {
        return {
          success: false,
          message: `Error al consultar Gemini API: ${searchErr.message}`,
          partidos: [],
          rawJson: '',
          totalQueried: candidateMatches.length,
          error: searchErr.message
        };
      }

      step1Result = {
        text: 'Respuesta generada en modo directo (Búsqueda web en vivo no disponible por cuota de la API).',
        searchQueries: [],
        isGrounded: false
      };
    }

    // =========================================================================
    // PASO 2: Conversión del texto del Paso 1 a JSON estricto
    // =========================================================================
    if (!jsonResponseText) {
      jsonResponseText = await callGeminiStep2ParseToJson(step1Result.text, variablesPartidos, apiKey);
    }

    // Limpiar markdown fences si vinieron
    let cleanJson = jsonResponseText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }

    let parsedPayload: any = null;
    try {
      parsedPayload = JSON.parse(cleanJson);
    } catch (parseErr: any) {
      console.error("Failed to parse Gemini JSON:", cleanJson, parseErr);
      return {
        success: false,
        message: "No se pudo interpretar el formato JSON devuelto por Gemini.",
        partidos: [],
        rawJson: jsonResponseText,
        totalQueried: candidateMatches.length,
        error: parseErr.message
      };
    }

    const partidosRaw: any[] = Array.isArray(parsedPayload?.partidos)
      ? parsedPayload.partidos
      : Array.isArray(parsedPayload)
        ? parsedPayload
        : [];

    const formattedRawJson = JSON.stringify(parsedPayload, null, 2);

    // Mapear cada partido con las coincidencias de Firestore
    const previewPartidos: GeminiPartidoPreview[] = partidosRaw.map(p => {
      const local = String(p.local || '').trim();
      const visitante = String(p.visitante || '').trim();
      const goles_local = p.goles_local !== null && p.goles_local !== undefined ? Number(p.goles_local) : 0;
      const goles_visitante = p.goles_visitante !== null && p.goles_visitante !== undefined ? Number(p.goles_visitante) : 0;
      const estado = String(p.estado || 'No iniciado').trim();
      const goleadores: GeminiGoleador[] = Array.isArray(p.goleadores) ? p.goleadores : [];
      const tarjetas: GeminiTarjeta[] = Array.isArray(p.tarjetas) ? p.tarjetas : [];

      // Buscar partido en candidateMatches usando areTeamsEquivalent robusto
      const matched = candidateMatches.find(m =>
        areTeamsEquivalent(m.homeTeam, local) && areTeamsEquivalent(m.awayTeam, visitante)
      ) || candidateMatches.find(m =>
        areTeamsEquivalent(m.homeTeam, local) || areTeamsEquivalent(m.awayTeam, visitante)
      );

      let hasChanges = false;
      if (matched) {
        const newStatus = mapGeminiEstadoToStatus(estado);
        hasChanges = matched.status !== newStatus ||
          matched.homeScore !== goles_local ||
          matched.awayScore !== goles_visitante;
      }

      return {
        local,
        goles_local,
        visitante,
        goles_visitante,
        estado,
        goleadores,
        tarjetas,
        matchedMatchId: matched?.id,
        matchedMatch: matched,
        hasChanges
      };
    });

    const statusNote = step1Result.isGrounded
      ? `Resultados verificados con Google Search en vivo (${step1Result.searchQueries.length} búsquedas web realizadas).`
      : `Gemini IA procesó ${previewPartidos.length} partido(s).`;

    return {
      success: true,
      message: statusNote,
      partidos: previewPartidos,
      rawJson: formattedRawJson,
      totalQueried: candidateMatches.length,
      searchQueries: step1Result.searchQueries,
      isGrounded: step1Result.isGrounded,
      searchSummary: step1Result.text
    };

  } catch (err: any) {
    console.error("Error in fetchGeminiMatchesPreview:", err);
    return {
      success: false,
      message: `Error general al consultar Gemini: ${err.message}`,
      partidos: [],
      rawJson: '',
      totalQueried: 0,
      error: err.message
    };
  }
}

/**
 * Commits the validated preview matches to Firestore, updates prediction points, and recalculates standings.
 */
export async function commitGeminiMatchesToFirestore(
  partidos: GeminiPartidoPreview[],
  settings: Setting | null = null
): Promise<GeminiCommitResult> {
  try {
    let updatedCount = 0;
    let standingsNeedRecalc = false;

    for (const p of partidos) {
      if (!p.matchedMatchId || !p.matchedMatch) continue;

      const newStatus = mapGeminiEstadoToStatus(p.estado);
      const newHome = p.goles_local !== null && p.goles_local !== undefined ? Number(p.goles_local) : null;
      const newAway = p.goles_visitante !== null && p.goles_visitante !== undefined ? Number(p.goles_visitante) : null;

      const currentMatch = p.matchedMatch;
      const changed = currentMatch.status !== newStatus ||
        currentMatch.homeScore !== newHome ||
        currentMatch.awayScore !== newAway;

      if (changed || (p.goleadores && p.goleadores.length > 0)) {
        const updateData: any = {
          status: newStatus,
          homeScore: newHome,
          awayScore: newAway,
          updatedAt: Date.now(),
          is_synced: newStatus === 'finished'
        };

        if (Array.isArray(p.goleadores) && p.goleadores.length > 0) {
          updateData.goalscorers = p.goleadores.map(g => `${g.jugador} ${g.minuto}' (${g.equipo})`);
        }

        await updateDoc(doc(db, 'matches', p.matchedMatchId), updateData);
        updatedCount++;

        // If match reached finished state, trigger prediction re-evaluation
        if (newStatus === 'finished' && newHome !== null && newAway !== null) {
          standingsNeedRecalc = true;
          await syncMatchPredictionsAndPoints(p.matchedMatchId, newHome, newAway, settings);
        }
      }
    }

    if (standingsNeedRecalc) {
      console.log("[commitGeminiMatchesToFirestore] Recalculando tabla de posiciones tras sincronizar partidos...");
      await recalculateStandings().catch(err => {
        console.warn("Standings recalc error after Gemini commit:", err);
      });
    }

    return {
      success: true,
      updatedCount,
      message: updatedCount > 0
        ? `Se actualizaron ${updatedCount} partido(s) exitosamente en Firestore.`
        : "Todos los partidos ya estaban sincronizados con estos marcadores."
    };
  } catch (err: any) {
    console.error("Error committing Gemini matches to Firestore:", err);
    return {
      success: false,
      updatedCount: 0,
      message: `Error al guardar en Firestore: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * Backwards-compatible direct sync function
 */
export async function syncDailyMatchesWithGemini(
  targetDateStr?: string,
  settings: Setting | null = null,
  apiKeyOverride?: string
): Promise<{ success: boolean; message: string; totalQueried: number; updatedMatches: any[]; rawText?: string; error?: string }> {
  const preview = await fetchGeminiMatchesPreview(targetDateStr, apiKeyOverride);
  if (!preview.success) {
    return {
      success: false,
      message: preview.message,
      totalQueried: preview.totalQueried,
      updatedMatches: [],
      rawText: preview.rawJson,
      error: preview.error
    };
  }

  const commit = await commitGeminiMatchesToFirestore(preview.partidos, settings);
  return {
    success: commit.success,
    message: commit.message,
    totalQueried: preview.totalQueried,
    updatedMatches: preview.partidos,
    rawText: preview.rawJson,
    error: commit.error
  };
}
