import { Match } from '../types';
import { UCL_36_TEAMS, getCanonicalTeamName, getTeamLogoByName } from '../data/fixtures';
import { findUclTeam } from './standings';
import { areTeamsEquivalent } from './geminiSync';
import { PlayerItem, normalizePlayerKey } from '../data/players';

export interface RawMatchEvent {
  matchId: string;
  matchTitle: string;
  date?: string;
  minute: number;
  playerName: string;
  type: 'gol' | 'asistencia' | 'cambio_entra' | 'cambio_sale' | 'tarjeta' | 'lesion';
  typeLabel: string;
  description: string;
  rawTeam: string;
  canonicalTeam: string;
  logo?: string;
}

export interface PlayerMatchEvidence {
  canonicalTeam: string;
  logo?: string;
  totalEvents: number;
  breakdown: {
    goals: number;
    assists: number;
    substitutions: number;
    cards: number;
    injuries: number;
  };
  sampleEvents: RawMatchEvent[];
  summaryText: string;
}

/**
 * Resuelve el club oficial de Champions (de los 36 canónicos) asociado a un evento de partido.
 */
export function resolveEventUclTeam(
  rawTeam: any,
  isHome: boolean | undefined,
  match: Match
): { canonicalTeam: string; logo?: string } | null {
  const cleanTeam = String(rawTeam || '').trim();
  if (cleanTeam && cleanTeam.toLowerCase() !== 'undefined' && cleanTeam.toLowerCase() !== 'null') {
    const directUcl = findUclTeam(cleanTeam);
    if (directUcl) return { canonicalTeam: directUcl.name, logo: getTeamLogoByName(directUcl.name) };
    
    const canon = getCanonicalTeamName(cleanTeam);
    if (canon && UCL_36_TEAMS.some(t => t.name === canon)) {
      return { canonicalTeam: canon, logo: getTeamLogoByName(canon) };
    }
    
    if (areTeamsEquivalent(cleanTeam, match.homeTeam)) {
      const homeUcl = findUclTeam(match.homeTeam);
      const teamName = homeUcl ? homeUcl.name : getCanonicalTeamName(match.homeTeam);
      return { canonicalTeam: teamName, logo: getTeamLogoByName(teamName) };
    }
    
    if (areTeamsEquivalent(cleanTeam, match.awayTeam)) {
      const awayUcl = findUclTeam(match.awayTeam);
      const teamName = awayUcl ? awayUcl.name : getCanonicalTeamName(match.awayTeam);
      return { canonicalTeam: teamName, logo: getTeamLogoByName(teamName) };
    }
  }

  // Fallback a isHome si no se especificó equipo
  if (isHome !== undefined) {
    const targetTeam = isHome ? match.homeTeam : match.awayTeam;
    const sideUcl = findUclTeam(targetTeam);
    const teamName = sideUcl ? sideUcl.name : getCanonicalTeamName(targetTeam);
    return { canonicalTeam: teamName, logo: getTeamLogoByName(teamName) };
  }

  return null;
}

/**
 * Compara de forma inteligente un jugador del catálogo con el nombre que figura en un evento de partido.
 * Maneja coincidencia exacta, iniciales, apodos y apellidos coincidentes.
 */
export function matchCatalogPlayerWithEventName(catalogName: string, eventPlayerName: string): boolean {
  if (!catalogName || !eventPlayerName) return false;
  const cNorm = normalizePlayerKey(catalogName);
  const eNorm = normalizePlayerKey(eventPlayerName);
  if (!cNorm || !eNorm) return false;
  if (cNorm === eNorm) return true;

  const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").trim();
  const cTokens = strip(catalogName).split(/\s+/).filter(Boolean);
  const eTokens = strip(eventPlayerName).split(/\s+/).filter(Boolean);

  if (cTokens.length === 0 || eTokens.length === 0) return false;

  const cLast = cTokens[cTokens.length - 1];
  const eLast = eTokens[eTokens.length - 1];

  // Si el apellido coincide y tiene al menos 4 caracteres
  if (cLast && eLast && cLast === eLast && cLast.length >= 4) {
    if (cTokens.length === 1 || eTokens.length === 1) return true;
    const cFirst = cTokens[0];
    const eFirst = eTokens[0];
    if (cFirst && eFirst) {
      if (cFirst === eFirst) return true;
      if (cFirst[0] === eFirst[0]) return true; // "A." vs "Alejandro"
      if (cFirst.startsWith(eFirst) || eFirst.startsWith(cFirst)) return true; // "Alex" vs "Alejandro"
    }
  }

  // Contención exacta multipalabra
  if (cTokens.length > 1 && eTokens.length > 1) {
    const cJoined = cTokens.join(' ');
    const eJoined = eTokens.join(' ');
    if (cJoined.includes(eJoined) || eJoined.includes(cJoined)) return true;
  }

  return false;
}

/**
 * Extrae todos los eventos de los partidos (goles, asistencias, tarjetas, cambios y lesiones).
 */
