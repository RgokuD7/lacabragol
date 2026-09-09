import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  WriteBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { Match, Prediction, Setting, User } from '../types';
import { evaluatePrediction } from './scoring';
import { recalculateStandings } from './standings';

/**
 * Helper to commit operations in safe Firestore batches of max 400 ops.
 */
async function commitBatchOperations(operations: ((batch: WriteBatch) => void)[]) {
  if (operations.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(op => op(batch));
    await batch.commit();
  }
}

/**
 * Recalcula de manera absoluta los puntos, plenos, rachas y medallas
 * de un subconjunto específico de usuarios (usado tras la sincronización de un partido).
 */
export async function recalculateUsersAbsolute(
  userIds: string[],
  settingsOverride?: Setting | null
): Promise<{ success: boolean; updatedUsersCount: number }> {
  const distinctUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (distinctUserIds.length === 0) {
    return { success: true, updatedUsersCount: 0 };
  }

  try {
    // 1. Obtener Settings
    let settings = settingsOverride;
    if (!settings) {
      const globalSetSnap = await getDoc(doc(db, 'settings', 'global')).catch(() => null);
      if (globalSetSnap && globalSetSnap.exists()) {
        settings = globalSetSnap.data() as Setting;
      }
    }
    const pointsExactMatch = settings?.pointsExactMatch ?? 3;

    // 2. Obtener todos los partidos finalizados
    const matchesSnap = await getDocs(collection(db, 'matches'));
    const allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
    const finishedMatchesMap: Record<string, Match> = {};
    const finishedMatchesList: Match[] = [];

    allMatches.forEach(m => {
      if (
        m.status === 'finished' &&
        m.homeScore !== null &&
        m.homeScore !== undefined &&
        m.awayScore !== null &&
        m.awayScore !== undefined
      ) {
        finishedMatchesMap[m.id] = m;
        finishedMatchesList.push(m);
      }
    });

    // Orden cronológico para rachas
    finishedMatchesList.sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      return timeA - timeB;
    });

    // 3. Obtener pronósticos de los usuarios afectados
    // Dividir userIds en chunks de 30 para consultas 'in' si es necesario
    const userPredictions: Record<string, Prediction[]> = {};
    distinctUserIds.forEach(uid => { userPredictions[uid] = []; });

    for (let i = 0; i < distinctUserIds.length; i += 30) {
      const chunk = distinctUserIds.slice(i, i + 30);
      const predsSnap = await getDocs(
        query(collection(db, 'predictions'), where('userId', 'in', chunk))
      );
      predsSnap.docs.forEach(d => {
        const pred = { id: d.id, ...d.data() } as Prediction;
        if (userPredictions[pred.userId]) {
          userPredictions[pred.userId].push(pred);
        }
      });
    }

    const batchOps: ((batch: WriteBatch) => void)[] = [];

    // 4. Recalcular cada usuario
    for (const uid of distinctUserIds) {
      const preds = userPredictions[uid] || [];
      const { userUpdate } = calculateUserStatsAndMedals(
        uid,
        preds,
        finishedMatchesMap,
        finishedMatchesList,
        pointsExactMatch
      );

      const userRef = doc(db, 'users', uid);
      batchOps.push(batch => {
        batch.update(userRef, userUpdate);
      });
    }

    await commitBatchOperations(batchOps);
    await recalculateStandings().catch(console.error);

    return { success: true, updatedUsersCount: distinctUserIds.length };
  } catch (err) {
    console.error('[recalculateUsersAbsolute] Error al recalcular usuarios:', err);
    throw err;
  }
}

/**
 * RECALCULO GENERAL DE EMERGENCIA (100% Base de Datos - CERO llamadas a SerpAPI):
 * 1. Audita todas las predicciones de partidos finalizados y corrige pointsEarned si difiere.
 * 2. Deduplica pronósticos por partido para evitar inflar puntos por pertenecer a varios grupos.
 * 3. Suma de forma absoluta los puntos y plenos de cada usuario.
 * 4. Limpia el array medallas y reevalúa retroactivamente los 15 logros oficiales.
 * 5. Sobrescribe users/{userId} con points, exactMatches, rachas y medallas.
 * 6. Dispara recalculateStandings() al culminar.
 */
