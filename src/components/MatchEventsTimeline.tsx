import React from 'react';
import { Match } from '../types';
import { DEFAULT_PLAYERS } from '../data/players';
import { TeamBadge } from './TeamBadge';
import { Info } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  minute: number;
  type: 'goal' | 'card' | 'injury';
  cardType?: 'amarilla' | 'roja';
  playerName: string;
  teamName: string;
  isHomeTeam: boolean;
}

function normalizeTeamStr(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\b(fc|cf|sc|ac|afc|fk|rb|cd|bsc)\b/gi, '') // remove club prefixes
    .replace(/[^a-z0-9]/g, '') // alphanumeric only
    .trim();
}

function matchTeamSide(target: string, homeTeam: string, awayTeam: string): 'home' | 'away' | null {
  const normTarget = normalizeTeamStr(target);
  const normHome = normalizeTeamStr(homeTeam);
  const normAway = normalizeTeamStr(awayTeam);

  if (!normTarget) return null;

  if (normHome && (normHome.includes(normTarget) || normTarget.includes(normHome))) {
    return 'home';
  }
  if (normAway && (normAway.includes(normTarget) || normTarget.includes(normAway))) {
    return 'away';
  }
  return null;
}

export function parseMatchEvents(match: {
  homeTeam: string;
  awayTeam: string;
  goalscorers?: any[];
  goles?: any[];
  cards?: any[];
  tarjetas?: any[];
  lesiones?: any[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  const goalsList = Array.isArray(match.goles) && match.goles.length > 0 
    ? match.goles 
    : (Array.isArray(match.goalscorers) ? match.goalscorers : []);

  const cardsList = Array.isArray(match.tarjetas) && match.tarjetas.length > 0 
    ? match.tarjetas 
    : (Array.isArray(match.cards) ? match.cards : []);

  const lesionesList = Array.isArray(match.lesiones) ? match.lesiones : [];

  // 1. Process goalscorers
  if (Array.isArray(goalsList)) {
    goalsList.forEach((g, idx) => {
      if (!g) return;
      if (typeof g === 'object') {
        const minute = Number(g.minuto ?? g.minute ?? 0);
        const playerName = String(g.jugador || g.player || 'Gol').trim();
        let teamName = String(g.equipo || g.team || '').trim();
        if (teamName.toLowerCase() === 'undefined') teamName = '';

        let side: 'home' | 'away' | null = null;
        if (g.is_home === true || g.isHome === true) side = 'home';
        if (g.is_home === false || g.isHome === false) side = 'away';

        if (!side && teamName) {
          side = matchTeamSide(teamName, match.homeTeam, match.awayTeam);
        }

        if (!side) {
          const found = DEFAULT_PLAYERS.find(p => p.name.toLowerCase().trim() === playerName.toLowerCase().trim());
          if (found?.team) {
            side = matchTeamSide(found.team, match.homeTeam, match.awayTeam);
            if (!teamName) teamName = found.team;
          }
        }

        const isHome = side !== 'away';

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
        let teamName = matchStr?.[3]?.trim() || '';
        if (teamName.toLowerCase() === 'undefined') teamName = '';

        let side: 'home' | 'away' | null = null;
        if (teamName) {
          side = matchTeamSide(teamName, match.homeTeam, match.awayTeam);
        }
        if (!side) {
          const found = DEFAULT_PLAYERS.find(p => p.name.toLowerCase().trim() === playerName.toLowerCase().trim());
          if (found?.team) {
            side = matchTeamSide(found.team, match.homeTeam, match.awayTeam);
            if (!teamName) teamName = found.team;
          }
        }

        const isHome = side !== 'away';

        events.push({
          id: `goal-str-${idx}-${minute}`,
          minute: isNaN(minute) ? 0 : minute,
          type: 'goal',
          playerName,
          teamName: teamName || (isHome ? match.homeTeam : match.awayTeam),
          isHomeTeam: isHome
        });
      }
    });
  }

  // 2. Process cards
  if (Array.isArray(cardsList)) {
    cardsList.forEach((c, idx) => {
      if (!c) return;
      if (typeof c === 'object') {
        const minute = Number(c.minuto ?? c.minute ?? 0);
        const playerName = String(c.jugador || c.player || 'Tarjeta').trim();
        let teamName = String(c.equipo || c.team || '').trim();
        if (teamName.toLowerCase() === 'undefined') teamName = '';

        const rawTipo = String(c.tipo || c.type || '').toLowerCase();
        const cardType: 'amarilla' | 'roja' = (
          rawTipo.includes('roja') || 
          rawTipo.includes('red') || 
          rawTipo.includes('expuls') || 
          rawTipo.includes('segunda')
        ) ? 'roja' : 'amarilla';

        let side: 'home' | 'away' | null = null;
        if (c.is_home === true || c.isHome === true) side = 'home';
        if (c.is_home === false || c.isHome === false) side = 'away';

        if (!side && teamName) {
          side = matchTeamSide(teamName, match.homeTeam, match.awayTeam);
        }

        if (!side) {
          const found = DEFAULT_PLAYERS.find(p => p.name.toLowerCase().trim() === playerName.toLowerCase().trim());
          if (found?.team) {
            side = matchTeamSide(found.team, match.homeTeam, match.awayTeam);
            if (!teamName) teamName = found.team;
          }
        }

        const isHome = side !== 'away';

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
        let teamName = matchStr?.[3]?.trim() || '';
        if (teamName.toLowerCase() === 'undefined') teamName = '';

        const rawTipo = matchStr?.[4]?.toLowerCase() || '';
        const cardType: 'amarilla' | 'roja' = (
          rawTipo.includes('roja') || 
          rawTipo.includes('red') || 
          rawTipo.includes('expuls') || 
          rawTipo.includes('segunda')
        ) ? 'roja' : 'amarilla';

        let side: 'home' | 'away' | null = null;
        if (teamName) {
          side = matchTeamSide(teamName, match.homeTeam, match.awayTeam);
        }
        if (!side) {
          const found = DEFAULT_PLAYERS.find(p => p.name.toLowerCase().trim() === playerName.toLowerCase().trim());
          if (found?.team) {
            side = matchTeamSide(found.team, match.homeTeam, match.awayTeam);
            if (!teamName) teamName = found.team;
          }
        }

        const isHome = side !== 'away';

        events.push({
          id: `card-str-${idx}-${minute}`,
          minute: isNaN(minute) ? 0 : minute,
          type: 'card',
          cardType,
          playerName,
          teamName: teamName || (isHome ? match.homeTeam : match.awayTeam),
          isHomeTeam: isHome
        });
      }
    });
  }

  // 3. Process injuries / substitutions
  if (Array.isArray(lesionesList)) {
    lesionesList.forEach((inj, idx) => {
      if (!inj) return;
      if (typeof inj === 'object') {
        const minute = Number(inj.minuto ?? inj.minute ?? 0);
        const sale = String(inj.jugador_sale || inj.player_out || '').trim();
        const entra = String(inj.jugador_entra || inj.player_in || '').trim();
        const playerName = entra && sale ? `${sale} ➔ ${entra}` : (sale || entra || 'Lesión / Cambio');
        let teamName = String(inj.equipo || inj.team || '').trim();
        if (teamName.toLowerCase() === 'undefined') teamName = '';

        let side: 'home' | 'away' | null = null;
        if (inj.is_home === true || inj.isHome === true) side = 'home';
        if (inj.is_home === false || inj.isHome === false) side = 'away';

        if (!side && teamName) {
          side = matchTeamSide(teamName, match.homeTeam, match.awayTeam);
        }

        if (!side) {
          const checkName = sale || entra;
          const found = DEFAULT_PLAYERS.find(p => p.name.toLowerCase().trim() === checkName.toLowerCase().trim());
          if (found?.team) {
            side = matchTeamSide(found.team, match.homeTeam, match.awayTeam);
            if (!teamName) teamName = found.team;
          }
        }

        const isHome = side !== 'away';

        events.push({
          id: `inj-${idx}-${minute}`,
          minute: isNaN(minute) ? 0 : minute,
          type: 'injury',
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

export interface MatchEventsTimelineProps {
  match: Match;
}

export function MatchEventsTimeline({ match }: MatchEventsTimelineProps) {
  const events = parseMatchEvents(match);
  const isFinished = match.status === 'finished';

  if (events.length === 0) {
    return (
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
    );
  }

  return (
    <div className="space-y-2">
      {/* Team Column Headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-2 bg-[#121215] border border-zinc-800/80 rounded-xl text-[11px] font-black uppercase tracking-wider">
        <div className="flex items-center gap-1.5 justify-start text-zinc-300 truncate">
          <TeamBadge src={match.homeFlag} teamName={match.homeTeam} className="w-4 h-4 shrink-0" />
          <span className="truncate">{match.homeTeam}</span>
        </div>
        <div className="text-zinc-500 font-mono text-[9px] px-1.5">MIN</div>
        <div className="flex items-center gap-1.5 justify-end text-zinc-300 text-right truncate">
          <span className="truncate">{match.awayTeam}</span>
          <TeamBadge src={match.awayFlag} teamName={match.awayTeam} className="w-4 h-4 shrink-0" />
        </div>
      </div>

      {/* Dynamic Left / Right Timeline */}
      <div className="relative py-2 space-y-3">
        {/* Central Vertical Line */}
        <div className="absolute left-1/2 top-2 bottom-2 -translate-x-1/2 w-0.5 bg-zinc-800" />

        {events.map((e) => {
          const isHome = e.isHomeTeam;
          const isGoal = e.type === 'goal';
          const isInjury = e.type === 'injury';
          const isRed = e.cardType === 'roja';
          const icon = isGoal ? '⚽' : isInjury ? '🚑' : isRed ? '🟥' : '🟨';
          const eventLabel = isGoal 
            ? 'Gol' 
            : isInjury 
              ? 'Lesión / Cambio' 
              : isRed 
                ? 'Tarjeta Roja' 
                : 'Tarjeta Amarilla';
          const minuteLabel = e.minute > 0 ? `${e.minute}'` : isGoal ? 'GOL' : isInjury ? 'LES' : 'TAR';

          return (
            <div 
              key={e.id}
              className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4"
            >
              {/* Left Column (Home Team Event) */}
              {isHome ? (
                <div className="flex items-center justify-end gap-2 text-right pr-1">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                      {e.playerName}
                    </p>
                    <p className={`text-[10px] font-semibold truncate ${
                      isGoal 
                        ? 'text-emerald-400' 
                        : isInjury 
                          ? 'text-sky-400' 
                          : isRed 
                            ? 'text-rose-400' 
                            : 'text-amber-400'
                    }`}>
                      {eventLabel}
                    </p>
                  </div>
                  <span className="text-base sm:text-lg shrink-0 select-none drop-shadow-sm">
                    {icon}
                  </span>
                </div>
              ) : (
                <div />
              )}

              {/* Center Column (Minute Pill) */}
              <div className="relative z-10 flex items-center justify-center">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-black font-mono shadow-md border ${
                  isGoal 
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]' 
                    : isInjury
                      ? 'bg-sky-950/90 border-sky-500/60 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                      : isRed
                        ? 'bg-rose-950/90 border-rose-500/60 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                        : 'bg-amber-950/90 border-amber-500/60 text-amber-300'
                }`}>
                  {minuteLabel}
                </span>
              </div>

              {/* Right Column (Away Team Event) */}
              {!isHome ? (
                <div className="flex items-center justify-start gap-2 text-left pl-1">
                  <span className="text-base sm:text-lg shrink-0 select-none drop-shadow-sm">
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                      {e.playerName}
                    </p>
                    <p className={`text-[10px] font-semibold truncate ${
                      isGoal 
                        ? 'text-emerald-400' 
                        : isInjury 
                          ? 'text-sky-400' 
                          : isRed 
                            ? 'text-rose-400' 
                            : 'text-amber-400'
                    }`}>
                      {eventLabel}
                    </p>
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
