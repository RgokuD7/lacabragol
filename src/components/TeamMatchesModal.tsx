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
import { Calendar, Trophy, Shield, CheckCircle2, Clock, AlertCircle, Sparkles } from 'lucide-react';
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
      if (teamScore > oppScore) return { result: 'V', label: 'Victoria', color: 'bg-emerald-500 text-white' };
      if (teamScore === oppScore) return { result: 'E', label: 'Empate', color: 'bg-amber-500 text-white' };
      return { result: 'D', label: 'Derrota', color: 'bg-rose-500 text-white' };
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
      contentClassName="px-3 sm:px-6 py-3 sm:py-5 pb-24 sm:pb-12"
    >
      <div className="space-y-4 sm:space-y-5">
        {/* TEAM HERO SUMMARY BANNER */}
        <div className="bg-gradient-to-b from-[#191922] to-[#121217] border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top row: Crest + Team Info */}
          <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
            <div className="relative shrink-0">
              <TeamBadge 
                src={resolvedLogo} 
                teamName={teamName} 
                size="lg" 
                className="w-14 h-14 sm:w-16 sm:h-16 ring-2 ring-zinc-700/80 p-1.5 bg-[#0e0e12] rounded-2xl shadow-lg object-contain" 
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                  {officialTeam?.name || teamName}
                </h3>
                {officialTeam?.country && (
                  <span className="text-[11px] sm:text-xs text-zinc-300 font-semibold bg-zinc-800/90 px-2.5 py-0.5 rounded-lg border border-zinc-700/60 shrink-0">
                    {officialTeam.country}
                  </span>
                )}
              </div>

              {activeStandingRow && (
                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                  <span className={cn(
                    "text-[10px] sm:text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border shadow-sm",
                    getPositionBadge(activeStandingRow.position).bg
                  )}>
                    Posición #{activeStandingRow.position} · {getPositionBadge(activeStandingRow.position).label}
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-black text-white">
                    {activeStandingRow.points} <span className="text-[11px] text-zinc-400 font-normal">pts</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom row: Stats Grid + Form Streak */}
          {activeStandingRow && (
            <div className="mt-4 pt-3.5 border-t border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative z-10">
              {/* 4 Stat Boxes Grid */}
              <div className="grid grid-cols-4 gap-2 flex-1 max-w-md">
                <div className="bg-[#0e0e12]/80 border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-500 block">PJ</span>
                  <span className="font-mono font-black text-xs sm:text-sm text-white">{activeStandingRow.matches}</span>
                </div>
                <div className="bg-[#0e0e12]/80 border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-500 block">G - E - P</span>
                  <span className="font-mono font-black text-xs sm:text-sm text-zinc-200">
                    {activeStandingRow.wins}-{activeStandingRow.draws}-{activeStandingRow.losses}
                  </span>
                </div>
                <div className="bg-[#0e0e12]/80 border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-500 block">Goles</span>
                  <span className="font-mono font-black text-xs sm:text-sm text-zinc-200">
                    {activeStandingRow.scoresFor}:{activeStandingRow.scoresAgainst}
                  </span>
                </div>
                <div className="bg-[#0e0e12]/80 border border-zinc-800 rounded-xl p-2 text-center shadow-inner">
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-500 block">Dif</span>
                  <span className={cn(
                    "font-mono font-black text-xs sm:text-sm",
                    activeStandingRow.scoreDiff > 0 ? "text-emerald-400" : activeStandingRow.scoreDiff < 0 ? "text-rose-400" : "text-zinc-400"
                  )}>
                    {activeStandingRow.scoreDiff > 0 ? `+${activeStandingRow.scoreDiff}` : activeStandingRow.scoreDiff}
                  </span>
                </div>
              </div>

              {/* Form Streak */}
              {formStreak.length > 0 && (
                <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 shrink-0">
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 uppercase font-bold tracking-wider">
                    Racha reciente
                  </span>
                  <div className="flex items-center gap-1.5">
                    {formStreak.slice(-5).map((item, idx) => (
                      <span
                        key={idx}
                        title={item.label}
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm",
                          item.color
                        )}
                      >
                        {item.result}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FILTER TABS (Todos / Jugados / Por Jugar) */}
        <div className="flex bg-[#121217] p-1.5 rounded-2xl border border-zinc-800 gap-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => {
              vibrateTap();
              setFilter('all');
            }}
            className={cn(
              "flex-1 py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none",
              filter === 'all'
                ? "bg-blue-600 text-white shadow-md font-black"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
            )}
          >
            <span>Todos</span>
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full font-mono font-bold">
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
              "flex-1 py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none",
              filter === 'played'
                ? "bg-emerald-600 text-white shadow-md font-black"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-white/90 shrink-0" />
            <span>Jugados</span>
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full font-mono font-bold">
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
              "flex-1 py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none",
              filter === 'pending'
                ? "bg-amber-600 text-white shadow-md font-black"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
            )}
          >
            <Clock className="w-3.5 h-3.5 text-white/90 shrink-0" />
            <span>Por Jugar</span>
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full font-mono font-bold">
              {pendingMatches.length}
            </span>
          </button>
        </div>

        {/* MATCHES LIST */}
        <div className="space-y-3">
          {displayedMatches.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-500 space-y-2 bg-[#141419] rounded-2xl border border-zinc-800">
              <Clock className="w-9 h-9 text-zinc-600" />
              <p className="text-xs sm:text-sm font-medium">
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

              const homeGoals = goalEvents.filter(e => e.isHomeTeam);
              const awayGoals = goalEvents.filter(e => !e.isHomeTeam);

              return (
                <div
                  key={m.id}
                  className={cn(
                    "bg-[#131317] border rounded-2xl p-3.5 sm:p-4.5 transition-all relative overflow-hidden shadow-sm",
                    isWin && "border-emerald-500/40 bg-gradient-to-b from-[#0e1713] to-[#111613]",
                    isLoss && "border-rose-500/40 bg-gradient-to-b from-[#190e11] to-[#131112]",
                    isTie && "border-amber-500/40 bg-gradient-to-b from-[#18150e] to-[#131211]",
                    isLive && "border-orange-500/60 bg-gradient-to-b from-[#1d120a] to-[#14110e] shadow-[0_0_20px_rgba(249,115,22,0.18)]",
                    !isPlayed && "border-zinc-800/80 hover:border-zinc-700 bg-[#121216]"
                  )}
                >
                  {/* Match Header: Round + Date + Home/Away Badge + Result Pill */}
                  <div className="flex items-center justify-between text-[11px] pb-2.5 border-b border-zinc-800/70 mb-3 gap-2 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-zinc-300 bg-zinc-800/90 px-2.5 py-0.5 rounded-lg border border-zinc-700/60 uppercase text-[10px] tracking-wider shrink-0">
                        {m.group || 'Fase de Liga'}
                      </span>
                      <span className="text-zinc-400 font-medium flex items-center gap-1.5 capitalize truncate">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span>{formatMatchDate(m.date)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Venue badge */}
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        isHome 
                          ? "bg-blue-500/15 text-blue-300 border border-blue-500/30" 
                          : "bg-zinc-800/80 text-zinc-400 border border-zinc-700/80"
                      )}>
                        {isHome ? 'Local 🏠' : 'Visita ✈️'}
                      </span>

                      {/* Result / Status badge */}
                      {isLive ? (
                        <span className="bg-orange-500/20 text-orange-300 border border-orange-500/50 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase animate-pulse flex items-center gap-1 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                          <span>En Vivo {m.estado ? `· ${m.estado}` : ''}</span>
                        </span>
                      ) : isWin ? (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase shadow-sm">
                          Victoria
                        </span>
                      ) : isTie ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase shadow-sm">
                          Empate
                        </span>
                      ) : isLoss ? (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase shadow-sm">
                          Derrota
                        </span>
                      ) : (
                        <span className="bg-zinc-800 text-zinc-400 border border-zinc-700/80 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
                          Por Jugar
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Matchup row */}
                  <div className="flex items-center justify-between gap-2 sm:gap-4 py-1">
                    {/* Home Team */}
                    <div className={cn(
                      "flex-1 flex items-center gap-2 sm:gap-3 min-w-0",
                      isHome ? "font-black text-white" : "text-zinc-400 font-medium"
                    )}>
                      <div className="relative shrink-0">
                        <TeamBadge 
                          src={m.homeFlag} 
                          teamName={m.homeTeam} 
                          size="md" 
                          className={cn(
                            "w-8 h-8 sm:w-10 sm:h-10 shrink-0 p-0.5 rounded-xl transition-all",
                            isHome && "ring-2 ring-blue-500/70 shadow-md bg-blue-500/10"
                          )} 
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={cn(
                          "text-xs sm:text-sm leading-snug line-clamp-2 break-words block",
                          isHome ? "text-white font-black" : "text-zinc-400"
                        )} title={m.homeTeam}>
                          {m.homeTeam}
                        </span>
                        {isHome && (
                          <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block">
                            (Tu equipo)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Center Score / VS */}
                    <div className="shrink-0 px-1 sm:px-3 flex flex-col items-center justify-center">
                      {isPlayed ? (
                        <div className="inline-flex items-center gap-2 bg-[#09090b] border border-zinc-700 px-3 sm:px-4 py-1.5 rounded-xl font-mono text-base sm:text-lg font-black text-white shadow-inner">
                          <span className={cn(isHome ? "text-blue-400 font-black" : "text-zinc-300")}>{m.homeScore ?? 0}</span>
                          <span className="text-zinc-600 text-sm font-normal">:</span>
                          <span className={cn(!isHome ? "text-blue-400 font-black" : "text-zinc-300")}>{m.awayScore ?? 0}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-black text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-xl shadow-sm">
                          VS
                        </span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className={cn(
                      "flex-1 flex items-center justify-end gap-2 sm:gap-3 min-w-0 text-right",
                      !isHome ? "font-black text-white" : "text-zinc-400 font-medium"
                    )}>
                      <div className="min-w-0 flex-1">
                        <span className={cn(
                          "text-xs sm:text-sm leading-snug line-clamp-2 break-words block",
                          !isHome ? "text-white font-black" : "text-zinc-400"
                        )} title={m.awayTeam}>
                          {m.awayTeam}
                        </span>
                        {!isHome && (
                          <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block">
                            (Tu equipo)
                          </span>
                        )}
                      </div>
                      <div className="relative shrink-0">
                        <TeamBadge 
                          src={m.awayFlag} 
                          teamName={m.awayTeam} 
                          size="md" 
                          className={cn(
                            "w-8 h-8 sm:w-10 sm:h-10 shrink-0 p-0.5 rounded-xl transition-all",
                            !isHome && "ring-2 ring-blue-500/70 shadow-md bg-blue-500/10"
                          )} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Goalscorers breakdown organized by team (Left = Home, Right = Away) */}
                  {goalEvents.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-zinc-800/70">
                      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 px-0.5">
                        <span className="flex items-center gap-1">
                          <span>⚽</span>
                          <span>Goles {m.homeTeam}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span>Goles {m.awayTeam}</span>
                          <span>⚽</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {/* Home Team Goals */}
                        <div className="space-y-1">
                          {homeGoals.length > 0 ? (
                            homeGoals.map((g, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                                <span className="text-[10px] shrink-0 text-emerald-400 font-bold">●</span>
                                <span className={cn(
                                  "text-[11px] truncate",
                                  isHome ? "font-bold text-white" : "text-zinc-300"
                                )}>
                                  {g.playerName}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500 shrink-0">{g.minute}'</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-[10px] text-zinc-600 italic block pl-3">Sin goles</span>
                          )}
                        </div>

                        {/* Away Team Goals */}
                        <div className="space-y-1 text-right">
                          {awayGoals.length > 0 ? (
                            awayGoals.map((g, idx) => (
                              <div key={idx} className="flex items-center justify-end gap-1.5 text-zinc-300 min-w-0">
                                <span className="text-[10px] font-mono text-zinc-500 shrink-0">{g.minute}'</span>
                                <span className={cn(
                                  "text-[11px] truncate",
                                  !isHome ? "font-bold text-white" : "text-zinc-300"
                                )}>
                                  {g.playerName}
                                </span>
                                <span className="text-[10px] shrink-0 text-emerald-400 font-bold">●</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-[10px] text-zinc-600 italic block pr-3">Sin goles</span>
                          )}
                        </div>
                      </div>
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
