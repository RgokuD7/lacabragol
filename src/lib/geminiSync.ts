import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Match, Setting } from '../types';
import { syncMatchPredictionsAndPoints } from './sync';
import { recalculateStandings } from './standings';

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
  error?: string;
}

export interface GeminiCommitResult {
  success: boolean;
  message: string;
  updatedCount: number;
  error?: string;
}

function normalizeTeamName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\b(fc|cf|as|ac|sk|fk|rb|sv|afc)\b/gi, '') // remove common acronyms
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function areTeamsEquivalent(nameA: string, nameB: string): boolean {
  const normA = normalizeTeamName(nameA);
  const normB = normalizeTeamName(nameB);
  if (!normA || !normB) return false;
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

export function mapGeminiEstadoToStatus(estado: string): 'pending' | 'in_progress' | 'finished' {
  const lower = (estado || '').toLowerCase();
  if (lower.includes('final') || lower.includes('termin') || lower.includes('ft') || lower.includes('concl')) {
    return 'finished';
  }
  if (lower.includes('vivo') || lower.includes('jugando') || lower.includes("'") || lower.includes('descanso') || lower.includes('ht') || lower.includes('progreso')) {
    return 'in_progress';
  }
  return 'pending';
}

/**
 * Fetches match results from Gemini API with Google Search Grounding.
 * DOES NOT write to Firestore.
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

    // Filter matches for the given date, in_progress, or pending
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

    // Prompt with explicit instruction to use Google search grounding
    const promptText = `USANDO TU HERRAMIENTA DE BÚSQUEDA EN INTERNET, busca los resultados reales, en vivo o finalizados, de los siguientes partidos de la Champions League del día de hoy: ${variablesPartidos}. Tras confirmar los datos reales en la web, devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta, sin texto adicional ni markdown:
{ "partidos": [ { "local": "Nombre", "goles_local": 0, "visitante": "Nombre", "goles_visitante": 0, "estado": "En vivo 45' / Finalizado / No iniciado", "goleadores": [ { "jugador": "Nombre", "equipo": "Nombre Equipo", "minuto": 12 } ], "tarjetas": [ { "jugador": "Nombre", "equipo": "Nombre Equipo", "tipo": "Amarilla/Roja", "minuto": 33 } ] } ] }`;

    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
    let responseText = '';
    let callSucceeded = false;
    let lastError: any = null;
    let webSearchQueries: string[] = [];
    let isGrounded = false;

    // 1st Attempt: with Google Search Grounding tool
    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }]
              }
            ],
            tools: [{ googleSearch: {} }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const partText = candidate?.content?.parts?.[0]?.text;
        const groundingMeta = candidate?.groundingMetadata;

        if (groundingMeta?.webSearchQueries) {
          webSearchQueries = groundingMeta.webSearchQueries;
          isGrounded = true;
        }

        if (partText) {
          responseText = partText;
          callSucceeded = true;
          isGrounded = !!groundingMeta;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemini attempt with googleSearch on ${modelName} failed:`, err.message);
      }
    }

    // Fallback: If Google Search Grounding quota was exceeded or unavailable, attempt without tools
    if (!callSucceeded || !responseText) {
      console.warn("Attempting fallback call without tools...");
      for (const modelName of modelsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: promptText }]
                }
              ],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
              }
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `HTTP ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          const candidate = data.candidates?.[0];
          const partText = candidate?.content?.parts?.[0]?.text;

          if (partText) {
            responseText = partText;
            callSucceeded = true;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Gemini fallback attempt on ${modelName} failed:`, err.message);
        }
      }
    }

    if (!callSucceeded || !responseText) {
      return {
        success: false,
        message: `Error al consultar Gemini API: ${lastError?.message || 'Sin respuesta del modelo'}`,
        partidos: [],
        rawJson: '',
        totalQueried: candidateMatches.length,
        error: lastError?.message
      };
    }

    // Clean JSON markdown fences if any
    let cleanJson = responseText.trim();
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
        rawJson: responseText,
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

    // Map each returned partido with candidateMatches
    const previewPartidos: GeminiPartidoPreview[] = partidosRaw.map(p => {
      const local = String(p.local || '').trim();
      const visitante = String(p.visitante || '').trim();
      const goles_local = p.goles_local !== null && p.goles_local !== undefined ? Number(p.goles_local) : 0;
      const goles_visitante = p.goles_visitante !== null && p.goles_visitante !== undefined ? Number(p.goles_visitante) : 0;
      const estado = String(p.estado || 'No iniciado').trim();
      const goleadores: GeminiGoleador[] = Array.isArray(p.goleadores) ? p.goleadores : [];
      const tarjetas: GeminiTarjeta[] = Array.isArray(p.tarjetas) ? p.tarjetas : [];

      // Find match in candidateMatches
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

    const statusNote = isGrounded
      ? `Resultados verificados con Google Search en vivo (${webSearchQueries.length} búsquedas web realizadas).`
      : `Gemini IA procesó ${previewPartidos.length} partido(s).`;

    return {
      success: true,
      message: statusNote,
      partidos: previewPartidos,
      rawJson: formattedRawJson,
      totalQueried: candidateMatches.length,
      searchQueries: webSearchQueries,
      isGrounded
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
