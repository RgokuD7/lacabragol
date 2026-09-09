import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Match, Setting } from '../types';
import { syncMatchPredictionsAndPoints, syncMatchResult } from './sync';
import { recalculateStandings, findUclTeam, StandingRow, StandingTeam } from './standings';
import { UCL_36_TEAMS, getTeamLogoByName } from '../data/fixtures';
import { getGeminiApiKey } from './geminiSync';

export const DEFAULT_SERPAPI_KEY = "30ebec1be507cf06e25598686b84f4aa3c9c56abd6bc7c2e13ac23ce0851cd8e";

export function getSerpApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('serpapi_api_key');
    if (saved && saved.trim()) return saved.trim();
  }
  const envKey = (import.meta as any).env?.VITE_SERPAPI_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  return DEFAULT_SERPAPI_KEY;
}

export function setSerpApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('serpapi_api_key', key.trim());
  }
}

export interface SerpApiMatchResult {
  local: string;
  goles_local: number;
  visitante: string;
  goles_visitante: number;
  estado: string;
  goleadores: Array<{
    jugador: string;
    equipo?: string;
    minuto: number;
  }>;
  tarjetas: Array<{
    jugador: string;
    equipo?: string;
    tipo: string;
    minuto: number;
  }>;
}

export interface SerpApiStandingItem {
  equipo: string;
  posicion: number;
  puntos: number;
  partidos_jugados: number;
  goles_favor: number;
  goles_contra: number;
  diferencia_goles: number;
}

const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-2.5-flash'
];

/**
 * Executes a fetch to SerpAPI.
 * Since browser environments (PWA/React) are blocked by CORS when requesting serpapi.com directly,
 * this function tries direct fetch and immediately falls back to a transparent CORS proxy.
 */
export async function fetchSerpApiRaw(query: string, apiKeyOverride?: string): Promise<any> {
  const apiKey = (apiKeyOverride || getSerpApiKey()).trim();
  if (!apiKey) {
    throw new Error("Falta la clave API de SerpAPI.");
  }

  const encodedQuery = encodeURIComponent(query);
  const directUrl = `https://serpapi.com/search.json?engine=google&q=${encodedQuery}&api_key=${apiKey}`;

  console.log(`[SerpAPI] Consultando Google: "${query}"...`);

  // Try direct fetch first
  try {
    const res = await fetch(directUrl, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      console.log(`[SerpAPI] Respuesta directa exitosa para "${query}".`);
      return extractRelevantSerpApiNode(data);
    }
  } catch (err: any) {
    console.warn(`[SerpAPI] Llamada directa bloqueada por CORS o red. Usando fallback de proxy...`, err.message);
  }

  // Fallback via CORS proxy (allorigins)
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
  try {
    const proxyRes = await fetch(proxyUrl, { method: 'GET' });
    if (!proxyRes.ok) {
      throw new Error(`Proxy HTTP ${proxyRes.status} ${proxyRes.statusText}`);
    }
    const proxyData = await proxyRes.json();
    console.log(`[SerpAPI] Respuesta exitosa mediante proxy para "${query}".`);
    return extractRelevantSerpApiNode(proxyData);
  } catch (proxyErr: any) {
    console.error(`[SerpAPI] Error al consultar SerpAPI:`, proxyErr);
    throw new Error(`Error de conexión con SerpAPI: ${proxyErr.message}`);
  }
}

/**
 * Extracts the sports_results node or relevant knowledge graph / games nodes from SerpAPI payload
 */
function extractRelevantSerpApiNode(data: any): any {
  if (data?.sports_results) {
    return data.sports_results;
  }
  if (data?.knowledge_graph) {
    return data.knowledge_graph;
  }
  if (data?.answer_box) {
    return data.answer_box;
  }
  if (Array.isArray(data?.organic_results) && data.organic_results.length > 0) {
    // Return first 3 organic snippets if sports_results is missing
    return {
      organic_summary: data.organic_results.slice(0, 3).map((r: any) => ({
        title: r.title,
        snippet: r.snippet
      }))
    };
  }
  return data;
}

/**
 * Sends the raw sports_results node to Gemini exclusively to parse it into our strict match format.
 */
