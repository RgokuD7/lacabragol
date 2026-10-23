import React, { useState, useMemo } from 'react';
import { BaseBottomSheet } from './BaseBottomSheet';
import { TeamBadge } from './TeamBadge';
import { Match } from '../types';
import { useMatches } from '../hooks/useMatches';
import { useStandings } from '../hooks/useStandings';
import { getMatchVsSummary, TeamResultItem } from '../lib/teamSummary';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { vibrateTap, vibratePop } from '../lib/haptics';
import { cn } from '../lib/utils';
import { 
  Calendar, 
  Trophy, 
  TrendingUp, 
  Swords, 
  ShieldCheck, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Flame,
  CheckCircle2,
  XCircle,
  MinusCircle
} from 'lucide-react';

export interface MatchVsSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  onPredictClick?: (match: Match) => void;
  onViewTeamMatches?: (teamName: string, logo?: string) => void;
}

export function MatchVsSummaryModal({
  isOpen,
  onClose,
  match,
  onPredictClick,
  onViewTeamMatches
}: MatchVsSummaryModalProps) {
  const { matches } = useMatches();
  const { standings } = useStandings();
  const [activeTab, setActiveTab] = useState<'both' | 'home' | 'away'>('both');

  const vsSummary = useMemo(() => {
    if (!match) return null;
    return getMatchVsSummary(match.homeTeam, match.awayTeam, matches, standings);
  }, [match, matches, standings]);

  if (!isOpen || !match || !vsSummary) return null;

  const { homeSummary, awaySummary, h2h } = vsSummary;

  const formatMatchDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, "EEEE d 'de' MMMM · HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, "d MMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const getPosBadgeClass = (pos?: number) => {
    if (!pos) return 'bg-zinc-800 text-zinc-400 border-zinc-700/60';
    if (pos <= 8) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (pos <= 24) return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    return 'bg-zinc-800 text-zinc-400 border-zinc-700/60';
  };

  const renderResultBadge = (result: 'V' | 'E' | 'D') => {
    if (result === 'V') {
      return (
        <span className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black flex items-center justify-center shrink-0">
          V
        </span>
      );
    }
    if (result === 'E') {
      return (
        <span className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-black flex items-center justify-center shrink-0">
          E
        </span>
      );
    }
    return (
      <span className="w-5 h-5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-black flex items-center justify-center shrink-0">
        D
      </span>
    );
  };

  const renderMatchesList = (teamMatches: TeamResultItem[], isHomeView: boolean) => {
    if (teamMatches.length === 0) {
      return (
        <div className="py-6 text-center text-xs text-zinc-500 bg-[#0c0c10] rounded-xl border border-zinc-800/60">
          Aún no registra partidos jugados en esta temporada.
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {teamMatches.map((m) => (
          <div
            key={m.matchId}
            className="flex items-center justify-between p-2 rounded-xl bg-[#0e0e13] border border-zinc-800/80 hover:border-zinc-700 text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <TeamBadge 
                src={m.opponentLogo} 
                teamName={m.opponentName} 
                className="w-5 h-5 shrink-0 object-contain" 
              />
              <div className="min-w-0 flex flex-col">
                <span className="font-bold text-white truncate max-w-[130px] sm:max-w-[180px]">
                  vs {m.opponentName}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {m.isHome ? 'Local 🏠' : 'Visita ✈️'} · {formatShortDate(m.date)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg border bg-zinc-900 border-zinc-700/80 text-white">
                {m.teamScore} - {m.oppScore}
              </span>
              {renderResultBadge(m.result)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Historial y Comparativa"
      contentClassName="px-3 sm:px-6 py-3 sm:py-5 pb-28 sm:pb-16"
    >
      <div className="space-y-4 sm:space-y-5">
        {/* MATCH HEADER CHIP */}
        <div className="flex items-center justify-between bg-[#121217] border border-zinc-800/80 rounded-2xl p-3 shadow-inner">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-wider shrink-0">
              {match.group || 'Fase de Liga'}
            </span>
            <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5 truncate">
              <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>{formatMatchDate(match.date)}</span>
            </span>
          </div>

          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">
            Previa Oficial
          </span>
        </div>

        {/* VERSUS FACE-OFF CARD */}
        <div className="bg-gradient-to-b from-[#181820] to-[#111116] border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
          <div className="grid grid-cols-11 gap-2 items-center relative z-10">
            {/* Home Team (Left 5 cols) */}
            <div 
              onClick={() => {
                if (onViewTeamMatches) {
                  vibrateTap();
                  onViewTeamMatches(match.homeTeam, match.homeFlag);
                }
              }}
              className="col-span-5 flex flex-col items-center text-center group cursor-pointer p-2 rounded-xl hover:bg-zinc-800/40 transition-colors"
            >
              <div className="relative">
                <TeamBadge 
                  src={match.homeFlag || homeSummary.logo} 
                  teamName={match.homeTeam} 
                  className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow group-hover:scale-105 transition-transform" 
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mt-2">
                Local
              </span>
              <h4 className="text-xs sm:text-sm font-black text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
                {homeSummary.officialName}
              </h4>

              {/* Pos & Pts Badge */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border", getPosBadgeClass(homeSummary.standing?.position))}>
                  #{homeSummary.standing?.position ?? '-'}
                </span>
                <span className="font-mono text-[11px] font-black text-white">
                  {homeSummary.standing?.points ?? homeSummary.stats.wins * 3 + homeSummary.stats.draws} <span className="text-[9px] text-zinc-400 font-normal">pts</span>
                </span>
              </div>

              {/* Form Streak dots */}
              {homeSummary.formStreak.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {homeSummary.formStreak.map((item, idx) => (
                    <span
                      key={idx}
                      title={item.label}
                      className={cn(
                        "w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white",
                        item.result === 'V' ? 'bg-emerald-500' : item.result === 'E' ? 'bg-amber-500' : 'bg-rose-500'
                      )}
                    >
                      {item.result}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Center VS Indicator (1 col) */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              <span className="w-8 h-8 rounded-full bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-center font-black text-xs text-zinc-300 shadow-inner">
                VS
              </span>
            </div>

            {/* Away Team (Right 5 cols) */}
            <div 
              onClick={() => {
                if (onViewTeamMatches) {
                  vibrateTap();
                  onViewTeamMatches(match.awayTeam, match.awayFlag);
                }
              }}
              className="col-span-5 flex flex-col items-center text-center group cursor-pointer p-2 rounded-xl hover:bg-zinc-800/40 transition-colors"
            >
              <div className="relative">
                <TeamBadge 
                  src={match.awayFlag || awaySummary.logo} 
                  teamName={match.awayTeam} 
                  className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow group-hover:scale-105 transition-transform" 
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mt-2">
                Visitante
              </span>
              <h4 className="text-xs sm:text-sm font-black text-white line-clamp-1 group-hover:text-emerald-400 transition-colors">
                {awaySummary.officialName}
              </h4>

              {/* Pos & Pts Badge */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border", getPosBadgeClass(awaySummary.standing?.position))}>
                  #{awaySummary.standing?.position ?? '-'}
                </span>
                <span className="font-mono text-[11px] font-black text-white">
                  {awaySummary.standing?.points ?? awaySummary.stats.wins * 3 + awaySummary.stats.draws} <span className="text-[9px] text-zinc-400 font-normal">pts</span>
                </span>
              </div>

              {/* Form Streak dots */}
              {awaySummary.formStreak.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {awaySummary.formStreak.map((item, idx) => (
                    <span
                      key={idx}
                      title={item.label}
                      className={cn(
                        "w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white",
                        item.result === 'V' ? 'bg-emerald-500' : item.result === 'E' ? 'bg-amber-500' : 'bg-rose-500'
                      )}
                    >
                      {item.result}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COMPARISON METRICS TABLE */}
        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span>Comparativa en Champions League</span>
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Fase Liga
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Posición */}
            <div className="flex items-center justify-between bg-[#0e0e13] p-2 rounded-xl border border-zinc-800/50">
              <span className="font-black text-white font-mono w-16 text-center">
                #{homeSummary.standing?.position ?? '-'}
              </span>
              <span className="text-zinc-400 text-[11px] font-semibold text-center flex-1">
                Posición General
              </span>
              <span className="font-black text-white font-mono w-16 text-center">
                #{awaySummary.standing?.position ?? '-'}
              </span>
            </div>

            {/* Puntos */}
            <div className="flex items-center justify-between bg-[#0e0e13] p-2 rounded-xl border border-zinc-800/50">
              <span className="font-black text-blue-400 font-mono w-16 text-center">
                {homeSummary.standing?.points ?? homeSummary.stats.wins * 3 + homeSummary.stats.draws} pts
              </span>
              <span className="text-zinc-400 text-[11px] font-semibold text-center flex-1">
                Puntos
              </span>
              <span className="font-black text-emerald-400 font-mono w-16 text-center">
                {awaySummary.standing?.points ?? awaySummary.stats.wins * 3 + awaySummary.stats.draws} pts
              </span>
            </div>

            {/* PJ */}
            <div className="flex items-center justify-between bg-[#0e0e13] p-2 rounded-xl border border-zinc-800/50">
              <span className="font-mono text-zinc-300 w-16 text-center">
                {homeSummary.stats.matches}
              </span>
              <span className="text-zinc-400 text-[11px] font-semibold text-center flex-1">
                Partidos Jugados (PJ)
              </span>
              <span className="font-mono text-zinc-300 w-16 text-center">
                {awaySummary.stats.matches}
              </span>
            </div>

            {/* Victorias - Empates - Derrotas */}
            <div className="flex items-center justify-between bg-[#0e0e13] p-2 rounded-xl border border-zinc-800/50">
              <span className="font-mono font-bold text-zinc-200 w-16 text-center">
                {homeSummary.stats.wins}-{homeSummary.stats.draws}-{homeSummary.stats.losses}
              </span>
              <span className="text-zinc-400 text-[11px] font-semibold text-center flex-1">
                G - E - P
              </span>
              <span className="font-mono font-bold text-zinc-200 w-16 text-center">
                {awaySummary.stats.wins}-{awaySummary.stats.draws}-{awaySummary.stats.losses}
              </span>
            </div>

            {/* Goles Favor / Contra */}
            <div className="flex items-center justify-between bg-[#0e0e13] p-2 rounded-xl border border-zinc-800/50">
              <span className="font-mono text-zinc-200 w-16 text-center">
                {homeSummary.stats.scoresFor}:{homeSummary.stats.scoresAgainst}
              </span>
              <span className="text-zinc-400 text-[11px] font-semibold text-center flex-1">
                Goles (Favor : Contra)
              </span>
              <span className="font-mono text-zinc-200 w-16 text-center">
                {awaySummary.stats.scoresFor}:{awaySummary.stats.scoresAgainst}
              </span>
            </div>

            {/* Diferencia */}
            <div className="flex items-center justify-between bg-[#0e0e13] p-2 rounded-xl border border-zinc-800/50">
              <span className={cn(
                "font-mono font-black w-16 text-center",
                homeSummary.stats.scoreDiff > 0 ? "text-emerald-400" : homeSummary.stats.scoreDiff < 0 ? "text-rose-400" : "text-zinc-400"
              )}>
                {homeSummary.stats.scoreDiff > 0 ? `+${homeSummary.stats.scoreDiff}` : homeSummary.stats.scoreDiff}
              </span>
              <span className="text-zinc-400 text-[11px] font-semibold text-center flex-1">
                Diferencia de Goles
              </span>
              <span className={cn(
                "font-mono font-black w-16 text-center",
                awaySummary.stats.scoreDiff > 0 ? "text-emerald-400" : awaySummary.stats.scoreDiff < 0 ? "text-rose-400" : "text-zinc-400"
              )}>
                {awaySummary.stats.scoreDiff > 0 ? `+${awaySummary.stats.scoreDiff}` : awaySummary.stats.scoreDiff}
              </span>
            </div>
          </div>
        </div>

        {/* HEAD TO HEAD SECTION */}
        {h2h.played > 0 && (
          <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-purple-400" />
                <span>Historial Directo (Enfrentamientos Previos)</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {h2h.played} {h2h.played === 1 ? 'partido' : 'partidos'}
              </span>
            </div>

            <div className="flex items-center justify-around bg-[#0e0e13] p-2 rounded-xl border border-zinc-800/60 text-xs">
              <span className="text-zinc-300 font-medium">
                Gana {match.homeTeam}: <strong className="text-blue-400">{h2h.homeWins}</strong>
              </span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-300 font-medium">
                Empates: <strong className="text-amber-400">{h2h.draws}</strong>
              </span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-300 font-medium">
                Gana {match.awayTeam}: <strong className="text-emerald-400">{h2h.awayWins}</strong>
              </span>
            </div>
          </div>
        )}

        {/* RECENT MATCHES SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Últimos Partidos Jugados</span>
            </span>

            {/* Filter Tabs: Ambos / Local / Visita */}
            <div className="flex bg-[#121217] p-1 rounded-xl border border-zinc-800 gap-1 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setActiveTab('both');
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  activeTab === 'both' ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
                )}
              >
                Ambos
              </button>
              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setActiveTab('home');
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  activeTab === 'home' ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"
                )}
              >
                Local
              </button>
              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setActiveTab('away');
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  activeTab === 'away' ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
                )}
              >
                Visita
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {(activeTab === 'both' || activeTab === 'home') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                  <TeamBadge src={match.homeFlag} teamName={match.homeTeam} className="w-4 h-4" />
                  <span>{match.homeTeam}</span>
                </span>
                {onViewTeamMatches && (
                  <button
                    type="button"
                    onClick={() => {
                      vibrateTap();
                      onViewTeamMatches(match.homeTeam, match.homeFlag);
                    }}
                    className="text-[10px] text-zinc-400 hover:text-blue-400 font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Ver todos</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              {renderMatchesList(homeSummary.recentMatches, true)}
            </div>
          )}

          {(activeTab === 'both' || activeTab === 'away') && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  <TeamBadge src={match.awayFlag} teamName={match.awayTeam} className="w-4 h-4" />
                  <span>{match.awayTeam}</span>
                </span>
                {onViewTeamMatches && (
                  <button
                    type="button"
                    onClick={() => {
                      vibrateTap();
                      onViewTeamMatches(match.awayTeam, match.awayFlag);
                    }}
                    className="text-[10px] text-zinc-400 hover:text-emerald-400 font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Ver todos</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              {renderMatchesList(awaySummary.recentMatches, false)}
            </div>
          )}
        </div>
      </div>

      {/* STICKY BOTTOM ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-[#0e0e13] border-t border-zinc-800 flex items-center justify-center gap-3 z-30 max-w-md mx-auto">
        {onPredictClick && (
          <button
            type="button"
            onClick={() => {
              vibratePop();
              onClose();
              onPredictClick(match);
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Trophy className="w-4 h-4" />
            <span>Pronosticar este Partido</span>
          </button>
        )}
      </div>
    </BaseBottomSheet>
  );
}
