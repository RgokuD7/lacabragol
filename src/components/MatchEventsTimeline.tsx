import React from 'react';
import { Match } from '../types';

export interface TimelineEvent {
  id: string;
  minute: number;
  type: 'goal' | 'card';
  cardType?: 'amarilla' | 'roja';
  playerName: string;
  teamName: string;
  isHomeTeam: boolean;
}

export function parseMatchEvents(match: {
  homeTeam: string;
  awayTeam: string;
  goalscorers?: any[];
  cards?: any[];
}): TimelineEvent[] {
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
  return events;
}

interface MatchEventsTimelineProps {
  match: Match;
  compact?: boolean;
}

export function MatchEventsTimeline({ match, compact = false }: MatchEventsTimelineProps) {
  const events = parseMatchEvents(match);
  const isFinished = match.status === 'finished';

  if (compact) {
    if (events.length === 0) {
      return (
        <div className="py-2.5 px-3 bg-[#0d0d10] rounded-lg border border-zinc-800/80 text-center">
          <p className="text-[11px] text-zinc-400 font-medium">
            {isFinished 
              ? 'Sin goles ni tarjetas registradas' 
              : 'Los goles y tarjetas se mostrarán aquí una vez inicie el partido'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5 pt-1">
        {events.map((e) => {
          return (
            <div 
              key={e.id}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#141418] border border-zinc-800/70 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0 select-none">
                  {e.type === 'goal' ? '⚽' : e.cardType === 'roja' ? '🟥' : '🟨'}
                </span>
                <div className="min-w-0">
                  <span className="font-bold text-white text-[11px] truncate block leading-tight">
                    {e.playerName}
                  </span>
                  <span className="text-[9px] text-zinc-400 truncate block leading-none mt-0.5">
                    {e.teamName}
                  </span>
                </div>
              </div>

              <span className="shrink-0 font-mono font-black text-[10px] text-blue-400 bg-blue-950/70 border border-blue-800/50 px-1.5 py-0.5 rounded">
                {e.minute > 0 ? `${e.minute}'` : 'GOL'}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Full timeline view
  return (
    <div className="relative pl-6 space-y-2.5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-800">
      {events.map((e) => (
        <div 
          key={e.id} 
          className="relative flex items-center justify-between gap-2 bg-[#141418] border border-zinc-800/80 rounded-xl p-2.5 hover:border-zinc-700 transition-colors shadow-sm"
        >
          <div className="absolute -left-[23px] w-4 h-4 rounded-full bg-[#111114] border-2 border-zinc-700 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>

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

          <div className="shrink-0">
            <span className="font-mono font-black text-xs text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-md shadow-sm">
              {e.minute > 0 ? `${e.minute}'` : 'GOL'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
