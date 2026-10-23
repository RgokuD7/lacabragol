import { Match } from '../types';
import { StandingRow, findUclTeam, normalizeTeamStr } from './standings';
import { UCL_36_TEAMS, getTeamLogoByName } from '../data/fixtures';

export interface TeamResultItem {
  matchId: string;
  date: string;
  group?: string;
  opponentName: string;
  opponentLogo: string;
  isHome: boolean;
  teamScore: number;
  oppScore: number;
  result: 'V' | 'E' | 'D';
  resultLabel: string;
  status: 'finished' | 'in_progress' | 'pending';
}

export interface TeamSummaryData {
  teamName: string;
  officialName: string;
  logo: string;
  country?: string;
  standing?: {
    position: number;
    points: number;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    scoresFor: number;
    scoresAgainst: number;
    scoreDiff: number;
    promotion?: string;
  };
  formStreak: Array<{
    result: 'V' | 'E' | 'D';
    label: string;
    score: string;
    oppName: string;
  }>;
  recentMatches: TeamResultItem[];
  nextMatches: TeamResultItem[];
  stats: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    scoresFor: number;
    scoresAgainst: number;
    scoreDiff: number;
  };
}

export interface H2HSummary {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  matches: TeamResultItem[];
}

export interface MatchVsSummary {
  homeSummary: TeamSummaryData;
  awaySummary: TeamSummaryData;
  h2h: H2HSummary;
}

/**
 * Checks if a match team matches the target team (via official UCL ID or fuzzy normalization).
 */
export function isTeamMatch(matchTeamName: string, targetTeamName: string): boolean {
  if (!matchTeamName || !targetTeamName) return false;
  const targetUcl = findUclTeam(targetTeamName);
  const matchUcl = findUclTeam(matchTeamName);
  if (targetUcl && matchUcl && targetUcl.id === matchUcl.id) {
    return true;
  }
  const normTarget = normalizeTeamStr(targetTeamName);
  const normMatch = normalizeTeamStr(matchTeamName);
  return normMatch === normTarget || normMatch.includes(normTarget) || normTarget.includes(normMatch);
}

/**
 * Computes a comprehensive summary for a single team.
 */
