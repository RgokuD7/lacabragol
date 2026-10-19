import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match } from '../types';

let cachedMatches: Match[] | null = null;

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>(() => cachedMatches || []);
  const [loading, setLoading] = useState<boolean>(() => !cachedMatches);

  useEffect(() => {
    if (cachedMatches && matches.length === 0) {
      setMatches(cachedMatches);
      setLoading(false);
    }

    const unsub = onSnapshot(collection(db, 'matches'), (snap) => {
      const ms = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.homeTeam && m.awayTeam)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      cachedMatches = ms;
      setMatches(ms);
      setLoading(false);
    }, (err) => {
      console.warn("Could not fetch matches in useMatches hook:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { matches, loading };
}