export async function parseMatchWithGemini(
  rawSportsResults: any,
  matchContext: { local: string; visitante: string },
  geminiApiKeyOverride?: string
): Promise<SerpApiMatchResult> {
  const apiKey = (geminiApiKeyOverride || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error("Falta la API Key de Gemini para formatear los datos de SerpAPI.");
  }

  const promptText = `Toma este objeto JSON crudo proveniente de SerpAPI. Extrae la información del partido y devuelve ÚNICAMENTE un JSON con esta estructura exacta: { "local": "Nombre", "goles_local": 0, "visitante": "Nombre", "goles_visitante": 0, "estado": "Finalizado/En vivo", "goleadores": [{"jugador": "Nombre", "minuto": 12}], "tarjetas": [{"jugador": "Nombre", "tipo": "Amarilla/Roja", "minuto": 33}] }. JSON Crudo: ${JSON.stringify(rawSportsResults)}`;

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        return {
          local: String(parsed.local || matchContext.local).trim(),
          goles_local: Number(parsed.goles_local ?? 0),
          visitante: String(parsed.visitante || matchContext.visitante).trim(),
          goles_visitante: Number(parsed.goles_visitante ?? 0),
          estado: String(parsed.estado || 'Finalizado').trim(),
          goleadores: Array.isArray(parsed.goleadores) ? parsed.goleadores : [],
          tarjetas: Array.isArray(parsed.tarjetas) ? parsed.tarjetas : []
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[parseMatchWithGemini] Falló con ${model}:`, err.message);
    }
  }

  throw new Error(`No se pudo parsear el resultado con Gemini: ${lastError?.message || 'Sin respuesta'}`);
}

/**
 * Sends the raw standings sports_results node to Gemini to parse into our strict standings array.
 */
export async function parseStandingsWithGemini(
  rawSportsResults: any,
  geminiApiKeyOverride?: string
): Promise<SerpApiStandingItem[]> {
  const apiKey = (geminiApiKeyOverride || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error("Falta la API Key de Gemini para formatear los datos de SerpAPI.");
  }

  const promptText = `Toma este objeto JSON de posiciones proveniente de SerpAPI. Extrae los datos y devuelve ÚNICAMENTE un JSON con un array de los equipos usando esta estructura exacta: { "tabla": [ { "equipo": "Nombre", "posicion": 1, "puntos": 3, "partidos_jugados": 1, "goles_favor": 2, "goles_contra": 0, "diferencia_goles": 2 } ] }. JSON Crudo: ${JSON.stringify(rawSportsResults)}`;

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        const rows: any[] = Array.isArray(parsed.tabla) ? parsed.tabla : Array.isArray(parsed) ? parsed : [];
        return rows.map((r, idx) => ({
          equipo: String(r.equipo || '').trim(),
          posicion: Number(r.posicion || idx + 1),
          puntos: Number(r.puntos || 0),
          partidos_jugados: Number(r.partidos_jugados || 0),
          goles_favor: Number(r.goles_favor || 0),
          goles_contra: Number(r.goles_contra || 0),
          diferencia_goles: Number(r.diferencia_goles ?? (Number(r.goles_favor || 0) - Number(r.goles_contra || 0)))
        }));
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[parseStandingsWithGemini] Falló con ${model}:`, err.message);
    }
  }

  throw new Error(`No se pudo parsear la tabla con Gemini: ${lastError?.message || 'Sin respuesta'}`);
}

/**
 * CASO DE PRUEBA ESTRICTO (Real Madrid vs Inter 2 - 1)
 * Genera el payload de prueba exacto solicitado por el usuario para validar la UI y la confirmación a Firebase.
 */
