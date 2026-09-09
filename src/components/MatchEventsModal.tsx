import React from 'react';
import { Match } from '../types';
import { BaseBottomSheet } from './BaseBottomSheet';
import { TeamBadge } from './TeamBadge';
import { Calendar, Clock, Info } from 'lucide-react';
import { formatMatchDate } from '../lib/utils';

interface MatchEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
}

interface TimelineEvent {
  id: string;
  minute: number;
  type: 'goal' | 'card';
  cardType?: 'amarilla' | 'roja';
  playerName: string;
  teamName: string;
  isHomeTeam: boolean;
}

export function MatchEventsModal({ isOpen, onClose, match }: MatchEventsModalProps) {
  if (!match) return null;

  const isFinished = match.status === 'finished';
  const isInProgress = match.status === 'in_progress';

  // Parse and unify all events
  const events: TimelineEvent[] = [];

  // 1. Process goalscorers
  if (Array.isArray(match.goalscorers)) {
    match.goalscorers.forEach((g, idx) => {
      if (!g) return;
      if (typeof g === 'object') {
        const minute = Number(g.minuto ?? g.minute ?? 0);
        const playerName = String(g.jugador || g.player || 'Gol').trim();
        const teamName = String(g.equipo || g.team || '').trim();
        const isHome = teamName.toLowerCase().includes(match.homeTeam.toLowerCase()) || 
                       match.homeTeam.toLowerCase().includes(teamName.toLowerCase());

        events.push({
          id: `goal-${idx}-${minute}`,
          minute: isNaN(minute) ? 0 : minute,
          type: 'goal',
          playerName,
          teamName: teamName || (isHome ? match.homeTeam : match.awayTeam),
          isHomeTeam: isHome
        });
      } else if (typeof g === 'string') {
        // String format: "Kylian Mbappé 14' (Real Madrid)"
        const matchStr = g.match(/^(.*?)\s*(\d+)?['’]?\s*(?:\((.*?)\))?$/);
        const playerName = matchStr?.[1]?.trim() || g;
        const minute = matchStr?.[2] ? parseInt(matchStr[2], 10) : 0;
        const teamName = matchStr?.[3]?.trim() || '';
        const isHome = teamName.toLowerCase().includes(match.homeTeam.toLowerCase());

        events.push({
          id: `goal-str-${idx}-${minute}`,
          minute,
          type: 'goal',
          playerName,
          teamName: teamName || (isHome ? match.homeTeam : match.awayTeam),
          isHomeTeam: isHome
        });
      }
    });
  }

  // 2. Process cards
  if (Array.isArray(match.cards)) {
    match.cards.forEach((c, idx) => {
      if (!c) return;
      if (typeof c === 'object') {
        const minute = Number(c.minuto ?? c.minute ?? 0);
        const playerName = String(c.jugador || c.player || 'Tarjeta').trim();
        const teamName = String(c.equipo || c.team || '').trim();
        const tipoStr = String(c.tipo || c.type || '').toLowerCase();
        const cardType: 'amarilla' | 'roja' = (tipoStr.includes('roja') || tipoStr.includes('red')) ? 'roja' : 'amarilla';
        const isHome = teamName.toLowerCase().includes(match.homeTeam.toLowerCase()) || 
                       match.homeTeam.toLowerCase().includes(teamName.toLowerCase());

        events.push({
          id: `card-${idx}-${minute}`,
          minute: isNaN(minute) ? 0 : minute,
          type: 'card',
          cardType,
          playerName,
          teamName: teamName || (isHome ? match.homeTeam : match.awayTeam),
          isHomeTeam: isHome
        });
      } else if (typeof c === 'string') {
        const matchStr = c.match(/^(.*?)\s*(\d+)?['’]?\s*(?:\((.*?)\))?(?:\s*-\s*(.*))?$/);
        const playerName = matchStr?.[1]?.trim() || c;
        const minute = matchStr?.[2] ? parseInt(matchStr[2], 10) : 0;
        const teamName = matchStr?.[3]?.trim() || '';
        const rawTipo = matchStr?.[4]?.toLowerCase() || '';
        const cardType: 'amarilla' | 'roja' = rawTipo.includes('roja') ? 'roja' : 'amarilla';
        const isHome = teamName.toLowerCase().includes(match.homeTeam.toLowerCase());

        events.push({
          id: `card-str-${idx}-${minute}`,
          minute,
          type: 'card',
          cardType,
          playerName,
          teamName: teamName || (isHome ? match.homeTeam : match.awayTeam),
          isHomeTeam: isHome
        });
      }
    });
  }

  // Sort events chronologically by minute
  events.sort((a, b) => a.minute - b.minute);

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Detalles del Partido"
      zIndexClassName="z-[1050]"
      contentClassName="p-4"
    >
      <div className="space-y-4 pb-12 max-h-[75vh] overflow-y-auto px-1">
        {/* Match Header Board */}
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
              <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 px-3 py-1.5 rounded-xl shadow-inner font-mono text-xl sm:text-2xl font-black text-white">
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

        {/* Timeline of Events Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Eventos del Partido</span>
            </h3>
            {events.length > 0 && (
              <span className="text-[10px] font-bold text-zinc-500">
                {events.length} {events.length === 1 ? 'evento' : 'eventos'}
              </span>
            )}
          </div>

          {events.length > 0 ? (
            <div className="relative pl-6 space-y-3 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-800">
              {events.map((e) => (
                <div 
                  key={e.id} 
                  className="relative flex items-center justify-between gap-2 bg-[#141418] border border-zinc-800/80 rounded-xl p-2.5 hover:border-zinc-700 transition-colors shadow-sm"
                >
                  {/* Left indicator bullet on line */}
                  <div className="absolute -left-[23px] w-4 h-4 rounded-full bg-[#111114] border-2 border-zinc-700 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </div>

                  {/* Event Info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0 select-none">
                      {e.type === 'goal' ? '⚽' : e.cardType === 'roja' ? '🟥' : '🟨'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate leading-tight">
                        {e.playerName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                        {e.teamName || (e.isHomeTeam ? match.homeTeam : match.awayTeam)}
                      </p>
                    </div>
                  </div>

                  {/* Minute Badge */}
                  <div className="shrink-0">
                    <span className="font-mono font-black text-xs text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-md shadow-sm">
                      {e.minute > 0 ? `${e.minute}'` : 'GOL'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#141418] border border-zinc-800/80 rounded-2xl p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mx-auto text-zinc-500">
                <Info className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-white">
                No hay goles ni tarjetas registradas
              </p>
              <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {isFinished 
                  ? 'Este encuentro finalizó sin eventos cargados en la base de datos o terminó 0-0.' 
                  : 'Los goles y tarjetas se sincronizarán automáticamente al disputarse el partido.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </BaseBottomSheet>
  );
}
