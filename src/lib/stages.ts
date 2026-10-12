import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Stage, StageStandingItem, Match, Prediction, User } from '../types';

/**
 * Suscribe en tiempo real a las etapas de un grupo, ordenadas cronológicamente.
 */
export function subscribeStages(
  groupId: string | null | undefined,
  onUpdate: (stages: Stage[]) => void,
  onError?: (err: any) => void
) {
  const targetGroupId = groupId || 'default';
  const q = query(
    collection(db, 'stages'),
    where('groupId', '==', targetGroupId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const stages = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Stage));

      // Ordenar por fecha de creación ascendente
      stages.sort((a, b) => a.createdAt - b.createdAt);
      onUpdate(stages);
    },
    (error) => {
      console.error('Error suscribiendo a etapas:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Calcula la clasificación completa para una etapa a partir de los partidos y pronósticos.
 */
export function calculateStageStandings(
  stage: Stage,
  matches: Match[],
  predictions: Prediction[],
  users: User[]
): StageStandingItem[] {
  const matchGroupSet = new Set(stage.matchGroups || []);

  // Mapear partidos de la etapa que hayan finalizado
  const stageMatches = matches.filter(m => {
    const g = m.group || 'Fase Regular';
    return matchGroupSet.has(g);
  });

  const stageMatchesMap = new Map<string, Match>();
  stageMatches.forEach(m => stageMatchesMap.set(m.id, m));

  // Acumular puntos y plenos por usuario
  const userScores: Record<string, { points: number; exactMatches: number }> = {};
  users.forEach(u => {
    userScores[u.uid] = { points: 0, exactMatches: 0 };
  });

  predictions.forEach(pred => {
    const match = stageMatchesMap.get(pred.matchId);
    if (!match) return;

    if (
      match.status === 'finished' &&
      match.homeScore !== null &&
      match.homeScore !== undefined &&
      match.awayScore !== null &&
      match.awayScore !== undefined
    ) {
      const uid = pred.userId;
      if (!userScores[uid]) {
        userScores[uid] = { points: 0, exactMatches: 0 };
      }

      const pts = pred.pointsEarned || 0;
      userScores[uid].points += pts;

      const isExact = pred.homeScore === match.homeScore && pred.awayScore === match.awayScore;
      if (isExact) {
        userScores[uid].exactMatches += 1;
      }
    }
  });

  // Generar lista para ordenar
  const items: {
    userId: string;
    displayName: string;
    nickname?: string;
    photoURL?: string;
    points: number;
    exactMatches: number;
  }[] = users.map(u => ({
    userId: u.uid,
    displayName: u.displayName || 'Participante',
    nickname: u.nickname,
    photoURL: u.photoURL,
    points: userScores[u.uid]?.points || 0,
    exactMatches: userScores[u.uid]?.exactMatches || 0,
  }));

  // Ordenar por puntos desc, luego por plenos desc
  items.sort((a, b) => b.points - a.points || b.exactMatches - a.exactMatches);

  // Asignar rangos manejando empates
  let currentRank = 1;
  const standings: StageStandingItem[] = [];

  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      const prev = items[i - 1];
      const curr = items[i];
      if (curr.points === prev.points && curr.exactMatches === prev.exactMatches) {
        // Empate en puntos y plenos: comparten el mismo rango
      } else {
        currentRank = i + 1;
      }
    }
    standings.push({
      rank: currentRank,
      ...items[i]
    });
  }

  return standings;
}

/**
 * Crea una nueva etapa en estado activo.
 */
export async function createStage(
  groupId: string | null | undefined,
  name: string,
  matchGroups: string[]
): Promise<string> {
  const targetGroupId = groupId || 'default';
  const cleanName = name.trim();
  if (!cleanName) throw new Error('El nombre de la etapa es obligatorio');
  if (!matchGroups || matchGroups.length === 0) throw new Error('Debes seleccionar al menos una jornada o fase');

  const newRef = doc(collection(db, 'stages'));
  const newStage: Stage = {
    id: newRef.id,
    groupId: targetGroupId,
    name: cleanName,
    matchGroups,
    status: 'active',
    createdAt: Date.now(),
  };

  await setDoc(newRef, newStage);
  return newRef.id;
}

/**
 * Cierra una etapa, calculando y congelando permanentemente el podio de ganadores y la tabla completa.
 */
export async function closeStage(
  stageId: string,
  stage: Stage,
  matches: Match[],
  predictions: Prediction[],
  users: User[],
  closedByUid?: string
): Promise<{ winners: StageStandingItem[]; fullStandings: StageStandingItem[] }> {
  const fullStandings = calculateStageStandings(stage, matches, predictions, users);
  // Ganadores: rank 1, 2 y 3 (incluyendo empates en dichas posiciones)
  const winners = fullStandings.filter(s => s.rank <= 3);

  const stageRef = doc(db, 'stages', stageId);
  await updateDoc(stageRef, {
    status: 'closed',
    closedAt: Date.now(),
    closedBy: closedByUid || 'admin',
    winners,
    fullStandings,
  });

  return { winners, fullStandings };
}

/**
 * Reabre una etapa cerrada para volverla activa si se necesita recalcular o reanudar.
 */
export async function reopenStage(stageId: string): Promise<void> {
  const stageRef = doc(db, 'stages', stageId);
  await updateDoc(stageRef, {
    status: 'active',
    closedAt: null,
    closedBy: null,
  });
}

/**
 * Recalcula y actualiza los ganadores y tabla congelada de una etapa ya cerrada.
 */
export async function recalculateClosedStage(
  stageId: string,
  stage: Stage,
  matches: Match[],
  predictions: Prediction[],
  users: User[]
): Promise<void> {
  const fullStandings = calculateStageStandings(stage, matches, predictions, users);
  const winners = fullStandings.filter(s => s.rank <= 3);

  const stageRef = doc(db, 'stages', stageId);
  await updateDoc(stageRef, {
    winners,
    fullStandings,
  });
}

/**
 * Elimina una etapa.
 */
export async function deleteStage(stageId: string): Promise<void> {
  await deleteDoc(doc(db, 'stages', stageId));
}
