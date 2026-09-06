import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { useSettings } from '../components/SettingsProvider';
import { useGroups } from '../components/GroupsProvider';
import { Match, Prediction } from '../types';

export function useUnpredictedCount() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { activeGroupId } = useGroups();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    let matches: Match[] = [];
    let preds: string[] = [];
    let mUnsub: () => void;
    let pUnsub: () => void;

    const calculate = () => {
      const now = Date.now();
      const blockMs = (settings?.blockMinutesBeforeMatch || 15) * 60 * 1000;
      
      let unpredicted = 0;
      for (const m of matches) {
        if (m.status === 'pending') {
          const matchTime = new Date(m.date).getTime();
          // Solo partidos en el futuro pero próximos (ej. siguientes 7 días) y que no estén bloqueados
          if (matchTime > now + blockMs && matchTime < now + 7 * 24 * 60 * 60 * 1000) {
            if (!preds.includes(m.id)) {
              unpredicted++;
            }
          }
        }
      }
      setCount(unpredicted);
    };

    mUnsub = onSnapshot(collection(db, 'matches'), (snap) => {
      matches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      calculate();
    });

    const currentGroupId = activeGroupId || 'default';
    pUnsub = onSnapshot(query(
      collection(db, 'predictions'), 
      where('userId', '==', user.uid),
      where('groupId', '==', currentGroupId)
    ), (snap) => {
      preds = snap.docs.map(d => (d.data() as Prediction).matchId);
      calculate();
    });

    return () => {
      if (mUnsub) mUnsub();
      if (pUnsub) pUnsub();
    };
  }, [user, settings, activeGroupId]);

  return count;
}
