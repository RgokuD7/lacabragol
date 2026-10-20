import React, { useState, useEffect, useMemo } from 'react';
import { X, Delete, ArrowRight, CheckCircle2, TrendingUp, ChevronDown, ChevronUp, Swords } from 'lucide-react';
import { Match } from '../types';
import { TeamBadge } from './TeamBadge';
import { TeamMatchesModal } from './TeamMatchesModal';
import { useMatches } from '../hooks/useMatches';
import { useStandings } from '../hooks/useStandings';
import { getMatchVsSummary } from '../lib/teamSummary';
import { vibratePop, vibrateSuccess, vibrateTap } from '../lib/haptics';
import { cn } from '../lib/utils';

interface ScoreNumpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  initialHomeScore?: string;
  initialAwayScore?: string;
  initialFocus?: 'home' | 'away';
  onSave: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
  isSaving?: boolean;
}

export function ScoreNumpadModal({
  isOpen,
  onClose,
  match,
  initialHomeScore = '',
  initialAwayScore = '',
  initialFocus = 'home',
  onSave,
  isSaving = false
}: ScoreNumpadModalProps) {
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [isStatsExpanded, setIsStatsExpanded] = useState<boolean>(false);
  const [teamModalTeam, setTeamModalTeam] = useState<{ name: string; logo?: string } | null>(null);

  const { matches } = useMatches();
  const { standings } = useStandings();

  const vsSummary = useMemo(() => {
    if (!match) return null;
    return getMatchVsSummary(match.homeTeam, match.awayTeam, matches, standings);
  }, [match, matches, standings]);

  // Sync state ONLY when modal opens or target match changes (avoids resetting to home during save)
  useEffect(() => {
    if (isOpen) {
      setHomeScore(initialHomeScore ?? '');
      setAwayScore(initialAwayScore ?? '');
      setActiveTeam(initialFocus);
      setIsStatsExpanded(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setTeamModalTeam(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, match?.id]);

  if (!isOpen || !match) return null;

  const currentScore = activeTeam === 'home' ? homeScore : awayScore;

  const handleDigitPress = (digit: string) => {
    vibratePop();
    const updateScore = (prev: string): string => {
      if (prev === '0') {
        return digit === '0' ? '0' : digit;
      }
      if (prev.length >= 2) {
        return prev;
      }
      return prev + digit;
    };

    if (activeTeam === 'home') {
      setHomeScore(updateScore);
    } else {
      setAwayScore(updateScore);
    }
  };

  const handleBackspace = () => {
    vibratePop();
    const updateScore = (prev: string): string => {
      if (prev.length <= 1) return '';
      return prev.slice(0, -1);
    };

    if (activeTeam === 'home') {
      setHomeScore(updateScore);
    } else {
      setAwayScore(updateScore);
    }
  };

  const handleClear = () => {
    vibratePop();
    if (activeTeam === 'home') {
      setHomeScore('');
    } else {
      setAwayScore('');
    }
  };

  const handleNextOrSave = async () => {
    vibratePop();
    if (activeTeam === 'home') {
      if (homeScore === '') {
        setHomeScore('0');
      }
      setActiveTeam('away');
    } else {
      const finalHome = homeScore === '' ? 0 : parseInt(homeScore, 10);
      const finalAway = awayScore === '' ? 0 : parseInt(awayScore, 10);
      const h = isNaN(finalHome) ? 0 : finalHome;
      const a = isNaN(finalAway) ? 0 : finalAway;
      vibrateSuccess();
      onClose();
      await onSave(match.id, h, a);
    }
  };

  const isHome = activeTeam === 'home';
  const activeTeamName = isHome ? match.homeTeam : match.awayTeam;
  const activeTeamFlag = isHome ? match.homeFlag : match.awayFlag;

  const homeSummary = vsSummary?.homeSummary;
  const awaySummary = vsSummary?.awaySummary;
  const h2h = vsSummary?.h2h;

  return (
    <>
      <div className="fixed inset-0 z-[1050] flex flex-col justify-end animate-in fade-in duration-200">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet Content Container */}
        <div 
          className="relative bg-[#121216] border-t border-zinc-800 w-full max-w-md mx-auto rounded-t-3xl shadow-2xl flex flex-col max-h-[94vh] overflow-y-auto transition-transform duration-200"
          style={{
            paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 20px), 24px)'
          }}
        >
          {/* Top Header Bar with Drag Handle, Title & Dedicated Close Button */}
          <div className="relative flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-zinc-800/60 mb-2">
            <div className="w-8 h-8 shrink-0" />

            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Pronosticar Resultado
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              onTouchStart={() => vibratePop()}
              className="w-8 h-8 rounded-full bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-400 hover:text-white transition-all cursor-pointer border border-zinc-700/70 shadow-md active:scale-95 flex items-center justify-center shrink-0"
              title="Cerrar modal"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Header (Marcador Global - Estilo TV con Resumen y Racha) */}
          <div className="mx-4 mb-2 bg-[#0c0c0f] border border-zinc-800/90 rounded-2xl p-2.5 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              {/* Home Team (TV Left) */}
              <div 
                onClick={() => {
                  vibratePop();
                  setActiveTeam('home');
                }}
                onTouchStart={() => vibratePop()}
                className={cn(
                  "flex-1 flex items-center gap-2 p-1.5 rounded-xl cursor-pointer transition-all min-w-0",
                  activeTeam === 'home' 
                    ? "bg-blue-500/15 border border-blue-500/40" 
                    : "hover:bg-zinc-800/40 border border-transparent"
                )}
              >
                <TeamBadge 
                  src={match.homeFlag} 
                  teamName={match.homeTeam} 
                  className="w-7 h-7 shrink-0 drop-shadow" 
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-zinc-500">Local</span>
                  <span className={cn(
                    "text-xs font-bold truncate leading-tight",
                    activeTeam === 'home' ? "text-blue-400" : "text-zinc-300"
                  )}>
                    {match.homeTeam}
                  </span>
                  
                  {/* Standing Pos & Form Dots */}
                  <div className="flex items-center gap-1 mt-0.5">
                    {homeSummary?.standing?.position && (
                      <span className="text-[8.5px] font-bold text-zinc-400 bg-zinc-800/90 px-1 py-0.2 rounded font-mono">
                        #{homeSummary.standing.position}
                      </span>
                    )}
                    {homeSummary?.standing?.points !== undefined && (
                      <span className="text-[8.5px] font-mono text-zinc-400 font-bold">
                        {homeSummary.standing.points}p
                      </span>
                    )}
                    {homeSummary?.formStreak && homeSummary.formStreak.length > 0 && (
                      <div className="flex items-center gap-0.5 ml-0.5" title="Racha reciente">
                        {homeSummary.formStreak.slice(-3).map((f, i) => (
                          <span 
                            key={i} 
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              f.result === 'V' ? 'bg-emerald-400' : f.result === 'E' ? 'bg-amber-400' : 'bg-rose-400'
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Scoreboard Display (Clickable for free navigation) */}
              <div className="flex items-center gap-1 shrink-0 px-1">
                <button
                  type="button"
                  onTouchStart={() => vibratePop()}
                  onClick={() => {
                    vibratePop();
                    setActiveTeam('home');
                  }}
                  className={cn(
                    "w-9 h-9 rounded-xl font-mono text-base font-black flex items-center justify-center transition-all cursor-pointer",
                    activeTeam === 'home'
                      ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.5)] border-2 border-blue-400 scale-105"
                      : "bg-zinc-800/90 text-zinc-300 border border-zinc-700 hover:border-zinc-500"
                  )}
                  title="Editar goles Local"
                >
                  {homeScore !== '' ? homeScore : (activeTeam === 'home' ? '0' : '-')}
                </button>

                <span className="text-zinc-500 font-black text-xs px-0.5 select-none">-</span>

                <button
                  type="button"
                  onTouchStart={() => vibratePop()}
                  onClick={() => {
                    vibratePop();
                    setActiveTeam('away');
                  }}
                  className={cn(
                    "w-9 h-9 rounded-xl font-mono text-base font-black flex items-center justify-center transition-all cursor-pointer",
                    activeTeam === 'away'
                      ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.5)] border-2 border-blue-400 scale-105"
                      : "bg-zinc-800/90 text-zinc-300 border border-zinc-700 hover:border-zinc-500"
                  )}
                  title="Editar goles Visitante"
                >
                  {awayScore !== '' ? awayScore : (activeTeam === 'away' ? '0' : '-')}
                </button>
              </div>

              {/* Away Team (TV Right) */}
              <div 
                onClick={() => {
                  vibratePop();
                  setActiveTeam('away');
                }}
                onTouchStart={() => vibratePop()}
                className={cn(
                  "flex-1 flex items-center justify-end gap-2 p-1.5 rounded-xl cursor-pointer transition-all min-w-0 text-right",
                  activeTeam === 'away' 
                    ? "bg-blue-500/15 border border-blue-500/40" 
                    : "hover:bg-zinc-800/40 border border-transparent"
                )}
              >
                <div className="flex flex-col min-w-0 text-right items-end">
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-zinc-500">Visitante</span>
                  <span className={cn(
                    "text-xs font-bold truncate leading-tight",
                    activeTeam === 'away' ? "text-blue-400" : "text-zinc-300"
                  )}>
                    {match.awayTeam}
                  </span>

                  {/* Standing Pos & Form Dots */}
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {awaySummary?.formStreak && awaySummary.formStreak.length > 0 && (
                      <div className="flex items-center gap-0.5 mr-0.5" title="Racha reciente">
                        {awaySummary.formStreak.slice(-3).map((f, i) => (
                          <span 
                            key={i} 
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              f.result === 'V' ? 'bg-emerald-400' : f.result === 'E' ? 'bg-amber-400' : 'bg-rose-400'
                            )}
                          />
                        ))}
                      </div>
                    )}
                    {awaySummary?.standing?.points !== undefined && (
                      <span className="text-[8.5px] font-mono text-zinc-400 font-bold">
                        {awaySummary.standing.points}p
                      </span>
                    )}
                    {awaySummary?.standing?.position && (
                      <span className="text-[8.5px] font-bold text-zinc-400 bg-zinc-800/90 px-1 py-0.2 rounded font-mono">
                        #{awaySummary.standing.position}
                      </span>
                    )}
                  </div>
                </div>
                <TeamBadge 
                  src={match.awayFlag} 
                  teamName={match.awayTeam} 
                  className="w-7 h-7 shrink-0 drop-shadow" 
                />
              </div>
            </div>
          </div>

          {/* TOGGLE ACCORDION: RESUMEN E HISTORIAL DE AMBOS EQUIPOS */}
          <div className="mx-4 mb-2">
            <button
              type="button"
              onClick={() => {
                vibrateTap();
                setIsStatsExpanded(!isStatsExpanded);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800 text-[11px] font-bold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm select-none"
            >
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                <span>{isStatsExpanded ? 'Ocultar Resumen e Historial' : '📊 Ver Resumen e Historial de Ambos Equipos'}</span>
              </div>
              {isStatsExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {/* EXPANDED CONTENT */}
            {isStatsExpanded && vsSummary && (
              <div className="mt-2 p-3 bg-[#0d0d11] border border-zinc-800/90 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Comparativa Rápida Side-by-Side */}
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between font-bold text-zinc-500 pb-1 border-b border-zinc-800/80">
                    <span className="text-blue-400 truncate max-w-[120px]">{match.homeTeam}</span>
                    <span className="text-zinc-400 uppercase tracking-wider">Métrica</span>
                    <span className="text-emerald-400 truncate max-w-[120px] text-right">{match.awayTeam}</span>
                  </div>

                  {/* Posición */}
                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-mono font-bold text-white w-14">
                      #{homeSummary?.standing?.position ?? '-'}
                    </span>
                    <span className="text-zinc-400 text-center flex-1">Posición</span>
                    <span className="font-mono font-bold text-white w-14 text-right">
                      #{awaySummary?.standing?.position ?? '-'}
                    </span>
                  </div>

                  {/* Puntos */}
                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-mono font-bold text-blue-400 w-14">
                      {homeSummary?.standing?.points ?? homeSummary?.stats.wins! * 3 + homeSummary?.stats.draws!} pts
                    </span>
                    <span className="text-zinc-400 text-center flex-1">Puntos</span>
                    <span className="font-mono font-bold text-emerald-400 w-14 text-right">
                      {awaySummary?.standing?.points ?? awaySummary?.stats.wins! * 3 + awaySummary?.stats.draws!} pts
                    </span>
                  </div>

                  {/* Récord G-E-P */}
                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-mono text-zinc-300 w-14">
                      {homeSummary?.stats.wins}-{homeSummary?.stats.draws}-{homeSummary?.stats.losses}
                    </span>
                    <span className="text-zinc-400 text-center flex-1">G - E - P</span>
                    <span className="font-mono text-zinc-300 w-14 text-right">
                      {awaySummary?.stats.wins}-{awaySummary?.stats.draws}-{awaySummary?.stats.losses}
                    </span>
                  </div>

                  {/* Goles y Diferencia */}
                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-mono text-zinc-300 w-14">
                      {homeSummary?.stats.scoresFor}:{homeSummary?.stats.scoresAgainst} ({homeSummary?.stats.scoreDiff! > 0 ? `+${homeSummary?.stats.scoreDiff}` : homeSummary?.stats.scoreDiff})
                    </span>
                    <span className="text-zinc-400 text-center flex-1">Goles (Dif)</span>
                    <span className="font-mono text-zinc-300 w-14 text-right">
                      {awaySummary?.stats.scoresFor}:{awaySummary?.stats.scoresAgainst} ({awaySummary?.stats.scoreDiff! > 0 ? `+${awaySummary?.stats.scoreDiff}` : awaySummary?.stats.scoreDiff})
                    </span>
                  </div>
                </div>

                {/* Historial Directo H2H (si existe) */}
                {h2h && h2h.played > 0 && (
                  <div className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-[10px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <Swords className="w-3 h-3 text-purple-400" />
                      <span>H2H Oficial:</span>
                    </div>
                    <span className="font-mono text-zinc-300 font-bold">
                      {h2h.homeWins} V · {h2h.draws} E · {h2h.awayWins} D
                    </span>
                  </div>
                )}

                {/* Últimos Partidos Side-by-Side (2 mini columnas) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/80">
                  {/* Home Team Recent */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-400 truncate">
                        Últimos {match.homeTeam}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          vibrateTap();
                          setTeamModalTeam({ name: match.homeTeam, logo: match.homeFlag });
                        }}
                        className="text-[9px] text-zinc-500 hover:text-blue-300 underline cursor-pointer"
                      >
                        Ver todos
                      </button>
                    </div>

                    {homeSummary?.recentMatches.slice(0, 3).map((m) => (
                      <div key={m.matchId} className="flex items-center justify-between p-1 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-[9px]">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={cn(
                            "w-3.5 h-3.5 rounded text-[8px] font-black flex items-center justify-center shrink-0",
                            m.result === 'V' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            m.result === 'E' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          )}>
                            {m.result}
                          </span>
                          <span className="text-zinc-300 truncate max-w-[65px] font-medium">{m.opponentName}</span>
                        </div>
                        <span className="font-mono font-bold text-white shrink-0">
                          {m.teamScore}-{m.oppScore}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Away Team Recent */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 truncate">
                        Últimos {match.awayTeam}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          vibrateTap();
                          setTeamModalTeam({ name: match.awayTeam, logo: match.awayFlag });
                        }}
                        className="text-[9px] text-zinc-500 hover:text-emerald-300 underline cursor-pointer"
                      >
                        Ver todos
                      </button>
                    </div>

                    {awaySummary?.recentMatches.slice(0, 3).map((m) => (
                      <div key={m.matchId} className="flex items-center justify-between p-1 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-[9px]">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={cn(
                            "w-3.5 h-3.5 rounded text-[8px] font-black flex items-center justify-center shrink-0",
                            m.result === 'V' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            m.result === 'E' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          )}>
                            {m.result}
                          </span>
                          <span className="text-zinc-300 truncate max-w-[65px] font-medium">{m.opponentName}</span>
                        </div>
                        <span className="font-mono font-bold text-white shrink-0">
                          {m.teamScore}-{m.oppScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Sección Central (Foco de Edición) */}
          <div className="flex flex-col items-center justify-center py-1 px-4">
            {/* Logo del equipo en edición */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-900/90 border-2 border-zinc-700/60 p-1 flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.15)] shrink-0">
              <TeamBadge 
                src={activeTeamFlag} 
                teamName={activeTeamName} 
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain" 
              />
            </div>

            {/* Etiqueta del equipo separada con margen adecuado (no superpuesta al logo) */}
            <div className="mt-2 mb-0.5">
              <span className={cn(
                "px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-md inline-flex items-center gap-1",
                isHome 
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/40" 
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
              )}>
                {isHome ? 'Equipo Local' : 'Equipo Visitante'}
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-black text-white text-center line-clamp-1">
              {activeTeamName}
            </h3>

            <p className="text-[11px] font-semibold text-zinc-400 mt-0.5">
              ¿Cuántos goles?
            </p>

            {/* Large Focused Score Indicator */}
            <div className="mt-1 mb-1">
              <div className="min-w-[76px] h-12 bg-zinc-900/90 border border-zinc-700/70 rounded-2xl flex items-center justify-center px-4 shadow-inner">
                <span className={cn(
                  "font-mono text-3xl sm:text-4xl font-black tracking-wider",
                  currentScore !== '' ? "text-white" : "text-zinc-600"
                )}>
                  {currentScore !== '' ? currentScore : '0'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Teclado Numérico (Numpad) */}
          <div className="px-5 py-1">
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onTouchStart={() => vibratePop()}
                  onClick={() => handleDigitPress(num)}
                  className="h-12 sm:h-13 bg-zinc-800/80 hover:bg-zinc-700/90 active:bg-zinc-600 active:scale-95 text-white font-mono font-black text-xl sm:text-2xl rounded-xl border border-zinc-700/60 shadow-sm transition-all flex items-center justify-center cursor-pointer select-none"
                >
                  {num}
                </button>
              ))}

              {/* Bottom row: Clear (C), 0, Backspace */}
              <button
                type="button"
                onTouchStart={() => vibratePop()}
                onClick={handleClear}
                className="h-12 sm:h-13 bg-zinc-900/80 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 text-zinc-400 hover:text-white font-mono font-bold text-base sm:text-lg rounded-xl border border-zinc-800 transition-all flex items-center justify-center cursor-pointer select-none"
                title="Limpiar"
              >
                C
              </button>

              <button
                type="button"
                onTouchStart={() => vibratePop()}
                onClick={() => handleDigitPress('0')}
                className="h-12 sm:h-13 bg-zinc-800/80 hover:bg-zinc-700/90 active:bg-zinc-600 active:scale-95 text-white font-mono font-black text-xl sm:text-2xl rounded-xl border border-zinc-700/60 shadow-sm transition-all flex items-center justify-center cursor-pointer select-none"
              >
                0
              </button>

              <button
                type="button"
                onTouchStart={() => vibratePop()}
                onClick={handleBackspace}
                className="h-12 sm:h-13 bg-zinc-900/80 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 text-zinc-400 hover:text-rose-400 rounded-xl border border-zinc-800 transition-all flex items-center justify-center cursor-pointer select-none"
                title="Borrar dígito"
              >
                <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* 4. Botón de Acción Inferior */}
          <div className="px-5 pt-3">
            <button
              type="button"
              onTouchStart={() => vibratePop()}
              onClick={handleNextOrSave}
              disabled={isSaving}
              className={cn(
                "w-full max-w-xs mx-auto py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98 select-none",
                isHome
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
              )}
            >
              {isHome ? (
                <>
                  <span>Siguiente Equipo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>{isSaving ? 'Guardando...' : 'Guardar Pronóstico'}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Partidos del Club en caso de querer ver fixture completo sin perder el numpad */}
      <TeamMatchesModal
        isOpen={!!teamModalTeam}
        onClose={() => setTeamModalTeam(null)}
        teamName={teamModalTeam?.name || null}
        teamLogo={teamModalTeam?.logo}
      />
    </>
  );
}