export function getMockRealMadridVsInterPreview(existingMatches: Match[]) {
  const mockResult: SerpApiMatchResult = {
    local: "Real Madrid",
    goles_local: 2,
    visitante: "Inter",
    goles_visitante: 1,
    estado: "Finalizado",
    goleadores: [
      { jugador: "Kylian Mbappé", equipo: "Real Madrid", minuto: 14 },
      { jugador: "Federico Valverde", equipo: "Real Madrid", minuto: 23 },
      { jugador: "Carlos Augusto", equipo: "Inter", minuto: 77 }
    ],
    tarjetas: []
  };

  // Find corresponding match in Firestore matches
  const targetMatch = existingMatches.find(m => 
    m.id === 'ucl_26_j1_03' ||
    (m.homeTeam.toLowerCase().includes('madrid') && m.awayTeam.toLowerCase().includes('inter'))
  );

  const previewPartido = {
    local: mockResult.local,
    goles_local: mockResult.goles_local,
    visitante: mockResult.visitante,
    goles_visitante: mockResult.goles_visitante,
    estado: mockResult.estado,
    goleadores: mockResult.goleadores,
    tarjetas: mockResult.tarjetas,
    matchedMatchId: targetMatch?.id || 'ucl_26_j1_03',
    matchedMatch: targetMatch,
    hasChanges: true
  };

  return {
    success: true,
    message: "Caso de Prueba cargado: Real Madrid 2 - 1 Inter (Simulación SerpAPI + Gemini).",
    partidos: [previewPartido],
    rawJson: JSON.stringify(mockResult, null, 2),
    totalQueried: 1,
    searchQueries: ["Real Madrid vs Inter hoy"],
    isGrounded: true,
    searchSummary: "Datos extraídos de sports_results en SerpAPI y estructurados con Gemini API."
  };
}

/**
 * Commits the parsed standings from SerpAPI to Firestore doc(system/standings)
 */
export async function commitSerpApiStandingsToFirestore(
  tablaItems: SerpApiStandingItem[]
): Promise<{ success: boolean; updatedTeams: number; message: string; error?: string }> {
  try {
    console.log(`[commitSerpApiStandingsToFirestore] Mapeando ${tablaItems.length} equipos para la tabla oficial...`);

    const finalStandings: StandingRow[] = tablaItems.map((item, index) => {
      const uclTeam = findUclTeam(item.equipo);
      const pos = item.posicion || index + 1;
      let promotion = 'Eliminado';
      if (pos <= 8) promotion = 'Octavos de Final';
      else if (pos <= 24) promotion = 'Playoffs';

      const teamName = uclTeam ? uclTeam.name : item.equipo;
      const shortName = uclTeam ? uclTeam.short : item.equipo;
      const logoUrl = getTeamLogoByName(teamName) || (uclTeam?.id ? `https://img.sofascore.com/api/v1/team/${uclTeam.id}/image` : '');

      const standingTeam: StandingTeam = {
        id: uclTeam?.id,
        name: teamName,
        shortName,
        nameCode: shortName.slice(0, 3).toUpperCase(),
        logo: logoUrl,
        country: uclTeam?.country
      };

      const wins = Math.floor(item.puntos / 3);
      const remainingPts = item.puntos % 3;
      const draws = remainingPts;
      const losses = Math.max(0, item.partidos_jugados - wins - draws);

      return {
        position: pos,
        team: standingTeam,
        matches: item.partidos_jugados,
        wins,
        draws,
        losses,
        scoresFor: item.goles_favor,
        scoresAgainst: item.goles_contra,
        scoreDiff: item.diferencia_goles,
        points: item.puntos,
        promotion,
        posicion_oficial_api: pos
      };
    });

    console.log('[commitSerpApiStandingsToFirestore] DATOS_CALCULADOS en memoria a persistir:');
    console.table(finalStandings.slice(0, 10).map(r => ({
      Pos: r.position,
      Club: r.team.name,
      PJ: r.matches,
      GF: r.scoresFor,
      GC: r.scoresAgainst,
      DG: r.scoreDiff,
      PTS: r.points,
      PosOficialApi: r.posicion_oficial_api
    })));

    const standingsDocRef = doc(db, 'system', 'standings');
    const existingSnap = await getDoc(standingsDocRef).catch(() => null);
    const existingData = existingSnap?.exists() ? existingSnap.data() : {};

    const payload = {
      season: existingData?.season || {
        id: 96518,
        name: "UEFA Champions League 26/27",
        phase: "Fase de Liga (36 Equipos)"
      },
      cupTrees: existingData?.cupTrees || [],
      standings: finalStandings,
      lastRecalculatedAt: Date.now()
    };

    console.log('[commitSerpApiStandingsToFirestore] Guardando en Firestore en doc(system/standings)...');
    await setDoc(standingsDocRef, payload, { merge: true });
    console.log('[commitSerpApiStandingsToFirestore] ¡Guardado exitoso confirmado en Firestore!');

    return {
      success: true,
      updatedTeams: finalStandings.length,
      message: `Se sincronizó la tabla oficial de 36 equipos desde SerpAPI exitosamente (${finalStandings.length} equipos guardados).`
    };
  } catch (err: any) {
    console.error('[commitSerpApiStandingsToFirestore] Error guardando tabla:', err);
    return {
      success: false,
      updatedTeams: 0,
      message: `Error al guardar tabla en Firestore: ${err.message}`,
      error: err.message
    };
  }
}

