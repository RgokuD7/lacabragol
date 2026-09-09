import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match } from '../types';
import { getTeamLogoByName } from '../data/fixtures';
import { DEFAULT_PLAYERS } from '../data/players';

export interface TopScorer {
  position: number;
  player: string;
  team: string;
  teamLogo?: string;
  goals: number;
  matchesScored: number;
}

export function useTopScorers() {
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'matches'), (snap) => {
      const finishedMatches = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.status === 'finished' || m.status === 'in_progress');

      // Key: "player_lowercase|team_lowercase"
      const scorerMap = new Map<string, {
        player: string;
        team: string;
        teamLogo?: string;
        goals: number;
        matchIds: Set<string>;
      }>();

      finishedMatches.forEach(match => {
        if (!Array.isArray(match.goalscorers) || match.goalscorers.length === 0) {
          return;
        }

        match.goalscorers.forEach(g => {
          if (!g) return;

          let playerName = '';
          let teamName = '';

          if (typeof g === 'object') {
            playerName = String(g.jugador || g.player || '').trim();
            teamName = String(g.equipo || g.team || '').trim();
          } else if (typeof g === 'string') {
            const matchStr = g.match(/^(.*?)\s*(\d+)?['’]?\s*(?:\((.*?)\))?$/);
            playerName = matchStr?.[1]?.trim() || g.trim();
            teamName = matchStr?.[3]?.trim() || '';
          }

          if (!playerName || playerName.toLowerCase() === 'undefined') return;
          if (teamName.toLowerCase() === 'undefined') teamName = '';

          // 1. Fallback to DEFAULT_PLAYERS catalog if team is missing
          if (!teamName) {
            const foundPlayer = DEFAULT_PLAYERS.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (foundPlayer && foundPlayer.team) {
              teamName = foundPlayer.team;
            }
          }

          // 2. Fallback to match teams
          if (!teamName) {
            teamName = match.homeTeam || match.awayTeam || '';
          }

          const mapKey = `${playerName.toLowerCase()}___${teamName.toLowerCase()}`;
          const existing = scorerMap.get(mapKey);

          const teamLogo = getTeamLogoByName(teamName) || 
            (teamName.toLowerCase().includes(match.homeTeam.toLowerCase()) ? match.homeFlag : 
             teamName.toLowerCase().includes(match.awayTeam.toLowerCase()) ? match.awayFlag : '');

          if (existing) {
            existing.goals += 1;
            existing.matchIds.add(match.id);
            if (!existing.teamLogo && teamLogo) existing.teamLogo = teamLogo;
          } else {
            scorerMap.set(mapKey, {
              player: playerName,
              team: teamName,
              teamLogo,
              goals: 1,
              matchIds: new Set([match.id])
            });
          }
        });
      });

      // Convert map to array and sort by goals (descending) then alphabetically
      const list: TopScorer[] = Array.from(scorerMap.values())
        .map(item => ({
          position: 0,
          player: item.player,
          team: item.team,
          teamLogo: item.teamLogo,
          goals: item.goals,
          matchesScored: item.matchIds.size
        }))
        .sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player));

      // Calculate positions (handling ties)
      let currentPos = 1;
      for (let i = 0; i < list.length; i++) {
        if (i > 0 && list[i].goals < list[i - 1].goals) {
          currentPos = i + 1;
        }
        list[i].position = currentPos;
      }

      setScorers(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error fetching matches for top scorers:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { scorers, loading };
}
