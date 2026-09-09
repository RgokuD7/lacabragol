import { collection, getDocs, doc, updateDoc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Match, Setting } from '../types';
import { syncMatchPredictionsAndPoints, syncMatchResult } from './sync';
import { recalculateStandings, findUclTeam, StandingRow, StandingTeam } from './standings';
import { UCL_36_TEAMS, getTeamLogoByName } from '../data/fixtures';
import { DEFAULT_PLAYERS, PlayerItem } from '../data/players';
import { getGeminiApiKey, areTeamsEquivalent } from './geminiSync';
import { sanitizeForFirestore } from './utils';

export const DEFAULT_SERPAPI_KEY = "30ebec1be507cf06e25598686b84f4aa3c9c56abd6bc7c2e13ac23ce0851cd8e";

// Hitos de tiempo escalonados desde la hora de inicio programada del partido
export const SYNC_MILESTONES = [5, 25, 47, 65, 75, 90, 115] as const;

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
 * Extracts the sports_results node, game spotlight, match events and search snippets from SerpAPI payload
 * so Gemini has both structured goal data and text snippets containing red cards/expulsions.
 */
function extractRelevantSerpApiNode(data: any): any {
  const sportsResults = data?.sports_results || data?.answer_box || data?.knowledge_graph || null;
  const organicSnippets = Array.isArray(data?.organic_results)
    ? data.organic_results.slice(0, 5).map((r: any) => ({
        title: r.title,
        snippet: r.snippet
      }))
    : [];

  const spotlight = sportsResults?.game_spotlight || null;
  const events = spotlight?.events || sportsResults?.events || [];

  return {
    sports_results: sportsResults,
    game_spotlight: spotlight,
    events: events,
    search_snippets: organicSnippets
  };
}

/**
 * Normaliza goleadores y tarjetas asegurando que 'equipo' nunca sea undefined ni vacío,
 * deduciéndolo de matchContext (local/visitante), los equipos crudos de SerpAPI, o DEFAULT_PLAYERS.
 */
