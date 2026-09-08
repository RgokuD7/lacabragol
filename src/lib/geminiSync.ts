import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
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

export interface GeminiMatchResult {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  status: 'pending' | 'in_progress' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
  goalscorers?: string[];
  notes?: string;
}

export interface SyncDailyResult {
  success: boolean;
  message: string;
  totalQueried: number;
  updatedMatches: GeminiMatchResult[];
  rawText?: string;
  error?: string;
}

/**
 * Calls Gemini API to fetch match outcomes for a target date (or active/pending matches)
 */
export async function syncDailyMatchesWithGemini(
  targetDateStr?: string,
  settings: Setting | null = null,
  apiKeyOverride?: string
): Promise<SyncDailyResult> {
  const apiKey = (apiKeyOverride || getGeminiApiKey()).trim();

  if (!apiKey) {
    return {
      success: false,
      message: "No se proporcionó una clave de API de Gemini válida.",
      totalQueried: 0,
      updatedMatches: [],
      error: "Falta API Key de Gemini"
    };
  }

  try {
    // 1. Fetch matches from Firestore
    const snap = await getDocs(collection(db, 'matches'));
    const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

    // Target date formatting (default: today's date in YYYY-MM-DD)
    const todayStr = targetDateStr || new Date().toISOString().split('T')[0];

    // Filter matches for the given date, or in_progress matches, or official UCL matches close to today
    let candidateMatches = allMatches.filter(m => {
      if (m.date && m.date.startsWith(todayStr)) return true;
      if (m.status === 'in_progress') return true;
      return false;
    });

    // If no matches exactly match today, grab the nearest pending matches or recent matches (max 10)
    if (candidateMatches.length === 0) {
      const pending = allMatches.filter(m => m.status === 'pending' || m.status === 'in_progress');
      if (pending.length > 0) {
        candidateMatches = pending.slice(0, 10);
      } else {
        // Fallback to the last 6 official matches
        candidateMatches = allMatches.slice(0, 6);
      }
    }

    if (candidateMatches.length === 0) {
      return {
        success: true,
        message: "No hay partidos pendientes ni en juego para consultar hoy.",
        totalQueried: 0,
        updatedMatches: []
      };
    }

    const matchesListText = candidateMatches.map(m => 
      `- ID: "${m.id}" | ${m.homeTeam} vs ${m.awayTeam} | Fecha/Hora UTC: ${m.date || 'Desconocida'} | Estado actual: ${m.status}`
    ).join('\n');

    const promptText = `Eres un asistente de datos deportivos especializado en fútbol de la UEFA Champions League y torneos internacionales.
Fecha objetivo de consulta: ${todayStr}.
Consulta tus conocimientos actualizados y fuentes de información para verificar el marcador oficial (en vivo o final) de los siguientes partidos:

${matchesListText}

Instrucciones estrictas:
1. Para cada partido que ya haya finalizado, asigna "status": "finished", con sus goles reales "homeScore" (entero >= 0) y "awayScore" (entero >= 0).
2. Si un partido está jugándose actualmente en vivo, asigna "status": "in_progress", con el marcador actual.
3. Si el partido aún no ha comenzado o se juega en el futuro, asigna "status": "pending", con "homeScore": null y "awayScore": null.
4. Incluye la lista de goleadores si se conocen en el campo "goalscorers": ["Nombre Minuto'"].
5. Devuelve ÚNICAMENTE un array JSON válido sin texto explicativo adicional, sin markdown de bienvenida, estrictamente el JSON:
[
  {
    "matchId": "string",
    "homeTeam": "string",
    "awayTeam": "string",
    "status": "pending" | "in_progress" | "finished",
    "homeScore": number | null,
    "awayScore": number | null,
    "goalscorers": []
  }
]`;

    // Attempt Gemini call with active models: gemini-3.6-flash first, then gemini-3.5-flash, gemini-flash-latest, and gemini-2.5-flash
    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
    let responseText = '';
    let callSucceeded = false;
    let lastError: any = null;

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
        console.warn(`Gemini attempt with ${modelName} failed:`, err.message);
      }
    }

    if (!callSucceeded || !responseText) {
      return {
        success: false,
        message: `Error al consultar Gemini API: ${lastError?.message || 'Sin respuesta del modelo'}`,
        totalQueried: candidateMatches.length,
        updatedMatches: [],
        error: lastError?.message
      };
    }

    // Clean JSON markdown fences
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }

    let parsedResults: GeminiMatchResult[] = [];
    try {
      parsedResults = JSON.parse(cleanJson);
      if (!Array.isArray(parsedResults)) {
        throw new Error("La respuesta de Gemini no es un array JSON.");
      }
    } catch (parseErr: any) {
      console.error("Failed to parse Gemini JSON:", cleanJson, parseErr);
      return {
        success: false,
        message: "No se pudo interpretar el formato JSON devuelto por Gemini.",
        totalQueried: candidateMatches.length,
        updatedMatches: [],
        rawText: responseText,
        error: parseErr.message
      };
    }

    // 2. Apply updates to Firestore
    const appliedUpdates: GeminiMatchResult[] = [];
    let standingsNeedRecalc = false;

    for (const result of parsedResults) {
      const match = candidateMatches.find(m => m.id === result.matchId);
      if (!match) continue;

      const newStatus = result.status;
      const newHome = result.homeScore !== null && result.homeScore !== undefined ? Number(result.homeScore) : null;
      const newAway = result.awayScore !== null && result.awayScore !== undefined ? Number(result.awayScore) : null;

      // Check if data actually changed
      const changed = match.status !== newStatus ||
        match.homeScore !== newHome ||
        match.awayScore !== newAway;

      if (changed) {
        const updateData: any = {
          status: newStatus,
          homeScore: newHome,
          awayScore: newAway,
          updatedAt: Date.now(),
          is_synced: newStatus === 'finished'
        };

        if (Array.isArray(result.goalscorers) && result.goalscorers.length > 0) {
          updateData.goalscorers = result.goalscorers;
        }

        await updateDoc(doc(db, 'matches', match.id), updateData);
        appliedUpdates.push(result);

        // If match reached finished state, trigger prediction re-evaluation
        if (newStatus === 'finished' && newHome !== null && newAway !== null) {
          standingsNeedRecalc = true;
          await syncMatchPredictionsAndPoints(match.id, newHome, newAway, settings);
        }
      }
    }

    if (standingsNeedRecalc) {
      await recalculateStandings().catch(console.error);
    }

    return {
      success: true,
      message: appliedUpdates.length > 0 
        ? `Se actualizaron ${appliedUpdates.length} partido(s) exitosamente con Gemini IA.`
        : "Todos los partidos consultados ya están al día.",
      totalQueried: candidateMatches.length,
      updatedMatches: appliedUpdates,
      rawText: responseText
    };

  } catch (err: any) {
    console.error("Error in syncDailyMatchesWithGemini:", err);
    return {
      success: false,
      message: `Error general durante la sincronización: ${err.message}`,
      totalQueried: 0,
      updatedMatches: [],
      error: err.message
    };
  }
}
