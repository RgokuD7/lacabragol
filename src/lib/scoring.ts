import { Setting } from '../types';

export type PredictionEvaluationType = 
  | 'exact'       // Acertó marcador exacto (e.g. 3-1 vs 3-1) -> +3 pts
  | 'outcome'     // Acertó ganador o empate sin marcador exacto (e.g. 2-0 vs 4-0) -> +1 pt
  | 'miss'        // Pronosticó pero no acertó (e.g. 0-2 vs 2-1) -> 0 pts
  | 'no_prediction' // No ingresó pronóstico y el partido terminó -> 0 pts
  | 'pending_saved' // Partido por jugar y ya tiene pronóstico
  | 'pending_empty' // Partido por jugar y falta pronosticar
  | 'live_saved'    // Partido en juego con pronóstico
  | 'live_empty';   // Partido en juego sin pronóstico

export interface PredictionResult {
  type: PredictionEvaluationType;
  points: number;
  label: string;
  badgeClass: string;
  desc?: string;
}

export function evaluatePrediction(
  homeScore?: number | null,
  awayScore?: number | null,
  predHome?: number | null,
  predAway?: number | null,
  matchStatus: 'pending' | 'in_progress' | 'finished' = 'pending',
  isLocked: boolean = false,
  settings?: Setting | null
): PredictionResult {
  const pointsExact = settings?.pointsExactMatch ?? 3;
  const pointsWinner = settings?.pointsWinnerTie ?? 1;

  const hasRealScore = homeScore !== undefined && homeScore !== null && awayScore !== undefined && awayScore !== null;
  const hasPred = predHome !== undefined && predHome !== null && !isNaN(predHome) && 
                  predAway !== undefined && predAway !== null && !isNaN(predAway);

  // 1. MATCH IS FINISHED
  if (matchStatus === 'finished') {
    if (!hasPred) {
      return {
        type: 'no_prediction',
        points: 0,
        label: 'No apostaste (0 pts)',
        badgeClass: 'bg-zinc-800/80 border-zinc-700 text-zinc-400',
        desc: 'Sin pronóstico registrado para este partido'
      };
    }

    const realHome = homeScore!;
    const realAway = awayScore!;
    const pHome = predHome!;
    const pAway = predAway!;

    // Check exact score
    if (pHome === realHome && pAway === realAway) {
      return {
        type: 'exact',
        points: pointsExact,
        label: `¡Marcador Exacto! (+${pointsExact} pts)`,
        badgeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
        desc: `Acertaste el resultado exacto ${realHome} - ${realAway}`
      };
    }

    // Check outcome (Home Win, Away Win, Tie)
    const realDiff = realHome - realAway;
    const predDiff = pHome - pAway;

    const sameOutcome = (realDiff > 0 && predDiff > 0) || // Home win
                        (realDiff < 0 && predDiff < 0) || // Away win
                        (realDiff === 0 && predDiff === 0); // Tie

    if (sameOutcome) {
      const outcomeType = realDiff === 0 ? 'el Empate' : realDiff > 0 ? 'la Victoria Local' : 'la Victoria Visitante';
      return {
        type: 'outcome',
        points: pointsWinner,
        label: `Acertaste ${outcomeType} (+${pointsWinner} pt)`,
        badgeClass: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
        desc: `Resultado: ${realHome}-${realAway} · Tu pronóstico: ${pHome}-${pAway}`
      };
    }

    // Missed
    return {
      type: 'miss',
      points: 0,
      label: 'No acertaste (0 pts)',
      badgeClass: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      desc: `Resultado: ${realHome}-${realAway} · Tu pronóstico: ${pHome}-${pAway}`
    };
  }

  // 2. MATCH IS LIVE / IN PROGRESS / LOCKED
  if (matchStatus === 'in_progress' || isLocked) {
    if (hasPred) {
      return {
        type: 'live_saved',
        points: 0,
        label: `En Juego · Apuesta: ${predHome} - ${predAway}`,
        badgeClass: 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse',
        desc: 'Partido bloqueado/en disputa'
      };
    } else {
      return {
        type: 'live_empty',
        points: 0,
        label: 'En Juego (Sin apuesta)',
        badgeClass: 'bg-zinc-800 border-zinc-700 text-zinc-500',
        desc: 'El tiempo para ingresar apuestas expiró'
      };
    }
  }

  // 3. MATCH IS OPEN / PENDING
  if (hasPred) {
    return {
      type: 'pending_saved',
      points: 0,
      label: `Tu apuesta: ${predHome} - ${predAway}`,
      badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      desc: 'Apuesta guardada exitosamente'
    };
  }

  return {
    type: 'pending_empty',
    points: 0,
    label: 'Pendiente de apuesta',
    badgeClass: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    desc: 'Ingresa tus goles y presiona Guardar'
  };
}
