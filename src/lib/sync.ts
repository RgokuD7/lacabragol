import { doc, getDoc, updateDoc, writeBatch, setDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { Match, Prediction, Setting, User } from '../types';
import { evaluatePrediction } from './scoring';
import { recalculateStandings } from './standings';
import { recalculateUsersAbsolute } from './recalculation';

export async function syncMatchPredictionsAndPoints(
  matchId: string,
  homeScore: number,
  awayScore: number,
  settings: Setting | null
) {
  try {
    const predSnap = await getDocs(query(collection(db, 'predictions'), where('matchId', '==', matchId)));
    if (predSnap.empty) {
      await recalculateStandings().catch(console.error);
      return;
    }

    const batch = writeBatch(db);
    const affectedUserIds = new Set<string>();

    predSnap.docs.forEach(d => {
      const p = d.data();
      if (p.userId) affectedUserIds.add(p.userId);
      const evalRes = evaluatePrediction(homeScore, awayScore, p.homeScore, p.awayScore, 'finished', true, settings);
      batch.update(d.ref, {
        pointsEarned: evalRes.points,
        updatedAt: Date.now()
      });
    });

    await batch.commit();

    // Recálculo absoluto sin deltas para evitar desincronizaciones
    if (affectedUserIds.size > 0) {
      await recalculateUsersAbsolute(Array.from(affectedUserIds), settings).catch(console.error);
    } else {
      await recalculateStandings().catch(console.error);
    }
  } catch (e) {
    console.error("Error updating predictions points for match:", matchId, e);
  }
}

export async function syncMatchResult(match: Match, settings: Setting | null, force: boolean = false) {
  if (!force && (match.is_synced || match.is_fetching)) return;

  const matchRef = doc(db, 'matches', match.id);
  
  // 1. Mark as fetching
  try {
    await updateDoc(matchRef, { is_fetching: true });
  } catch (e) {
    console.error("Failed to mark match as fetching", e);
    return;
  }

  try {
    // 2. Evaluates scores already present on the match
    let homeScore = match.homeScore;
    let awayScore = match.awayScore;
    let status = match.status;

    // 3. Update predictions and aggregate points
    const batch = writeBatch(db);
    batch.update(matchRef, {
      is_synced: true,
      is_fetching: false
    });

    const affectedUserIds = new Set<string>();

    if (status === 'finished' && homeScore !== null && awayScore !== null && homeScore !== undefined && awayScore !== undefined) {
      const predSnap = await getDocs(query(collection(db, 'predictions'), where('matchId', '==', match.id)));

      // Actualizar puntos ganados en cada predicción
      predSnap.docs.forEach(d => {
        const p = d.data();
        if (p.userId) affectedUserIds.add(p.userId);
        const evalRes = evaluatePrediction(homeScore, awayScore, p.homeScore, p.awayScore, 'finished', true, settings);
        
        batch.update(d.ref, {
          pointsEarned: evalRes.points,
          updatedAt: Date.now()
        });
      });
    }

    await batch.commit();

    // 4. Recálculo absoluto de puntos, plenos, rachas y medallas para los usuarios afectados
    if (status === 'finished') {
      if (affectedUserIds.size > 0) {
        await recalculateUsersAbsolute(Array.from(affectedUserIds), settings).catch(console.error);
      }
      await evaluateEndOfJornada(match.group, settings);
      await recalculateStandings().catch(console.error);
    }

  } catch (err) {
    console.error("Failed to sync match", err);
    // Unset is_fetching so it can be tried again
    await updateDoc(matchRef, { is_fetching: false }).catch(() => {});
  }
}


async function evaluateEndOfJornada(groupId: string, settings: Setting | null) {
  try {
    const matchesSnap = await getDocs(query(collection(db, 'matches'), where('group', '==', groupId)));
    const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
    
    // Check if all matches in this group are finished
    const allFinished = matches.every(m => m.status === 'finished');
    if (!allFinished) return;

    // Fetch all predictions for these matches
    const matchIds = matches.map(m => m.id);
    if (matchIds.length === 0) return;

    // chunk matchIds for 'in' query
    const allPreds: Prediction[] = [];
    for (let i = 0; i < matchIds.length; i += 10) {
      const chunk = matchIds.slice(i, i + 10);
      const predsQ = query(collection(db, 'predictions'), where('matchId', 'in', chunk));
      const predsSnap = await getDocs(predsQ);
      allPreds.push(...predsSnap.docs.map(d => d.data() as Prediction));
    }

    const userPreds: Record<string, Prediction[]> = {};
    allPreds.forEach(p => {
      if (!userPreds[p.userId]) userPreds[p.userId] = [];
      userPreds[p.userId].push(p);
    });

    const batch = writeBatch(db);
    const usersSnap = await getDocs(collection(db, 'users'));
    const allUsers = usersSnap.docs.map(d => d.data() as User);

    for (const user of allUsers) {
      const preds = userPreds[user.uid] || [];
      const numPreds = preds.length;
      const numMatches = matches.length;

      const newMedals: string[] = [];
      
      const pointsTotal = preds.reduce((acc, p) => acc + (p.pointsEarned || 0), 0);
      const exacts = preds.filter(p => p.pointsEarned === (settings?.pointsExactMatch || 3));
      const misses = preds.filter(p => p.pointsEarned === 0);

      // Francotirador
      if (numPreds >= 4 && exacts.length >= 3) {
        newMedals.push('🎯 Francotirador');
      }

      // Cabra de Oro
      if (numPreds >= 4 && misses.length === 0 && numPreds === matches.length) { // Or just numPreds? "todos los partidos de la jornada"
         // Actually prompt says: "Si el usuario obtiene > 0 puntos en TODOS los partidos de la jornada. Condición: Mínimo 4 partidos pronosticados."
         if (numPreds === numMatches && misses.length === 0) {
           newMedals.push('🐐 Cabra de Oro');
         }
      }

      // Cabra Congelada
      if (numPreds >= (numMatches / 2) && pointsTotal === 0) {
        newMedals.push('🥶 Cabra Congelada');
      }

      // Montaña Rusa
      if (exacts.length >= 1 && misses.length >= 1) {
        newMedals.push('🎢 Montaña Rusa');
      }

      if (newMedals.length > 0) {
        batch.update(doc(db, 'users', user.uid), { medallas: arrayUnion(...newMedals) });
      }
    }

    // Leaderboard Titles
    const usersWithPreds = allUsers.filter(u => (userPreds[u.uid] || []).length > 0);
    const sortedUsers = [...allUsers].sort((a, b) => (b.points || 0) - (a.points || 0) || (b.exactMatches || 0) - (a.exactMatches || 0));

    // Reset titles for all users
    for (const u of allUsers) {
      let title = null;
      if (sortedUsers.length > 0 && u.uid === sortedUsers[0].uid) {
        title = '👑';
      } else if (sortedUsers.length > 1 && u.uid === sortedUsers[sortedUsers.length - 1].uid) {
        // Last place logic: Must have at least 1 prediction in THIS jornada to get the title
        if ((userPreds[u.uid] || []).length > 0) {
          title = '🐢';
        }
      }
      batch.update(doc(db, 'users', u.uid), { title });
    }

    await batch.commit();
  } catch (e) {
    console.error("Error evaluating end of jornada", e);
  }
}
