export interface Group {
  id: string;
  name: string;
  code: string;
  adminId: string;
  coAdmins?: string[];
  members: string[];
  blockedMembers?: string[];
  createdAt: number;
}

export interface User {
  uid: string;
  displayName: string;
  nickname?: string;
  email: string;
  photoURL?: string;
  points: number;
  exactMatches: number;
  title?: string;
  medallas?: string[];
  paid: boolean;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
  streak_normal?: number;
  streak_pleno?: number;
  streak_falla?: number;
  streak_ausente?: number;
  max_streak_normal?: number;
  max_streak_pleno?: number;
  max_streak_falla?: number;
  max_streak_ausente?: number;
  hasSeenTutorial?: boolean;
  hasSeenPlayersUpdateTutorial?: boolean;
}

export interface Setting {
  groupName: string;
  adminId: string;
  rulesText: string;
  blockMinutesBeforeMatch: number;
  pointsExactMatch: number;
  pointsWinnerTie: number;
  pointsTeamGoals: number;
  pointsGoalDiff: number;
  pointsChampion: number;
  pointsRunnerUp: number;
  pointsThirdPlace: number;
  pointsSpecial: number;
  updatedAt: number;
}

export interface Match {
  id: string; // Document ID
  group: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: 'pending' | 'in_progress' | 'finished';
  estado?: string;
  apiId?: string | number;
  is_synced?: boolean;
  is_fetching?: boolean;
  is_updating?: boolean;
  is_updating_at?: number;
  goalscorers?: any[];
  cards?: any[];
  ultimo_hito_sincronizado?: number;
  last_synced_milestone?: number;
  last_synced_at?: number;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  groupId?: string;
  homeScore: number;
  awayScore: number;
  pointsEarned: number;
  reactions?: Record<string, string[] | number>;
  updatedAt: number;
}

export interface Podium {
  userId: string;
  groupId?: string;
  champion?: string;
  championLogo?: string;
  runnerUp?: string;
  runnerUpLogo?: string;
  topScorer?: string;
  mostAssists?: string;
  bestKeeper?: string;
  mvp?: string;
  hasCustomPlayer?: boolean;
  updatedAt: number;
}
