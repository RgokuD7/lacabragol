import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  ChevronLeft, 
  ChevronRight, 
  Trophy, 
  Calendar, 
  Users, 
  Shield, 
  ArrowUp, 
  ArrowDown, 
  Minus, 
  X 
} from 'lucide-react';
import { Match, Prediction, User, Stage } from '../types';
import { UserAvatar } from './UserAvatar';
import { TeamBadge } from './TeamBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { vibrateTap, vibrateSuccess } from '../lib/haptics';
import { cn } from '../lib/utils';
import { UCL_36_TEAMS } from '../data/fixtures';

interface RankingEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  predictions: Prediction[];
  users: User[];
  stages: Stage[];
  selectedStageId?: string;
  activeGroupId?: string | null;
  pointsExact?: number;
  pointsWinner?: number;
  initialViewType?: 'users' | 'teams';
  onSelectUser?: (user: User) => void;
}

interface UserStandingFrame {
  userId: string;
  user: User;
  points: number;
  exactMatches: number;
  rank: number;
  prevRank: number;
  rankDelta: number;
  pointsGainedThisMatch: number;
  isExactThisMatch: boolean;
  scoredThisMatch: boolean;
}

interface TeamStandingFrame {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number;
  prevRank: number;
  rankDelta: number;
  pointsGainedThisMatch: number;
}

interface TimelineFrame {
  index: number;
  match: Match | null;
  userStandings: UserStandingFrame[];
  teamStandings: TeamStandingFrame[];
  scorersInMatch: Array<{
    user: User;
    points: number;
    isExact: boolean;
  }>;
}

