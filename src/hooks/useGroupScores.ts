import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Prediction, Match } from '../types';

export interface MemberScore {
  points: number;
  exactMatches: number;
  streak_pleno?: number;
  streak_normal?: number;
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

    let predictionsList: Prediction[] = [];
    let matchesMap: Record<string, Match> = {};

    const recompute = () => {
      const scores: Record<string, MemberScore> = {};
      const userFinishedPreds: Record<string, { pred: Prediction; matchTime: number; updatedAt: number }[]> = {};

      predictionsList.forEach((pred) => {
        const uid = pred.userId;
        if (!uid) return;

        if (!scores[uid]) {
          scores[uid] = { points: 0, exactMatches: 0, streak_pleno: 0, streak_normal: 0 };
        }

        const pts = pred.pointsEarned || 0;
        scores[uid].points += pts;

        if (pts > 0 && pts === exactMatchPoints) {
          scores[uid].exactMatches += 1;
        }

        const match = matchesMap[pred.matchId];
        if (match && match.status === 'finished') {
          if (!userFinishedPreds[uid]) {
            userFinishedPreds[uid] = [];
          }
          const mTime = new Date(match.date).getTime() || 0;
          userFinishedPreds[uid].push({ 
            pred, 
            matchTime: mTime,
            updatedAt: pred.updatedAt || 0
          });
        }
      });

      // Calculate streak per user
      Object.entries(userFinishedPreds).forEach(([uid, list]) => {
        // Sort chronologically (oldest to newest)
        list.sort((a, b) => {
          if (a.matchTime !== b.matchTime) return a.matchTime - b.matchTime;
          return a.updatedAt - b.updatedAt;
        });

        // Count streaks backwards from the most recently finished match
        let streakPleno = 0;
        for (let i = list.length - 1; i >= 0; i--) {
          const pts = list[i].pred.pointsEarned || 0;
          if (pts === exactMatchPoints) {
            streakPleno++;
          } else {
            break;
          }
        }

        let streakNormal = 0;
        for (let i = list.length - 1; i >= 0; i--) {
          const pts = list[i].pred.pointsEarned || 0;
          if (pts > 0) {
            streakNormal++;
          } else {
            break;
          }
        }

        if (scores[uid]) {
          scores[uid].streak_pleno = streakPleno;
          scores[uid].streak_normal = streakNormal;
        }
      });

      setMemberScores(scores);
      setLoadingScores(false);
    };

    const q = query(
      collection(db, 'predictions'),
      where('groupId', '==', groupId)
    );

    const unsubPreds = onSnapshot(q, (snap) => {
      predictionsList = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Prediction));
      recompute();
    }, (err) => {
      console.warn('Error listening to group predictions for scores:', err);
      setLoadingScores(false);
    });

    const unsubMatches = onSnapshot(collection(db, 'matches'), (snap) => {
      const map: Record<string, Match> = {};
      snap.docs.forEach(docSnap => {
        map[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as Match;
      });
      matchesMap = map;
      recompute();
    }, (err) => {
      console.warn('Error listening to matches for scores:', err);
    });

    return () => {
      unsubPreds();
      unsubMatches();
    };
  }, [groupId, exactMatchPoints]);

  const currentUserScore = (currentUserId && memberScores[currentUserId]) 
    ? memberScores[currentUserId] 
    : { points: 0, exactMatches: 0, streak_pleno: 0, streak_normal: 0 };

  return {
    memberScores,
    currentUserPoints: currentUserScore.points,
    currentUserExactMatches: currentUserScore.exactMatches,
    loadingScores
  };
}