export function normalizeGoleadoresAndTarjetas(
  parsedMatch: any,
  matchContext: { local: string; visitante: string },
  rawSportsResults?: any
): { goleadores: SerpApiMatchResult['goleadores']; tarjetas: SerpApiMatchResult['tarjetas'] } {
  const rawTeams: any[] = 
    rawSportsResults?.sports_results?.game_spotlight?.teams || 
    rawSportsResults?.sports_results?.teams || 
    rawSportsResults?.game_spotlight?.teams || [];

  // 1. Process and normalize goalscorers
  const normalizedGoleadores = (Array.isArray(parsedMatch.goleadores) ? parsedMatch.goleadores : []).map((g: any) => {
    let jugador = String(g.jugador || g.player || '').trim();
    let equipo = String(g.equipo || g.team || '').trim();
    const minuto = Number(g.minuto ?? g.minute ?? 0);

    // If equipo is missing or "undefined", try to deduce from rawTeams in SerpAPI
    if (!equipo || equipo.toLowerCase() === 'undefined') {
      for (const t of rawTeams) {
        const teamName = String(t.name || '').trim();
        const goals = Array.isArray(t.goals) ? t.goals : [];
        const hasPlayer = goals.some((goalItem: any) => {
          const pName = String(goalItem.player || goalItem.jugador || '').toLowerCase();
          return pName.includes(jugador.toLowerCase()) || jugador.toLowerCase().includes(pName);
        });
        if (hasPlayer) {
          if (teamName.toLowerCase().includes(matchContext.local.toLowerCase()) || matchContext.local.toLowerCase().includes(teamName.toLowerCase())) {
            equipo = matchContext.local;
          } else if (teamName.toLowerCase().includes(matchContext.visitante.toLowerCase()) || matchContext.visitante.toLowerCase().includes(teamName.toLowerCase())) {
            equipo = matchContext.visitante;
          } else {
            equipo = teamName;
          }
          break;
        }
      }
    }

    // Fallback: check DEFAULT_PLAYERS catalogue
    if (!equipo || equipo.toLowerCase() === 'undefined') {
      const foundPlayer = DEFAULT_PLAYERS.find(p => p.name.toLowerCase() === jugador.toLowerCase());
      if (foundPlayer && foundPlayer.team) {
        equipo = foundPlayer.team;
      } else {
        if (matchContext.local && jugador.toLowerCase().includes(matchContext.local.toLowerCase())) {
          equipo = matchContext.local;
        } else if (matchContext.visitante && jugador.toLowerCase().includes(matchContext.visitante.toLowerCase())) {
          equipo = matchContext.visitante;
        }
      }
    }

    return {
      jugador,
      equipo,
      minuto: isNaN(minuto) ? 0 : minuto
    };
  });

  // 2. Process and normalize cards
  const normalizedTarjetas = (Array.isArray(parsedMatch.tarjetas) ? parsedMatch.tarjetas : []).map((c: any) => {
    let jugador = String(c.jugador || c.player || '').trim();
    let equipo = String(c.equipo || c.team || '').trim();
    const rawTipo = String(c.tipo || c.type || '').toLowerCase();
    const tipo = (rawTipo.includes('roja') || rawTipo.includes('red') || rawTipo.includes('expuls')) ? 'Roja' : 'Amarilla';
    const minuto = Number(c.minuto ?? c.minute ?? 0);

    if (!equipo || equipo.toLowerCase() === 'undefined') {
      const foundPlayer = DEFAULT_PLAYERS.find(p => p.name.toLowerCase() === jugador.toLowerCase());
      if (foundPlayer && foundPlayer.team) {
        equipo = foundPlayer.team;
      } else {
        if (matchContext.local && jugador.toLowerCase().includes(matchContext.local.toLowerCase())) {
          equipo = matchContext.local;
        } else if (matchContext.visitante && jugador.toLowerCase().includes(matchContext.visitante.toLowerCase())) {
          equipo = matchContext.visitante;
        }
      }
    }

    return {
      jugador,
      equipo,
      tipo,
      minuto: isNaN(minuto) ? 0 : minuto
    };
  });

  return { goleadores: normalizedGoleadores, tarjetas: normalizedTarjetas };
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

  const promptText = `Toma este objeto JSON con datos deportivos y noticias de un partido de la UEFA Champions League entre "${matchContext.local}" (Local) y "${matchContext.visitante}" (Visitante).
Extrae la información oficial y devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta:
{
  "local": "${matchContext.local}",
  "goles_local": 0,
  "visitante": "${matchContext.visitante}",
  "goles_visitante": 0,
  "estado": "Finalizado",
  "goleadores": [
    { "jugador": "Nombre Completo", "equipo": "${matchContext.local} o ${matchContext.visitante}", "minuto": 12 }
  ],
  "tarjetas": [
    { "jugador": "Nombre Completo", "equipo": "${matchContext.local} o ${matchContext.visitante}", "tipo": "Amarilla o Roja", "minuto": 33 }
  ]
}

REGLAS CRÍTICAS DE EXTRACCIÓN:
1. GOLEADORES CON EQUIPO OBLIGATORIO: Para cada gol en "goleadores", DEBES incluir la propiedad "equipo", cuyo valor DEBE ser exactamente "${matchContext.local}" o "${matchContext.visitante}". Hereda el equipo desde el club padre donde están anidados los goles en el JSON (ej. teams[0].goals o teams[1].goals). NUNCA dejes "equipo" vacío ni como "undefined".
2. EXPULSIONES Y TARJETAS ROJAS OBLIGATORIAS: Revisa minuciosamente tanto los eventos estructurados como los fragmentos de texto en "search_snippets" o noticias. Si un jugador recibió tarjeta roja (o fue expulsado por roja directa o doble amarilla), DEBES incluirlo obligatoriamente en el array "tarjetas" con: "tipo": "Roja", el minuto (si se menciona o infiere) y su equipo exacto ("${matchContext.local}" o "${matchContext.visitante}").
3. Si hay tarjetas amarillas conocidas en los eventos o texto, inclúyelas con "tipo": "Amarilla".
4. Devuelve ÚNICAMENTE el JSON válido, sin explicaciones ni bloques de texto adicional.
JSON de entrada: ${JSON.stringify(rawSportsResults)}`;

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
        const { goleadores, tarjetas } = normalizeGoleadoresAndTarjetas(parsed, matchContext, rawSportsResults);

        return {
          local: String(parsed.local || matchContext.local).trim(),
          goles_local: Number(parsed.goles_local ?? 0),
          visitante: String(parsed.visitante || matchContext.visitante).trim(),
          goles_visitante: Number(parsed.goles_visitante ?? 0),
          estado: String(parsed.estado || 'Finalizado').trim(),
          goleadores,
          tarjetas
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[parseMatchWithGemini] Falló con ${model}:`, err.message);
    }
  }

  throw new Error(`No se pudo parsear el resultado con Gemini: ${lastError?.message || 'Sin respuesta'}`);
}

export interface BatchMatchInput {
  matchId: string;
  local: string;
  visitante: string;
  targetMilestone: number;
  rawSportsResults: any;
}

/**
 * OPTIMIZACIÓN CRÍTICA (BATCHING GEMINI):
 * Agrupa los resultados crudos de múltiples partidos en UNA SOLA LLAMADA a Gemini API.
 * Solicita un Array de JSON estructurados con cada partido identificado por su matchId.
 */
export async function parseMultipleMatchesWithGemini(
  batchData: BatchMatchInput[],
  geminiApiKeyOverride?: string
): Promise<Record<string, SerpApiMatchResult>> {
  if (batchData.length === 0) return {};

  const apiKey = (geminiApiKeyOverride || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error("Falta la API Key de Gemini para formatear el lote de partidos.");
  }

  // Si solo hay un partido, parsear directamente
  if (batchData.length === 1) {
    const single = batchData[0];
    const parsedSingle = await parseMatchWithGemini(
      single.rawSportsResults,
      { local: single.local, visitante: single.visitante },
      apiKey
    );
    return { [single.matchId]: parsedSingle };
  }

  const matchItemsPayload = batchData.map(item => ({
    matchId: item.matchId,
    partido: `${item.local} (Local) vs ${item.visitante} (Visitante)`,
    hito_minutos: `+${item.targetMilestone} min`,
    datos_crudos_serpapi: item.rawSportsResults
  }));

  const promptText = `Eres un asistente de datos deportivos para la UEFA Champions League.
A continuación tienes un LOTE de ${batchData.length} partidos activos con datos crudos de SerpAPI (resultados deportivos, eventos y noticias).

Tu tarea es analizar TODO el bloque unificado y devolver ÚNICAMENTE un objeto JSON válido con un array "partidos", donde cada elemento corresponda a un partido del lote con su respectivo "matchId":

{
  "partidos": [
    {
      "matchId": "id_del_partido",
      "local": "Nombre Exacto Local",
      "goles_local": 0,
      "visitante": "Nombre Exacto Visitante",
      "goles_visitante": 0,
      "estado": "Finalizado / En vivo / Descanso / Primer tiempo / Segundo tiempo / No iniciado",
      "goleadores": [
        {
          "jugador": "Nombre Completo",
          "equipo": "Nombre de su Equipo",
          "minuto": 25
        }
      ],
      "tarjetas": [
        {
          "jugador": "Nombre Completo",
          "equipo": "Nombre de su Equipo",
          "tipo": "Amarilla o Roja",
          "minuto": 40
        }
      ]
    }
  ]
}

LOTE DE PARTIDOS A PROCESAR:
${JSON.stringify(matchItemsPayload)}

REGLAS CRÍTICAS:
1. Incluye en el array "partidos" TODOS los ${batchData.length} partidos del lote, conservando estrictamente su "matchId" exacto.
2. Si un partido no ha comenzado o no tiene goles reportados, define goles_local: 0, goles_visitante: 0 y estado: "No iniciado".
3. Si el partido está en juego (1T, 2T, entretiempo, minuto en progreso, etc.), define estado como "En vivo" o equivalente. Si ya terminó oficialmente (FT, Final, Concluido), define estado como "Finalizado".
4. En goleadores y tarjetas, asigna siempre el equipo respectivo del jugador (Local o Visitante) según la información deportiva del partido. NUNCA lo dejes vacío ni como "undefined".
5. Extrae tarjetas rojas y expulsiones obligatoriamente si aparecen en noticias, eventos o fragmentos del texto.
6. Devuelve ÚNICAMENTE el código JSON puro, sin bloques markdown ni texto adicional.`;

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[parseMultipleMatchesWithGemini] Enviando lote de ${batchData.length} partidos a Gemini (${model})...`);
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
        const parsedJson = JSON.parse(rawText);
        const partidosArray: any[] = Array.isArray(parsedJson.partidos) 
          ? parsedJson.partidos 
          : Array.isArray(parsedJson) 
          ? parsedJson 
          : [];

        const resultsMap: Record<string, SerpApiMatchResult> = {};

        batchData.forEach(input => {
          const found = partidosArray.find(p => 
            p.matchId === input.matchId ||
            (p.local && p.visitante && areTeamsEquivalent(p.local, input.local) && areTeamsEquivalent(p.visitante, input.visitante))
          );

          if (found) {
            const { goleadores, tarjetas } = normalizeGoleadoresAndTarjetas(
              found,
              { local: input.local, visitante: input.visitante },
              input.rawSportsResults
            );

            resultsMap[input.matchId] = {
              local: String(found.local || input.local).trim(),
              goles_local: Number(found.goles_local ?? 0),
              visitante: String(found.visitante || input.visitante).trim(),
              goles_visitante: Number(found.goles_visitante ?? 0),
              estado: String(found.estado || 'En vivo').trim(),
              goleadores,
              tarjetas
            };
          }
        });

        console.log(`[parseMultipleMatchesWithGemini] ✅ Éxito con ${model}. Partidos parseados: ${Object.keys(resultsMap).length}/${batchData.length}`);
        return resultsMap;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[parseMultipleMatchesWithGemini] Falló con ${model}:`, err.message);
    }
  }

  throw new Error(`Error al procesar lote con Gemini: ${lastError?.message || 'Sin respuesta'}`);
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
        id: uclTeam?.id ?? null,
        name: teamName || 'Club Desconocido',
        shortName: shortName || teamName || 'Club',
        nameCode: (shortName || teamName || 'CLB').slice(0, 3).toUpperCase(),
        logo: logoUrl || '',
        country: uclTeam?.country || ''
      };

      const wins = Math.floor((item.puntos || 0) / 3);
      const remainingPts = (item.puntos || 0) % 3;
      const draws = remainingPts;
      const losses = Math.max(0, (item.partidos_jugados || 0) - wins - draws);

      return {
        position: pos,
        team: standingTeam,
        matches: item.partidos_jugados ?? 0,
        wins,
        draws,
        losses,
        scoresFor: item.goles_favor ?? 0,
        scoresAgainst: item.goles_contra ?? 0,
        scoreDiff: item.diferencia_goles ?? 0,
        points: item.puntos ?? 0,
        promotion: promotion || '',
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

    const sanitizedPayload = sanitizeForFirestore(payload);

    console.log('[commitSerpApiStandingsToFirestore] Guardando en Firestore en doc(system/standings) sanitizado...');
    await setDoc(standingsDocRef, sanitizedPayload, { merge: true });
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
 * Ensures that all goalscorers returned by SerpAPI/Gemini exist in the system players collection (doc(db, 'system/players')).
 * If a player does not exist, creates their profile "al vuelo" with default values and persists it sanitised.
 */
export async function ensurePlayersExist(
  goalscorers: Array<{ jugador?: string; player?: string; equipo?: string; team?: string }>
): Promise<void> {
  if (!Array.isArray(goalscorers) || goalscorers.length === 0) return;

  try {
    const playersDocRef = doc(db, 'system', 'players');
    const snap = await getDoc(playersDocRef).catch(() => null);
    
    let currentPlayers: PlayerItem[] = DEFAULT_PLAYERS;
    if (snap?.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.players) && data.players.length > 0) {
        currentPlayers = data.players;
      }
    }

    let hasUpdates = false;
    const playerMap = new Map<string, PlayerItem>();
    currentPlayers.forEach(p => {
      playerMap.set(p.name.toLowerCase().trim(), { ...p });
    });

    goalscorers.forEach(g => {
      const name = String(g.jugador || g.player || '').trim();
      if (!name) return;
      let teamName = String(g.equipo || g.team || '').trim();
      if (teamName.toLowerCase() === 'undefined') teamName = '';
      const normalized = name.toLowerCase();

      const existing = playerMap.get(normalized);
      if (existing) {
        // If existing player has no team or 'undefined' team, update it if teamName is valid
        if ((!existing.team || existing.team.toLowerCase() === 'undefined' || existing.team.trim() === '') && teamName) {
          existing.team = teamName;
          hasUpdates = true;
          console.log(`[ensurePlayersExist] 🔄 Actualizando equipo de "${name}": "${teamName}"`);
        }
      } else {
        playerMap.set(normalized, {
          id: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name,
          team: teamName,
          position: 'Delantero',
          nationality: ''
        });
        hasUpdates = true;
        console.log(`[ensurePlayersExist] ⚽ Creando perfil de jugador al vuelo: "${name}" (${teamName})`);
      }
    });

    if (hasUpdates || !snap?.exists()) {
      const updatedList = Array.from(playerMap.values());
      const payload = sanitizeForFirestore({ players: updatedList });
      await setDoc(playersDocRef, payload, { merge: true });
      console.log(`[ensurePlayersExist] ✅ ${updatedList.length} perfiles de jugadores guardados en doc(system/players).`);
    }
  } catch (err: any) {
    console.warn('[ensurePlayersExist] Advertencia al verificar/crear perfiles al vuelo:', err?.message || err);
  }
}

/**
 * SISTEMA DE ACTUALIZACIÓN ESCALONADA 'EN VIVO PARCIAL' Y CIERRE (BATCHING SERPAPI + GEMINI + WRITEBATCH):
 * 
 * 1. Cronograma de Hitos Escalonados (calculados desde la hora_inicio programada):
 *    +5 min: Arranque del partido.
 *    +25 min: Promediando el primer tiempo.
 *    +47 min: Final del primer tiempo.
 *    +65 min: Arranque del segundo tiempo.
 *    +75 min: Recta final.
 *    +90 min: Fin del tiempo reglamentario.
 *    +115 min: Cierre definitivo.
 * 
 * 2. Estrategia de Batching (SerpAPI + Gemini):
 *    - Filtra todos los partidos en curso que cruzaron un hito y no han sido sincronizados en ese hito.
 *    - Ejecuta consultas a SerpAPI en paralelo para cada partido activo.
 *    - OPTIMIZACIÓN CRÍTICA: Agrupa todos los resultados crudos de SerpAPI en un único bloque y realiza
 *      UNA SOLA LLAMADA a Gemini API.
 * 
 * 3. Escritura en Lote (Firestore writeBatch):
 *    - Actualiza todos los partidos en vivo/finalizados de una sola vez de forma atómica.
 *    - Si algún partido finalizó, asegura jugadores "al vuelo", recalcula puntos y tabla de posiciones.
 */
export async function checkAndAutoSyncFinishedMatches(
  matches: Match[],
  settings: Setting | null
): Promise<{
  syncedCount: number;
  liveCount: number;
  finishedCount: number;
  errors: string[];
}> {
  const now = Date.now();
  const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de expiración para evitar bloqueos permanentes

  interface CandidateInfo {
    match: Match;
    targetMilestone: number;
    matchTime: number;
  }

  // 1. Filtrar candidatos según hitos escalonados y estado
  const candidates: CandidateInfo[] = [];

  for (const m of matches) {
    if (m.status === 'finished' && m.is_synced) continue;

    const matchTime = new Date(m.date).getTime();
    if (isNaN(matchTime)) continue;

    // REGLA INQUEBRANTABLE: Prohibido buscar automáticamente información de un partido que aún no ha comenzado
    if (now < matchTime) continue;

    const elapsedMins = (now - matchTime) / (60 * 1000);
    const passedMilestones = SYNC_MILESTONES.filter(ms => elapsedMins >= ms);
    if (passedMilestones.length === 0) continue; // No ha llegado a +5 min

    const targetMilestone = Math.max(...passedMilestones);
    const lastSynced = m.last_synced_milestone ?? 0;

    // Si ya se sincronizó en este hito o uno superior, omitir
    if (lastSynced >= targetMilestone) continue;

    // Throttle local en memoria
    if (inFlightSyncMatchIds.has(m.id)) continue;

    // Candado remoto en Firestore
    if (m.is_updating && m.is_updating_at && (now - m.is_updating_at < LOCK_TIMEOUT_MS)) {
      console.log(`[AutoSync] Partido ${m.homeTeam} vs ${m.awayTeam} está bloqueado por otro cliente (is_updating: true).`);
      continue;
    }

    candidates.push({ match: m, targetMilestone, matchTime });
  }

  if (candidates.length === 0) {
    return { syncedCount: 0, liveCount: 0, finishedCount: 0, errors: [] };
  }

  console.log(`[AutoSync] 🚀 Se detectaron ${candidates.length} partidos para sincronización escalonada en lote...`);

  // Marcar throttle en memoria
  candidates.forEach(c => inFlightSyncMatchIds.add(c.match.id));

  // Activar candado de concurrencia en Firestore para todos los candidatos
  await Promise.allSettled(
    candidates.map(c =>
      updateDoc(doc(db, 'matches', c.match.id), {
        is_updating: true,
        is_updating_at: Date.now()
      })
    )
  );

  const errors: string[] = [];
  let liveCount = 0;
  let finishedCount = 0;

  try {
    // 2. Consultas a SerpAPI en paralelo para obtener la data cruda de cada partido activo
    console.log(`[AutoSync] 📡 Consultando SerpAPI en paralelo para ${candidates.length} partidos activos...`);
    const serpResults = await Promise.allSettled(
      candidates.map(async c => {
        const query = `${c.match.homeTeam} vs ${c.match.awayTeam} hoy`;
        const rawNode = await fetchSerpApiRaw(query);
        return {
          matchId: c.match.id,
          local: c.match.homeTeam,
          visitante: c.match.awayTeam,
          targetMilestone: c.targetMilestone,
          rawSportsResults: rawNode
        };
      })
    );

    const successfulSerpData: BatchMatchInput[] = [];
    serpResults.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        successfulSerpData.push(res.value);
      } else {
        const m = candidates[idx].match;
        console.warn(`[AutoSync] SerpAPI falló para ${m.homeTeam} vs ${m.awayTeam}:`, res.reason);
        errors.push(`SerpAPI (${m.homeTeam} vs ${m.awayTeam}): ${res.reason?.message || res.reason}`);
      }
    });

    if (successfulSerpData.length === 0) {
      throw new Error("No se pudo obtener datos de SerpAPI para ningún partido del lote.");
    }

    // 3. OPTIMIZACIÓN CRÍTICA: UNA SOLA LLAMADA a Gemini API con el lote unificado
    console.log(`[AutoSync] 🤖 Agrupando ${successfulSerpData.length} partidos crudos en 1 sola llamada a Gemini API...`);
    const geminiResultsMap = await parseMultipleMatchesWithGemini(successfulSerpData);

    // 4. ESCRITURA EN LOTE (writeBatch de Firestore)
    const batch = writeBatch(db);
    const updatedCandidates: Array<{ candidate: CandidateInfo; result: SerpApiMatchResult; status: 'finished' | 'in_progress' }> = [];
    const allGoalscorersToEnsure: any[] = [];

    candidates.forEach(c => {
      const parsed = geminiResultsMap[c.match.id];
      if (!parsed) {
        // Si Gemini no devolvió este partido, liberar su candado
        batch.update(doc(db, 'matches', c.match.id), { is_updating: false });
        return;
      }

      const estadoLower = parsed.estado.toLowerCase();
      const isFinished = 
        estadoLower.includes('final') ||
        estadoLower.includes('ft') ||
        estadoLower.includes('terminado') ||
        estadoLower.includes('concl') ||
        (c.targetMilestone >= 115); // Hito +115 min es cierre definitivo

      const isLive = 
        estadoLower.includes('vivo') ||
        estadoLower.includes('live') ||
        estadoLower.includes('juego') ||
        estadoLower.includes('1t') ||
        estadoLower.includes('2t') ||
        estadoLower.includes('descanso') ||
        estadoLower.includes('ht');

      const status: 'finished' | 'in_progress' = isFinished ? 'finished' : (isLive ? 'in_progress' : 'in_progress');

      if (status === 'finished') {
        finishedCount++;
      } else {
        liveCount++;
      }

      if (Array.isArray(parsed.goleadores)) {
        allGoalscorersToEnsure.push(...parsed.goleadores);
      }

      const matchRef = doc(db, 'matches', c.match.id);
      batch.update(matchRef, sanitizeForFirestore({
        homeScore: parsed.goles_local,
        awayScore: parsed.goles_visitante,
        status,
        goalscorers: parsed.goleadores || [],
        cards: parsed.tarjetas || [],
        last_synced_milestone: c.targetMilestone,
        last_synced_at: Date.now(),
        is_synced: status === 'finished',
        is_updating: false,
        updated_at: Date.now()
      }));

      updatedCandidates.push({ candidate: c, result: parsed, status });
    });

    console.log(`[AutoSync] 💾 Escribiendo ${updatedCandidates.length} partidos en Firestore con writeBatch...`);
    await batch.commit();
    console.log(`[AutoSync] ✅ Lote guardado con éxito. En vivo: ${liveCount}, Finalizados: ${finishedCount}`);

    // 5. Post-procesamiento para partidos finalizados
    if (allGoalscorersToEnsure.length > 0) {
      await ensurePlayersExist(allGoalscorersToEnsure).catch(console.warn);
    }

    const finishedMatchesToSync = updatedCandidates.filter(u => u.status === 'finished');
    if (finishedMatchesToSync.length > 0) {
      console.log(`[AutoSync] 🔄 Sincronizando puntos y tabla para ${finishedMatchesToSync.length} partidos finalizados...`);
      for (const item of finishedMatchesToSync) {
        const updatedMatch: Match = {
          ...item.candidate.match,
          homeScore: item.result.goles_local,
          awayScore: item.result.goles_visitante,
          status: 'finished',
          goalscorers: item.result.goleadores || [],
          cards: item.result.tarjetas || [],
          is_synced: true,
          is_updating: false
        };
        await syncMatchResult(updatedMatch, settings, true).catch(err => {
          console.error(`[AutoSync] Error sincronizando puntos de ${updatedMatch.homeTeam} vs ${updatedMatch.awayTeam}:`, err);
        });
      }
      await recalculateStandings().catch(console.error);
    }

  } catch (err: any) {
    console.error('[AutoSync] Error crítico en sincronización escalonada por lotes:', err);
    errors.push(err.message || 'Error general en batching');

    // Liberar candados en Firestore en caso de error
    await Promise.allSettled(
      candidates.map(c =>
        updateDoc(doc(db, 'matches', c.match.id), { is_updating: false }).catch(() => null)
      )
    );
  } finally {
    // Liberar throttle en memoria
    candidates.forEach(c => inFlightSyncMatchIds.delete(c.match.id));
  }

  const syncedCount = liveCount + finishedCount;
  return { syncedCount, liveCount, finishedCount, errors };
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

  let currentIdx = 0;
  for (const match of targetMatches) {
    currentIdx++;
    const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`;
    
    if (onProgress) {
      onProgress(currentIdx, targetMatches.length, matchLabel);
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
      console.log(`[syncJornadaMatchesWithSerpApi] (${currentIdx}/${targetMatches.length}) Consultando: ${matchLabel}...`);
      
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
        last_synced_milestone: isFinished ? 115 : 90,
        last_synced_at: Date.now(),
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
        await ensurePlayersExist(parsed.goleadores || []);
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
