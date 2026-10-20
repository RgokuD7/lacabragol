import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StandingRow } from '../lib/standings';

export interface SeasonInfo {
  id: number;
  name: string;
}

interface StandingsCache {
  standings: StandingRow[];
  seasonInfo: SeasonInfo | null;
  cupTrees: any[];
}

let cachedData: StandingsCache | null = null;

export function useStandings() {
  const [standings, setStandings] = useState<StandingRow[]>(() => cachedData?.standings || []);
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(() => cachedData?.seasonInfo || null);
  const [cupTrees, setCupTrees] = useState<any[]>(() => cachedData?.cupTrees || []);
  const [loading, setLoading] = useState<boolean>(() => !cachedData);

  useEffect(() => {
    if (cachedData && standings.length === 0) {
      setStandings(cachedData.standings);
      setSeasonInfo(cachedData.seasonInfo);
      setCupTrees(cachedData.cupTrees);
      setLoading(false);
    }

    const unsub = onSnapshot(doc(db, 'system', 'standings'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const rows = Array.isArray(data.standings) ? (data.standings as StandingRow[]) : [];
        const season = data.season || null;
        const trees = Array.isArray(data.cupTrees) ? data.cupTrees : [];

        cachedData = {
          standings: rows,
          seasonInfo: season,
          cupTrees: trees
        };

        setStandings(rows);
        setSeasonInfo(season);
        setCupTrees(trees);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Could not fetch standings in useStandings hook:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { standings, seasonInfo, cupTrees, loading };
}