export async function recalculateAllUsersFromDatabase(
  settingsOverride?: Setting | null
): Promise<{
  success: boolean;
  updatedUsersCount: number;
  updatedPredictionsCount: number;
  totalMatchesCount: number;
}> {
  console.log('[recalculateAllUsersFromDatabase] Iniciando recálculo masivo 100% BBDD...');

  try {
    // 1. Obtener Settings
    let settings = settingsOverride;
    if (!settings) {
      const globalSetSnap = await getDoc(doc(db, 'settings', 'global')).catch(() => null);
      if (globalSetSnap && globalSetSnap.exists()) {
        settings = globalSetSnap.data() as Setting;
      }
    }
    const pointsExactMatch = settings?.pointsExactMatch ?? 3;

    // 2. Obtener todos los partidos
    const matchesSnap = await getDocs(collection(db, 'matches'));
    const allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
    const finishedMatchesMap: Record<string, Match> = {};
    const finishedMatchesList: Match[] = [];

    allMatches.forEach(m => {
      if (
        m.status === 'finished' &&
        m.homeScore !== null &&
        m.homeScore !== undefined &&
        m.awayScore !== null &&
        m.awayScore !== undefined
      ) {
        finishedMatchesMap[m.id] = m;
        finishedMatchesList.push(m);
      }
    });

    // Ordenar cronológicamente para el cálculo histórico de rachas
    finishedMatchesList.sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      return timeA - timeB;
    });

    console.log(`[recalculateAllUsersFromDatabase] Partidos finalizados detectados: ${finishedMatchesList.length}`);

    // 3. Obtener todas las predicciones
    const predsSnap = await getDocs(collection(db, 'predictions'));
    const allPredictions: Prediction[] = predsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Prediction));

    console.log(`[recalculateAllUsersFromDatabase] Pronósticos totales en BBDD: ${allPredictions.length}`);

    const predBatchOps: ((batch: WriteBatch) => void)[] = [];
    let updatedPredictionsCount = 0;

    // 4. Auditar pointsEarned en cada predicción de partido finalizado
    allPredictions.forEach(pred => {
      const match = finishedMatchesMap[pred.matchId];
      if (match) {
        const evalRes = evaluatePrediction(
          match.homeScore,
          match.awayScore,
          pred.homeScore,
          pred.awayScore,
          'finished',
          true,
          settings
        );

        if (pred.pointsEarned !== evalRes.points) {
          pred.pointsEarned = evalRes.points;
          updatedPredictionsCount++;
          const predRef = doc(db, 'predictions', pred.id);
          predBatchOps.push(batch => {
            batch.update(predRef, {
              pointsEarned: evalRes.points,
              updatedAt: Date.now()
            });
          });
        }
      }
    });

    if (predBatchOps.length > 0) {
      console.log(`[recalculateAllUsersFromDatabase] Actualizando ${predBatchOps.length} pronósticos con pointsEarned corregido...`);
      await commitBatchOperations(predBatchOps);
    }

    // 5. Agrupar predicciones por usuario
    const userPredictionsMap: Record<string, Prediction[]> = {};
    allPredictions.forEach(pred => {
      const uid = pred.userId;
      if (!uid) return;
      if (!userPredictionsMap[uid]) userPredictionsMap[uid] = [];
      userPredictionsMap[uid].push(pred);
    });

    // 6. Obtener todos los usuarios
    const usersSnap = await getDocs(collection(db, 'users'));
    const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));

    console.log(`[recalculateAllUsersFromDatabase] Usuarios a recalcular: ${allUsers.length}`);

    const userBatchOps: ((batch: WriteBatch) => void)[] = [];

    for (const u of allUsers) {
      const userPreds = userPredictionsMap[u.uid] || [];
      const { userUpdate } = calculateUserStatsAndMedals(
        u.uid,
        userPreds,
        finishedMatchesMap,
        finishedMatchesList,
        pointsExactMatch
      );

      const userRef = doc(db, 'users', u.uid);
      userBatchOps.push(batch => {
        batch.update(userRef, userUpdate);
      });
    }

    if (userBatchOps.length > 0) {
      console.log(`[recalculateAllUsersFromDatabase] Escribiendo actualización en ${userBatchOps.length} usuarios...`);
      await commitBatchOperations(userBatchOps);
    }

    // 7. Recalcular la tabla de posiciones oficial UCL
    console.log('[recalculateAllUsersFromDatabase] Disparando recalculateStandings()...');
    await recalculateStandings().catch(err => {
      console.error('[recalculateAllUsersFromDatabase] Error en recalculateStandings:', err);
    });

    console.log('[recalculateAllUsersFromDatabase] ✅ Proceso completado exitosamente.');

    return {
      success: true,
      updatedUsersCount: allUsers.length,
      updatedPredictionsCount,
      totalMatchesCount: finishedMatchesList.length
    };
  } catch (err) {
    console.error('[recalculateAllUsersFromDatabase] Error crítico durante el recálculo:', err);
    throw err;
  }
}