export function extractAllMatchEvents(matches: Match[]): RawMatchEvent[] {
  const events: RawMatchEvent[] = [];

  matches.forEach(m => {
    const matchTitle = `${m.homeTeam} vs ${m.awayTeam}`;
    const date = m.date || '';

    // 1. Goles y Asistencias
    const rawGoles = Array.isArray((m as any).goles) ? (m as any).goles : (Array.isArray(m.goalscorers) ? m.goalscorers : []);
    rawGoles.forEach((g: any) => {
      if (!g) return;
      let scorerName = '';
      let assistName = '';
      let rawTeam = '';
      let minute = 0;
      let isHome: boolean | undefined = g.is_home;

      if (typeof g === 'object') {
        scorerName = String(g.jugador || g.player || '').trim();
        assistName = String(g.asistencia || g.assist || '').trim();
        rawTeam = String(g.equipo || g.team || '').trim();
        minute = Number(g.minuto ?? 0);
      } else if (typeof g === 'string') {
        const matchStr = g.match(/^(.*?)\s*(\d+)?['’]?\s*(?:\((.*?)\))?$/);
        scorerName = matchStr?.[1]?.trim() || g.trim();
        minute = matchStr?.[2] ? parseInt(matchStr[2], 10) : 0;
        rawTeam = matchStr?.[3]?.trim() || '';
      }

      const teamRes = resolveEventUclTeam(rawTeam, isHome, m);
      if (teamRes?.canonicalTeam) {
        if (scorerName && scorerName.toLowerCase() !== 'undefined' && scorerName.toLowerCase() !== 'gol') {
          events.push({
            matchId: m.id,
            matchTitle,
            date,
            minute,
            playerName: scorerName,
            type: 'gol',
            typeLabel: 'Gol',
            description: `⚽ Gol (min. ${minute || '?'})`,
            rawTeam,
            canonicalTeam: teamRes.canonicalTeam,
            logo: teamRes.logo
          });
        }

        if (assistName && assistName.toLowerCase() !== 'undefined' && assistName.toLowerCase() !== 'null' && assistName.toLowerCase() !== 'none') {
          events.push({
            matchId: m.id,
            matchTitle,
            date,
            minute,
            playerName: assistName,
            type: 'asistencia',
            typeLabel: 'Asistencia',
            description: `👟 Asistencia para ${scorerName || 'gol'} (min. ${minute || '?'})`,
            rawTeam,
            canonicalTeam: teamRes.canonicalTeam,
            logo: teamRes.logo
          });
        }
      }
    });

    // 2. Tarjetas
    const rawTarjetas = Array.isArray((m as any).tarjetas) ? (m as any).tarjetas : (Array.isArray(m.cards) ? m.cards : []);
    rawTarjetas.forEach((t: any) => {
      if (!t) return;
      let playerName = '';
      let rawTeam = '';
      let minute = 0;
      let cardType = 'Amarilla';
      let isHome: boolean | undefined = t.is_home;

      if (typeof t === 'object') {
        playerName = String(t.jugador || t.player || '').trim();
        rawTeam = String(t.equipo || t.team || '').trim();
        minute = Number(t.minuto ?? 0);
        cardType = String(t.tipo || 'Amarilla').trim();
      } else if (typeof t === 'string') {
        playerName = t.trim();
      }

      if (playerName && playerName.toLowerCase() !== 'undefined' && playerName.toLowerCase() !== 'amonestado') {
        const teamRes = resolveEventUclTeam(rawTeam, isHome, m);
        if (teamRes?.canonicalTeam) {
          const isRed = cardType.toLowerCase().includes('roja') || cardType.toLowerCase().includes('red');
          events.push({
            matchId: m.id,
            matchTitle,
            date,
            minute,
            playerName,
            type: 'tarjeta',
            typeLabel: `Tarjeta ${cardType}`,
            description: `${isRed ? '🟥' : '🟨'} Tarjeta ${cardType} (min. ${minute || '?'})`,
            rawTeam,
            canonicalTeam: teamRes.canonicalTeam,
            logo: teamRes.logo
          });
        }
      }
    });

    // 3. Cambios / Sustituciones
    const rawCambios = Array.isArray((m as any).cambios) 
      ? (m as any).cambios 
      : (Array.isArray((m as any).sustituciones) ? (m as any).sustituciones : []);
    
    rawCambios.forEach((c: any) => {
      if (!c) return;
      let entra = '';
      let sale = '';
      let rawTeam = '';
      let minute = 0;
      let isHome: boolean | undefined = c.is_home;

      if (typeof c === 'object') {
        entra = String(c.jugador_entra || c.player_in || '').trim();
        sale = String(c.jugador_sale || c.player_out || '').trim();
        rawTeam = String(c.equipo || c.team || '').trim();
        minute = Number(c.minuto ?? 0);
      }

      const teamRes = resolveEventUclTeam(rawTeam, isHome, m);
      if (teamRes?.canonicalTeam) {
        if (entra && entra.toLowerCase() !== 'undefined' && entra.toLowerCase() !== 'cambio') {
          events.push({
            matchId: m.id,
            matchTitle,
            date,
            minute,
            playerName: entra,
            type: 'cambio_entra',
            typeLabel: 'Entró de cambio',
            description: `🔄 Entró al partido${sale ? ` por ${sale}` : ''} (min. ${minute || '?'})`,
            rawTeam,
            canonicalTeam: teamRes.canonicalTeam,
            logo: teamRes.logo
          });
        }

        if (sale && sale.toLowerCase() !== 'undefined' && sale.toLowerCase() !== 'cambio') {
          events.push({
            matchId: m.id,
            matchTitle,
            date,
            minute,
            playerName: sale,
            type: 'cambio_sale',
            typeLabel: 'Salió sustituido',
            description: `🔄 Salió sustituido${entra ? ` por ${entra}` : ''} (min. ${minute || '?'})`,
            rawTeam,
            canonicalTeam: teamRes.canonicalTeam,
            logo: teamRes.logo
          });
        }
      }
    });

    // 4. Lesiones
    const rawLesiones = Array.isArray((m as any).lesiones) ? (m as any).lesiones : [];
    rawLesiones.forEach((l: any) => {
      if (!l) return;
      let playerName = '';
      let rawTeam = '';
      let minute = 0;
      let isHome: boolean | undefined = l.is_home;

      if (typeof l === 'object') {
        playerName = String(l.jugador || l.player || '').trim();
        rawTeam = String(l.equipo || l.team || '').trim();
        minute = Number(l.minuto ?? 0);
      }

      if (playerName && playerName.toLowerCase() !== 'undefined') {
        const teamRes = resolveEventUclTeam(rawTeam, isHome, m);
        if (teamRes?.canonicalTeam) {
          events.push({
            matchId: m.id,
            matchTitle,
            date,
            minute,
            playerName,
            type: 'lesion',
            typeLabel: 'Lesión',
            description: `🩹 Lesión (min. ${minute || '?'})`,
            rawTeam,
            canonicalTeam: teamRes.canonicalTeam,
            logo: teamRes.logo
          });
        }
      }
    });
  });

  return events;
}

/**
 * Construye un mapa con la evidencia de cada jugador del catálogo según los registros de los partidos.
 */
export function buildPlayerMatchEvidenceMap(
  matches: Match[],
  catalogPlayers: PlayerItem[]
): Map<string, PlayerMatchEvidence> {
  const allEvents = extractAllMatchEvents(matches);
  const map = new Map<string, PlayerMatchEvidence>();

  catalogPlayers.forEach(p => {
    const key = p.id ? String(p.id) : normalizePlayerKey(p.name);
    const matchedEvents = allEvents.filter(ev => matchCatalogPlayerWithEventName(p.name, ev.playerName));
    if (matchedEvents.length === 0) return;

    // Agrupar eventos por club canónico
    const byTeam = new Map<string, RawMatchEvent[]>();
    matchedEvents.forEach(ev => {
      if (!byTeam.has(ev.canonicalTeam)) {
        byTeam.set(ev.canonicalTeam, []);
      }
      byTeam.get(ev.canonicalTeam)!.push(ev);
    });

    // Seleccionar el club con más eventos registrados
    let topTeam = '';
    let topEvents: RawMatchEvent[] = [];
    byTeam.forEach((evList, team) => {
      if (evList.length > topEvents.length) {
        topTeam = team;
        topEvents = evList;
      }
    });

    if (!topTeam || topEvents.length === 0) return;

    let goals = 0;
    let assists = 0;
    let substitutions = 0;
    let cards = 0;
    let injuries = 0;

    topEvents.forEach(ev => {
      if (ev.type === 'gol') goals++;
      else if (ev.type === 'asistencia') assists++;
      else if (ev.type === 'cambio_entra' || ev.type === 'cambio_sale') substitutions++;
      else if (ev.type === 'tarjeta') cards++;
      else if (ev.type === 'lesion') injuries++;
    });

    let summaryText = '';
    if (goals > 0 && assists > 0) {
      summaryText = `${goals} gol(es) y ${assists} asistencia(s) en partidos`;
    } else if (goals > 0) {
      summaryText = `${goals} gol(es) registrados`;
    } else if (assists > 0) {
      summaryText = `${assists} asistencia(s) registrada(s)`;
    } else if (substitutions > 0) {
      const firstSub = topEvents.find(ev => ev.type.startsWith('cambio'));
      summaryText = firstSub ? `${firstSub.description} en ${firstSub.matchTitle}` : `${substitutions} cambio(s)`;
    } else if (cards > 0) {
      summaryText = `${cards} tarjeta(s) en partidos`;
    } else {
      summaryText = `${topEvents.length} registro(s) en partidos`;
    }

    map.set(key, {
      canonicalTeam: topTeam,
      logo: topEvents[0]?.logo || getTeamLogoByName(topTeam),
      totalEvents: topEvents.length,
      breakdown: { goals, assists, substitutions, cards, injuries },
      sampleEvents: topEvents,
      summaryText
    });
  });

  return map;
}
