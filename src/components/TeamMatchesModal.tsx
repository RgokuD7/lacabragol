import React, { useState, useMemo, useEffect } from 'react';
import { BaseBottomSheet } from './BaseBottomSheet';
import { TeamBadge } from './TeamBadge';
import { Match } from '../types';
import { useMatches } from '../hooks/useMatches';
import { findUclTeam, normalizeTeamStr } from '../lib/standings';
import { UCL_36_TEAMS, UCL_LEAGUE_PHASE_MATCHES, getTeamLogoByName } from '../data/fixtures';
import { parseMatchEvents } from './MatchEventsTimeline';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { vibrateTap } from '../lib/haptics';
import { cn } from '../lib/utils';
import { Calendar, Trophy, Shield, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TeamMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string | null;
  teamLogo?: string;
  standingRow?: {
    position: number;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    scoresFor: number;
    scoresAgainst: number;
    scoreDiff: number;
    points: number;
    promotion?: string;
  } | null;
}

export function TeamMatchesModal({
  isOpen,
  onClose,
  teamName,
  teamLogo,
  standingRow
}: TeamMatchesModalProps) {
  const { matches: firestoreMatches } = useMatches();
  const [filter, setFilter] = useState<'all' | 'played' | 'pending'>('all');
  const [fetchedStandingRow, setFetchedStandingRow] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setFilter('all');
    }
  }, [isOpen, teamName]);

  // Find official UCL team information
  const officialTeam = useMemo(() => {
    if (!teamName) return null;
    return findUclTeam(teamName) || UCL_36_TEAMS.find(t => 
      normalizeTeamStr(t.name) === normalizeTeamStr(teamName)
    ) || null;
  }, [teamName]);

  // Auto-fetch standing data if not passed in props
  useEffect(() => {
    if (standingRow || !teamName || !isOpen) return;

    let isMounted = true;
    const fetchStandings = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'standings'));
        if (snap.exists() && isMounted) {
          const data = snap.data();
          if (Array.isArray(data.standings)) {
            const found = data.standings.find((s: any) => {
              const ucl = findUclTeam(s.team?.name);
              if (officialTeam && ucl && ucl.id === officialTeam.id) return true;
              return normalizeTeamStr(s.team?.name) === normalizeTeamStr(teamName);
            });
            if (found) {
              setFetchedStandingRow(found);
            }
          }
        }
      } catch (e) {
        console.warn("Could not fetch standings for team modal", e);
      }
    };
    fetchStandings();

    return () => { isMounted = false; };
  }, [standingRow, teamName, isOpen, officialTeam]);

  const activeStandingRow = standingRow || fetchedStandingRow;

  const resolvedLogo = useMemo(() => {
    if (teamLogo) return teamLogo;
    if (teamName) return getTeamLogoByName(teamName);
    return '';
  }, [teamLogo, teamName]);

  // Helper to determine if a match involves this team as Home
  const checkIsHome = (m: { homeTeam: string }) => {
    if (!teamName) return false;
    if (officialTeam) {
      const hUcl = findUclTeam(m.homeTeam);
      if (hUcl && hUcl.id === officialTeam.id) return true;
    }
    const normTarget = normalizeTeamStr(teamName);
    const normH = normalizeTeamStr(m.homeTeam);
    return normH === normTarget || normH.includes(normTarget) || normTarget.includes(normH);
  };

  // Helper to determine if a match involves this team as Away
  const checkIsAway = (m: { awayTeam: string }) => {
    if (!teamName) return false;
    if (officialTeam) {
      const aUcl = findUclTeam(m.awayTeam);
      if (aUcl && aUcl.id === officialTeam.id) return true;
    }
    const normTarget = normalizeTeamStr(teamName);
    const normA = normalizeTeamStr(m.awayTeam);
    return normA === normTarget || normA.includes(normTarget) || normTarget.includes(normA);
  };

  // Extract all matches involving this team
  const teamMatches = useMemo<Match[]>(() => {
    if (!teamName) return [];

    // 1. Matches from Firestore
    const matched = firestoreMatches.filter(m => checkIsHome(m) || checkIsAway(m));

    // 2. Check if any fixture from UCL_LEAGUE_PHASE_MATCHES is missing from Firestore
    if (officialTeam) {
      const officialFixtures = UCL_LEAGUE_PHASE_MATCHES.filter(
        f => f.homeId === officialTeam.id || f.awayId === officialTeam.id
      );

      officialFixtures.forEach(fix => {
        const alreadyExists = matched.some(m => 
          m.id === fix.id || 
          String(m.apiId) === String(fix.apiId) ||
          (checkIsHome(m) && normalizeTeamStr(m.awayTeam) === normalizeTeamStr(fix.awayTeam)) ||
          (checkIsAway(m) && normalizeTeamStr(m.homeTeam) === normalizeTeamStr(fix.homeTeam))
        );

        if (!alreadyExists) {
          matched.push({
            id: fix.id,
            apiId: fix.apiId,
            group: fix.group,
            date: fix.date,
            homeTeam: fix.homeTeam,
            awayTeam: fix.awayTeam,
            homeFlag: getTeamLogoByName(fix.homeTeam),
            awayFlag: getTeamLogoByName(fix.awayTeam),
            status: 'pending'
          } as Match);
        }
      });
    }

    // Sort chronologically by date
    return matched.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [teamName, officialTeam, firestoreMatches]);

  // Categorize matches
  const playedMatches = useMemo(() => {
    return teamMatches.filter(m => m.status === 'finished' || m.status === 'in_progress');
  }, [teamMatches]);

  const pendingMatches = useMemo(() => {
    return teamMatches.filter(m => m.status === 'pending');
  }, [teamMatches]);

  // Current filtered list
  const displayedMatches = useMemo(() => {
    if (filter === 'played') return playedMatches;
    if (filter === 'pending') return pendingMatches;
    return teamMatches;
  }, [filter, playedMatches, pendingMatches, teamMatches]);

  // Form calculation (streak of finished matches)
  const formStreak = useMemo(() => {
    const finished = playedMatches.filter(m => m.status === 'finished');
    return finished.map(m => {
      const isHome = checkIsHome(m);
      const teamScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
      const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
      if (teamScore > oppScore) return { result: 'W', label: 'Victoria', color: 'bg-emerald-500 text-white' };
      if (teamScore === oppScore) return { result: 'D', label: 'Empate', color: 'bg-amber-500 text-white' };
      return { result: 'L', label: 'Derrota', color: 'bg-rose-500 text-white' };
    });
  }, [playedMatches, teamName]);

  const formatMatchDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, "EEE d MMM · HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const getPositionBadge = (pos: number) => {
    if (pos <= 8) {
      return { bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', label: 'Octavos directos' };
    }
    if (pos <= 24) {
      return { bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40', label: 'Playoffs' };
    }
    return { bg: 'bg-zinc-800 text-zinc-400 border-zinc-700/60', label: 'Eliminado' };
  };

  if (!isOpen || !teamName) return null;

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Partidos del Club"
      contentClassName="pb-16"
    >
      <div className="space-y-4">
        {/* TEAM HERO SUMMARY BANNER */}
        <div className="bg-[#18181c] border border-zinc-800 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 relative overflow-hidden">
          {/* Subtle Glow behind logo */}
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

          {/* Left: Badge + Team Name + Country */}
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="relative shrink-0">
              <TeamBadge 
                src={resolvedLogo} 
                teamName={teamName} 
                size="md" 
                className="w-14 h-14 sm:w-16 sm:h-16 ring-2 ring-zinc-700/60 shadow-md p-1 bg-[#121215] rounded-2xl" 
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  {officialTeam?.name || teamName}
                </h3>
                {officialTeam?.country && (
                  <span className="text-[11px] text-zinc-400 font-medium bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/50">
                    {officialTeam.country}
                  </span>
                )}
              </div>

              {/* Standing Position Badge */}
              {activeStandingRow && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shadow-sm",
                    getPositionBadge(activeStandingRow.position).bg
                  )}>
                    Posición #{activeStandingRow.position} · {getPositionBadge(activeStandingRow.position).label}
                  </span>
                  <span className="text-xs font-mono font-black text-white">
                    {activeStandingRow.points} <span className="text-[10px] text-zinc-400 font-normal">pts</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick Stats & Form Streak */}
          <div className="flex flex-col sm:items-end w-full sm:w-auto border-t sm:border-t-0 border-zinc-800/80 pt-2.5 sm:pt-0 gap-1.5">
            {activeStandingRow && (
              <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-300 justify-between sm:justify-end">
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block sm:text-right">PJ</span>
                  <span className="font-bold">{activeStandingRow.matches}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block sm:text-right">G-E-P</span>
                  <span className="font-bold text-zinc-200">
                    {activeStandingRow.wins}-{activeStandingRow.draws}-{activeStandingRow.losses}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block sm:text-right">GF:GC</span>
                  <span className="font-bold">{activeStandingRow.scoresFor}:{activeStandingRow.scoresAgainst}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block sm:text-right">DG</span>
                  <span className={cn("font-bold", activeStandingRow.scoreDiff > 0 ? "text-emerald-400" : activeStandingRow.scoreDiff < 0 ? "text-rose-400" : "text-zinc-400")}>
                    {activeStandingRow.scoreDiff > 0 ? `+${activeStandingRow.scoreDiff}` : activeStandingRow.scoreDiff}
                  </span>
                </div>
              </div>
            )}

            {/* Form Streak Pills */}
            {formStreak.length > 0 && (
              <div className="flex items-center gap-1 mt-1 sm:mt-0 justify-start sm:justify-end">
                <span className="text-[10px] text-zinc-500 mr-1 font-semibold uppercase">Racha:</span>
                {formStreak.slice(-5).map((item, idx) => (
                  <span
                    key={idx}
                    title={item.label}
                    className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shadow-sm",
                      item.color
                    )}
                  >
                    {item.result}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FILTER TABS (Todos / Jugados / Por Jugar) */}
        <div className="flex bg-[#141418] p-1 rounded-xl border border-zinc-800 gap-1">
          <button
            type="button"
            onClick={() => {
              vibrateTap();
              setFilter('all');
            }}
            className={cn(
              "flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              filter === 'all'
                ? "bg-blue-600 text-white shadow-sm font-black"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <span>Todos</span>
            <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full font-mono">
              {teamMatches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              vibrateTap();
              setFilter('played');
            }}
            className={cn(
              "flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              filter === 'played'
                ? "bg-emerald-600 text-white shadow-sm font-black"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <CheckCircle2 className="w-3 h-3 text-white/90" />
            <span>Jugados</span>
            <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full font-mono">
              {playedMatches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              vibrateTap();
              setFilter('pending');
            }}
            className={cn(
              "flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              filter === 'pending'
                ? "bg-amber-600 text-white shadow-sm font-black"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <Clock className="w-3 h-3 text-white/90" />
            <span>Por Jugar</span>
            <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full font-mono">
              {pendingMatches.length}
            </span>
          </button>
        </div>

        {/* MATCHES LIST */}
        <div className="space-y-2.5">
          {displayedMatches.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-500 space-y-2 bg-[#121215] rounded-xl border border-zinc-800">
              <Clock className="w-8 h-8 text-zinc-600" />
              <p className="text-xs font-medium">
                {filter === 'played' 
                  ? 'No hay partidos jugados todavía para este club.'
                  : filter === 'pending'
                    ? 'No quedan partidos pendientes para este club.'
                    : 'No se encontraron partidos para este club.'}
              </p>
            </div>
          ) : (
            displayedMatches.map((m) => {
              const isHome = checkIsHome(m);
              const isPlayed = m.status === 'finished' || m.status === 'in_progress';
              const isLive = m.status === 'in_progress';
              const isFinished = m.status === 'finished';

              const teamScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
              const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);

              const isWin = isFinished && teamScore > oppScore;
              const isTie = isFinished && teamScore === oppScore;
              const isLoss = isFinished && teamScore < oppScore;

              // Parse goal events for this match
              const goalEvents = isPlayed 
                ? parseMatchEvents(m).filter(e => e.type === 'goal')
                : [];

              return (
                <div
                  key={m.id}
                  className={cn(
                    "bg-[#141418] border rounded-xl p-3 transition-all relative overflow-hidden",
                    isWin && "border-emerald-500/30 bg-[#0d1712]",
                    isLoss && "border-rose-500/30 bg-[#170d10]",
                    isTie && "border-amber-500/30 bg-[#16130d]",
                    isLive && "border-orange-500/60 bg-[#1a0f0a] shadow-[0_0_15px_rgba(249,115,22,0.15)]",
                    !isPlayed && "border-zinc-800/80 hover:border-zinc-700"
                  )}
                >
                  {/* Top Header: Round + Date + Home/Away Badge + Result Pill */}
                  <div className="flex items-center justify-between text-[10px] pb-2 border-b border-zinc-800/60 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60 uppercase">
                        {m.group || 'Fase de Liga'}
                      </span>
                      <span className="text-zinc-400 font-mono flex items-center gap-1 capitalize">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        {formatMatchDate(m.date)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Venue badge */}
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                        isHome 
                          ? "bg-blue-500/10 text-blue-300 border border-blue-500/30" 
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      )}>
                        {isHome ? 'Local 🏠' : 'Visita ✈️'}
                      </span>

                      {/* Result / Status badge */}
                      {isLive ? (
                        <span className="bg-orange-500/20 text-orange-300 border border-orange-500/50 px-2 py-0.5 rounded-full font-black text-[9px] uppercase animate-pulse">
                          🔴 En Vivo {m.estado ? `· ${m.estado}` : ''}
                        </span>
                      ) : isWin ? (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-black text-[9px] uppercase">
                          Victoria
                        </span>
                      ) : isTie ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-black text-[9px] uppercase">
                          Empate
                        </span>
                      ) : isLoss ? (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-black text-[9px] uppercase">
                          Derrota
                        </span>
                      ) : (
                        <span className="bg-zinc-800 text-zinc-400 border border-zinc-700/80 px-2 py-0.5 rounded-full font-black text-[9px] uppercase">
                          Por Jugar
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Matchup row */}
                  <div className="flex items-center justify-between gap-2 py-1">
                    {/* Home Team */}
                    <div className={cn(
                      "flex-1 flex items-center gap-2 min-w-0",
                      isHome ? "font-black text-white" : "text-zinc-400 font-medium"
                    )}>
                      <TeamBadge 
                        src={m.homeFlag} 
                        teamName={m.homeTeam} 
                        size="sm" 
                        className={cn("w-6 h-6 shrink-0", isHome && "ring-1 ring-blue-500/50 rounded-full")} 
                      />
                      <span className="truncate text-xs" title={m.homeTeam}>
                        {m.homeTeam}
                      </span>
                    </div>

                    {/* Center Score / VS */}
                    <div className="shrink-0 px-2">
                      {isPlayed ? (
                        <div className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-700/80 px-2.5 py-1 rounded-lg font-mono text-sm font-black text-white shadow-sm">
                          <span className={cn(isHome && "text-blue-400")}>{m.homeScore ?? 0}</span>
                          <span className="text-zinc-600 text-xs">-</span>
                          <span className={cn(!isHome && "text-blue-400")}>{m.awayScore ?? 0}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-zinc-500 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800">
                          VS
                        </span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className={cn(
                      "flex-1 flex items-center justify-end gap-2 min-w-0 text-right",
                      !isHome ? "font-black text-white" : "text-zinc-400 font-medium"
                    )}>
                      <span className="truncate text-xs" title={m.awayTeam}>
                        {m.awayTeam}
                      </span>
                      <TeamBadge 
                        src={m.awayFlag} 
                        teamName={m.awayTeam} 
                        size="sm" 
                        className={cn("w-6 h-6 shrink-0", !isHome && "ring-1 ring-blue-500/50 rounded-full")} 
                      />
                    </div>
                  </div>

                  {/* Goalscorers preview (if any) */}
                  {goalEvents.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/50 text-[10px] text-zinc-400 flex flex-wrap gap-x-3 gap-y-1 items-center">
                      <span className="text-zinc-500 font-bold shrink-0">⚽ Goles:</span>
                      {goalEvents.map((g, idx) => (
                        <span key={idx} className="flex items-center gap-1">
                          <strong className={cn(
                            (isHome && g.isHomeTeam) || (!isHome && !g.isHomeTeam) 
                              ? "text-zinc-200" 
                              : "text-zinc-500"
                          )}>
                            {g.playerName}
                          </strong>
                          <span className="text-zinc-500 font-mono text-[9px]">{g.minute}'</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </BaseBottomSheet>
  );
}
