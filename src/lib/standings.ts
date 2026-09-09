import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UCL_36_TEAMS, UCL_LEAGUE_PHASE_MATCHES, getTeamLogoByName } from '../data/fixtures';
import { Match } from '../types';

export interface StandingTeam {
  id?: number;
  name: string;
  shortName: string;
  nameCode?: string;
  logo: string;
  country?: string;
}

export interface StandingRow {
  position: number;
  team: StandingTeam;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  scoresFor: number;
  scoresAgainst: number;
  scoreDiff: number;
  points: number;
  promotion: string;
  awayGoals?: number;
  awayWins?: number;
  posicion_oficial_api?: number;
}

/**
 * Strips accents/diacritics, punctuation, extra spaces and lowers case.
 */
export function normalizeTeamStr(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents (é -> e, ü -> u, etc.)
    .replace(/[øØ]/g, 'o')
    .replace(/[šŠ]/g, 's')
    .replace(/[čČ]/g, 'c')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Comprehensive dictionary of aliases and common name variations for all 36 UCL teams.
 * Maps normalized variant strings directly to the official UCL team ID.
 */
export const UCL_TEAM_ALIASES: Record<string, number> = {
  // Real Madrid (2829)
  'real madrid': 2829,
  'madrid': 2829,
  'real madrid cf': 2829,
  'r madrid': 2829,

  // FC Barcelona (2817)
  'barcelona': 2817,
  'fc barcelona': 2817,
  'barca': 2817,

  // Atlético Madrid (2836)
  'atletico madrid': 2836,
  'atletico de madrid': 2836,
  'atletico': 2836,
  'atl madrid': 2836,
  'atleti': 2836,
  'club atletico de madrid': 2836,

  // FC Bayern München (2672)
  'bayern': 2672,
  'bayern munich': 2672,
  'bayern munchen': 2672,
  'fc bayern': 2672,
  'fc bayern munchen': 2672,
  'fc bayern munich': 2672,
  'bayern de munich': 2672,

  // Manchester City (17)
  'manchester city': 17,
  'man city': 17,
  'mancity': 17,
  'mcfc': 17,

  // Manchester United (35)
  'manchester united': 35,
  'man united': 35,
  'man utd': 35,
  'manutd': 35,
  'mufc': 35,

  // Arsenal (42)
  'arsenal': 42,
  'arsenal fc': 42,

  // Aston Villa (40)
  'aston villa': 40,
  'villa': 40,
  'aston villa fc': 40,

  // Liverpool FC (44)
  'liverpool': 44,
  'liverpool fc': 44,

  // Paris Saint-Germain (1644)
  'psg': 1644,
  'paris saint germain': 1644,
  'paris sg': 1644,
  'paris': 1644,

  // Inter (2697)
  'inter': 2697,
  'inter milan': 2697,
  'inter de milan': 2697,
  'internazionale': 2697,
  'fc internazionale': 2697,

  // AS Roma (2702)
  'roma': 2702,
  'as roma': 2702,

  // SSC Napoli (2714)
  'napoli': 2714,
  'ssc napoli': 2714,

  // Como (2704)
  'como': 2704,
  'como 1907': 2704,

  // Borussia Dortmund (2673)
  'dortmund': 2673,
  'borussia dortmund': 2673,
  'bvb': 2673,
  'bvb dortmund': 2673,

  // RB Leipzig (36360)
  'rb leipzig': 36360,
  'leipzig': 36360,
  'rasenballsport leipzig': 36360,

  // VfB Stuttgart (2677)
  'stuttgart': 2677,
  'vfb stuttgart': 2677,

  // FC Porto (3002)
  'porto': 3002,
  'fc porto': 3002,

  // Sporting CP (3001)
  'sporting': 3001,
  'sporting cp': 3001,
  'sporting lisboa': 3001,
  'sporting lisbon': 3001,
  'sporting de portugal': 3001,

  // Feyenoord (2959)
  'feyenoord': 2959,
  'feyenoord rotterdam': 2959,

  // PSV Eindhoven (2952)
  'psv': 2952,
  'psv eindhoven': 2952,

  // Club Brugge KV (2888)
  'club brugge': 2888,
  'club brugge kv': 2888,
  'brugge': 2888,
  'brujas': 2888,
  'club brujas': 2888,

  // Real Betis (2816)
  'real betis': 2816,
  'betis': 2816,
  'real betis balompie': 2816,

  // Villarreal (2819)
  'villarreal': 2819,
  'villarreal cf': 2819,

  // Lille (1643)
  'lille': 1643,
  'losc lille': 1643,
  'losc': 1643,

  // RC Lens (1648)
  'lens': 1648,
  'rc lens': 1648,

  // Bodø/Glimt (656)
  'bodo glimt': 656,
  'bodo': 656,
  'fk bodo glimt': 656,

  // Viking FK (1164)
  'viking': 1164,
  'viking fk': 1164,

  // SK Slavia Praha (2216)
  'slavia praha': 2216,
  'sk slavia praha': 2216,
  'slavia praga': 2216,
  'slavia': 2216,

  // ŠK Slovan Bratislava (2404)
  'slovan bratislava': 2404,
  'sk slovan bratislava': 2404,
  'slovan': 2404,

  // Fenerbahçe (3052)
  'fenerbahce': 3052,
  'fenerbahce sk': 3052,
  'fener': 3052,

  // Galatasaray (3061)
  'galatasaray': 3061,
  'galatasaray sk': 3061,
  'gala': 3061,

  // Shakhtar Donetsk (3313)
  'shakhtar': 3313,
  'shakhtar donetsk': 3313,
  'fc shakhtar donetsk': 3313,

  // Sabah FK (267828)
  'sabah': 267828,
  'sabah fk': 267828,

  // LASK (2058)
  'lask': 2058,
  'lask linz': 2058,

  // AEK Athens (3250)
  'aek': 3250,
  'aek athens': 3250,
  'aek atenas': 3250,
  'aek fc': 3250
};

/**
 * Robust UCL Team finder.
 * Matches by explicit ID, fixture matching, alias mapping, accent-free normalization, and substring containment.
 */
export function findUclTeam(
  name?: string,
  candidateId?: number | string,
  matchDoc?: Match
) {
  // 1. If explicit ID provided or found in candidateId
  if (candidateId) {
    const numId = Number(candidateId);
    if (!isNaN(numId) && numId > 0) {
      const byId = UCL_36_TEAMS.find(t => t.id === numId);
      if (byId) return byId;
    }
  }

  // 2. If match document matches official UCL league phase fixture
  if (matchDoc?.id) {
    const fixture = UCL_LEAGUE_PHASE_MATCHES.find(f => f.id === matchDoc.id || String(f.apiId) === String(matchDoc.apiId));
    if (fixture) {
      const normName = normalizeTeamStr(name);
      const normHome = normalizeTeamStr(fixture.homeTeam);
      const normAway = normalizeTeamStr(fixture.awayTeam);
      if (normName && (normName === normHome || normHome.includes(normName) || normName.includes(normHome))) {
        const found = UCL_36_TEAMS.find(t => t.id === fixture.homeId);
        if (found) return found;
      }
      if (normName && (normName === normAway || normAway.includes(normName) || normName.includes(normAway))) {
        const found = UCL_36_TEAMS.find(t => t.id === fixture.awayId);
        if (found) return found;
      }
    }
  }

  if (!name) return null;

  const norm = normalizeTeamStr(name);
  if (!norm) return null;

  // 3. Direct dictionary alias lookup
  const aliasId = UCL_TEAM_ALIASES[norm];
  if (aliasId) {
    const byAlias = UCL_36_TEAMS.find(t => t.id === aliasId);
    if (byAlias) return byAlias;
  }

  // 4. Exact normalized name or short name match
  let found = UCL_36_TEAMS.find(t => 
    normalizeTeamStr(t.name) === norm || normalizeTeamStr(t.short) === norm
  );
  if (found) return found;

  // 5. Strip common club prefixes/suffixes and check again
  const stripped = norm
    .replace(/\b(fc|cf|fk|sk|vfb|ssc|as|ac|rc|kv|cp|afc|rb|losc|de|club)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripped && stripped !== norm) {
    const strippedAliasId = UCL_TEAM_ALIASES[stripped];
    if (strippedAliasId) {
      const byStrippedAlias = UCL_36_TEAMS.find(t => t.id === strippedAliasId);
      if (byStrippedAlias) return byStrippedAlias;
    }

    found = UCL_36_TEAMS.find(t => {
      const tNorm = normalizeTeamStr(t.name).replace(/\b(fc|cf|fk|sk|vfb|ssc|as|ac|rc|kv|cp|afc|rb|losc|de|club)\b/g, '').trim();
      const tShort = normalizeTeamStr(t.short);
      return tNorm === stripped || tShort === stripped;
    });
    if (found) return found;
  }

  // 6. Substring inclusion
  found = UCL_36_TEAMS.find(t => {
    const tNorm = normalizeTeamStr(t.name);
    const tShort = normalizeTeamStr(t.short);
    if (norm.length >= 4 && (tNorm.includes(norm) || norm.includes(tNorm))) return true;
    if (tShort.length >= 3 && norm.includes(tShort)) return true;
    return false;
  });

  return found || null;
}

/**
 * Centralized function to recalculate the 36-team UEFA Champions League standings.
 * Reads all finished matches from Firestore, calculates W/D/L, GD, GF, GA, Points,
 * sorts by official UEFA criteria, logs memory calculations to console, and commits to doc(db, 'system', 'standings').
 */
export async function recalculateStandings(): Promise<{
  success: boolean;
  processedMatches: number;
  standings: StandingRow[];
  error?: string;
}> {
  console.log('🔄 [recalculateStandings] Iniciando recálculo completo de la tabla UCL (36 equipos)...');
  
  try {
    // 1. Fetch current matches from Firestore
    const snap = await getDocs(collection(db, 'matches'));
    const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
    console.log(`[recalculateStandings] Total partidos leídos de Firestore: ${allMatches.length}`);

    // Filter finished matches with valid numerical scores
    const finishedMatches = allMatches.filter(m => {
      const isFin = m.status === 'finished' || (m as any).status === 'completed';
      const hScore = (m as any).homeScore;
      const aScore = (m as any).awayScore;
      const hValid = hScore !== null && hScore !== undefined && String(hScore).trim() !== '' && !isNaN(Number(hScore));
      const aValid = aScore !== null && aScore !== undefined && String(aScore).trim() !== '' && !isNaN(Number(aScore));
      return isFin && hValid && aValid;
    });

    console.log(`[recalculateStandings] Partidos finalizados con marcador válido: ${finishedMatches.length}`);

    // 2. Read existing doc upfront to extract existing official API positions
    const standingsDocRef = doc(db, 'system', 'standings');
    const existingSnap = await getDoc(standingsDocRef).catch(readErr => {
      console.warn("[recalculateStandings] No se pudo leer doc existente (se creará uno nuevo):", readErr);
      return null;
    });
    const existingData = existingSnap?.exists() ? existingSnap.data() : {};

    const existingPositionsMap = new Map<number, number>();
    if (Array.isArray(existingData?.standings)) {
      for (const row of existingData.standings) {
        if (row?.team?.id) {
          const apiPos = row.posicion_oficial_api ?? row.position;
          if (typeof apiPos === 'number' && !isNaN(apiPos)) {
            existingPositionsMap.set(row.team.id, apiPos);
          }
        }
      }
    }

    // 3. Initialize table rows for all 36 UCL teams
    const teamStatsMap = new Map<number, {
      team: StandingTeam;
      matches: number;
      wins: number;
      draws: number;
      losses: number;
      scoresFor: number;
      scoresAgainst: number;
      scoreDiff: number;
      points: number;
      awayGoals: number;
      awayWins: number;
      posicion_oficial_api?: number;
    }>();

    for (const uclTeam of UCL_36_TEAMS) {
      const logoUrl = getTeamLogoByName(uclTeam.name) || (uclTeam.id ? `https://img.sofascore.com/api/v1/team/${uclTeam.id}/image` : '');
      teamStatsMap.set(uclTeam.id, {
        team: {
          id: uclTeam.id,
          name: uclTeam.name,
          shortName: uclTeam.short,
          nameCode: uclTeam.short.slice(0, 3).toUpperCase(),
          logo: logoUrl,
          country: uclTeam.country
        },
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scoresFor: 0,
        scoresAgainst: 0,
        scoreDiff: 0,
        points: 0,
        awayGoals: 0,
        awayWins: 0,
        posicion_oficial_api: existingPositionsMap.get(uclTeam.id)
      });
    }

    // 4. Process each finished match
    let processedCount = 0;
    for (const match of finishedMatches) {
      const homeFlagId = match.homeFlag?.match(/\/team\/(\d+)\/image/)?.[1];
      const awayFlagId = match.awayFlag?.match(/\/team\/(\d+)\/image/)?.[1];

      const homeUcl = findUclTeam(match.homeTeam, (match as any).homeId || homeFlagId, match);
      const awayUcl = findUclTeam(match.awayTeam, (match as any).awayId || awayFlagId, match);

      if (!homeUcl || !awayUcl) {
        console.warn(`[recalculateStandings] ⚠️ Partido omitido por equipo no identificado:`, {
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          matchedHome: homeUcl?.name || 'NO ENCONTRADO',
          matchedAway: awayUcl?.name || 'NO ENCONTRADO'
        });
        continue;
      }

      const homeStats = teamStatsMap.get(homeUcl.id);
      const awayStats = teamStatsMap.get(awayUcl.id);

      if (!homeStats || !awayStats) {
        console.warn(`[recalculateStandings] Stats map missing for teams:`, homeUcl.id, awayUcl.id);
        continue;
      }

      const hScore = Number(match.homeScore);
      const aScore = Number(match.awayScore);

      homeStats.matches += 1;
      awayStats.matches += 1;

      homeStats.scoresFor += hScore;
      homeStats.scoresAgainst += aScore;
      homeStats.scoreDiff = homeStats.scoresFor - homeStats.scoresAgainst;

      awayStats.scoresFor += aScore;
      awayStats.scoresAgainst += hScore;
      awayStats.scoreDiff = awayStats.scoresFor - awayStats.scoresAgainst;

      // REGLA 4 UEFA: Mayor cantidad de goles a favor marcados como visitante
      awayStats.awayGoals += aScore;

      if (hScore > aScore) {
        // Victoria Local
        homeStats.wins += 1;
        homeStats.points += 3;
        awayStats.losses += 1;
      } else if (hScore < aScore) {
        // Victoria Visitante
        awayStats.wins += 1;
        awayStats.points += 3;
        // REGLA 6 UEFA: Mayor número de victorias como visitante
        awayStats.awayWins += 1;
        homeStats.losses += 1;
      } else {
        // Empate
        homeStats.draws += 1;
        homeStats.points += 1;
        awayStats.draws += 1;
        awayStats.points += 1;
      }

      processedCount++;
      console.log(`[recalculateStandings] ✓ Computado: ${homeUcl.name} ${hScore} - ${aScore} ${awayUcl.name}`);
    }

    // 5. Comparador estricto de Reglas 1 a 6 UEFA Champions League:
    // 1. Puntos totales (3 por victoria, 1 por empate)
    // 2. Diferencia de goles (GF - GC)
    // 3. Mayor cantidad de goles a favor (GF)
    // 4. Mayor cantidad de goles a favor marcados como visitante
    // 5. Mayor número de victorias
    // 6. Mayor número de victorias como visitante
    const compareRules1to6 = (a: any, b: any): number => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
      if (b.scoresFor !== a.scoresFor) return b.scoresFor - a.scoresFor;
      const bAwayGoals = b.awayGoals ?? 0;
      const aAwayGoals = a.awayGoals ?? 0;
      if (bAwayGoals !== aAwayGoals) return bAwayGoals - aAwayGoals;
      if (b.wins !== a.wins) return b.wins - a.wins;
      const bAwayWins = b.awayWins ?? 0;
      const aAwayWins = a.awayWins ?? 0;
      if (bAwayWins !== aAwayWins) return bAwayWins - aAwayWins;
      return 0;
    };

    // 6. Verificar si existe algún empate no resuelto tras Reglas 1 a 6
    const allStatsList = Array.from(teamStatsMap.values());
    let hasUnresolvedTie = false;
    for (let i = 0; i < allStatsList.length; i++) {
      for (let j = i + 1; j < allStatsList.length; j++) {
        const t1 = allStatsList[i];
        const t2 = allStatsList[j];
        if (t1.matches > 0 && compareRules1to6(t1, t2) === 0) {
          // Si ambos equipos están empatados en reglas 1-6 y no tienen posición oficial distinta
          if (!t1.posicion_oficial_api || !t2.posicion_oficial_api || t1.posicion_oficial_api === t2.posicion_oficial_api) {
            hasUnresolvedTie = true;
            break;
          }
        }
      }
      if (hasUnresolvedTie) break;
    }

    // Si persiste empate, consultar automáticamente a SerpAPI ("tabla posiciones champions league")
    if (hasUnresolvedTie) {
      console.log('[recalculateStandings] ⚠️ Empate detectado tras Reglas 1-6 sin posicion_oficial_api. Consultando SerpAPI...');
      try {
        const { fetchSerpApiRaw, parseStandingsWithGemini } = await import('./serpapiSync');
        const rawNode = await fetchSerpApiRaw('tabla posiciones champions league');
        const items = await parseStandingsWithGemini(rawNode);
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const uclTeam = findUclTeam(item.equipo);
          if (uclTeam && teamStatsMap.has(uclTeam.id)) {
            const teamStat = teamStatsMap.get(uclTeam.id)!;
            const pos = Number(item.posicion) || (idx + 1);
            teamStat.posicion_oficial_api = pos;
          }
        }
        console.log('[recalculateStandings] ✅ Posiciones oficiales de la API aplicadas a los equipos.');
      } catch (err: any) {
        console.warn('[recalculateStandings] ⚠️ Fallback SerpAPI para desempate no pudo completarse:', err.message);
      }
    }

    // 7. Ordenar filas aplicando Reglas 1 a 6, seguidas de Regla 7 (posicion_oficial_api) y alfabético
    const sortedStats = Array.from(teamStatsMap.values()).sort((a, b) => {
      const cmp1to6 = compareRules1to6(a, b);
      if (cmp1to6 !== 0) return cmp1to6;

      // REGLA 7 UEFA (Fallback oficial persistido de la API)
      const aApi = a.posicion_oficial_api ?? 999;
      const bApi = b.posicion_oficial_api ?? 999;
      if (aApi !== bApi) return aApi - bApi;

      // Criterio residual alfabético
      return a.team.name.localeCompare(b.team.name);
    });

    // 8. Assign positions and promotions
    const finalStandings: StandingRow[] = sortedStats.map((row, index) => {
      const position = index + 1;
      let promotion = 'Eliminado';
      if (position <= 8) {
        promotion = 'Octavos de Final';
      } else if (position <= 24) {
        promotion = 'Playoffs';
      }

      return {
        ...row,
        position,
        promotion,
        awayGoals: row.awayGoals,
        awayWins: row.awayWins,
        posicion_oficial_api: row.posicion_oficial_api
      };
    });

    // =========================================================================
    // EXPLICIT AUDIT LOGGING OF CALCULATED MEMORY DATA
    // =========================================================================
    console.log('📊 [recalculateStandings] DATOS_CALCULADOS en memoria antes de guardar en Firestore:');
    console.log(`[recalculateStandings] Partidos procesados con éxito: ${processedCount} de ${finishedMatches.length}`);
    console.table(finalStandings.slice(0, 10).map(r => ({
      Pos: r.position,
      Club: r.team.name,
      PJ: r.matches,
      PG: r.wins,
      PE: r.draws,
      PP: r.losses,
      GF: r.scoresFor,
      GC: r.scoresAgainst,
      DG: r.scoreDiff,
      PTS: r.points,
      Fase: r.promotion
    })));

    // 9. Prepare payload preserving existing season and cupTrees

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

    console.log('[recalculateStandings] Guardando en Firestore en doc(system/standings) con await...');
    // STRICTLY AWAIT THE WRITE PROMISE
    await setDoc(standingsDocRef, payload, { merge: true });
    console.log('✅ [recalculateStandings] ¡Guardado exitoso confirmado en Firestore!');

    return {
      success: true,
      processedMatches: processedCount,
      standings: finalStandings
    };
  } catch (err: any) {
    console.error("❌ [recalculateStandings] Error crítico durante el cálculo de la tabla:", err);
    return {
      success: false,
      processedMatches: 0,
      standings: [],
      error: err?.message || 'Error desconocido al recalcular y guardar la tabla UCL'
    };
  }
}
