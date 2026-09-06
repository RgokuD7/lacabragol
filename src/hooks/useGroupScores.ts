import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Prediction } from '../types';

export interface MemberScore {
  points: number;
  exactMatches: number;
}

export function useGroupScores(
  groupId: string | null | undefined, 
  currentUserId?: string,
  exactMatchPoints: number = 3
) {
  const [memberScores, setMemberScores] = useState<Record<string, MemberScore>>({});
  const [loadingScores, setLoadingScores] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setMemberScores({});
      setLoadingScores(false);
      return;
    }

    setLoadingScores(true);

    const q = query(
      collection(db, 'predictions'),
      where('groupId', '==', groupId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const scores: Record<string, MemberScore> = {};

      snap.docs.forEach((docSnap) => {
        const pred = docSnap.data() as Prediction;
        const uid = pred.userId;
        if (!uid) return;

        if (!scores[uid]) {
          scores[uid] = { points: 0, exactMatches: 0 };
        }

        const pts = pred.pointsEarned || 0;
        scores[uid].points += pts;

        if (pts > 0 && pts === exactMatchPoints) {
          scores[uid].exactMatches += 1;
        }
      });

      setMemberScores(scores);
      setLoadingScores(false);
    }, (err) => {
      console.warn('Error listening to group predictions for scores:', err);
      setLoadingScores(false);
    });

    return () => unsub();
  }, [groupId, exactMatchPoints]);

  const currentUserScore = (currentUserId && memberScores[currentUserId]) 
    ? memberScores[currentUserId] 
    : { points: 0, exactMatches: 0 };

  return {
    memberScores,
    currentUserPoints: currentUserScore.points,
    currentUserExactMatches: currentUserScore.exactMatches,
    loadingScores
  };
}
