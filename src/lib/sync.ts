import { doc, getDoc, updateDoc, writeBatch, setDoc, collection, query, where, getDocs, increment, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { Match, Prediction, Setting, User } from '../types';
import { evaluatePrediction } from './scoring';

export async function syncMatchResult(match: Match, settings: Setting | null) {
  if (match.is_synced || match.is_fetching) return;

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

    
    if (status === 'finished' && homeScore !== null && awayScore !== null && homeScore !== undefined && awayScore !== undefined) {
      
      const predSnap = await getDocs(query(collection(db, 'predictions'), where('matchId', '==', match.id)));
      const allUsersSnap = await getDocs(collection(db, 'users'));
      
      const allUsers: Record<string, any> = {};
      allUsersSnap.docs.forEach(d => {
        allUsers[d.id] = d.data();
      });

      const userUpdates: Record<string, any> = {};

      // 1. Process predictions
      predSnap.docs.forEach(d => {
        const p = d.data();
        const oldPointsEarned = p.pointsEarned || 0;
        
        const evalRes = evaluatePrediction(homeScore, awayScore, p.homeScore, p.awayScore, 'finished', true, settings);
        
        batch.update(d.ref, {
          pointsEarned: evalRes.points,
          updatedAt: Date.now()
        });
        
        const pointsDiff = evalRes.points - oldPointsEarned;
        let exactDiff = 0;
        
        const exactMatchPoints = settings?.pointsExactMatch || 3;
        
        if (evalRes.points === exactMatchPoints && oldPointsEarned !== exactMatchPoints) {
            exactDiff = 1;
        } else if (evalRes.points !== exactMatchPoints && oldPointsEarned === exactMatchPoints) {
            exactDiff = -1;
        }

        const newMedals = [];
        const pHome = p.homeScore;
        const pAway = p.awayScore;
        const rHome = homeScore;
        const rAway = awayScore;
        const exact = pHome === rHome && pAway === rAway;
        const realDiff = rHome - rAway;
        const predDiff = pHome - pAway;
        const sameOutcome = (realDiff > 0 && predDiff > 0) || (realDiff < 0 && predDiff < 0) || (realDiff === 0 && predDiff === 0);

        if (exact && pHome === 0 && pAway === 0) newMedals.push('🔒 Cerrajero');
        if (exact && ((pHome === 1 && pAway === 0) || (pHome === 0 && pAway === 1))) newMedals.push('👔 Bilardista');
        
        const pWinnerGoles = pHome > pAway ? pHome : (pAway > pHome ? pAway : 0);
        if (sameOutcome && pWinnerGoles >= 4 && (rHome + rAway) >= 3) {
          newMedals.push('🎮 Modo Play');
        }
        if (rHome !== rAway && pHome === rAway && pAway === rHome) {
          newMedals.push('🙃 Mundo al Revés');
        }
        if ((pHome + pAway) >= 4 && rHome === 0 && rAway === 0) {
          newMedals.push('💨 Puro Humo');
        }
        if (evalRes.points === 0 && (pHome + pAway) === (rHome + rAway)) {
          newMedals.push('🧮 Matemático');
        }

        // Streak calculation
        let streakType = 'falla';
        if (evalRes.points === exactMatchPoints) {
          streakType = 'pleno';
        } else if (evalRes.points > 0) {
          streakType = 'normal';
        }

        if (!userUpdates[p.userId]) {
            userUpdates[p.userId] = { pointsDiff: 0, exactDiff: 0, medals: [], streakType, hasPrediction: true };
        }
        userUpdates[p.userId].pointsDiff += pointsDiff;
        userUpdates[p.userId].exactDiff += exactDiff;
        userUpdates[p.userId].medals.push(...newMedals);
        userUpdates[p.userId].streakType = streakType;
      });

      // 2. Identify missing predictions
      Object.keys(allUsers).forEach(userId => {
        if (!userUpdates[userId]) {
          userUpdates[userId] = { pointsDiff: 0, exactDiff: 0, medals: [], streakType: 'ausente', hasPrediction: false };
        }
      });

      // 3. Apply streaks and create user batch updates
      for (const [userId, updateData] of Object.entries(userUpdates as Record<string, any>)) {
        const u = allUsers[userId];
        if (!u) continue; // safety

        const finalUpdates: any = { updatedAt: Date.now() };
        
        if (updateData.pointsDiff !== 0) finalUpdates.points = increment(updateData.pointsDiff);
        if (updateData.exactDiff !== 0) finalUpdates.exactMatches = increment(updateData.exactDiff);
        if (updateData.medals.length > 0) finalUpdates.medallas = arrayUnion(...updateData.medals);

        // Calculate streaks
        let sn = u.streak_normal || 0;
        let sp = u.streak_pleno || 0;
        let sf = u.streak_falla || 0;
        let sa = u.streak_ausente || 0;
        let msn = u.max_streak_normal || 0;
        let msp = u.max_streak_pleno || 0;
        let msf = u.max_streak_falla || 0;
        let msa = u.max_streak_ausente || 0;

        const type = updateData.streakType;

        if (type === 'ausente') {
            sa += 1;
            sn = 0; sp = 0; sf = 0;
            if (sa > msa) { msa = sa; finalUpdates.max_streak_ausente = msa; }
            finalUpdates.streak_ausente = sa;
            finalUpdates.streak_normal = sn;
            finalUpdates.streak_pleno = sp;
            finalUpdates.streak_falla = sf;
        } else if (type === 'falla') {
            sf += 1;
            sn = 0; sp = 0; sa = 0;
            if (sf > msf) { msf = sf; finalUpdates.max_streak_falla = msf; }
            finalUpdates.streak_falla = sf;
            finalUpdates.streak_normal = sn;
            finalUpdates.streak_pleno = sp;
            finalUpdates.streak_ausente = sa;
        } else if (type === 'normal') {
            sn += 1;
            sp = 0; sf = 0; sa = 0;
            if (sn > msn) { msn = sn; finalUpdates.max_streak_normal = msn; }
            finalUpdates.streak_normal = sn;
            finalUpdates.streak_pleno = sp;
            finalUpdates.streak_falla = sf;
            finalUpdates.streak_ausente = sa;
        } else if (type === 'pleno') {
            sp += 1;
            sn += 1;
            sf = 0; sa = 0;
            if (sp > msp) { msp = sp; finalUpdates.max_streak_pleno = msp; }
            if (sn > msn) { msn = sn; finalUpdates.max_streak_normal = msn; }
            finalUpdates.streak_pleno = sp;
            finalUpdates.streak_normal = sn;
            finalUpdates.streak_falla = sf;
            finalUpdates.streak_ausente = sa;
        }

        batch.update(doc(db, 'users', userId), finalUpdates);
      }
    }

    await batch.commit();

    // TRIGGER JORNADA END LOGIC AND TITLES
    if (status === 'finished') {
      await evaluateEndOfJornada(match.group, settings);
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