export function getTeamSummary(
  teamName: string,
  allMatches: Match[],
  standings?: StandingRow[]
): TeamSummaryData {
  const officialTeam = findUclTeam(teamName) || UCL_36_TEAMS.find(t => 
    normalizeTeamStr(t.name) === normalizeTeamStr(teamName)
  );

  const officialName = officialTeam?.name || teamName;
  const logo = (officialTeam as any)?.logo || getTeamLogoByName(teamName);
  const country = officialTeam?.country;

  // 1. Find Standing Row
  let standingInfo: TeamSummaryData['standing'] | undefined = undefined;
  if (standings && standings.length > 0) {
    const row = standings.find(s => {
      if (officialTeam && s.team?.id && s.team.id === officialTeam.id) return true;
      return isTeamMatch(s.team?.name, teamName);
    });
    if (row) {
      standingInfo = {
        position: row.position,
        points: row.points,
        matches: row.matches,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        scoresFor: row.scoresFor,
        scoresAgainst: row.scoresAgainst,
        scoreDiff: row.scoreDiff,
        promotion: row.promotion
      };
    }
  }

  // 2. Filter matches for this team
  const teamMatches = allMatches.filter(m => 
    isTeamMatch(m.homeTeam, teamName) || isTeamMatch(m.awayTeam, teamName)
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 3. Separate finished / in_progress vs pending
  const playedMatches = teamMatches.filter(m => m.status === 'finished' || m.status === 'in_progress');
  const pendingMatches = teamMatches.filter(m => m.status === 'pending');

  // Compute calculated stats if standing not available
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;

  const resultItems: TeamResultItem[] = playedMatches.map(m => {
    const isHome = isTeamMatch(m.homeTeam, teamName);
    const teamScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    const opponentName = isHome ? m.awayTeam : m.homeTeam;
    const opponentLogo = isHome ? m.awayFlag : m.homeFlag;

    let res: 'V' | 'E' | 'D' = 'E';
    let resLabel = 'Empate';
    if (m.status === 'finished') {
      gf += teamScore;
      ga += oppScore;
      if (teamScore > oppScore) {
        res = 'V';
        resLabel = 'Victoria';
        wins++;
      } else if (teamScore === oppScore) {
        res = 'E';
        resLabel = 'Empate';
        draws++;
      } else {
        res = 'D';
        resLabel = 'Derrota';
        losses++;
      }
    }

    return {
      matchId: m.id,
      date: m.date,
      group: m.group,
      opponentName,
      opponentLogo: opponentLogo || getTeamLogoByName(opponentName),
      isHome,
      teamScore,
      oppScore,
      result: res,
      resultLabel: resLabel,
      status: m.status as any
    };
  });

  // Recent 5 played matches (most recent first)
  const recentMatches = [...resultItems].reverse().slice(0, 5);

  // Form Streak dots (chronological last 5 finished)
  const finishedOnly = resultItems.filter(r => r.status === 'finished');
  const formStreak = finishedOnly.slice(-5).map(r => ({
    result: r.result,
    label: `${r.resultLabel}: ${r.teamScore}-${r.oppScore} vs ${r.opponentName}`,
    score: `${r.teamScore}-${r.oppScore}`,
    oppName: r.opponentName
  }));

  // Next upcoming 3 matches
  const nextMatches: TeamResultItem[] = pendingMatches.slice(0, 3).map(m => {
    const isHome = isTeamMatch(m.homeTeam, teamName);
    const opponentName = isHome ? m.awayTeam : m.homeTeam;
    const opponentLogo = isHome ? m.awayFlag : m.homeFlag;
    return {
      matchId: m.id,
      date: m.date,
      group: m.group,
      opponentName,
      opponentLogo: opponentLogo || getTeamLogoByName(opponentName),
      isHome,
      teamScore: 0,
      oppScore: 0,
      result: 'E',
      resultLabel: 'Pendiente',
      status: 'pending'
    };
  });

  const stats = standingInfo ? {
    matches: standingInfo.matches,
    wins: standingInfo.wins,
    draws: standingInfo.draws,
    losses: standingInfo.losses,
    scoresFor: standingInfo.scoresFor,
    scoresAgainst: standingInfo.scoresAgainst,
    scoreDiff: standingInfo.scoreDiff
  } : {
    matches: playedMatches.length,
    wins,
    draws,
    losses,
    scoresFor: gf,
    scoresAgainst: ga,
    scoreDiff: gf - ga
  };

  return {
    teamName,
    officialName,
    logo,
    country,
    standing: standingInfo,
    formStreak,
    recentMatches,
    nextMatches,
    stats
  };
}

/**
 * Returns full Head-to-Head & comparative summary between two teams.
 */
export function getMatchVsSummary(
  homeTeamName: string,
  awayTeamName: string,
  allMatches: Match[],
  standings?: StandingRow[]
): MatchVsSummary {
  const homeSummary = getTeamSummary(homeTeamName, allMatches, standings);
  const awaySummary = getTeamSummary(awayTeamName, allMatches, standings);

  // Find previous matches between Home Team and Away Team
  const h2hMatchesRaw = allMatches.filter(m => {
    const isHomeVsAway = isTeamMatch(m.homeTeam, homeTeamName) && isTeamMatch(m.awayTeam, awayTeamName);
    const isAwayVsHome = isTeamMatch(m.homeTeam, awayTeamName) && isTeamMatch(m.awayTeam, homeTeamName);
    return (isHomeVsAway || isAwayVsHome) && (m.status === 'finished' || m.status === 'in_progress');
  });

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  const h2hMatches: TeamResultItem[] = h2hMatchesRaw.map(m => {
    const isActualHome = isTeamMatch(m.homeTeam, homeTeamName);
    const hScore = isActualHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const aScore = isActualHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);

    let res: 'V' | 'E' | 'D' = 'E';
    let resLabel = 'Empate';
    if (m.status === 'finished') {
      if (hScore > aScore) {
        res = 'V';
        resLabel = `Ganó ${homeTeamName}`;
        homeWins++;
      } else if (hScore === aScore) {
        res = 'E';
        resLabel = 'Empate';
        draws++;
      } else {
        res = 'D';
        resLabel = `Ganó ${awayTeamName}`;
        awayWins++;
      }
    }

    return {
      matchId: m.id,
      date: m.date,
      group: m.group,
      opponentName: isActualHome ? m.awayTeam : m.homeTeam,
      opponentLogo: isActualHome ? m.awayFlag : m.homeFlag,
      isHome: isActualHome,
      teamScore: hScore,
      oppScore: aScore,
      result: res,
      resultLabel: resLabel,
      status: m.status as any
    };
  });

  return {
    homeSummary,
    awaySummary,
    h2h: {
      played: h2hMatches.length,
      homeWins,
      draws,
      awayWins,
      matches: h2hMatches
    }
  };
}
