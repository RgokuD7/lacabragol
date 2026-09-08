import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UCL_36_TEAMS, getTeamLogoByName } from '../data/fixtures';
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
}

/**
 * Normalizes and finds a UCL team by name or alias
 */
export function findUclTeam(name?: string) {
  if (!name) return null;
  const raw = name.toLowerCase().trim();
  const clean = raw
    .replace(/^fc\s+/i, '')
    .replace(/\s+fc$/i, '')
    .replace(/^cf\s+/i, '')
    .replace(/\s+cf$/i, '')
    .replace(/\s+c\.f\.$/i, '');

  // 1. Exact name match
  let found = UCL_36_TEAMS.find(t => t.name.toLowerCase() === raw || t.name.toLowerCase() === clean);
  if (found) return found;

  // 2. Exact short match
  found = UCL_36_TEAMS.find(t => t.short.toLowerCase() === raw || t.short.toLowerCase() === clean);
  if (found) return found;

  // 3. Substring matching
  found = UCL_36_TEAMS.find(t => {
    const tClean = t.name.toLowerCase()
      .replace(/^fc\s+/i, '')
      .replace(/\s+fc$/i, '')
      .replace(/^cf\s+/i, '')
      .replace(/\s+cf$/i, '')
      .replace(/\s+c\.f\.$/i, '');
    return clean.includes(tClean) || tClean.includes(clean);
  });

  return found || null;
}

/**
 * Centralized function to recalculate the 36-team UEFA Champions League standings.
 * Reads all finished matches from Firestore, calculates W/D/L, GD, GF, GA, Points,
 * sorts by official UEFA criteria, and commits to doc(db, 'system', 'standings').
 */
export async function recalculateStandings(): Promise<{
  success: boolean;
  processedMatches: number;
  standings: StandingRow[];
  error?: string;
}> {
  try {
    // 1. Fetch current matches
    const snap = await getDocs(collection(db, 'matches'));
    const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

    // Filter finished matches with valid scores
    const finishedMatches = allMatches.filter(m => 
      m.status === 'finished' &&
      m.homeScore !== null &&
      m.homeScore !== undefined &&
      m.awayScore !== null &&
      m.awayScore !== undefined
    );

    // 2. Initialize table rows for all 36 UCL teams
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
        points: 0
      });
    }

    // 3. Process each finished match
    for (const match of finishedMatches) {
      const homeUcl = findUclTeam(match.homeTeam);
      const awayUcl = findUclTeam(match.awayTeam);

      if (!homeUcl || !awayUcl) {
        // Skip match if teams are not UCL phase teams (e.g. test dummy teams)
        continue;
      }

      const homeStats = teamStatsMap.get(homeUcl.id);
      const awayStats = teamStatsMap.get(awayUcl.id);

      if (!homeStats || !awayStats) continue;

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

      if (hScore > aScore) {
        // Home win
        homeStats.wins += 1;
        homeStats.points += 3;
        awayStats.losses += 1;
      } else if (hScore < aScore) {
        // Away win
        awayStats.wins += 1;
        awayStats.points += 3;
        homeStats.losses += 1;
      } else {
        // Tie / Draw
        homeStats.draws += 1;
        homeStats.points += 1;
        awayStats.draws += 1;
        awayStats.points += 1;
      }
    }

    // 4. Sort rows by official UEFA Champions League criteria:
    // 1st: Points
    // 2nd: Goal Difference (scoreDiff)
    // 3rd: Goals Scored (scoresFor)
    // 4th: Matches won (wins)
    // 5th: Team Name alphabetical
    const sortedStats = Array.from(teamStatsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
      if (b.scoresFor !== a.scoresFor) return b.scoresFor - a.scoresFor;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.team.name.localeCompare(b.team.name);
    });

    // 5. Assign positions and promotions
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
        promotion
      };
    });

    // 6. Read existing doc to preserve season/cupTrees if present
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

    await setDoc(standingsDocRef, payload, { merge: true });

    return {
      success: true,
      processedMatches: finishedMatches.length,
      standings: finalStandings
    };
  } catch (err: any) {
    console.error("Error in recalculateStandings:", err);
    return {
      success: false,
      processedMatches: 0,
      standings: [],
      error: err?.message || 'Error al recalcular la tabla'
    };
  }
}
