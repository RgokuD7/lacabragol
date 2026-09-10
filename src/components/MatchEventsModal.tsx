import React from 'react';
import { Match } from '../types';
import { BaseBottomSheet } from './BaseBottomSheet';
import { TeamBadge } from './TeamBadge';
import { Calendar, Clock } from 'lucide-react';
import { formatMatchDate } from '../lib/utils';
import { MatchEventsTimeline } from './MatchEventsTimeline';

interface MatchEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
}

export function MatchEventsModal({ isOpen, onClose, match }: MatchEventsModalProps) {
  if (!match) return null;

  const isFinished = match.status === 'finished';
  const isInProgress = match.status === 'in_progress';

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Detalles del Partido"
      zIndexClassName="z-[1050]"
      contentClassName="p-4"
    >
      <div className="space-y-4 pb-20 max-h-[75vh] overflow-y-auto px-1">
        {/* Match Header Scoreboard */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-lg">
          {/* Top Info: Date & Group */}
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-3 mb-3 border-b border-zinc-800/80">
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>{formatMatchDate(match.date)}</span>
            </span>
            <span className="bg-zinc-900 border border-zinc-700/60 px-2 py-0.5 rounded-full text-[10px] font-black uppercase text-zinc-300 tracking-wider">
              {match.group || 'Fase de Liga'}
            </span>
          </div>

          {/* Teams & Score Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Home Team */}
            <div className="flex-1 flex flex-col items-center text-center gap-1.5 min-w-0">
              <TeamBadge 
                src={match.homeFlag} 
                teamName={match.homeTeam} 
                size="lg" 
                className="w-12 h-12 shrink-0 drop-shadow-md" 
              />
              <span className="text-xs sm:text-sm font-black text-white leading-tight truncate max-w-full">
                {match.homeTeam}
              </span>
            </div>

            {/* Score Center */}
            <div className="flex flex-col items-center justify-center px-2">
              <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 px-3.5 py-1.5 rounded-xl shadow-inner font-mono text-xl sm:text-2xl font-black text-white">
                <span>{match.homeScore ?? (isFinished || isInProgress ? 0 : '-')}</span>
                <span className="text-zinc-500 text-sm">-</span>
                <span>{match.awayScore ?? (isFinished || isInProgress ? 0 : '-')}</span>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest mt-1.5 px-2 py-0.5 rounded-full border ${
                isFinished 
                  ? 'bg-zinc-800 text-zinc-300 border-zinc-700' 
                  : isInProgress 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {isFinished ? 'Finalizado' : isInProgress ? 'En Vivo' : 'Programado'}
              </span>
            </div>

            {/* Away Team */}
            <div className="flex-1 flex flex-col items-center text-center gap-1.5 min-w-0">
              <TeamBadge 
                src={match.awayFlag} 
                teamName={match.awayTeam} 
                size="lg" 
                className="w-12 h-12 shrink-0 drop-shadow-md" 
              />
              <span className="text-xs sm:text-sm font-black text-white leading-tight truncate max-w-full">
                {match.awayTeam}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Left / Right Timeline Section */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Eventos del Partido</span>
            </h3>
          </div>
          <MatchEventsTimeline match={match} />
        </div>
      </div>
    </BaseBottomSheet>
  );
}
