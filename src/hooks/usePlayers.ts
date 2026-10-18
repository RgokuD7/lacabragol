import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_PLAYERS, PlayerItem, normalizePlayerKey, formatNationality, formatPosition } from '../data/players';

export function usePlayers() {
  const [players, setPlayers] = useState<PlayerItem[]>(DEFAULT_PLAYERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'players'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const deletedKeys = new Set<string>(data?.deletedKeys || []);
        if (Array.isArray(data?.players) && data.players.length > 0) {
          const firestoreFormatted: PlayerItem[] = data.players
            .filter((p: any) => !deletedKeys.has(normalizePlayerKey(p.name)))
            .map((p: any) => ({
              ...p,
              nationality: formatNationality(p.nationality),
              position: formatPosition(p.position)
            }));
          setPlayers(firestoreFormatted);
          setLoading(false);
          return;
        }
      }
      setPlayers(DEFAULT_PLAYERS);
      setLoading(false);
    }, (err) => {
      console.warn("Could not load system/players from Firestore, falling back to default:", err);
      setPlayers(DEFAULT_PLAYERS);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { players, loading };
}
