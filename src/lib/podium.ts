import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Podium } from '../types';
import { getTeamLogoByName } from '../data/fixtures';

export function getPodiumDocId(groupId: string | null | undefined, userId: string): string {
  if (groupId && groupId !== 'default') {
    return `${groupId}_${userId}`;
  }
  return userId;
}

export async function getGroupPodium(groupId: string | null | undefined, userId: string): Promise<Podium | null> {
  if (!userId) return null;
  
  if (groupId && groupId !== 'default') {
    try {
      const groupDocRef = doc(db, 'podiums', `${groupId}_${userId}`);
      const snap = await getDoc(groupDocRef);
      if (snap.exists()) {
        return snap.data() as Podium;
      }
    } catch (e) {
      console.warn("Could not fetch group podium:", e);
    }
  }

  // Fallback to legacy single-user podium doc
  try {
    const legacySnap = await getDoc(doc(db, 'podiums', userId));
    if (legacySnap.exists()) {
      return legacySnap.data() as Podium;
    }
  } catch (e) {
    console.warn("Could not fetch legacy podium:", e);
  }

  return null;
}

export async function saveGroupPodium(groupId: string | null | undefined, userId: string, data: Partial<Podium>): Promise<void> {
  const docId = getPodiumDocId(groupId, userId);
  const payload: Podium = {
    userId,
    groupId: groupId || undefined,
    champion: (data.champion || '').trim(),
    championLogo: data.championLogo || getTeamLogoByName(data.champion),
    runnerUp: (data.runnerUp || '').trim(),
    runnerUpLogo: data.runnerUpLogo || getTeamLogoByName(data.runnerUp),
    topScorer: (data.topScorer || '').trim(),
    mostAssists: (data.mostAssists || '').trim(),
    mvp: (data.mvp || '').trim(),
    updatedAt: Date.now()
  };

  await setDoc(doc(db, 'podiums', docId), payload);
}

export async function findAnyUserPodium(userId: string): Promise<Podium | null> {
  if (!userId) return null;

  // 1. Check legacy user.uid doc
  try {
    const snap = await getDoc(doc(db, 'podiums', userId));
    if (snap.exists()) {
      return snap.data() as Podium;
    }
  } catch (e) {
    console.warn("Error checking legacy podium:", e);
  }

  // 2. Query any podium doc with this userId
  try {
    const q = query(collection(db, 'podiums'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as Podium;
    }
  } catch (e) {
    console.warn("Error querying user podiums:", e);
  }

  return null;
}
