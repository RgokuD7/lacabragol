import React from 'react';
import { Match } from '../types';
import { DEFAULT_PLAYERS } from '../data/players';
import { TeamBadge } from './TeamBadge';
import { Info } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  minute: number;
  type: 'goal' | 'card' | 'substitution' | 'injury';
  cardType?: 'amarilla' | 'roja';
  playerName: string;
  playerIn?: string;
  playerOut?: string;
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
  cambios?: any[];
  sustituciones?: any[];
  lesiones?: any[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  const goalsList = Array.isArray(match.goles) && match.goles.length > 0 
    ? match.goles 
    : (Array.isArray(match.goalscorers) ? match.goalscorers : []);

  const cardsList = Array.isArray(match.tarjetas) && match.tarjetas.length > 0 
    ? match.tarjetas 
    : (Array.isArray(match.cards) ? match.cards : []);

  const rawCambiosList = Array.isArray(match.cambios) 
    ? match.cambios 
    : (Array.isArray((match as any).sustituciones) ? (match as any).sustituciones : []);

  const rawLesionesList = Array.isArray(match.lesiones) ? match.lesiones : [];

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

  // 3. Process substitutions (cambios) & injuries (lesiones)
  const allSubstitutions: any[] = [...rawCambiosList];
  const actualInjuries: any[] = [];

  rawLesionesList.forEach(item => {
    if (!item) return;
    // Si contiene jugador_entra / player_in o jugador_sale, o tipo cambio, es una sustitución
    if (item.jugador_entra || item.player_in || item.jugador_sale || item.player_out || String(item.tipo || '').toLowerCase().includes('cambio')) {
      allSubstitutions.push(item);
    } else {
      actualInjuries.push(item);
    }
  });

  // Procesar sustituciones (con icono 🔄 y etiquetas ▲ Entra / ▼ Sale)
  allSubstitutions.forEach((sub, idx) => {
    if (!sub) return;
    if (typeof sub === 'object') {
      const minute = Number(sub.minuto ?? sub.minute ?? 0);
      const sale = String(sub.jugador_sale || sub.player_out || '').trim();
      const entra = String(sub.jugador_entra || sub.player_in || '').trim();
      const playerName = entra && sale ? `${entra} / ${sale}` : (entra || sale || 'Cambio');
      let teamName = String(sub.equipo || sub.team || '').trim();
      if (teamName.toLowerCase() === 'undefined') teamName = '';

      let side: 'home' | 'away' | null = null;
      if (sub.is_home === true || sub.isHome === true) side = 'home';
      if (sub.is_home === false || sub.isHome === false) side = 'away';

      if (!side && teamName) {
        side = matchTeamSide(teamName, match.homeTeam, match.awayTeam);
      }

      if (!side) {
        const checkName = entra || sale;
        const found = DEFAULT_PLAYERS.find(p => p.name.toLowerCase().trim() === checkName.toLowerCase().trim());
        if (found?.team) {
          side = matchTeamSide(found.team, match.homeTeam, match.awayTeam);
          if (!teamName) teamName = found.team;
        }
      }

      const isHome = side !== 'away';

      events.push({
        id: `sub-${idx}-${minute}`,
        minute: isNaN(minute) ? 0 : minute,
        type: 'substitution',
        playerName,
        playerIn: entra || undefined,
        playerOut: sale || undefined,
        teamName: teamName || (isHome ? match.homeTeam : match.awayTeam),
        isHomeTeam: isHome
      });
    }
  });

  // Procesar lesiones genuinas (sin reemplazo o marcadas como lesión)
  actualInjuries.forEach((inj, idx) => {
    if (!inj) return;
    if (typeof inj === 'object') {
      const minute = Number(inj.minuto ?? inj.minute ?? 0);
      const playerName = String(inj.jugador || inj.player || 'Lesión').trim();
      let teamName = String(inj.equipo || inj.team || '').trim();
      if (teamName.toLowerCase() === 'undefined') teamName = '';

      let side: 'home' | 'away' | null = null;
      if (inj.is_home === true || inj.isHome === true) side = 'home';
      if (inj.is_home === false || inj.isHome === false) side = 'away';

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
        id: `inj-${idx}-${minute}`,
        minute: isNaN(minute) ? 0 : minute,
        type: 'injury',
        playerName,
        teamName: teamName || (isHome ? match.homeTeam : match.awayTeam),
        isHomeTeam: isHome
      });
    }
  });

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
          No hay goles, tarjetas ni cambios registrados
        </p>
        <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
          {isFinished 
            ? 'Este encuentro finalizó sin eventos cargados en la base de datos o terminó 0-0.' 
            : 'Los goles, tarjetas y cambios se sincronizarán al disputarse el partido.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Team Column Headers - Strict equal layout */}
      <div className="grid grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] items-center gap-1.5 sm:gap-3 px-2 py-2 bg-[#121215] border border-zinc-800/80 rounded-xl text-[11px] font-black uppercase tracking-wider w-full">
        <div className="flex items-center gap-1.5 justify-start text-zinc-300 truncate min-w-0">
          <TeamBadge src={match.homeFlag} teamName={match.homeTeam} className="w-4 h-4 shrink-0" />
          <span className="truncate">{match.homeTeam}</span>
        </div>
        <div className="text-zinc-500 font-mono text-[9px] text-center w-9 mx-auto shrink-0">MIN</div>
        <div className="flex items-center gap-1.5 justify-end text-zinc-300 text-right truncate min-w-0">
          <span className="truncate">{match.awayTeam}</span>
          <TeamBadge src={match.awayFlag} teamName={match.awayTeam} className="w-4 h-4 shrink-0" />
        </div>
      </div>

      {/* Dynamic Left / Right Timeline */}
      <div className="relative py-2 space-y-3 w-full overflow-hidden">
        {/* Central Vertical Line strictly at 50% */}
        <div className="absolute left-1/2 top-2 bottom-2 -translate-x-1/2 w-0.5 bg-zinc-800 pointer-events-none" />

        {events.map((e) => {
          const isHome = e.isHomeTeam;
          const isGoal = e.type === 'goal';
          const isSub = e.type === 'substitution';
          const isInjury = e.type === 'injury';
          const isRed = e.cardType === 'roja';
          
          // Icon and Label: Substitutions use 🔄 Cambio (never an ambulance)
          const icon = isGoal ? '⚽' : isSub ? '🔄' : isInjury ? '🚑' : isRed ? '🟥' : '🟨';
          const eventLabel = isGoal 
            ? 'Gol' 
            : isSub 
              ? 'Cambio' 
              : isInjury 
                ? 'Lesión' 
                : isRed 
                  ? 'Tarjeta Roja' 
                  : 'Tarjeta Amarilla';
          const minuteLabel = e.minute > 0 ? `${e.minute}'` : isGoal ? 'GOL' : isSub ? 'CAM' : isInjury ? 'LES' : 'TAR';

          return (
            <div 
              key={e.id}
              className="relative grid grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] items-center gap-1.5 sm:gap-3 w-full"
            >
              {/* Left Column (Home Team Event) */}
              {isHome ? (
                <div className="flex items-center justify-end gap-1.5 sm:gap-2 text-right pr-1 min-w-0 w-full overflow-hidden">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    {isSub ? (
                      <div className="space-y-0.5">
                        {e.playerIn && (
                          <p className="text-[10px] sm:text-xs font-bold text-emerald-400 truncate leading-tight flex items-center justify-end gap-1" title={`Entra: ${e.playerIn}`}>
                            <span className="truncate">{e.playerIn}</span>
                            <span className="text-[9px] font-black text-emerald-400 shrink-0 select-none">▲</span>
                          </p>
                        )}
                        {e.playerOut && (
                          <p className="text-[9px] sm:text-[10px] font-medium text-rose-400/90 truncate leading-tight flex items-center justify-end gap-1" title={`Sale: ${e.playerOut}`}>
                            <span className="truncate">{e.playerOut}</span>
                            <span className="text-[9px] font-black text-rose-400 shrink-0 select-none">▼</span>
                          </p>
                        )}
                        <p className="text-[8px] sm:text-[9px] font-bold text-cyan-400 uppercase tracking-wider">
                          Cambio
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs sm:text-sm font-black text-white leading-tight truncate" title={e.playerName}>
                          {e.playerName}
                        </p>
                        <p className={`text-[9px] sm:text-[10px] font-semibold truncate ${
                          isGoal 
                            ? 'text-emerald-400' 
                            : isInjury 
                              ? 'text-rose-400' 
                              : isRed 
                                ? 'text-rose-400' 
                                : 'text-amber-400'
                        }`}>
                          {eventLabel}
                        </p>
                      </>
                    )}
                  </div>
                  <span className="text-base sm:text-lg shrink-0 select-none drop-shadow-sm">
                    {icon}
                  </span>
                </div>
              ) : (
                <div />
              )}

              {/* Center Column (Minute Pill - Guaranteed exactly centered at 50%) */}
              <div className="relative z-10 flex items-center justify-center w-9 mx-auto">
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black font-mono shadow-md border shrink-0 ${
                  isGoal 
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]' 
                    : isSub
                      ? 'bg-cyan-950/90 border-cyan-500/60 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                      : isInjury
                        ? 'bg-rose-950/90 border-rose-500/60 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                        : isRed
                          ? 'bg-rose-950/90 border-rose-500/60 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                          : 'bg-amber-950/90 border-amber-500/60 text-amber-300'
                }`}>
                  {minuteLabel}
                </span>
              </div>

              {/* Right Column (Away Team Event) */}
              {!isHome ? (
                <div className="flex items-center justify-start gap-1.5 sm:gap-2 text-left pl-1 min-w-0 w-full overflow-hidden">
                  <span className="text-base sm:text-lg shrink-0 select-none drop-shadow-sm">
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    {isSub ? (
                      <div className="space-y-0.5">
                        {e.playerIn && (
                          <p className="text-[10px] sm:text-xs font-bold text-emerald-400 truncate leading-tight flex items-center justify-start gap-1" title={`Entra: ${e.playerIn}`}>
                            <span className="text-[9px] font-black text-emerald-400 shrink-0 select-none">▲</span>
                            <span className="truncate">{e.playerIn}</span>
                          </p>
                        )}
                        {e.playerOut && (
                          <p className="text-[9px] sm:text-[10px] font-medium text-rose-400/90 truncate leading-tight flex items-center justify-start gap-1" title={`Sale: ${e.playerOut}`}>
                            <span className="text-[9px] font-black text-rose-400 shrink-0 select-none">▼</span>
                            <span className="truncate">{e.playerOut}</span>
                          </p>
                        )}
                        <p className="text-[8px] sm:text-[9px] font-bold text-cyan-400 uppercase tracking-wider">
                          Cambio
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs sm:text-sm font-black text-white leading-tight truncate" title={e.playerName}>
                          {e.playerName}
                        </p>
                        <p className={`text-[9px] sm:text-[10px] font-semibold truncate ${
                          isGoal 
                            ? 'text-emerald-400' 
                            : isInjury 
                              ? 'text-rose-400' 
                              : isRed 
                                ? 'text-rose-400' 
                                : 'text-amber-400'
                        }`}>
                          {eventLabel}
                        </p>
                      </>
                    )}
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