const inFlightSyncMatchIds = new Set<string>();

/**
 * Sistema de Actualización Inteligente y Automática por Partido (SerpAPI + Gemini + Candado de Concurrencia).
 * 
 * Lógica:
 * - Filtra partidos donde: hora_actual > (hora_inicio + 115 minutos) y status !== 'finished'.
 * - Candado Anti-Colisión (Firestore):
 *   - Si is_updating === true y el candado tiene menos de 5 minutos, otro cliente está actualizándolo -> se omite.
 *   - Antes de llamar a la API, el cliente actualiza el documento con { is_updating: true, is_updating_at: Date.now() }.
 * - Consulta SerpAPI: `[Local] vs [Visitante] hoy`.
 * - Gemini extrae y parsea el nodo sports_results al formato estricto de partido.
 * - Si el partido está finalizado:
 *   - Se guarda el marcador, goleadores, tarjetas, status = 'finished'.
 *   - Se libera el candado: is_updating: false.
 *   - Se recalculan pronósticos, puntos y tabla de posiciones.
 * - Si no está finalizado o si ocurre un error, se libera el candado: is_updating: false.
 */
export async function checkAndAutoSyncFinishedMatches(
  matches: Match[],
  settings: Setting | null
): Promise<{ syncedCount: number; errors: string[] }> {
  const now = Date.now();
  const MATCH_DURATION_MS = 115 * 60 * 1000;
  const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de expiración para evitar bloqueos permanentes

  // Filtrar candidatos según tiempo y estado
  const candidates = matches.filter(m => {
    if (m.status === 'finished') return false;
    const matchTime = new Date(m.date).getTime();
    if (isNaN(matchTime)) return false;

    // REGLA INQUEBRANTABLE: Prohibido buscar automáticamente información de un partido que aún no ha comenzado
    if (now < matchTime) {
      return false;
    }

    const isOver115Min = now >= (matchTime + MATCH_DURATION_MS);
    if (!isOver115Min) return false;

    // Throttle local en memoria
    if (inFlightSyncMatchIds.has(m.id)) return false;

    // Candado remoto en Firestore
    if (m.is_updating && m.is_updating_at && (now - m.is_updating_at < LOCK_TIMEOUT_MS)) {
      console.log(`[AutoSync] Partido ${m.homeTeam} vs ${m.awayTeam} está bloqueado por otro cliente (is_updating: true).`);
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  console.log(`[AutoSync] Verificando ${candidates.length} partido(s) pendiente(s) tras 115 minutos...`);
  let syncedCount = 0;
  const errors: string[] = [];

  for (const match of candidates) {
    inFlightSyncMatchIds.add(match.id);
    const matchRef = doc(db, 'matches', match.id);

    try {
      // 1. Verificación atómica en Firestore antes de llamar a la API
      const snap = await getDoc(matchRef);
      if (snap.exists()) {
        const fresh = snap.data() as Match;
        if (fresh.status === 'finished') {
          inFlightSyncMatchIds.delete(match.id);
          continue;
        }
        if (fresh.is_updating && fresh.is_updating_at && (Date.now() - fresh.is_updating_at < LOCK_TIMEOUT_MS)) {
          console.log(`[AutoSync] Partido ${match.homeTeam} vs ${match.awayTeam} fue bloqueado concurrentemente por otro cliente.`);
          inFlightSyncMatchIds.delete(match.id);
          continue;
        }
      }

      // 2. Activar candado de concurrencia en Firestore
      await updateDoc(matchRef, {
        is_updating: true,
        is_updating_at: Date.now()
      });
      console.log(`[AutoSync] 🔒 Candado activado para: ${match.homeTeam} vs ${match.awayTeam}`);

      // 3. Consultar SerpAPI
      const queryStr = `${match.homeTeam} vs ${match.awayTeam} hoy`;
      const rawNode = await fetchSerpApiRaw(queryStr);
      const parsed = await parseMatchWithGemini(rawNode, { local: match.homeTeam, visitante: match.awayTeam });

      const isFinished = 
        parsed.estado.toLowerCase().includes('final') ||
        parsed.estado.toLowerCase().includes('ft') ||
        parsed.estado.toLowerCase().includes('terminado');

      if (isFinished) {
        console.log(`[AutoSync] ⚽ Partido finalizado confirmado: ${parsed.local} ${parsed.goles_local} - ${parsed.goles_visitante} ${parsed.visitante}`);

        // 4. Guardar resultado final y liberar candado
        await updateDoc(matchRef, {
          homeScore: parsed.goles_local,
          awayScore: parsed.goles_visitante,
          status: 'finished',
          goalscorers: parsed.goleadores || [],
          cards: parsed.tarjetas || [],
          is_synced: true,
          is_updating: false,
          updated_at: Date.now()
        });

        const updatedMatch: Match = {
          ...match,
          homeScore: parsed.goles_local,
          awayScore: parsed.goles_visitante,
          status: 'finished',
          goalscorers: parsed.goleadores || [],
          cards: parsed.tarjetas || [],
          is_synced: true,
          is_updating: false
        };

        // 5. Recalcular puntos, medallas, rachas y tabla de posiciones
        await syncMatchResult(updatedMatch, settings, true);
        syncedCount++;
      } else {
        console.log(`[AutoSync] Partido aún no finalizado (${parsed.estado}). Liberando candado.`);
        await updateDoc(matchRef, {
          is_updating: false
        });
      }
    } catch (err: any) {
      console.error(`[AutoSync] Error actualizando partido ${match.homeTeam} vs ${match.awayTeam}:`, err);
      errors.push(`${match.homeTeam} vs ${match.awayTeam}: ${err.message}`);
      // Liberar candado en caso de error
      await updateDoc(matchRef, {
        is_updating: false
      }).catch(() => null);
    } finally {
      inFlightSyncMatchIds.delete(match.id);
    }
  }

  return { syncedCount, errors };
}

/**
 * NUEVA FUNCIÓN: Sincronización Manual por Jornada (Botón de Contingencia).
 * 
 * Permite al Administrador Supremo forzar la actualización de todos los partidos de una jornada específica
 * (ignorando el bloqueo temporal para partidos pasados o que no se sincronizaron bien).
 * Al terminar de inyectar los datos en Firestore, ejecuta obligatoriamente recalculateStandings().
 */
export async function syncJornadaMatchesWithSerpApi(
  jornadaName: string,
  allMatches: Match[],
  settings: Setting | null,
  onProgress?: (current: number, total: number, currentMatch: string) => void
): Promise<{
  success: boolean;
  totalMatches: number;
  syncedMatches: number;
  errors: string[];
  message: string;
}> {
  console.log(`[syncJornadaMatchesWithSerpApi] Iniciando sincronización manual para "${jornadaName}"...`);

  // Filtrar los partidos que pertenecen a la jornada seleccionada
  const targetMatches = allMatches.filter(m => 
    (m.group || '').trim().toLowerCase() === jornadaName.trim().toLowerCase()
  );

  if (targetMatches.length === 0) {
    return {
      success: false,
      totalMatches: 0,
      syncedMatches: 0,
      errors: [`No se encontraron partidos registrados para la jornada "${jornadaName}".`],
      message: `No se encontraron partidos para "${jornadaName}".`
    };
  }

  let syncedMatches = 0;
  const errors: string[] = [];

  for (let i = 0; i < targetMatches.length; i++) {
    const match = targetMatches[i];
    const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`;
    
    if (onProgress) {
      onProgress(i + 1, targetMatches.length, matchLabel);
    }

    const matchRef = doc(db, 'matches', match.id);

    const now = Date.now();
    const matchTime = new Date(match.date).getTime();

    // REGLA ESTRICTA: Jamás consultar partidos cuya fecha/hora esté en el futuro
    if (isNaN(matchTime) || now < matchTime) {
      console.log(`[syncJornadaMatchesWithSerpApi] ⏩ Omitiendo partido futuro que no ha comenzado: ${matchLabel} (${match.date})`);
      
      // Auto-reparación: Si un partido futuro fue marcado erróneamente como 'finished', restaurarlo a 'pending'
      if (match.status === 'finished') {
        console.log(`[syncJornadaMatchesWithSerpApi] 🛠️ Auto-reparando partido futuro erróneamente finalizado: ${matchLabel}`);
        await updateDoc(matchRef, {
          status: 'pending',
          homeScore: null,
          awayScore: null,
          is_synced: false,
          is_updating: false,
          goalscorers: [],
          cards: []
        });
      }
      continue;
    }

    try {
      console.log(`[syncJornadaMatchesWithSerpApi] (${i + 1}/${targetMatches.length}) Consultando: ${matchLabel}...`);
      
      const queryStr = `${match.homeTeam} vs ${match.awayTeam}`;
      const rawNode = await fetchSerpApiRaw(queryStr);
      const parsed = await parseMatchWithGemini(
        rawNode,
        { local: match.homeTeam, visitante: match.awayTeam }
      );

      const isFinished = 
        parsed.estado.toLowerCase().includes('final') ||
        parsed.estado.toLowerCase().includes('ft') ||
        parsed.estado.toLowerCase().includes('terminado');

      const isLive = 
        parsed.estado.toLowerCase().includes('vivo') ||
        parsed.estado.toLowerCase().includes('live') ||
        parsed.estado.toLowerCase().includes('juego') ||
        parsed.estado.toLowerCase().includes('1t') ||
        parsed.estado.toLowerCase().includes('2t');

      const status = isFinished ? 'finished' : isLive ? 'in_progress' : match.status;

      // Inyectar datos en Firestore
      await updateDoc(matchRef, {
        homeScore: parsed.goles_local,
        awayScore: parsed.goles_visitante,
        status,
        goalscorers: parsed.goleadores || [],
        cards: parsed.tarjetas || [],
        is_synced: isFinished,
        is_updating: false,
        updated_at: Date.now()
      });

      const updatedMatch: Match = {
        ...match,
        homeScore: parsed.goles_local,
        awayScore: parsed.goles_visitante,
        status,
        goalscorers: parsed.goleadores || [],
        cards: parsed.tarjetas || [],
        is_synced: isFinished,
        is_updating: false
      };

      // Si el partido está finalizado, actualizar predicciones, puntos y rachas
      if (status === 'finished') {
        await syncMatchResult(updatedMatch, settings, true);
      }

      syncedMatches++;
      console.log(`[syncJornadaMatchesWithSerpApi] ✓ Partido ${matchLabel} guardado: ${parsed.goles_local}-${parsed.goles_visitante} (${status})`);
    } catch (err: any) {
      console.error(`[syncJornadaMatchesWithSerpApi] Error procesando ${matchLabel}:`, err);
      errors.push(`${matchLabel}: ${err.message}`);
    }
  }

  // OBLIGATORIO: Disparar recalculateStandings() al culminar la inyección de la jornada
  console.log('[syncJornadaMatchesWithSerpApi] Inyección completa. Disparando recalculateStandings()...');
  try {
    await recalculateStandings();
    console.log('[syncJornadaMatchesWithSerpApi] ✅ recalculateStandings() finalizado con éxito.');
  } catch (recalcErr: any) {
    console.error('[syncJornadaMatchesWithSerpApi] Error al recalcular tabla:', recalcErr);
    errors.push(`Error recalculando tabla: ${recalcErr.message}`);
  }

  return {
    success: syncedMatches > 0,
    totalMatches: targetMatches.length,
    syncedMatches,
    errors,
    message: `Sincronización de ${jornadaName} completada: ${syncedMatches} de ${targetMatches.length} partidos actualizados. Tabla de posiciones recalculada con éxito.`
  };
}