export function RankingEvolutionModal({
  isOpen,
  onClose,
  matches = [],
  predictions = [],
  users = [],
  stages = [],
  selectedStageId = 'all',
  activeGroupId,
  pointsExact = 3,
  pointsWinner = 1,
  initialViewType = 'users',
  onSelectUser,
}: RankingEvolutionModalProps) {
  // Si no hay usuarios en la prop (ej. abierto desde StandingsTab), forzar modo 'teams'
  const effectiveInitialView = users.length === 0 ? 'teams' : initialViewType;
  const [viewType, setViewType] = useState<'users' | 'teams'>(effectiveInitialView);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1); // 1 = 1x, 2 = 2x, 3 = 3x
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar vista inicial cuando se abre
  useEffect(() => {
    if (users.length === 0) {
      setViewType('teams');
    } else if (initialViewType) {
      setViewType(initialViewType);
    }
  }, [initialViewType, users.length, isOpen]);

  // Etapa seleccionada
  const activeStage = useMemo(() => {
    if (selectedStageId === 'all') return null;
    return stages.find(s => s.id === selectedStageId) || null;
  }, [stages, selectedStageId]);

  // Partidos finalizados y ordenados cronológicamente
  const finishedMatches = useMemo(() => {
    let list = (matches || []).filter(m => 
      m.status === 'finished' && 
      m.homeScore !== null && 
      m.homeScore !== undefined && 
      m.awayScore !== null && 
      m.awayScore !== undefined
    );

    // Filtrar por etapa si corresponde
    if (activeStage) {
      const groupSet = new Set(activeStage.matchGroups || []);
      list = list.filter(m => groupSet.has(m.group || 'Fase Regular'));
    }

    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches, activeStage]);

  // Predicciones indexadas por matchId y userId
  const predsMap = useMemo(() => {
    const map = new Map<string, Map<string, Prediction>>();
    (predictions || []).forEach(p => {
      if (!map.has(p.matchId)) {
        map.set(p.matchId, new Map());
      }
      map.get(p.matchId)!.set(p.userId, p);
    });
    return map;
  }, [predictions]);

  // Construir todos los frames de la línea de tiempo cronológica
  const timelineFrames = useMemo<TimelineFrame[]>(() => {
    const frames: TimelineFrame[] = [];

    // Estado acumulador para usuarios (si existen)
    const userTotals = new Map<string, { points: number; exactMatches: number }>();
    (users || []).forEach(u => userTotals.set(u.uid, { points: 0, exactMatches: 0 }));

    // Estado acumulador para equipos UCL (siempre 36 equipos)
    const teamTotals = new Map<string, {
      played: number; won: number; drawn: number; lost: number;
      gf: number; ga: number; gd: number; points: number;
    }>();
    UCL_36_TEAMS.forEach(t => teamTotals.set(t.name, {
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0
    }));

    // Helper: calcular ranking de usuarios
    const computeUserRankings = (
      gainsThisMatch: Map<string, { points: number; isExact: boolean }>,
      prevRanks: Map<string, number>
    ): UserStandingFrame[] => {
      if (!users || users.length === 0) return [];

      const list = users.map(u => {
        const tot = userTotals.get(u.uid) || { points: 0, exactMatches: 0 };
        const gain = gainsThisMatch.get(u.uid) || { points: 0, isExact: false };
        return {
          userId: u.uid,
          user: u,
          points: tot.points,
          exactMatches: tot.exactMatches,
          rank: 1,
          prevRank: prevRanks.get(u.uid) || 1,
          rankDelta: 0,
          pointsGainedThisMatch: gain.points,
          isExactThisMatch: gain.isExact,
          scoredThisMatch: gain.points > 0
        };
      });

      list.sort((a, b) => 
        b.points - a.points || 
        b.exactMatches - a.exactMatches || 
        (a.user.nickname || a.user.displayName || '').localeCompare(b.user.nickname || b.user.displayName || '')
      );

      let currRank = 1;
      for (let i = 0; i < list.length; i++) {
        if (i > 0) {
          const prev = list[i - 1];
          const curr = list[i];
          if (curr.points === prev.points && curr.exactMatches === prev.exactMatches) {
            // Empate
          } else {
            currRank = i + 1;
          }
        }
        list[i].rank = currRank;
        list[i].rankDelta = (list[i].prevRank || currRank) - currRank;
      }

      return list;
    };

    // Helper: calcular ranking de equipos
    const computeTeamRankings = (
      teamGains: Map<string, number>,
      prevRanks: Map<string, number>
    ): TeamStandingFrame[] => {
      const list: TeamStandingFrame[] = Array.from(teamTotals.entries()).map(([name, stat]) => ({
        name,
        ...stat,
        rank: 1,
        prevRank: prevRanks.get(name) || 1,
        rankDelta: 0,
        pointsGainedThisMatch: teamGains.get(name) || 0
      }));

      list.sort((a, b) => 
        b.points - a.points || 
        b.gd - a.gd || 
        b.gf - a.gf || 
        b.won - a.won || 
        a.name.localeCompare(b.name)
      );

      let currRank = 1;
      for (let i = 0; i < list.length; i++) {
        if (i > 0) {
          const prev = list[i - 1];
          const curr = list[i];
          if (curr.points === prev.points && curr.gd === prev.gd && curr.gf === prev.gf) {
            // Empate
          } else {
            currRank = i + 1;
          }
        }
        list[i].rank = currRank;
        list[i].rankDelta = (list[i].prevRank || currRank) - currRank;
      }

      return list;
    };

    // FRAME 0: Estado Inicial (todos con 0 pts)
    const initialUserRanks = new Map<string, number>();
    (users || []).forEach(u => initialUserRanks.set(u.uid, 1));
    const initialTeamRanks = new Map<string, number>();
    UCL_36_TEAMS.forEach(t => initialTeamRanks.set(t.name, 1));

    const frame0UserStandings = computeUserRankings(new Map(), initialUserRanks);
    const frame0TeamStandings = computeTeamRankings(new Map(), initialTeamRanks);

    frames.push({
      index: 0,
      match: null,
      userStandings: frame0UserStandings,
      teamStandings: frame0TeamStandings,
      scorersInMatch: []
    });

    let lastUserRanks = new Map<string, number>(frame0UserStandings.map(s => [s.userId, s.rank]));
    let lastTeamRanks = new Map<string, number>(frame0TeamStandings.map(s => [s.name, s.rank]));

    // FRAMES 1..N: Avanzar partido a partido
    finishedMatches.forEach((m, mIdx) => {
      const matchPreds = predsMap.get(m.id);
      const userGains = new Map<string, { points: number; isExact: boolean }>();
      const scorers: Array<{ user: User; points: number; isExact: boolean }> = [];

      const mHome = m.homeScore!;
      const mAway = m.awayScore!;

      // 1. Calcular puntos para usuarios
      if (users && users.length > 0) {
        users.forEach(u => {
          const pred = matchPreds?.get(u.uid);
          if (!pred) return;

          const pHome = pred.homeScore;
          const pAway = pred.awayScore;

          const isExact = pHome === mHome && pAway === mAway;
          const actualDiff = mHome - mAway;
          const predDiff = pHome - pAway;
          const isOutcome = (actualDiff > 0 && predDiff > 0) ||
                            (actualDiff < 0 && predDiff < 0) ||
                            (actualDiff === 0 && predDiff === 0);

          let earned = 0;
          if (isExact) {
            earned = pointsExact;
          } else if (isOutcome) {
            earned = pointsWinner;
          }

          if (earned > 0) {
            userGains.set(u.uid, { points: earned, isExact });
            const currentTotal = userTotals.get(u.uid);
            if (currentTotal) {
              currentTotal.points += earned;
              if (isExact) currentTotal.exactMatches += 1;
            }
            scorers.push({ user: u, points: earned, isExact });
          }
        });
      }

      // 2. Calcular puntos para equipos UCL
      const teamGains = new Map<string, number>();
      const homeTeamStat = teamTotals.get(m.homeTeam);
      const awayTeamStat = teamTotals.get(m.awayTeam);

      if (homeTeamStat && awayTeamStat) {
        homeTeamStat.played += 1;
        awayTeamStat.played += 1;
        homeTeamStat.gf += mHome;
        homeTeamStat.ga += mAway;
        homeTeamStat.gd = homeTeamStat.gf - homeTeamStat.ga;
        awayTeamStat.gf += mAway;
        awayTeamStat.ga += mHome;
        awayTeamStat.gd = awayTeamStat.gf - awayTeamStat.ga;

        if (mHome > mAway) {
          homeTeamStat.won += 1;
          homeTeamStat.points += 3;
          awayTeamStat.lost += 1;
          teamGains.set(m.homeTeam, 3);
        } else if (mAway > mHome) {
          awayTeamStat.won += 1;
          awayTeamStat.points += 3;
          homeTeamStat.lost += 1;
          teamGains.set(m.awayTeam, 3);
        } else {
          homeTeamStat.drawn += 1;
          homeTeamStat.points += 1;
          awayTeamStat.drawn += 1;
          awayTeamStat.points += 1;
          teamGains.set(m.homeTeam, 1);
          teamGains.set(m.awayTeam, 1);
        }
      }

      scorers.sort((a, b) => b.points - a.points);

      const userStandings = computeUserRankings(userGains, lastUserRanks);
      const teamStandings = computeTeamRankings(teamGains, lastTeamRanks);

      frames.push({
        index: mIdx + 1,
        match: m,
        userStandings,
        teamStandings,
        scorersInMatch: scorers
      });

      lastUserRanks = new Map(userStandings.map(s => [s.userId, s.rank]));
      lastTeamRanks = new Map(teamStandings.map(s => [s.name, s.rank]));
    });

    return frames;
  }, [users, finishedMatches, predsMap, pointsExact, pointsWinner]);

  // Frame actual activo (completamente seguro contra undefined)
  const currentFrame: TimelineFrame = timelineFrames[currentFrameIndex] || timelineFrames[0] || {
    index: 0,
    match: null,
    userStandings: [],
    teamStandings: [],
    scorersInMatch: []
  };

  const totalFrames = Math.max(0, timelineFrames.length - 1);

  // Intervalo de reproducción según velocidad seleccionada
  const stepIntervalMs = speed === 1 ? 1400 : speed === 2 ? 800 : 450;
  // Duración de la animación CSS de las barras y el movimiento vertical
  const animDurationMs = speed === 1 ? 750 : speed === 2 ? 500 : 320;

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentFrameIndex(prev => {
        if (prev >= totalFrames) {
          setIsPlaying(false);
          vibrateSuccess();
          return prev;
        }
        vibrateTap();
        return prev + 1;
      });
    }, stepIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, stepIntervalMs, totalFrames]);

  useEffect(() => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  }, [selectedStageId, isOpen]);

  if (!isOpen) return null;

  // Puntaje máximo para calcular porcentaje de ancho de barra
  const maxUserPoints = Math.max(1, currentFrame.userStandings[0]?.points || 1);
  const maxTeamPoints = Math.max(1, currentFrame.teamStandings[0]?.points || 1);

  // Dimensiones para el Bar Chart Race animado
  const userRowHeight = 62;
  const userRowGap = 6;
  const teamRowHeight = 54;
  const teamRowGap = 6;

  return (
    <div 
      className="fixed inset-0 z-[1100] flex items-center justify-center p-2 sm:p-4"
      style={{
        paddingTop: 'max(var(--sat, env(safe-area-inset-top, 0px)), 20px)',
        paddingBottom: 'max(var(--sab, env(safe-area-inset-bottom, 0px)), 16px)'
      }}
    >
      {/* Backdrop oscuro limpio sin filtros que desenfoquen a los hijos */}
      <div 
        className="fixed inset-0 bg-black/85 animate-in fade-in duration-150" 
        onClick={onClose}
      />

      <div 
        className="relative z-10 bg-[#121217] border border-emerald-500/40 rounded-2xl max-w-3xl w-full p-3 sm:p-5 space-y-3.5 shadow-2xl flex flex-col text-white custom-scrollbar overflow-y-auto antialiased"
        style={{
          maxHeight: 'calc(100dvh - max(var(--sat, env(safe-area-inset-top, 0px)), 20px) - max(var(--sab, env(safe-area-inset-bottom, 0px)), 16px) - 16px)'
        }}
        onClick={e => e.stopPropagation()}
      >
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-900/20">
              <Play className="w-4 h-4 fill-emerald-400 text-emerald-400 ml-0.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-white tracking-tight">
                  Evolución del Ranking
                </h3>
                <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold px-2 py-0.2 rounded-full shrink-0">
                  {activeStage ? activeStage.name : 'Acumulado General'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                Simula el avance partido a partido con barras de crecimiento continuo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Selector de Vista: Amigos vs Clubes */}
            {users.length > 0 && (
              <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    vibrateTap();
                    setViewType('users');
                  }}
                  className={cn(
                    "px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1",
                    viewType === 'users' ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                  )}
                >
                  <Users className="w-3 h-3" />
                  <span className="hidden sm:inline">Amigos</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    vibrateTap();
                    setViewType('teams');
                  }}
                  className={cn(
                    "px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1",
                    viewType === 'teams' ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                  )}
                >
                  <Shield className="w-3 h-3" />
                  <span className="hidden sm:inline">Clubes UCL</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLES DE REPRODUCCIÓN */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-2.5 shadow-inner">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Botones de acción */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setCurrentFrameIndex(0);
                  setIsPlaying(false);
                }}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Reiniciar al inicio (0 puntos)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setCurrentFrameIndex(prev => Math.max(0, prev - 1));
                  setIsPlaying(false);
                }}
                disabled={currentFrameIndex === 0}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                title="Partido anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  if (currentFrameIndex >= totalFrames) {
                    setCurrentFrameIndex(0);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying(!isPlaying);
                  }
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer",
                  isPlaying
                    ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 hover:scale-[1.02]"
                )}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-white" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    <span>{currentFrameIndex >= totalFrames ? 'Repetir' : 'Reproducir'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setCurrentFrameIndex(prev => Math.min(totalFrames, prev + 1));
                  setIsPlaying(false);
                }}
                disabled={currentFrameIndex >= totalFrames}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                title="Partido siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  vibrateTap();
                  setCurrentFrameIndex(totalFrames);
                  setIsPlaying(false);
                }}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Ir al final (actualidad)"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Selector de Velocidad */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1">Velocidad:</span>
              {[1, 2, 3].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    vibrateTap();
                    setSpeed(s);
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                    speed === s ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Slider / Scrubber */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold">
              <span>Inicio (0 pts)</span>
              <span className="text-emerald-400 font-mono font-bold">
                {currentFrameIndex === 0 ? '🏁 Inicio' : `Partido ${currentFrameIndex} de ${totalFrames}`}
              </span>
              <span>Actualidad</span>
            </div>
            <input
              type="range"
              min={0}
              max={totalFrames}
              value={currentFrameIndex}
              onChange={(e) => {
                setCurrentFrameIndex(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
          </div>
        </div>

        {/* TARJETA DEL PARTIDO ACTUAL */}
        {currentFrame?.match ? (
          <div className="bg-gradient-to-r from-zinc-900 via-[#18181f] to-zinc-900 border border-emerald-500/30 rounded-xl p-3 shadow-md animate-in fade-in space-y-2">
            <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.2 rounded-full">
                  {currentFrame.match.group || 'Fase de Liga'}
                </span>
                <span className="text-zinc-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-500" />
                  {(() => {
                    try {
                      return format(new Date(currentFrame.match.date), "EEE d MMM · HH:mm", { locale: es });
                    } catch {
                      return currentFrame.match.date;
                    }
                  })()}
                </span>
              </div>
              <span className="font-mono text-zinc-400 font-bold text-[10px]">
                Marcador Final
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              {/* Home Team */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <TeamBadge
                  src={currentFrame.match.homeFlag}
                  teamName={currentFrame.match.homeTeam}
                  className="w-7 h-7 shrink-0 object-contain drop-shadow"
                />
                <span className="font-black text-xs text-white truncate">
                  {currentFrame.match.homeTeam}
                </span>
              </div>

              {/* Score Box */}
              <div className="px-3 py-1 bg-black/60 border border-zinc-700/80 rounded-xl font-mono font-black text-base text-white shadow-inner shrink-0">
                <span>{currentFrame.match.homeScore ?? '-'}</span>
                <span className="text-zinc-500 px-1.5">-</span>
                <span>{currentFrame.match.awayScore ?? '-'}</span>
              </div>

              {/* Away Team */}
              <div className="flex-1 flex items-center justify-end gap-2 min-w-0 text-right">
                <span className="font-black text-xs text-white truncate">
                  {currentFrame.match.awayTeam}
                </span>
                <TeamBadge
                  src={currentFrame.match.awayFlag}
                  teamName={currentFrame.match.awayTeam}
                  className="w-7 h-7 shrink-0 object-contain drop-shadow"
                />
              </div>
            </div>

            {/* Aciertos de este partido */}
            {viewType === 'users' && (
              <div className="text-[11px] pt-1 border-t border-zinc-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                <span className="text-zinc-500 font-bold shrink-0">Aciertos:</span>
                {currentFrame.scorersInMatch.length === 0 ? (
                  <span className="text-zinc-500 italic text-[10px]">
                    Ningún participante sumó puntos en este partido
                  </span>
                ) : (
                  currentFrame.scorersInMatch.map((s) => (
                    <span
                      key={s.user.uid}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 animate-in zoom-in-95",
                        s.isExact 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                          : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      )}
                    >
                      <span>{s.isExact ? '🎯' : '⚽'}</span>
                      <strong className="text-white">{s.user.nickname || s.user.displayName}</strong>
                      <span className="text-[9px] opacity-80">(+{s.points})</span>
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-xl p-3.5 text-center text-xs text-zinc-400 space-y-1">
            <Trophy className="w-5 h-5 mx-auto text-amber-400" />
            <p className="font-bold text-white">Inicio del Torneo</p>
            <p className="text-[11px] text-zinc-500">
              Todos los participantes comienzan con 0 puntos. Presiona Reproducir ▶ para ver cómo se movió la tabla partido a partido.
            </p>
          </div>
        )}

        {/* BAR CHART RACE: TABLA ANIMADA FLUIDA */}
        <div className="flex-1 min-h-[300px] max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
          {viewType === 'users' ? (
            <div 
              className="relative w-full transition-all duration-300"
              style={{ height: `${users.length * (userRowHeight + userRowGap)}px` }}
            >
              {users.map((u) => {
                const rankIndex = currentFrame.userStandings.findIndex(s => s.userId === u.uid);
                if (rankIndex === -1) return null;
                const standing = currentFrame.userStandings[rankIndex];

                const pct = maxUserPoints > 0 ? (standing.points / maxUserPoints) * 100 : 0;
                const isFirst = standing.rank === 1 && standing.points > 0;
                const isSecond = standing.rank === 2 && standing.points > 0;
                const isThird = standing.rank === 3 && standing.points > 0;

                return (
                  <div
                    key={u.uid}
                    onClick={() => onSelectUser?.(u)}
                    className={cn(
                      "absolute left-0 right-0 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer",
                      standing.scoredThisMatch && "ring-1 ring-emerald-500/60 bg-emerald-950/20",
                      isFirst ? "bg-gradient-to-r from-amber-950/40 via-[#18181f] to-[#121215] border-amber-500/50 shadow-md shadow-amber-900/20" :
                      isSecond ? "bg-zinc-900/90 border-zinc-700/80" :
                      isThird ? "bg-zinc-900/90 border-amber-900/40" :
                      "bg-[#141418] border-zinc-800/80 hover:bg-zinc-800/40"
                    )}
                    style={{
                      height: `${userRowHeight}px`,
                      transform: `translateY(${rankIndex * (userRowHeight + userRowGap)}px)`,
                      transition: `transform ${animDurationMs}ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease`
                    }}
                  >
                    {/* Top Row: Info + Avatar + Points */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      {/* Left: Rank + Indicator + Avatar + Name */}
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Rank Badge */}
                        <div className="w-5 text-center shrink-0">
                          {isFirst ? (
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-black text-[10px] inline-flex items-center justify-center shadow">1</span>
                          ) : isSecond ? (
                            <span className="w-5 h-5 rounded-full bg-zinc-600 text-white font-black text-[10px] inline-flex items-center justify-center">2</span>
                          ) : isThird ? (
                            <span className="w-5 h-5 rounded-full bg-amber-900 text-amber-200 font-black text-[10px] inline-flex items-center justify-center">3</span>
                          ) : (
                            <span className="font-mono text-zinc-500 font-black text-xs">#{standing.rank}</span>
                          )}
                        </div>

                        {/* Rank Delta (▲ +2, ▼ -1, -) */}
                        <div className="w-6 text-center shrink-0 text-[10px] font-black">
                          {standing.rankDelta > 0 ? (
                            <span className="text-emerald-400 flex items-center justify-center animate-bounce">
                              <ArrowUp className="w-3 h-3" />
                              <span>{standing.rankDelta}</span>
                            </span>
                          ) : standing.rankDelta < 0 ? (
                            <span className="text-rose-400 flex items-center justify-center">
                              <ArrowDown className="w-3 h-3" />
                              <span>{Math.abs(standing.rankDelta)}</span>
                            </span>
                          ) : (
                            <span className="text-zinc-600">
                              <Minus className="w-3 h-3 mx-auto" />
                            </span>
                          )}
                        </div>

                        {/* User Avatar */}
                        <UserAvatar
                          src={u.photoURL}
                          name={u.nickname || u.displayName || ''}
                          size="sm"
                          className={cn(isFirst && "border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]")}
                        />

                        {/* Name */}
                        <div className="min-w-0">
                          <span className={cn(
                            "font-bold text-xs truncate block leading-tight",
                            isFirst ? "text-amber-200 font-black" : "text-white"
                          )}>
                            {u.nickname || u.displayName || 'Participante'}
                          </span>
                          <span className="text-[9.5px] text-zinc-500 font-mono">
                            {standing.exactMatches} plenos
                          </span>
                        </div>
                      </div>

                      {/* Right: Points ticker */}
                      <div className="flex items-center gap-1.5 shrink-0 text-right">
                        {standing.pointsGainedThisMatch > 0 && (
                          <span className={cn(
                            "text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-in zoom-in-75",
                            standing.isExactThisMatch ? "bg-emerald-500 text-black shadow-emerald-500/30" : "bg-sky-400 text-black"
                          )}>
                            +{standing.pointsGainedThisMatch}
                          </span>
                        )}

                        <div className="min-w-[42px]">
                          <span className={cn(
                            "font-mono font-black text-sm block leading-tight",
                            isFirst ? "text-amber-400" : "text-white"
                          )}>
                            {standing.points}
                          </span>
                          <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">PTS</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Visible Animated Progress Bar (Bar Chart Race) */}
                    <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden border border-zinc-700/50 relative mt-1">
                      <div
                        className={cn(
                          "h-full rounded-full shadow-sm",
                          isFirst ? "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]" :
                          isSecond ? "bg-gradient-to-r from-zinc-400 via-zinc-300 to-white" :
                          isThird ? "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-500" :
                          "bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400"
                        )}
                        style={{
                          width: `${Math.max(2.5, pct)}%`,
                          transition: `width ${animDurationMs}ms cubic-bezier(0.25, 1, 0.5, 1)`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div 
              className="relative w-full transition-all duration-300"
              style={{ height: `${UCL_36_TEAMS.length * (teamRowHeight + teamRowGap)}px` }}
            >
              {UCL_36_TEAMS.map((t) => {
                const rankIndex = currentFrame.teamStandings.findIndex(s => s.name === t.name);
                if (rankIndex === -1) return null;
                const standing = currentFrame.teamStandings[rankIndex];

                const pct = maxTeamPoints > 0 ? (standing.points / maxTeamPoints) * 100 : 0;
                const isTop8 = standing.rank <= 8;
                const isPlayoff = standing.rank >= 9 && standing.rank <= 24;

                return (
                  <div
                    key={t.name}
                    className={cn(
                      "absolute left-0 right-0 p-2 rounded-xl border flex flex-col justify-between",
                      standing.pointsGainedThisMatch > 0 && "ring-1 ring-emerald-500/50 bg-emerald-950/20",
                      isTop8 ? "bg-[#141418] border-emerald-500/30" :
                      isPlayoff ? "bg-[#141418] border-blue-500/20" :
                      "bg-[#141418] border-zinc-800/80"
                    )}
                    style={{
                      height: `${teamRowHeight}px`,
                      transform: `translateY(${rankIndex * (teamRowHeight + teamRowGap)}px)`,
                      transition: `transform ${animDurationMs}ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease`
                    }}
                  >
                    {/* Top Row: Rank + Team + Points */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          "w-5 h-5 rounded-md font-mono font-black text-[10px] inline-flex items-center justify-center shrink-0",
                          isTop8 ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40" :
                          isPlayoff ? "bg-blue-600/30 text-blue-300 border border-blue-500/40" :
                          "bg-zinc-800 text-zinc-400"
                        )}>
                          {standing.rank}
                        </span>

                        <div className="w-5 text-center shrink-0 text-[9px] font-black">
                          {standing.rankDelta > 0 ? (
                            <span className="text-emerald-400 flex items-center justify-center">
                              <ArrowUp className="w-2.5 h-2.5" />
                              <span>{standing.rankDelta}</span>
                            </span>
                          ) : standing.rankDelta < 0 ? (
                            <span className="text-rose-400 flex items-center justify-center">
                              <ArrowDown className="w-2.5 h-2.5" />
                              <span>{Math.abs(standing.rankDelta)}</span>
                            </span>
                          ) : (
                            <span className="text-zinc-600">
                              <Minus className="w-2.5 h-2.5 mx-auto" />
                            </span>
                          )}
                        </div>

                        <TeamBadge teamName={t.name} className="w-5 h-5 shrink-0 object-contain drop-shadow" />

                        <div className="min-w-0">
                          <span className="font-bold text-xs text-white truncate block leading-tight">
                            {t.name}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono">
                            PJ: {standing.played} · V:{standing.won} E:{standing.drawn} D:{standing.lost} · DG:{standing.gd > 0 ? `+${standing.gd}` : standing.gd}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-right">
                        {standing.pointsGainedThisMatch > 0 && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-black shadow-sm">
                            +{standing.pointsGainedThisMatch}
                          </span>
                        )}

                        <div className="min-w-[36px]">
                          <span className="font-mono font-black text-sm text-white block leading-tight">
                            {standing.points}
                          </span>
                          <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">PTS</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Animated Progress Bar */}
                    <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden border border-zinc-700/50 mt-1 relative">
                      <div
                        className={cn(
                          "h-full rounded-full shadow-sm",
                          isTop8 ? "bg-gradient-to-r from-emerald-500 to-teal-400" :
                          isPlayoff ? "bg-gradient-to-r from-blue-500 to-sky-400" :
                          "bg-zinc-600"
                        )}
                        style={{
                          width: `${Math.max(2.5, pct)}%`,
                          transition: `width ${animDurationMs}ms cubic-bezier(0.25, 1, 0.5, 1)`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
