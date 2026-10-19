import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match } from '../types';
import { getTeamLogoByName, getCanonicalTeamName } from '../data/fixtures';
import { usePlayers } from './usePlayers';
import { findMatchingCatalogPlayer } from '../data/players';

export interface TopAssister {
  position: number;
  player: string;
  team: string;
  teamLogo?: string;
  playerPhoto?: string;
  assists: number;
  matchesAssisted: number;
}

let cachedAssisters: TopAssister[] | null = null;

export function useTopAssists() {
  const { players: catalogPlayers } = usePlayers();
  const [assisters, setAssisters] = useState<TopAssister[]>(() => cachedAssisters || []);
  const [loading, setLoading] = useState(() => !cachedAssisters);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'matches'), (snap) => {
      const matches = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.status === 'finished' || m.status === 'in_progress');

      // Key: "player_lowercase|team_lowercase"
      const assistMap = new Map<string, {
        player: string;
        team: string;
        teamLogo?: string;
        playerPhoto?: string;
        assists: number;
        matchIds: Set<string>;
      }>();

      matches.forEach(match => {
        const rawGoles = Array.isArray((match as any).goles) 
          ? (match as any).goles 
          : (Array.isArray(match.goalscorers) ? match.goalscorers : []);

        if (rawGoles.length === 0) return;

        rawGoles.forEach((g: any) => {
          if (!g) return;

          let assistName = '';
          let teamName = '';

          if (typeof g === 'object') {
            assistName = String(g.asistencia || g.assist || '').trim();
            teamName = String(g.equipo || g.team || '').trim();
            if (!teamName && g.is_home !== undefined) {
              teamName = g.is_home ? match.homeTeam : match.awayTeam;
            }
          }

          if (
            !assistName || 
            assistName.toLowerCase() === 'null' || 
            assistName.toLowerCase() === 'undefined' || 
            assistName.toLowerCase() === 'none' ||
            assistName === '-'
          ) {
            return;
          }

          // Match player in catalog to get official name, team and photo
          const matchedPlayer = findMatchingCatalogPlayer(assistName, catalogPlayers);
          const displayName = matchedPlayer?.name || assistName;
          const playerPhoto = matchedPlayer?.imageUrl || matchedPlayer?.image;

          // 1. Fallback to catalog if team is missing
          if (!teamName && matchedPlayer?.team) {
            teamName = matchedPlayer.team;
          }

          // 2. Fallback to match teams
          if (!teamName) {
            teamName = match.homeTeam || match.awayTeam || '';
          }

          // Canonicalize team name to merge variations
          teamName = getCanonicalTeamName(teamName);

          const mapKey = `${displayName.toLowerCase()}___${teamName.toLowerCase()}`;
          const existing = assistMap.get(mapKey);

          const teamLogo = getTeamLogoByName(teamName) || 
            (teamName.toLowerCase().includes(match.homeTeam.toLowerCase()) ? match.homeFlag : 
             teamName.toLowerCase().includes(match.awayTeam.toLowerCase()) ? match.awayFlag : '');

          if (existing) {
            existing.assists += 1;
            existing.matchIds.add(match.id);
            if (!existing.teamLogo && teamLogo) existing.teamLogo = teamLogo;
            if (!existing.playerPhoto && playerPhoto) existing.playerPhoto = playerPhoto;
          } else {
            assistMap.set(mapKey, {
              player: displayName,
              team: teamName,
              teamLogo,
              playerPhoto,
              assists: 1,
              matchIds: new Set([match.id])
            });
          }
        });
      });

      // Convert map to array and sort by assists (descending) then alphabetically
      const list: TopAssister[] = Array.from(assistMap.values())
        .map(item => ({
          position: 0,
          player: item.player,
          team: item.team,
          teamLogo: item.teamLogo,
          playerPhoto: item.playerPhoto,
          assists: item.assists,
          matchesAssisted: item.matchIds.size
        }))
        .sort((a, b) => b.assists - a.assists || a.player.localeCompare(b.player));

      // Calculate positions (handling ties)
      let currentPos = 1;
      for (let i = 0; i < list.length; i++) {
        if (i > 0 && list[i].assists < list[i - 1].assists) {
          currentPos = i + 1;
        }
        list[i].position = currentPos;
      }

      cachedAssisters = list;
      setAssisters(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error fetching matches for top assists:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [catalogPlayers]);

  return { assisters, loading };
}
