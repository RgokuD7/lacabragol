import { User } from '../types';

export type AchievementCategory = 'match' | 'jornada' | 'streak';
export type AchievementRarity = 'comun' | 'raro' | 'epico' | 'legendario';

export interface Achievement {
  id: string;
  title: string;
  name: string;
  emoji: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  description: string;
  shortCondition: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  // PARTIDO
  {
    id: 'cerrajero',
    title: '🔒 Cerrajero',
    name: 'Cerrajero',
    emoji: '🔒',
    category: 'match',
    rarity: 'raro',
    description: 'Acertaste un marcador exacto de 0 a 0. La cerradura perfecta.',
    shortCondition: 'Pleno exacto 0 - 0'
  },
  {
    id: 'bilardista',
    title: '👔 Bilardista',
    name: 'Bilardista',
    emoji: '👔',
    category: 'match',
    rarity: 'comun',
    description: 'Acertaste un marcador exacto de 1 a 0 o 0 a 1. Ganar como sea, a lo Bilardo.',
    shortCondition: 'Pleno exacto 1 - 0 o 0 - 1'
  },
  {
    id: 'modo_play',
    title: '🎮 Modo Play',
    name: 'Modo Play',
    emoji: '🎮',
    category: 'match',
    rarity: 'raro',
    description: 'Pronosticaste al ganador con 4+ goles y acertaste el desenlace en un partido con 3 o más goles reales.',
    shortCondition: 'Ganador 4+ goles y desenlace acertado'
  },
  {
    id: 'mundo_al_reves',
    title: '🙃 Mundo al Revés',
    name: 'Mundo al Revés',
    emoji: '🙃',
    category: 'match',
    rarity: 'comun',
    description: 'Pronosticaste el marcador exactamente invertido sin haber empate (ej. dijiste 2-1 y terminó 1-2).',
    shortCondition: 'Marcador invertido sin empate'
  },
  {
    id: 'puro_humo',
    title: '💨 Puro Humo',
    name: 'Puro Humo',
    emoji: '💨',
    category: 'match',
    rarity: 'comun',
    description: 'Pronosticaste un festival con 4 o más goles en total y el partido terminó en un triste 0 a 0.',
    shortCondition: 'Pronóstico 4+ goles y fin 0 - 0'
  },
  {
    id: 'matematico',
    title: '🧮 Matemático',
    name: 'Matemático',
    emoji: '🧮',
    category: 'match',
    rarity: 'raro',
    description: 'No sumaste puntos en el partido, pero la suma de goles pronosticados fue exactamente igual al total real.',
    shortCondition: '0 puntos pero suma de goles exacta'
  },

  // JORNADA
  {
    id: 'cabra_de_oro',
    title: '🐐 Cabra de Oro',
    name: 'Cabra de Oro',
    emoji: '🐐',
    category: 'jornada',
    rarity: 'legendario',
    description: 'Puntuaste (> 0 puntos) en absolutamente TODOS los partidos de una misma jornada (mínimo 4 partidos disputados).',
    shortCondition: 'Puntuar en todos los partidos de la jornada'
  },
  {
    id: 'cabra_congelada',
    title: '🥶 Cabra Congelada',
    name: 'Cabra Congelada',
    emoji: '🥶',
    category: 'jornada',
    rarity: 'comun',
    description: 'Pronosticaste al menos la mitad de los partidos de la fecha y no sumaste ni un solo punto.',
    shortCondition: '>= 50% de partidos y 0 puntos'
  },
  {
    id: 'montana_rusa',
    title: '🎢 Montaña Rusa',
    name: 'Montaña Rusa',
    emoji: '🎢',
    category: 'jornada',
    rarity: 'comun',
    description: 'En una misma jornada lograste al menos un pleno exacto y también te fuiste en cero en otro partido.',
    shortCondition: 'Al menos un pleno y un cero en la fecha'
  },
  {
    id: 'francotirador',
    title: '🎯 Francotirador',
    name: 'Francotirador',
    emoji: '🎯',
    category: 'jornada',
    rarity: 'epico',
    description: 'Acertaste 3 o más marcadores exactos (plenos) en una misma jornada con mínimo 4 partidos.',
    shortCondition: '3 o más plenos en la misma jornada'
  },

  // RACHAS
  {
    id: 'racha_cabra',
    title: '🐐🔥 Racha Cabra',
    name: 'Racha Cabra',
    emoji: '🐐🔥',
    category: 'streak',
    rarity: 'legendario',
    description: 'Encadenaste 2 o más plenos consecutivos (marcadores exactos perfectos).',
    shortCondition: 'Racha de 2+ plenos seguidos'
  },
  {
    id: 'en_llamas',
    title: '🔥 En Llamas',
    name: 'En Llamas',
    emoji: '🔥',
    category: 'streak',
    rarity: 'raro',
    description: 'Encadenaste 3 o más partidos consecutivos sumando puntos.',
    shortCondition: 'Racha de 3+ aciertos seguidos'
  },
  {
    id: 'enfriado',
    title: '🥶 Enfriado',
    name: 'Enfriado',
    emoji: '🥶',
    category: 'streak',
    rarity: 'comun',
    description: 'Acumulaste 3 o más partidos seguidos sin sumar un solo punto.',
    shortCondition: 'Racha de 3+ fallas seguidas'
  },
  {
    id: 'fantasma',
    title: '👻 Fantasma',
    name: 'Fantasma',
    emoji: '👻',
    category: 'streak',
    rarity: 'comun',
    description: 'Te ausentaste y no cargaste pronósticos durante 4 o más partidos consecutivos.',
    shortCondition: 'Racha de 4+ ausencias seguidas'
  }
];

export function isAchievementUnlocked(achievement: Achievement, user: User | null | undefined): boolean {
  if (!user) return false;

  // 1. Direct check in user's medallas array
  const medallas = user.medallas || [];
  const hasDirectMedal = medallas.some(m => {
    if (typeof m !== 'string') return false;
    return m.includes(achievement.name) || m === achievement.title;
  });

  if (hasDirectMedal) return true;

  // 2. Statistical fallback for streaks
  if (achievement.id === 'racha_cabra') {
    return (user.max_streak_pleno || 0) >= 2 || (user.streak_pleno || 0) >= 2;
  }
  if (achievement.id === 'en_llamas') {
    return (user.max_streak_normal || 0) >= 3 || (user.streak_normal || 0) >= 3;
  }
  if (achievement.id === 'enfriado') {
    return (user.max_streak_falla || 0) >= 3 || (user.streak_falla || 0) >= 3;
  }
  if (achievement.id === 'fantasma') {
    return (user.max_streak_ausente || 0) >= 4 || (user.streak_ausente || 0) >= 4;
  }

  return false;
}

export function getRarityColor(rarity: AchievementRarity): {
  badge: string;
  border: string;
  glow: string;
  text: string;
} {
  switch (rarity) {
    case 'legendario':
      return {
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
        border: 'border-amber-500/40',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.25)]',
        text: 'text-amber-400'
      };
    case 'epico':
      return {
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
        border: 'border-purple-500/40',
        glow: 'shadow-[0_0_15px_rgba(168,85,247,0.25)]',
        text: 'text-purple-400'
      };
    case 'raro':
      return {
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
        border: 'border-blue-500/40',
        glow: 'shadow-[0_0_12px_rgba(59,130,246,0.2)]',
        text: 'text-blue-400'
      };
    case 'comun':
    default:
      return {
        badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        border: 'border-zinc-800',
        glow: '',
        text: 'text-zinc-400'
      };
  }
}
