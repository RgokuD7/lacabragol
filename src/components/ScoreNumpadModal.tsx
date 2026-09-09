import React, { useState, useEffect } from 'react';
import { X, Delete, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Match } from '../types';
import { TeamBadge } from './TeamBadge';
import { vibratePop, vibrateSuccess } from '../lib/haptics';
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

  // Sync state ONLY when modal opens or target match changes (avoids resetting to home during save)
  useEffect(() => {
    if (isOpen) {
      setHomeScore(initialHomeScore ?? '');
      setAwayScore(initialAwayScore ?? '');
      setActiveTeam(initialFocus);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, match?.id]);

  if (!isOpen || !match) return null;

  const currentScore = activeTeam === 'home' ? homeScore : awayScore;

  // Keypad logic strictly adhering to specifications:
  // 1. Initial Zero rule:
  //    - If empty, typing '0' sets '0'.
  //    - If '0' and user types another number (1-9), '0' is REPLACED by the new number (avoids '05').
  //    - If non-zero (e.g. '1') and user types '0', it becomes '10'.
  // 2. Length limit: Maximum 2 digits.
  // 3. No auto-advance: Explicit button press required to advance.
  const handleDigitPress = (digit: string) => {
    vibratePop();
    const updateScore = (prev: string): string => {
      // If currently '0' and user types a digit 1-9, replace it
      if (prev === '0') {
        return digit === '0' ? '0' : digit;
      }
      // If already at 2 digits, do not allow further digits
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
      // Advance to Away team
      // If user didn't enter anything, default home to '0'
      if (homeScore === '') {
        setHomeScore('0');
      }
      setActiveTeam('away');
    } else {
      // Save prediction
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

  return (
    <div className="fixed inset-0 z-[1050] flex flex-col justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet Content Container */}
      <div 
        className="relative bg-[#121216] border-t border-zinc-800 w-full max-w-md mx-auto rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-200"
        style={{
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 20px), 24px)'
        }}
      >
        {/* Top Header Bar with Drag Handle, Title & Dedicated Close Button */}
        <div className="relative flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-zinc-800/60 mb-2">
          {/* Left balance spacer to keep center content perfectly centered */}
          <div className="w-8 h-8 shrink-0" />

          {/* Centered Drag Handle + Modal Title */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Pronosticar Resultado
            </span>
          </div>

          {/* Close Button ('X') - Contained in header row, completely separated from TV scoreboard */}
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

        {/* 1. Header (Marcador Global - Estilo TV) */}
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
              <div className="flex flex-col min-w-0 text-right">
                <span className="text-[8.5px] font-bold uppercase tracking-wider text-zinc-500">Visitante</span>
                <span className={cn(
                  "text-xs font-bold truncate leading-tight",
                  activeTeam === 'away' ? "text-blue-400" : "text-zinc-300"
                )}>
                  {match.awayTeam}
                </span>
              </div>
              <TeamBadge 
                src={match.awayFlag} 
                teamName={match.awayTeam} 
                className="w-7 h-7 shrink-0 drop-shadow" 
              />
            </div>
          </div>
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
  );
}