/**
 * Función pura que calcula los puntos absolutos, exactMatches, rachas
 * y las 15 medallas oficiales para un usuario dado su historial de pronósticos.
 */
function calculateUserStatsAndMedals(
  userId: string,
  userPreds: Prediction[],
  finishedMatchesMap: Record<string, Match>,
  sortedFinishedMatches: Match[],
  pointsExactMatch: number = 3
): { userUpdate: Record<string, any> } {
  // Deduplicar pronósticos por matchId para evitar que usuarios en múltiples grupos
  // sumen puntos duplicados en su perfil global
  const uniqueMatchPreds: Record<string, Prediction> = {};
  userPreds.forEach(p => {
    if (!finishedMatchesMap[p.matchId]) return;
    const current = uniqueMatchPreds[p.matchId];
    if (!current) {
      uniqueMatchPreds[p.matchId] = p;
    } else {
      // Si existen duplicados por pertenecer a varios grupos, tomar el de mayor puntos o más reciente
      if ((p.pointsEarned || 0) > (current.pointsEarned || 0)) {
        uniqueMatchPreds[p.matchId] = p;
      }
    }
  });

  // 1. Suma absoluta de puntos y exactMatches
  let absolutePoints = 0;
  let absoluteExactMatches = 0;

  Object.values(uniqueMatchPreds).forEach(p => {
    const pts = p.pointsEarned || 0;
    absolutePoints += pts;
    if (pts === pointsExactMatch) {
      absoluteExactMatches += 1;
    }
  });

  // 2. Reevaluación de los 15 Logros desde cero (Medallas)
  const medalsSet = new Set<string>();

  // A. LOGROS POR PARTIDO
  Object.values(uniqueMatchPreds).forEach(p => {
    const m = finishedMatchesMap[p.matchId];
    if (!m) return;

    const pHome = p.homeScore;
    const pAway = p.awayScore;
    const rHome = m.homeScore!;
    const rAway = m.awayScore!;
    const pts = p.pointsEarned || 0;

    const exact = pHome === rHome && pAway === rAway;
    const realDiff = rHome - rAway;
    const predDiff = pHome - pAway;
    const sameOutcome =
      (realDiff > 0 && predDiff > 0) ||
      (realDiff < 0 && predDiff < 0) ||
      (realDiff === 0 && predDiff === 0);

    // 🔒 Cerrajero: Pleno exacto 0-0
    if (exact && pHome === 0 && pAway === 0) {
      medalsSet.add('🔒 Cerrajero');
    }

    // 👔 Bilardista: Pleno exacto 1-0 o 0-1
    if (exact && ((pHome === 1 && pAway === 0) || (pHome === 0 && pAway === 1))) {
      medalsSet.add('👔 Bilardista');
    }

    // 🎮 Modo Play: Festival con 7+ goles en el pronóstico y 7+ goles reales, acertando el ganador
    if (sameOutcome && (pHome + pAway) >= 7 && (rHome + rAway) >= 7) {
      medalsSet.add('🎮 Modo Play');
    }

    // 🥱 Partido Somnífero: Achuntarle al 0-0 exacto
    if (exact && pHome === 0 && pAway === 0) {
      medalsSet.add('🥱 Partido Somnífero');
    }

    // 🙃 Mundo al Revés: Marcador exactamente invertido sin haber empate
    if (rHome !== rAway && pHome === rAway && pAway === rHome) {
      medalsSet.add('🙃 Mundo al Revés');
    }

    // 💨 Puro Humo: Pronóstico de 4+ goles y fin en 0-0
    if ((pHome + pAway) >= 4 && rHome === 0 && rAway === 0) {
      medalsSet.add('💨 Puro Humo');
    }

    // 🧮 Matemático: 0 puntos pero suma de goles exacta
    if (pts === 0 && (pHome + pAway) === (rHome + rAway)) {
      medalsSet.add('🧮 Matemático');
    }
  });

  // B. LOGROS POR JORNADA
  // Agrupar los partidos finalizados por jornada / grupo
  const matchesByJornada: Record<string, Match[]> = {};
  sortedFinishedMatches.forEach(m => {
    const jName = (m.group || 'Sin Jornada').trim();
    if (!matchesByJornada[jName]) matchesByJornada[jName] = [];
    matchesByJornada[jName].push(m);
  });

  for (const [, jMatches] of Object.entries(matchesByJornada)) {
    const userJornadaPreds = jMatches
      .map(m => uniqueMatchPreds[m.id])
      .filter((p): p is Prediction => p !== undefined);

    const numPreds = userJornadaPreds.length;
    const numMatches = jMatches.length;
    const jTotalPts = userJornadaPreds.reduce((sum, p) => sum + (p.pointsEarned || 0), 0);
    const jExacts = userJornadaPreds.filter(p => (p.pointsEarned || 0) === pointsExactMatch);
    const jMisses = userJornadaPreds.filter(p => (p.pointsEarned || 0) === 0);

    // 🐐 Cabra de Oro: Puntuó (>0) en TODOS los partidos de la jornada (mínimo 4 partidos)
    if (numMatches >= 4 && numPreds === numMatches && jMisses.length === 0) {
      medalsSet.add('🐐 Cabra de Oro');
    }

    // 🥶 Cabra Congelada: Pronosticó al menos el 50% de la fecha y 0 puntos totales
    if (numMatches > 0 && numPreds >= Math.ceil(numMatches / 2) && jTotalPts === 0) {
      medalsSet.add('🥶 Cabra Congelada');
    }

    // 🎢 Montaña Rusa: Al menos un pleno y al menos un 0 en la misma jornada
    if (jExacts.length >= 1 && jMisses.length >= 1) {
      medalsSet.add('🎢 Montaña Rusa');
    }

    // 🎯 Francotirador: 3 o más plenos en una misma jornada con mínimo 4 partidos
    if (numMatches >= 4 && jExacts.length >= 3) {
      medalsSet.add('🎯 Francotirador');
    }
  }

  // C. RACHAS Y LOGROS DE RACHAS
  // Evaluar cronológicamente sobre todos los partidos finalizados
  let current_pleno = 0;
  let max_streak_pleno = 0;

  let current_normal = 0;
  let max_streak_normal = 0;

  let current_falla = 0;
  let max_streak_falla = 0;

  let current_ausente = 0;
  let max_streak_ausente = 0;

  for (const m of sortedFinishedMatches) {
    const pred = uniqueMatchPreds[m.id];
    if (pred) {
      const pts = pred.pointsEarned || 0;
      if (pts === pointsExactMatch) {
        current_pleno++;
        current_normal++;
        current_falla = 0;
        current_ausente = 0;
      } else if (pts > 0) {
        current_normal++;
        current_pleno = 0;
        current_falla = 0;
        current_ausente = 0;
      } else {
        current_falla++;
        current_pleno = 0;
        current_normal = 0;
        current_ausente = 0;
      }
    } else {
      // El usuario no pronosticó este partido finalizado
      current_ausente++;
      current_pleno = 0;
      current_normal = 0;
      current_falla = 0;
    }

    if (current_pleno > max_streak_pleno) max_streak_pleno = current_pleno;
    if (current_normal > max_streak_normal) max_streak_normal = current_normal;
    if (current_falla > max_streak_falla) max_streak_falla = current_falla;
    if (current_ausente > max_streak_ausente) max_streak_ausente = current_ausente;
  }

  // Medallas de racha
  // 🐐🔥 Racha Cabra: Racha de 2+ plenos seguidos
  if (max_streak_pleno >= 2) {
    medalsSet.add('🐐🔥 Racha Cabra');
  }

  // 🔥 En Llamas: Racha de 3+ aciertos seguidos
  if (max_streak_normal >= 3) {
    medalsSet.add('🔥 En Llamas');
  }

  // 🥶 Enfriado: Racha de 3+ fallas seguidas
  if (max_streak_falla >= 3) {
    medalsSet.add('🥶 Enfriado');
  }

  // 👻 Fantasma: Racha de 4+ ausencias seguidas
  if (max_streak_ausente >= 4) {
    medalsSet.add('👻 Fantasma');
  }

  const userUpdate = {
    points: absolutePoints,
    exactMatches: absoluteExactMatches,
    streak_pleno: current_pleno,
    streak_normal: current_normal,
    streak_falla: current_falla,
    streak_ausente: current_ausente,
    max_streak_pleno,
    max_streak_normal,
    max_streak_falla,
    max_streak_ausente,
    medallas: Array.from(medalsSet),
    updatedAt: Date.now()
  };

  return { userUpdate };
}
