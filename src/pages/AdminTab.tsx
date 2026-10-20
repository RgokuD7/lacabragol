import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useGroups } from '../components/GroupsProvider';
import { db } from '../lib/firebase';
import { collection, doc, query, where, onSnapshot, getDocs, getDoc, writeBatch, updateDoc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Match, Prediction, User, Setting, Stage, StageStandingItem } from '../types';
import { ShieldAlert, RefreshCw, Sparkles, PlayCircle, Search, ShieldCheck, Check, X, AlertCircle, AlertTriangle, Trash2, Loader2, CheckCircle2, UserPlus, FileCode, FileJson, RotateCcw, Users, Plus, Table2, Edit3, Save, Key, Trophy, Flame, Layers, Flag, Calendar, Clock, Crown, Medal, Target, CheckSquare, Square, ChevronRight, Link2, Shield, Filter, Bot, Copy, Globe } from 'lucide-react';
import { TeamBadge } from '../components/TeamBadge';
import { UCL_LEAGUE_PHASE_MATCHES, UCL_36_TEAMS, getCanonicalTeamName, getTeamLogoByName } from '../data/fixtures';
import { PlayerItem, DEFAULT_PLAYERS, deduplicatePlayers, normalizePlayerKey, formatNationality, formatPosition, findMatchingCatalogPlayer, arePlayerNamesEquivalent, cleanPlayerForStorage, AVAILABLE_NATIONALITIES, getNationalityOptions, AVAILABLE_POSITIONS } from '../data/players';
import { copyTextToClipboard } from '../lib/clipboard';
import { AiPlayersModal } from '../components/AiPlayersModal';
import { cn, sanitizeForFirestore } from '../lib/utils';
import { useSettings } from '../components/SettingsProvider';
import { BaseBottomSheet } from '../components/BaseBottomSheet';
import { UserAvatar } from '../components/UserAvatar';
import { recalculateStandings, findUclTeam } from '../lib/standings';
import { recalculateAllUsersFromDatabase } from '../lib/recalculation';
import { buildPlayerMatchEvidenceMap, PlayerMatchEvidence, extractAllMatchEvents } from '../lib/matchEventsAuditor';
import { 
  fetchGeminiMatchesPreview, 
  commitGeminiMatchesToFirestore, 
  getGeminiApiKey, 
  setGeminiApiKey, 
  GeminiPreviewResult, 
  mapGeminiEstadoToStatus, 
  GeminiPartidoPreview 
} from '../lib/geminiSync';
import { 
  getSerpApiKey, 
  setSerpApiKey, 
  fetchSerpApiRaw, 
  parseMatchWithGemini, 
  parseMultipleMatchesWithGemini,
  parseStandingsWithGemini, 
  getMockRealMadridVsInterPreview, 
  commitSerpApiStandingsToFirestore, 
  SerpApiStandingItem,
  checkAndAutoSyncFinishedMatches,
  syncJornadaMatchesWithSerpApi,
  isGeminiRateLimit,
  BatchMatchInput
} from '../lib/serpapiSync';
import { GeminiApiResultsModal } from '../components/GeminiApiResultsModal';
import { SerpApiStandingsModal } from '../components/SerpApiStandingsModal';
import { StageWinnersModal } from '../components/StageWinnersModal';
import { MatchJsonModal } from '../components/MatchJsonModal';
import { 
  subscribeStages, 
  calculateStageStandings, 
  createStage, 
  closeStage, 
  reopenStage, 
  recalculateClosedStage, 
  deleteStage 
} from '../lib/stages';
import { syncMatchPredictionsAndPoints } from '../lib/sync';
import { vibrateTap, vibrateSuccess, vibrateError } from '../lib/haptics';


export function AdminTab({ inline, onBack }: { inline?: boolean, onBack?: () => void }) {
  const { user, profile } = useAuth();
  const { groups, activeGroupId } = useGroups();
  const { settings } = useSettings();
  const [adminTab, setAdminTab] = useState<'actions' | 'scores' | 'users' | 'players' | 'stages'>('actions');

  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [matchSearch, setMatchSearch] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  
  const [matchScores, setMatchScores] = useState<Record<string, { home: string, away: string, status: string }>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Stages management state
  const [stages, setStages] = useState<Stage[]>([]);
  const [groupPredictions, setGroupPredictions] = useState<Prediction[]>([]);
  const [newStageName, setNewStageName] = useState('');
  const [selectedMatchGroups, setSelectedMatchGroups] = useState<string[]>([]);
  const [isCreatingStage, setIsCreatingStage] = useState(false);
  const [isClosingStage, setIsClosingStage] = useState(false);
  const [stageToClose, setStageToClose] = useState<Stage | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [stageStandingsPreview, setStageStandingsPreview] = useState<StageStandingItem[]>([]);
  const [showWinnersModal, setShowWinnersModal] = useState(false);

  // Admin touch score editor modal state (prevents virtual keyboard layout shifts)
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [modalHomeScore, setModalHomeScore] = useState<number>(0);
  const [modalAwayScore, setModalAwayScore] = useState<number>(0);
  const [modalStatus, setModalStatus] = useState<'pending' | 'in_progress' | 'finished'>('pending');
  const [isSavingScoreModal, setIsSavingScoreModal] = useState(false);
  const [adminJsonMatch, setAdminJsonMatch] = useState<{ match: Match; mode: 'manual' | 'ai' | 'json' } | null>(null);

  // Standings recalculation state
  const [isRecalculatingStandings, setIsRecalculatingStandings] = useState(false);
  const [isRecalculatingRanking, setIsRecalculatingRanking] = useState(false);
  const [showConfirmRecalculateRanking, setShowConfirmRecalculateRanking] = useState(false);

  // Gemini Daily Sync state
  const [isSyncingGemini, setIsSyncingGemini] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(getGeminiApiKey());
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [geminiPreviewData, setGeminiPreviewData] = useState<GeminiPreviewResult | null>(null);
  const [isCommittingGemini, setIsCommittingGemini] = useState(false);

  // SerpAPI + Gemini hybrid sync state
  const [serpApiKeyInput, setSerpApiKeyInput] = useState(getSerpApiKey());
  const [serpKeySaved, setSerpKeySaved] = useState(false);
  const [isSyncingSerpApiMatches, setIsSyncingSerpApiMatches] = useState(false);
  const [isSyncingSerpApiStandings, setIsSyncingSerpApiStandings] = useState(false);
  const [serpStandingsPreview, setSerpStandingsPreview] = useState<SerpApiStandingItem[] | null>(null);
  const [serpStandingsRawJson, setSerpStandingsRawJson] = useState<string>('');
  const [isCommittingStandings, setIsCommittingStandings] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [selectedJornadaSync, setSelectedJornadaSync] = useState('Jornada 1');
  const [isSyncingJornada, setIsSyncingJornada] = useState(false);
  const [jornadaSyncProgress, setJornadaSyncProgress] = useState<{ current: number; total: number; match: string } | null>(null);

  // Status and management states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [isDeletingTests, setIsDeletingTests] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isRestoringOfficial, setIsRestoringOfficial] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);

  // Podium Players management state
  const [podiumPlayers, setPodiumPlayers] = useState<PlayerItem[]>(DEFAULT_PLAYERS);
  const [deletedPlayerKeys, setDeletedPlayerKeys] = useState<Set<string>>(new Set());
  const [playerSearch, setPlayerSearch] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('');
  const [newPlayerNationality, setNewPlayerNationality] = useState('');
  const [newPlayerImage, setNewPlayerImage] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [isSavingPlayers, setIsSavingPlayers] = useState(false);
  const [isResettingPlayers, setIsResettingPlayers] = useState(false);

  // Jugadores & Goleadores Subtabs
  const [playersSubTab, setPlayersSubTab] = useState<'catalog' | 'match_scorers' | 'custom_podiums'>('catalog');

  // Pestaña interna de Estadísticas de Partidos: Goleadores vs Asistidores
  const [matchStatsTab, setMatchStatsTab] = useState<'scorers' | 'assists'>('scorers');

  // Goleadores de Partidos state
  const [matchScorerSearch, setMatchScorerSearch] = useState('');
  const [isNormalizingMatchClubs, setIsNormalizingMatchClubs] = useState(false);
  const [editingScorerPlayer, setEditingScorerPlayer] = useState<{ playerName: string; currentTeam: string } | null>(null);
  const [selectedTargetTeam, setSelectedTargetTeam] = useState('');
  const [isUpdatingScorerTeam, setIsUpdatingScorerTeam] = useState(false);

  // Asistidores de Partidos state
  const [matchAssistSearch, setMatchAssistSearch] = useState('');
  const [showOnlyInconsistentAssisters, setShowOnlyInconsistentAssisters] = useState(false);

  // Podios Manuales state
  const [customPodiumList, setCustomPodiumList] = useState<Array<{
    playerName: string;
    roles: string[];
    occurrences: Array<{
      podiumId: string;
      userId: string;
      userName: string;
      role: 'topScorer' | 'mostAssists' | 'mvp';
      groupId?: string;
    }>;
  }>>([]);
  const [isLoadingCustomPodiums, setIsLoadingCustomPodiums] = useState(false);
  const [customPodiumSearch, setCustomPodiumSearch] = useState('');

  // Modal para agregar jugador de podio manual al catálogo oficial
  const [addingCustomPlayer, setAddingCustomPlayer] = useState<{
    customName: string;
    occurrences: Array<{
      podiumId: string;
      userId: string;
      userName: string;
      role: 'topScorer' | 'mostAssists' | 'mvp';
      groupId?: string;
    }>;
    name: string;
    team: string;
    position: string;
    nationality: string;
    imageUrl?: string;
  } | null>(null);
  const [modalCustomError, setModalCustomError] = useState<string | null>(null);

  // Modal para vincular jugador manual a jugador oficial existente
  const [linkingCustomPlayer, setLinkingCustomPlayer] = useState<{
    customName: string;
    occurrences: Array<{ podiumId: string; role: 'topScorer' | 'mostAssists' | 'mvp' }>;
    targetOfficialName: string;
  } | null>(null);
  const [isSavingPodiumLink, setIsSavingPodiumLink] = useState(false);
  const [modalLinkError, setModalLinkError] = useState<string | null>(null);
  const [officialPlayerSearch, setOfficialPlayerSearch] = useState('');

  // Modal para editar jugador oficial del catálogo
  const [editingCatalogPlayer, setEditingCatalogPlayer] = useState<PlayerItem | null>(null);

  // Filtros rápidos para problemas de clubes y nacionalidades
  const [showOnlyUnlinkedCatalog, setShowOnlyUnlinkedCatalog] = useState(false);
  const [showOnlyWithoutNat, setShowOnlyWithoutNat] = useState(false);
  const [showOnlyInconsistentScorers, setShowOnlyInconsistentScorers] = useState(false);

  // Asistente IA para jugadores
  const [isAiAssistantModalOpen, setIsAiAssistantModalOpen] = useState(false);
  const [copiedQuickJson, setCopiedQuickJson] = useState(false);

  // Modal "Actualizar con JSON" (Smart JSON & Match Events Updater)
  const [updateJsonModalOpen, setUpdateJsonModalOpen] = useState(false);
  const [updateJsonTab, setUpdateJsonTab] = useState<'matches' | 'paste'>('matches');
  const [updateJsonPastedText, setUpdateJsonPastedText] = useState('');
  const [isApplyingJsonUpdate, setIsApplyingJsonUpdate] = useState(false);
  const [updateJsonFilter, setUpdateJsonFilter] = useState<'all' | 'new' | 'matched' | 'clubs'>('all');
  const [updateJsonFeedback, setUpdateJsonFeedback] = useState<string | null>(null);

  // Listen to stages for activeGroupId
  useEffect(() => {
    const unsub = subscribeStages(activeGroupId, (fetched) => {
      setStages(fetched);
    });
    return () => unsub();
  }, [activeGroupId]);

  // Listen to predictions for activeGroupId (for stage calculations)
  useEffect(() => {
    if (!activeGroupId) return;
    const q = query(
      collection(db, 'predictions'),
      where('groupId', '==', activeGroupId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const preds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prediction));
      setGroupPredictions(preds);
    }, (err) => {
      console.warn('Error listening to group predictions:', err);
    });
    return () => unsub();
  }, [activeGroupId]);

  const availableMatchGroups = useMemo(() => {
    const groupsSet = new Set<string>();
    matches.forEach(m => {
      if (m.group) groupsSet.add(m.group);
    });
    if (groupsSet.size === 0) {
      for (let i = 1; i <= 8; i++) groupsSet.add(`Jornada ${i}`);
    }
    return Array.from(groupsSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      if (numA && numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [matches]);

  const matchGroupStats = useMemo(() => {
    const stats: Record<string, { total: number; finished: number; live: number; pending: number }> = {};
    matches.forEach(m => {
      const g = m.group || 'Fase Regular';
      if (!stats[g]) {
        stats[g] = { total: 0, finished: 0, live: 0, pending: 0 };
      }
      stats[g].total++;
      const isFinished = m.status === 'finished';
      const isLive = !isFinished && (m.status === 'in_progress' || (m.estado && (m.estado.toLowerCase().includes('vivo') || /\d+['’]/.test(m.estado))));
      if (isFinished) {
        stats[g].finished++;
      } else if (isLive) {
        stats[g].live++;
      } else {
        stats[g].pending++;
      }
    });
    return stats;
  }, [matches]);

  const selectedGroupsStats = useMemo(() => {
    let total = 0;
    let finished = 0;
    let live = 0;
    let pending = 0;
    selectedMatchGroups.forEach(g => {
      const st = matchGroupStats[g];
      if (st) {
        total += st.total;
        finished += st.finished;
        live += st.live;
        pending += st.pending;
      }
    });
    return {
      total,
      finished,
      live,
      pending,
      isAllFinished: total > 0 && finished === total,
      hasLive: live > 0,
      isAllUpcoming: total > 0 && finished === 0 && live === 0,
      isPartiallyFinished: total > 0 && finished > 0 && finished < total
    };
  }, [selectedMatchGroups, matchGroupStats]);


  useEffect(() => {
    const unsubMatches = onSnapshot(query(collection(db, 'matches')), snap => {
      const ms = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      ms.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
      setMatches(ms);
      
      const newScores: Record<string, { home: string, away: string, status: string }> = {};
      ms.forEach(m => {
        newScores[m.id] = {
          home: m.homeScore?.toString() ?? '',
          away: m.awayScore?.toString() ?? '',
          status: m.status
        };
      });
      setMatchScores(newScores);
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users')), snap => {
      setUsers(snap.docs.map(d => d.data() as User));
    });

    const unsubPlayers = onSnapshot(doc(db, 'system', 'players'), snap => {
      if (snap.exists() && Array.isArray(snap.data()?.players) && snap.data().players.length > 0) {
        const data = snap.data();
        const deletedKeys = new Set<string>(data.deletedKeys || []);
        setDeletedPlayerKeys(deletedKeys);
        const firestoreFormatted: PlayerItem[] = snap.data().players
          .filter((p: any) => !deletedKeys.has(normalizePlayerKey(p.name)))
          .map((p: any) => ({
            ...p,
            nationality: formatNationality(p.nationality),
            position: formatPosition(p.position)
          }));
        setPodiumPlayers(firestoreFormatted);
      } else {
        setDeletedPlayerKeys(new Set());
        setPodiumPlayers(DEFAULT_PLAYERS);
      }
    });

    return () => {
      unsubMatches();
      unsubUsers();
      unsubPlayers();
    };
  }, []);

  const availableJornadas = useMemo(() => {
    const set = new Set<string>();
    matches.forEach(m => {
      if (m.group && m.group.trim()) {
        set.add(m.group.trim());
      }
    });
    if (set.size === 0) {
      for (let i = 1; i <= 8; i++) set.add(`Jornada ${i}`);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [matches]);

  const filteredMatches = matches.filter(m => {
    const q = matchSearch.toLowerCase();
    const matchesSearch = m.homeTeam.toLowerCase().includes(q) || m.awayTeam.toLowerCase().includes(q);
    const matchesStatus = matchStatusFilter === 'all' || m.status === matchStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return (u.nickname || '').toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  // Jugadores del catálogo oficial que NO tienen un club oficial de Champions vinculado de forma exacta
  const unlinkedCatalogPlayers = useMemo(() => {
    return podiumPlayers.filter(p => !p.team || !UCL_36_TEAMS.some(t => t.name === p.team));
  }, [podiumPlayers]);

  // Jugadores del catálogo oficial que NO tienen nacionalidad asignada
  const playersWithoutNationality = useMemo(() => {
    return podiumPlayers.filter(p => !p.nationality || !p.nationality.trim());
  }, [podiumPlayers]);

  const filteredPodiumPlayers = useMemo(() => {
    let list = podiumPlayers;
    if (showOnlyUnlinkedCatalog) {
      list = list.filter(p => !p.team || !UCL_36_TEAMS.some(t => t.name === p.team));
    }
    if (showOnlyWithoutNat) {
      list = list.filter(p => !p.nationality || !p.nationality.trim());
    }
    const q = playerSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.team && p.team.toLowerCase().includes(q)) ||
      (p.position && p.position.toLowerCase().includes(q)) ||
      (p.nationality && p.nationality.toLowerCase().includes(q))
    );
  }, [podiumPlayers, playerSearch, showOnlyUnlinkedCatalog, showOnlyWithoutNat]);

  // Auditoría en tiempo real de goleadores registrados en partidos
  const matchScorersAudit = useMemo(() => {
    const map = new Map<string, {
      key: string;
      playerName: string;
      totalGoals: number;
      distinctTeams: Set<string>;
      matches: Array<{
        matchId: string;
        matchTitle: string;
        date: string;
        currentTeam: string;
        goalIndex: number;
      }>;
    }>();

    matches.forEach(m => {
      const rawGoles = Array.isArray((m as any).goles) ? (m as any).goles : (Array.isArray(m.goalscorers) ? m.goalscorers : []);
      if (rawGoles.length === 0) return;
      rawGoles.forEach((g: any, idx: number) => {
        if (!g) return;
        const pName = typeof g === 'object' ? (g.jugador || g.player || '') : (String(g).replace(/\d+.*$/, '') || String(g));
        const cleanPlayer = String(pName).trim();
        if (!cleanPlayer || cleanPlayer.toLowerCase() === 'undefined') return;

        let cleanTeam = '';
        if (typeof g === 'object') {
          cleanTeam = String(g.equipo || g.team || '').trim();
        } else if (typeof g === 'string') {
          const mTeam = g.match(/\((.*?)\)/);
          if (mTeam?.[1]) cleanTeam = mTeam[1].trim();
        }

        const key = cleanPlayer.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            key,
            playerName: cleanPlayer,
            totalGoals: 0,
            distinctTeams: new Set(),
            matches: []
          });
        }

        const item = map.get(key)!;
        item.totalGoals += 1;
        if (cleanTeam) item.distinctTeams.add(cleanTeam);
        item.matches.push({
          matchId: m.id,
          matchTitle: `${m.homeTeam} vs ${m.awayTeam}`,
          date: m.date || '',
          currentTeam: cleanTeam,
          goalIndex: idx
        });
      });
    });

    return Array.from(map.values())
      .map(item => {
        const teamsArr = Array.from(item.distinctTeams);
        const canonical = getCanonicalTeamName(teamsArr[0] || '');
        const hasMissingTeam = teamsArr.length === 0 || teamsArr.some(t => !t);
        const hasMultipleTeams = teamsArr.length > 1;
        const hasNonCanonicalTeam = teamsArr.some(t => t !== getCanonicalTeamName(t));
        const hasNonOfficialUclTeam = teamsArr.some(t => !t || !UCL_36_TEAMS.some(ucl => ucl.name === t));
        const isInconsistent = hasMissingTeam || hasMultipleTeams || hasNonCanonicalTeam || hasNonOfficialUclTeam;
        return {
          ...item,
          teamsList: teamsArr,
          canonicalTeam: canonical,
          hasMissingTeam,
          hasMultipleTeams,
          hasNonCanonicalTeam,
          hasNonOfficialUclTeam,
          isInconsistent
        };
      })
      .sort((a, b) => (b.isInconsistent ? 1 : 0) - (a.isInconsistent ? 1 : 0) || b.totalGoals - a.totalGoals);
  }, [matches]);

  const filteredMatchScorers = useMemo(() => {
    let list = matchScorersAudit;
    if (showOnlyInconsistentScorers) {
      list = list.filter(s => s.isInconsistent);
    }
    const q = matchScorerSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(s => 
      s.playerName.toLowerCase().includes(q) ||
      s.teamsList.some(t => t.toLowerCase().includes(q)) ||
      s.canonicalTeam.toLowerCase().includes(q)
    );
  }, [matchScorersAudit, matchScorerSearch, showOnlyInconsistentScorers]);

  // Auditoría en tiempo real de asistidores registrados en partidos
  const matchAssistsAudit = useMemo(() => {
    const map = new Map<string, {
      key: string;
      playerName: string;
      totalAssists: number;
      distinctTeams: Set<string>;
      matches: Array<{
        matchId: string;
        matchTitle: string;
        date: string;
        currentTeam: string;
        minute: number;
        scorerName: string;
      }>;
    }>();

    matches.forEach(m => {
      const rawGoles = Array.isArray((m as any).goles) ? (m as any).goles : (Array.isArray(m.goalscorers) ? m.goalscorers : []);
      rawGoles.forEach((g: any) => {
        if (!g) return;
        let assistName = '';
        let scorerName = '';
        let cleanTeam = '';
        let minute = 0;

        if (typeof g === 'object') {
          assistName = String(g.asistencia || g.assist || '').trim();
          scorerName = String(g.jugador || g.player || '').trim();
          cleanTeam = String(g.equipo || g.team || '').trim();
          minute = Number(g.minuto ?? 0);
          if (!cleanTeam && g.is_home !== undefined) {
            cleanTeam = g.is_home ? m.homeTeam : m.awayTeam;
          }
        }

        if (!assistName || assistName.toLowerCase() === 'null' || assistName.toLowerCase() === 'undefined' || assistName.toLowerCase() === 'none') {
          return;
        }

        const key = assistName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            key,
            playerName: assistName,
            totalAssists: 0,
            distinctTeams: new Set(),
            matches: []
          });
        }

        const item = map.get(key)!;
        item.totalAssists += 1;
        if (cleanTeam) item.distinctTeams.add(cleanTeam);
        item.matches.push({
          matchId: m.id,
          matchTitle: `${m.homeTeam} vs ${m.awayTeam}`,
          date: m.date || '',
          currentTeam: cleanTeam,
          minute,
          scorerName
        });
      });
    });

    return Array.from(map.values())
      .map(item => {
        const teamsArr = Array.from(item.distinctTeams);
        const canonical = getCanonicalTeamName(teamsArr[0] || '');
        const hasMissingTeam = teamsArr.length === 0 || teamsArr.some(t => !t);
        const hasMultipleTeams = teamsArr.length > 1;
        const hasNonCanonicalTeam = teamsArr.some(t => t !== getCanonicalTeamName(t));
        const hasNonOfficialUclTeam = teamsArr.some(t => !t || !UCL_36_TEAMS.some(ucl => ucl.name === t));
        const isInconsistent = hasMissingTeam || hasMultipleTeams || hasNonCanonicalTeam || hasNonOfficialUclTeam;
        return {
          ...item,
          teamsList: teamsArr,
          canonicalTeam: canonical,
          hasMissingTeam,
          hasMultipleTeams,
          hasNonCanonicalTeam,
          hasNonOfficialUclTeam,
          isInconsistent
        };
      })
      .sort((a, b) => (b.isInconsistent ? 1 : 0) - (a.isInconsistent ? 1 : 0) || b.totalAssists - a.totalAssists);
  }, [matches]);

  const filteredMatchAssists = useMemo(() => {
    let list = matchAssistsAudit;
    if (showOnlyInconsistentAssisters) {
      list = list.filter(a => a.isInconsistent);
    }
    const q = matchAssistSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(a => 
      a.playerName.toLowerCase().includes(q) ||
      a.teamsList.some(t => t.toLowerCase().includes(q)) ||
      a.canonicalTeam.toLowerCase().includes(q)
    );
  }, [matchAssistsAudit, matchAssistSearch, showOnlyInconsistentAssisters]);

  // Jugadores encontrados en partidos que aún no están en el catálogo oficial (usando match inteligente)
  const matchPlayersNotInCatalog = useMemo(() => {
    const map = new Map<string, { name: string; team: string; type: string }>();

    matchScorersAudit.forEach(s => {
      const key = normalizePlayerKey(s.playerName);
      if (deletedPlayerKeys.has(key)) return; // Omitir si fue eliminado intencionalmente por el admin
      const matched = findMatchingCatalogPlayer(s.playerName, podiumPlayers);
      if (!matched) {
        map.set(key, {
          name: s.playerName,
          team: s.canonicalTeam || s.teamsList[0] || '',
          type: 'Goleador'
        });
      }
    });

    matchAssistsAudit.forEach(a => {
      const key = normalizePlayerKey(a.playerName);
      if (deletedPlayerKeys.has(key)) return; // Omitir si fue eliminado intencionalmente por el admin
      const matched = findMatchingCatalogPlayer(a.playerName, podiumPlayers);
      if (!matched) {
        if (!map.has(key)) {
          map.set(key, {
            name: a.playerName,
            team: a.canonicalTeam || a.teamsList[0] || '',
            type: 'Asistidor'
          });
        }
      }
    });

    return Array.from(map.values());
  }, [podiumPlayers, matchScorersAudit, matchAssistsAudit, deletedPlayerKeys]);

  // Evidencia detallada de jugadores según eventos de partidos (goles, asistencias, cambios/sustituciones, tarjetas, lesiones)
  const catalogPlayerMatchEvidenceMap = useMemo(() => {
    if (adminTab !== 'players') return new Map<string, PlayerMatchEvidence>();
    return buildPlayerMatchEvidenceMap(matches, podiumPlayers);
  }, [adminTab, matches, podiumPlayers]);

  // Jugadores del catálogo sin club oficial que fueron detectados en partidos con un club de Champions
  const matchEventDetectedPlayers = useMemo(() => {
    return unlinkedCatalogPlayers.filter(p => {
      const key = p.id ? String(p.id) : normalizePlayerKey(p.name);
      const evidence = catalogPlayerMatchEvidenceMap.get(key);
      return !!(evidence && evidence.canonicalTeam && UCL_36_TEAMS.some(t => t.name === evidence.canonicalTeam));
    });
  }, [unlinkedCatalogPlayers, catalogPlayerMatchEvidenceMap]);

  // Cuántos jugadores del catálogo se pueden auto-vincular (bien por alias ortográfico o bien por registros encontrados en partidos)
  const autoLinkableCatalogPlayers = useMemo(() => {
    return unlinkedCatalogPlayers.filter(p => {
      // 1. Alias ortográfico (ej. "Bayern Munich" -> "FC Bayern München")
      if (p.team) {
        const match = findUclTeam(p.team);
        if (match && match.name !== p.team) return true;
      }
      // 2. Registro en partidos (ej. Alejandro Grimaldo -> Club Atlético de Madrid por sustitución; Enzo Fernández -> Manchester City por asistencia)
      const key = p.id ? String(p.id) : normalizePlayerKey(p.name);
      const evidence = catalogPlayerMatchEvidenceMap.get(key);
      if (evidence && evidence.canonicalTeam && UCL_36_TEAMS.some(t => t.name === evidence.canonicalTeam)) {
        return true;
      }
      return false;
    });
  }, [unlinkedCatalogPlayers, catalogPlayerMatchEvidenceMap]);

  // Análisis inteligente para "Actualizar con JSON"
  const updateJsonAnalysis = useMemo(() => {
    // 1. Extraer lista bruta de eventos/jugadores según pestaña activa
    const rawEvents: Array<{
      name: string;
      rawTeam: string;
      detectedUclTeam: string;
      role: 'Delantero' | 'Centrocampista' | 'Defensa' | 'Portero';
      evidenceType: string;
    }> = [];

    if (updateJsonTab === 'matches') {
      const allEvents = extractAllMatchEvents(matches);
      allEvents.forEach(ev => {
        if (!ev.playerName) return;
        rawEvents.push({
          name: ev.playerName,
          rawTeam: ev.rawTeam,
          detectedUclTeam: ev.canonicalTeam,
          role: ev.type === 'gol' ? 'Delantero' : ev.type === 'asistencia' ? 'Centrocampista' : 'Centrocampista',
          evidenceType: ev.typeLabel
        });
      });
    } else if (updateJsonTab === 'paste' && updateJsonPastedText.trim()) {
      try {
        const parsed = JSON.parse(updateJsonPastedText);
        let list: any[] = [];
        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (Array.isArray(parsed.players)) {
          list = parsed.players;
        } else if (Array.isArray(parsed.top_players)) {
          list = parsed.top_players;
        } else if (Array.isArray(parsed.partidos)) {
          const fakeMatches: Match[] = parsed.partidos.map((p: any, idx: number) => ({ id: `pasted_${idx}`, ...p }));
          const extracted = extractAllMatchEvents(fakeMatches);
          extracted.forEach(ev => {
            rawEvents.push({
              name: ev.playerName,
              rawTeam: ev.rawTeam,
              detectedUclTeam: ev.canonicalTeam,
              role: ev.type === 'gol' ? 'Delantero' : ev.type === 'asistencia' ? 'Centrocampista' : 'Centrocampista',
              evidenceType: ev.typeLabel
            });
          });
        }

        list.forEach(item => {
          if (!item) return;
          const pName = String(item.name || item.jugador || item.player || '').trim();
          if (!pName) return;
          const pTeam = String(item.team || item.equipo || '').trim();
          const canonTeam = findUclTeam(pTeam)?.name || getCanonicalTeamName(pTeam) || pTeam;
          const pPos = formatPosition(item.position || item.posicion) || 'Delantero';
          rawEvents.push({
            name: pName,
            rawTeam: pTeam,
            detectedUclTeam: canonTeam,
            role: (pPos.includes('Def') ? 'Defensa' : pPos.includes('Port') ? 'Portero' : pPos.includes('Cent') ? 'Centrocampista' : 'Delantero') as any,
            evidenceType: 'JSON'
          });
        });
      } catch (e) {
        // En caso de JSON incompleto mientras escribe
      }
    }

    // 2. Agrupar por nombre único del evento
    const uniqueMap = new Map<string, {
      name: string;
      detectedUclTeam: string;
      role: 'Delantero' | 'Centrocampista' | 'Defensa' | 'Portero';
      evidenceCount: number;
    }>();

    rawEvents.forEach(ev => {
      const key = normalizePlayerKey(ev.name);
      if (!key) return;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          name: ev.name,
          detectedUclTeam: ev.detectedUclTeam,
          role: ev.role,
          evidenceCount: 1
        });
      } else {
        const item = uniqueMap.get(key)!;
        item.evidenceCount += 1;
        if (!item.detectedUclTeam && ev.detectedUclTeam) item.detectedUclTeam = ev.detectedUclTeam;
        if (ev.role === 'Delantero') item.role = 'Delantero';
      }
    });

    // 3. Emparejamiento inteligente contra podiumPlayers
    const newPlayers: Array<{ name: string; team: string; position: string; evidenceCount: number }> = [];
    const matchedExisting: Array<{ eventName: string; catalogPlayer: PlayerItem; reason: string }> = [];
    const clubUpdates: Array<{ eventName: string; catalogPlayer: PlayerItem; oldTeam: string; newTeam: string }> = [];

    uniqueMap.forEach(item => {
      const matched = findMatchingCatalogPlayer(item.name, podiumPlayers);
      if (matched) {
        const isOfficialClub = !!matched.team && UCL_36_TEAMS.some(t => t.name === matched.team);
        const hasValidDetectedUcl = !!item.detectedUclTeam && UCL_36_TEAMS.some(t => t.name === item.detectedUclTeam);

        if (!isOfficialClub && hasValidDetectedUcl && matched.team !== item.detectedUclTeam) {
          clubUpdates.push({
            eventName: item.name,
            catalogPlayer: matched,
            oldTeam: matched.team || 'Sin Club',
            newTeam: item.detectedUclTeam
          });
        } else {
          matchedExisting.push({
            eventName: item.name,
            catalogPlayer: matched,
            reason: normalizePlayerKey(item.name) === normalizePlayerKey(matched.name)
              ? 'Coincidencia exacta de nombre'
              : `Emparejado con "${matched.name}" (no se duplicará)`
          });
        }
      } else {
        newPlayers.push({
          name: item.name,
          team: item.detectedUclTeam || '',
          position: item.role,
          evidenceCount: item.evidenceCount
        });
      }
    });

    return {
      newPlayers,
      matchedExisting,
      clubUpdates,
      totalScanned: uniqueMap.size
    };
  }, [matches, podiumPlayers, updateJsonTab, updateJsonPastedText]);

  // Carga y escaneo de jugadores de podio manuales
  const fetchCustomPodiums = useCallback(async () => {
    if (podiumPlayers.length === 0) {
      setIsLoadingCustomPodiums(false);
      return;
    }
    setIsLoadingCustomPodiums(true);
    try {
      const snap = await getDocs(collection(db, 'podiums'));
      const officialKeys = new Set(podiumPlayers.map(p => normalizePlayerKey(p.name)));
      
      const customMap = new Map<string, {
        playerName: string;
        roles: Set<string>;
        occurrences: Array<{
          podiumId: string;
          userId: string;
          userName: string;
          role: 'topScorer' | 'mostAssists' | 'mvp';
          groupId?: string;
        }>;
      }>();

      const userMap = new Map(users.map(u => [u.uid, u.displayName || u.email?.split('@')[0] || u.uid]));

      snap.docs.forEach(d => {
        const data = d.data();
        const podiumId = d.id;
        const uid = data.userId || (podiumId.includes('_') ? podiumId.split('_')[1] : podiumId);
        const userName = userMap.get(uid) || uid;

        const checkField = (fieldVal?: string, role?: 'topScorer' | 'mostAssists' | 'mvp', roleLabel?: string) => {
          if (!fieldVal || !fieldVal.trim()) return;
          const trimmed = fieldVal.trim();
          const key = normalizePlayerKey(trimmed);
          if (!officialKeys.has(key)) {
            if (!customMap.has(key)) {
              customMap.set(key, {
                playerName: trimmed,
                roles: new Set(),
                occurrences: []
              });
            }
            const entry = customMap.get(key)!;
            if (roleLabel) entry.roles.add(roleLabel);
            if (role) {
              entry.occurrences.push({
                podiumId,
                userId: uid,
                userName,
                role,
                groupId: data.groupId
              });
            }
          }
        };

        checkField(data.topScorer, 'topScorer', 'Goleador');
        checkField(data.mostAssists, 'mostAssists', 'Asistidor');
        checkField(data.mvp, 'mvp', 'MVP');
      });

      const list = Array.from(customMap.values()).map(item => ({
        playerName: item.playerName,
        roles: Array.from(item.roles),
        occurrences: item.occurrences
      }));

      setCustomPodiumList(list);
    } catch (e: any) {
      console.error("Error fetching custom podiums:", e);
      setFeedback({ type: 'error', text: `Error al cargar podios: ${e?.message || 'Error desconocido'}` });
    } finally {
      setIsLoadingCustomPodiums(false);
    }
  }, [podiumPlayers, users]);

  useEffect(() => {
    if (adminTab === 'players' && playersSubTab === 'custom_podiums') {
      fetchCustomPodiums();
    }
  }, [adminTab, playersSubTab, fetchCustomPodiums]);

  const filteredCustomPodiums = useMemo(() => {
    const q = customPodiumSearch.toLowerCase().trim();
    if (!q) return customPodiumList;
    return customPodiumList.filter(p => 
      p.playerName.toLowerCase().includes(q) ||
      p.roles.some(r => r.toLowerCase().includes(q)) ||
      p.occurrences.some(o => o.userName.toLowerCase().includes(q))
    );
  }, [customPodiumList, customPodiumSearch]);

  const filteredOfficialForLinking = useMemo(() => {
    if (!officialPlayerSearch.trim()) return podiumPlayers;
    const q = officialPlayerSearch.toLowerCase().trim();
    return podiumPlayers.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.team && p.team.toLowerCase().includes(q))
    );
  }, [podiumPlayers, officialPlayerSearch]);

  const handleMatchScoreChange = (matchId: string, field: 'home' | 'away' | 'status', value: string) => {
    setMatchScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value
      }
    }));
  };

  const updateMatchResult = async (matchId: string) => {
    const ms = matchScores[matchId];
    if (!ms) return;
    
    setIsSaving(true);
    try {
      const mRef = doc(db, 'matches', matchId);
      const targetMatch = matches.find(m => m.id === matchId);
      
      const updateData: any = {
        status: ms.status,
        updatedAt: Date.now()
      };
      
      if (ms.status === 'in_progress' || ms.status === 'finished') {
        const hVal = ms.home === '' || isNaN(parseInt(ms.home, 10)) ? 0 : Math.max(0, parseInt(ms.home, 10));
        const aVal = ms.away === '' || isNaN(parseInt(ms.away, 10)) ? 0 : Math.max(0, parseInt(ms.away, 10));
        updateData.homeScore = hVal;
        updateData.awayScore = aVal;
        setMatchScores(prev => ({
          ...prev,
          [matchId]: { ...prev[matchId], home: String(hVal), away: String(aVal) }
        }));
      } else if (ms.home !== '' || ms.away !== '') {
        const hVal = ms.home === '' || isNaN(parseInt(ms.home, 10)) ? 0 : Math.max(0, parseInt(ms.home, 10));
        const aVal = ms.away === '' || isNaN(parseInt(ms.away, 10)) ? 0 : Math.max(0, parseInt(ms.away, 10));
        updateData.homeScore = hVal;
        updateData.awayScore = aVal;
        setMatchScores(prev => ({
          ...prev,
          [matchId]: { ...prev[matchId], home: String(hVal), away: String(aVal) }
        }));
      } else {
        updateData.homeScore = null;
        updateData.awayScore = null;
      }

      // If set to 'pending' (Por Jugar), ensure the date is in the future so predictions are open
      if (ms.status === 'pending') {
        const currentDate = targetMatch?.date ? new Date(targetMatch.date).getTime() : 0;
        if (currentDate <= Date.now() + 30 * 60 * 1000) {
          updateData.date = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        }
      } else if (ms.status === 'in_progress') {
        // If set to 'in_progress' (En Juego), ensure the match date looks started
        const currentDate = targetMatch?.date ? new Date(targetMatch.date).getTime() : 0;
        if (currentDate > Date.now()) {
          updateData.date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        }
      }
      
      await updateDoc(mRef, updateData);

      // Re-evaluate predictions if finished
      if (ms.status === 'finished') {
        const finalH = updateData.homeScore ?? 0;
        const finalA = updateData.awayScore ?? 0;
        await syncMatchPredictionsAndPoints(matchId, finalH, finalA, settings);
        await recalculateStandings();
      }

      setFeedback({ type: 'success', text: 'Resultado del partido actualizado correctamente.' });
    } catch(e) {
      console.error(e);
      setFeedback({ type: 'error', text: 'Error guardando partido' });
    }
    setIsSaving(false);
  };

  const handleOpenScoreModal = (m: Match) => {
    setEditingMatch(m);
    const ms = matchScores[m.id];
    const hVal = ms?.home !== '' && ms?.home !== undefined && !isNaN(parseInt(ms.home, 10)) ? parseInt(ms.home, 10) : (m.homeScore ?? 0);
    const aVal = ms?.away !== '' && ms?.away !== undefined && !isNaN(parseInt(ms.away, 10)) ? parseInt(ms.away, 10) : (m.awayScore ?? 0);
    setModalHomeScore(hVal);
    setModalAwayScore(aVal);
    setModalStatus((ms?.status || m.status || 'pending') as any);
    vibrateTap();
  };

  const handleSaveScoreModal = async () => {
    if (!editingMatch) return;
    setIsSavingScoreModal(true);
    try {
      const matchId = editingMatch.id;
      const mRef = doc(db, 'matches', matchId);

      const updateData: any = {
        status: modalStatus,
        updatedAt: Date.now(),
        is_synced: modalStatus === 'finished'
      };

      if (modalStatus === 'in_progress' || modalStatus === 'finished') {
        updateData.homeScore = modalHomeScore;
        updateData.awayScore = modalAwayScore;
      } else {
        updateData.homeScore = null;
        updateData.awayScore = null;
      }

      await updateDoc(mRef, updateData);

      // Update local state in matchScores
      setMatchScores(prev => ({
        ...prev,
        [matchId]: {
          home: modalStatus !== 'pending' ? String(modalHomeScore) : '',
          away: modalStatus !== 'pending' ? String(modalAwayScore) : '',
          status: modalStatus
        }
      }));

      // Re-evaluate predictions if finished
      if (modalStatus === 'finished') {
        await syncMatchPredictionsAndPoints(matchId, modalHomeScore, modalAwayScore, settings);
        await recalculateStandings();
      }

      vibrateSuccess();
      setFeedback({ 
        type: 'success', 
        text: `Marcador de ${editingMatch.homeTeam} vs ${editingMatch.awayTeam} actualizado (${modalStatus === 'finished' ? 'Finalizado' : modalStatus === 'in_progress' ? 'En Juego' : 'Por Jugar'}).` 
      });
      setEditingMatch(null);
    } catch (e: any) {
      console.error(e);
      vibrateError();
      setFeedback({ type: 'error', text: 'Error al guardar resultado: ' + e.message });
    }
    setIsSavingScoreModal(false);
  };

  const handleRecalculateStandings = async () => {
    setIsRecalculatingStandings(true);
    vibrateTap();
    setFeedback({ type: 'info', text: 'Calculando puntos, goles y posiciones para los 36 equipos...' });
    try {
      const res = await recalculateStandings();
      if (res.success) {
        vibrateSuccess();
        if (res.processedMatches === 0) {
          setFeedback({ 
            type: 'info', 
            text: `Tabla UCL recalculada: No se encontraron partidos con estado 'Finalizado' y marcador numérico válido (0 computados). Todos los equipos se restablecieron a 0 puntos.` 
          });
        } else {
          setFeedback({ 
            type: 'success', 
            text: `¡Tabla UCL recalculada con éxito! Se procesaron ${res.processedMatches} partidos finalizados con sus puntos y diferencia de goles para los 36 equipos.` 
          });
        }
      } else {
        vibrateError();
        console.error("[AdminTab] Fallo en recalculateStandings:", res.error);
        setFeedback({ type: 'error', text: `Error al recalcular la tabla: ${res.error || 'Fallo desconocido'}` });
      }
    } catch (err: any) {
      vibrateError();
      console.error("[AdminTab] Excepción al recalcular tabla:", err);
      setFeedback({ type: 'error', text: `Error inesperado: ${err.message}` });
    }
    setIsRecalculatingStandings(false);
  };

  const handleRecalculateRanking = async () => {
    setIsRecalculatingRanking(true);
    setShowConfirmRecalculateRanking(false);
    vibrateTap();
    setFeedback({ type: 'info', text: 'Recalculando puntos, plenos y 15 medallas oficiales desde cero en la base de datos (Cero SerpAPI)...' });
    try {
      const res = await recalculateAllUsersFromDatabase(settings);
      if (res.success) {
        vibrateSuccess();
        setFeedback({
          type: 'success',
          text: `¡Recálculo exitoso! Se auditaron ${res.auditedPredictionsCount} pronósticos (${res.correctedPredictionsCount} corregidos), se recalcularon ${res.updatedUsersCount} usuarios y se actualizaron las 15 medallas sobre ${res.totalMatchesCount} partidos finalizados. Tabla UCL sincronizada.`
        });
      }
    } catch (err: any) {
      vibrateError();
      console.error("[AdminTab] Error en recálculo de ranking:", err);
      setFeedback({
        type: 'error',
        text: `Error al recalcular ranking: ${err.message || 'Error desconocido'}`
      });
    } finally {
      setIsRecalculatingRanking(false);
    }
  };

  const handleSyncGeminiDaily = async () => {
    setIsSyncingGemini(true);
    vibrateTap();
    setFeedback({ type: 'info', text: 'Consultando marcadores y resultados con Gemini IA...' });
    try {
      const res = await fetchGeminiMatchesPreview(undefined, geminiApiKeyInput);
      if (res.success) {
        vibrateSuccess();
        setGeminiPreviewData(res);
        setFeedback(null);
      } else {
        vibrateError();
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: 'Error en sincronización Gemini: ' + err.message });
    }
    setIsSyncingGemini(false);
  };

  const handleConfirmCommitGemini = async () => {
    if (!geminiPreviewData) return;
    setIsCommittingGemini(true);
    vibrateTap();
    try {
      const res = await commitGeminiMatchesToFirestore(geminiPreviewData.partidos, settings);
      if (res.success) {
        vibrateSuccess();
        setFeedback({ type: 'success', text: res.message });
        setGeminiPreviewData(null);
      } else {
        vibrateError();
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: 'Error al guardar en Firestore: ' + err.message });
    }
    setIsCommittingGemini(false);
  };

  const handleSaveGeminiKey = () => {
    if (!geminiApiKeyInput.trim()) return;
    setGeminiApiKey(geminiApiKeyInput.trim());
    setGeminiKeySaved(true);
    vibrateSuccess();
    setTimeout(() => setGeminiKeySaved(false), 2500);
  };

  const handleSaveSerpApiKey = () => {
    if (!serpApiKeyInput.trim()) return;
    setSerpApiKey(serpApiKeyInput.trim());
    setSerpKeySaved(true);
    vibrateSuccess();
    setTimeout(() => setSerpKeySaved(false), 2500);
  };

  const handleRunMockTestCaseRealMadridVsInter = () => {
    vibrateTap();
    const mockPreview = getMockRealMadridVsInterPreview(matches);
    setGeminiPreviewData(mockPreview as any);
    vibrateSuccess();
    setFeedback({
      type: 'info',
      text: 'Caso de Prueba cargado en el Modal: Real Madrid 2 - 1 Inter. Revisa marcadores, goleadores y minutos.'
    });
  };

  const handleSyncSerpApiDailyMatches = async () => {
    setIsSyncingSerpApiMatches(true);
    vibrateTap();
    setFeedback({ type: 'info', text: 'Buscando partidos en vivo/hoy en Google vía SerpAPI...' });

    try {
      const now = Date.now();
      const localD = new Date();
      const localYear = localD.getFullYear();
      const localMonth = String(localD.getMonth() + 1).padStart(2, '0');
      const localDay = String(localD.getDate()).padStart(2, '0');
      const localTodayPrefix = `${localYear}-${localMonth}-${localDay}`;

      const candidateMatches = matches.filter(m => {
        if (m.status === 'in_progress') return true;
        const matchTime = new Date(m.date).getTime();
        // REGLA: Prohibido buscar automáticamente partidos que aún no han comenzado
        if (now < matchTime) return false;
        
        // Verificar fecha local
        const matchLocalStr = new Date(m.date).toLocaleDateString('en-CA'); // YYYY-MM-DD local
        return matchLocalStr === localTodayPrefix;
      });

      if (candidateMatches.length === 0) {
        setFeedback({ type: 'info', text: 'No hay partidos que hayan iniciado el día de hoy. Si deseas sincronizar una fecha previa o forzada, usa la Sincronización de Contingencia por Jornada.' });
        setIsSyncingSerpApiMatches(false);
        return;
      }

      // 1. Recopilar la data cruda de SerpAPI en paralelo con un desfase prudente
      const queriesRun: string[] = [];
      const serpResults = await Promise.allSettled(
        candidateMatches.map(async (m, idx) => {
          if (idx > 0) {
            await new Promise(r => setTimeout(r, idx * 300));
          }
          const query = `${m.homeTeam} vs ${m.awayTeam} hoy`;
          queriesRun.push(query);
          const rawNode = await fetchSerpApiRaw(query, serpApiKeyInput);
          return {
            matchId: m.id,
            local: m.homeTeam,
            visitante: m.awayTeam,
            targetMilestone: 90,
            rawSportsResults: rawNode,
            match: m
          };
        })
      );

      const successfulBatchData: Array<BatchMatchInput & { match: Match }> = [];
      serpResults.forEach(res => {
        if (res.status === 'fulfilled') {
          successfulBatchData.push(res.value);
        }
      });

      if (successfulBatchData.length === 0) {
        setFeedback({ type: 'error', text: 'No se pudieron extraer datos válidos desde SerpAPI para los partidos de hoy.' });
        setIsSyncingSerpApiMatches(false);
        return;
      }

      // 2. UN SOLO FETCH A GEMINI para estructurar todo el lote
      setFeedback({ type: 'info', text: `Estructurando lote de ${successfulBatchData.length} partidos con 1 sola llamada a Gemini API...` });
      const geminiResultsMap = await parseMultipleMatchesWithGemini(successfulBatchData, geminiApiKeyInput);

      const resultsList: GeminiPartidoPreview[] = [];
      successfulBatchData.forEach(item => {
        const parsed = geminiResultsMap[item.matchId];
        if (parsed) {
          const newStatus = mapGeminiEstadoToStatus(parsed.estado);
          const changed = item.match.status !== newStatus ||
            item.match.homeScore !== parsed.goles_local ||
            item.match.awayScore !== parsed.goles_visitante;

          resultsList.push({
            local: parsed.local,
            goles_local: parsed.goles_local,
            visitante: parsed.visitante,
            goles_visitante: parsed.goles_visitante,
            estado: parsed.estado,
            goleadores: parsed.goleadores as any,
            tarjetas: parsed.tarjetas as any,
            matchedMatchId: item.match.id,
            matchedMatch: item.match,
            hasChanges: changed
          });
        }
      });

      if (resultsList.length === 0) {
        setFeedback({ type: 'error', text: 'No se pudieron estructurar partidos con Gemini.' });
        setIsSyncingSerpApiMatches(false);
        return;
      }

      vibrateSuccess();
      setGeminiPreviewData({
        success: true,
        message: `Se consultaron ${resultsList.length} partido(s) mediante SerpAPI y se estructuraron con 1 sola llamada a Gemini.`,
        partidos: resultsList,
        rawJson: JSON.stringify({ partidos: resultsList }, null, 2),
        totalQueried: candidateMatches.length,
        searchQueries: queriesRun,
        isGrounded: true,
        searchSummary: `Datos extraídos en vivo de SerpAPI (sports_results) y parseados en lote con 1 sola llamada a Gemini API.`
      });
      setFeedback(null);
    } catch (err: any) {
      vibrateError();
      console.error("[handleSyncSerpApiDailyMatches] Error:", err);
      if (isGeminiRateLimit(err)) {
        setFeedback({ type: 'warning', text: 'Límite de la IA alcanzado. Reintentando en el próximo ciclo.' });
      } else {
        setFeedback({ type: 'error', text: 'Error al sincronizar con SerpAPI: ' + err.message });
      }
    }
    setIsSyncingSerpApiMatches(false);
  };

  const handleSyncSerpApiStandings = async () => {
    setIsSyncingSerpApiStandings(true);
    vibrateTap();
    setFeedback({ type: 'info', text: 'Consultando tabla de posiciones en Google vía SerpAPI...' });

    try {
      const query = "tabla posiciones champions league";
      const rawNode = await fetchSerpApiRaw(query, serpApiKeyInput);
      const tabla = await parseStandingsWithGemini(rawNode, geminiApiKeyInput);

      if (!tabla || tabla.length === 0) {
        setFeedback({ type: 'error', text: 'No se detectaron posiciones válidas en la respuesta de SerpAPI.' });
        setIsSyncingSerpApiStandings(false);
        return;
      }

      vibrateSuccess();
      setSerpStandingsPreview(tabla);
      setSerpStandingsRawJson(JSON.stringify(tabla, null, 2));
      setFeedback(null);
    } catch (err: any) {
      vibrateError();
      console.error("[handleSyncSerpApiStandings] Error:", err);
      setFeedback({ type: 'error', text: 'Error al consultar tabla en SerpAPI: ' + err.message });
    }
    setIsSyncingSerpApiStandings(false);
  };

  const handleConfirmCommitStandings = async () => {
    if (!serpStandingsPreview || serpStandingsPreview.length === 0) return;
    setIsCommittingStandings(true);
    vibrateTap();
    try {
      const res = await commitSerpApiStandingsToFirestore(serpStandingsPreview);
      if (res.success) {
        vibrateSuccess();
        setFeedback({ type: 'success', text: res.message });
        setSerpStandingsPreview(null);
      } else {
        vibrateError();
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: 'Error al guardar tabla en Firestore: ' + err.message });
    }
    setIsCommittingStandings(false);
  };

  const handleRunAutoSyncNow = async () => {
    setIsAutoSyncing(true);
    vibrateTap();
    setFeedback({ type: 'info', text: 'Evaluando partidos activos en sus hitos (+5m, +25m, +47m, +65m, +75m, +90m, +115m) con batching de Gemini...' });
    try {
      const res = await checkAndAutoSyncFinishedMatches(matches, settings);
      vibrateSuccess();
      setFeedback({
        type: 'success',
        text: `Auto-sync completado: ${res.syncedCount} partido(s) sincronizado(s) (${res.liveCount} en vivo, ${res.finishedCount} finalizados) con batching de Gemini y writeBatch${res.errors.length > 0 ? `. Advertencias: ${res.errors.join(', ')}` : '.'}`
      });
    } catch (err: any) {
      vibrateError();
      if (isGeminiRateLimit(err)) {
        setFeedback({ type: 'warning', text: 'Límite de la IA alcanzado. Reintentando en el próximo ciclo.' });
      } else {
        setFeedback({ type: 'error', text: `Error en auto-sync: ${err.message}` });
      }
    } finally {
      setIsAutoSyncing(false);
    }
  };

  const handleSyncJornada = async () => {
    if (!selectedJornadaSync) return;
    setIsSyncingJornada(true);
    setJornadaSyncProgress(null);
    vibrateTap();
    setFeedback({ type: 'info', text: `Iniciando sincronización forzada de ${selectedJornadaSync} con SerpAPI...` });

    try {
      const res = await syncJornadaMatchesWithSerpApi(
        selectedJornadaSync,
        matches,
        settings,
        (current, total, matchName) => {
          setJornadaSyncProgress({ current, total, match: matchName });
        }
      );

      if (res.success) {
        vibrateSuccess();
        setFeedback({
          type: 'success',
          text: res.message
        });
      } else {
        vibrateError();
        setFeedback({
          type: 'error',
          text: `No se pudieron sincronizar partidos: ${res.errors.join(', ')}`
        });
      }
    } catch (err: any) {
      vibrateError();
      if (isGeminiRateLimit(err)) {
        setFeedback({ type: 'warning', text: 'Límite de la IA alcanzado. Reintentando en el próximo ciclo.' });
      } else {
        setFeedback({ type: 'error', text: `Error en sincronización por jornada: ${err.message}` });
      }
    } finally {
      setIsSyncingJornada(false);
      setJornadaSyncProgress(null);
    }
  };

  const toggleUserPaid = async (uid: string, current: boolean) => {
    try { await updateDoc(doc(db, 'users', uid), { paid: !current }); } catch(e) {}
  };
  
  const toggleUserAdmin = async (uid: string, current: boolean) => {
    try { await updateDoc(doc(db, 'users', uid), { isAdmin: !current }); } catch(e) {}
  };

  // Stage Actions
  const handleToggleMatchGroup = (groupName: string) => {
    setSelectedMatchGroups(prev =>
      prev.includes(groupName)
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const handleSelectAllMatchGroups = () => {
    setSelectedMatchGroups([...availableMatchGroups]);
  };

  const handleClearMatchGroups = () => {
    setSelectedMatchGroups([]);
  };

  const handleCreateStage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newStageName.trim()) {
      setFeedback({ type: 'error', text: 'Debes ingresar un nombre para la etapa.' });
      return;
    }
    if (selectedMatchGroups.length === 0) {
      setFeedback({ type: 'error', text: 'Debes seleccionar al menos una jornada o fase para la etapa.' });
      return;
    }
    setIsCreatingStage(true);
    vibrateTap();
    try {
      await createStage(activeGroupId, newStageName, selectedMatchGroups);
      vibrateSuccess();
      setFeedback({ type: 'success', text: `Etapa "${newStageName.trim()}" creada con éxito e iniciada.` });
      setNewStageName('');
      setSelectedMatchGroups([]);
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: 'Error creando etapa: ' + (err.message || 'Error desconocido') });
    } finally {
      setIsCreatingStage(false);
    }
  };

  const handleInitiateCloseStage = (stage: Stage) => {
    const standings = calculateStageStandings(stage, matches, groupPredictions, users);
    setStageStandingsPreview(standings);
    setStageToClose(stage);
    setShowCloseModal(true);
    vibrateTap();
  };

  const handleConfirmCloseStage = async () => {
    if (!stageToClose) return;
    setIsClosingStage(true);
    vibrateTap();
    try {
      const { winners } = await closeStage(
        stageToClose.id,
        stageToClose,
        matches,
        groupPredictions,
        users,
        user?.uid
      );
      vibrateSuccess();
      setFeedback({
        type: 'success',
        text: `¡Etapa "${stageToClose.name}" terminada y cerrada con éxito! Se registraron ${winners.length} participantes en el podio histórico.`
      });
      setShowCloseModal(false);
      setStageToClose(null);
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: 'Error al cerrar etapa: ' + (err.message || 'Error desconocido') });
    } finally {
      setIsClosingStage(false);
    }
  };

  const handleReopenStage = async (stage: Stage) => {
    if (!window.confirm(`¿Reabrir la etapa "${stage.name}"? Volverá a estar activa y se actualizarán sus resultados en vivo.`)) return;
    vibrateTap();
    try {
      await reopenStage(stage.id);
      vibrateSuccess();
      setFeedback({ type: 'success', text: `Etapa "${stage.name}" reabierta como activa.` });
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: 'Error al reabrir etapa: ' + (err.message || 'Error desconocido') });
    }
  };

  const handleRecalculateStage = async (stage: Stage) => {
    vibrateTap();
    try {
      await recalculateClosedStage(stage.id, stage, matches, groupPredictions, users);
      vibrateSuccess();
      setFeedback({ type: 'success', text: `Ganadores de la etapa "${stage.name}" recalculados con éxito.` });
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: 'Error recalculando etapa: ' + (err.message || 'Error desconocido') });
    }
  };

  const handleDeleteStage = async (stage: Stage) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la etapa "${stage.name}"? Esta acción no se puede deshacer.`)) return;
    vibrateTap();
    try {
      await deleteStage(stage.id);
      vibrateSuccess();
      setFeedback({ type: 'success', text: `Etapa "${stage.name}" eliminada correctamente.` });
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: 'Error al eliminar etapa: ' + (err.message || 'Error desconocido') });
    }
  };


  const isTestMatch = (m: Match) => {
    if (!m.id?.startsWith('ucl_26_')) return true;
    if (m.group === 'Ejemplos Demo' || !m.group) return true;
    if ((m as any).isTest) return true;
    return false;
  };

  const handleDeleteTestMatches = async () => {
    setIsDeletingTests(true);
    setShowConfirmDelete(false);
    setFeedback(null);
    try {
      const snap = await getDocs(collection(db, 'matches'));
      const testMatchIds = new Set<string>();
      const deletePromises: Promise<any>[] = [];

      snap.docs.forEach(d => {
        const data = d.data();
        if (!d.id.startsWith('ucl_26_') || data.group === 'Ejemplos Demo' || !data.group || data.isTest) {
          testMatchIds.add(d.id);
          deletePromises.push(deleteDoc(d.ref));
        }
      });

      await Promise.all(deletePromises);

      // Also clean up predictions for those test matches or any ucl_demo_
      const predSnap = await getDocs(collection(db, 'predictions'));
      const predDeletes: Promise<any>[] = [];
      predSnap.docs.forEach(p => {
        const pData = p.data();
        if (testMatchIds.has(pData.matchId) || pData.matchId?.startsWith('ucl_demo_') || !pData.matchId?.startsWith('ucl_26_')) {
          predDeletes.push(deleteDoc(p.ref));
        }
      });

      if (predDeletes.length > 0) {
        await Promise.all(predDeletes);
      }

      if (deletePromises.length > 0) {
        setFeedback({
          type: 'success',
          text: `Se eliminaron con éxito ${deletePromises.length} partido(s) de prueba y ${predDeletes.length} pronóstico(s) de prueba. La aplicación queda con los 144 partidos oficiales de Champions League 100% operativos.`
        });
      } else {
        setFeedback({
          type: 'info',
          text: 'No se encontraron partidos de prueba en la base de datos. Los 144 partidos oficiales de Champions League ya están 100% limpios y operativos.'
        });
      }
    } catch (e: any) {
      console.error(e);
      setFeedback({
        type: 'error',
        text: `Error al eliminar partidos de prueba: ${e?.message || 'Error desconocido'}`
      });
    } finally {
      setIsDeletingTests(false);
    }
  };

  const handleRestoreOfficialMatches = async () => {
    setIsRestoringOfficial(true);
    setFeedback(null);
    try {
      const snap = await getDocs(collection(db, 'matches'));
      const existingIds = new Set(snap.docs.map(d => d.id));
      
      let addedCount = 0;
      const missingMatches = UCL_LEAGUE_PHASE_MATCHES.filter(m => !existingIds.has(m.id));

      if (missingMatches.length === 0) {
        setFeedback({
          type: 'info',
          text: `Los 144 partidos oficiales de Champions League ya están registrados y verificados en la base de datos.`
        });
      } else {
        for (let i = 0; i < missingMatches.length; i += 300) {
          const chunk = missingMatches.slice(i, i + 300);
          const batch = writeBatch(db);
          chunk.forEach(m => {
            const matchRef = doc(db, 'matches', m.id);
            batch.set(matchRef, {
              group: m.group,
              date: m.date,
              homeTeam: m.homeTeam,
              awayTeam: m.awayTeam,
              homeFlag: `https://img.sofascore.com/api/v1/team/${m.homeId}/image`,
              awayFlag: `https://img.sofascore.com/api/v1/team/${m.awayId}/image`,
              status: 'pending',
              homeScore: null,
              awayScore: null,
              apiId: m.apiId || m.id
            });
            addedCount++;
          });
          await batch.commit();
        }
        setFeedback({
          type: 'success',
          text: `Se verificaron y restauraron ${addedCount} partidos oficiales faltantes.`
        });
      }
    } catch (e: any) {
      console.error(e);
      setFeedback({
        type: 'error',
        text: `Error verificando partidos: ${e?.message || 'Error desconocido'}`
      });
    } finally {
      setIsRestoringOfficial(false);
    }
  };

  const handleGenerateTestMatches = async () => {
    setIsGeneratingTests(true);
    setFeedback(null);
    try {
      const now = new Date();
      const DAY_MS = 24 * 60 * 60 * 1000;
      
      const newMatches = [
        {
          group: 'Ejemplos Demo',
          homeTeam: 'Real Madrid',
          awayTeam: 'Liverpool',
          date: new Date(now.getTime() - DAY_MS).toISOString(), // Yesterday - Finished
          status: 'finished',
          homeScore: 3,
          awayScore: 1,
          isTest: true,
          createdAt: now.getTime()
        },
        {
          group: 'Ejemplos Demo',
          homeTeam: 'Manchester City',
          awayTeam: 'Arsenal',
          date: new Date(now.getTime() + (2 * 60 * 60 * 1000)).toISOString(), // In 2 hours - Por Jugar
          status: 'pending',
          homeScore: null,
          awayScore: null,
          isTest: true,
          createdAt: now.getTime()
        },
        {
          group: 'Ejemplos Demo',
          homeTeam: 'Bayern Munich',
          awayTeam: 'Dortmund',
          date: new Date(now.getTime() - (15 * 60 * 1000)).toISOString(), // Started 15 min ago - En Juego
          status: 'in_progress',
          homeScore: 1,
          awayScore: 0,
          isTest: true,
          createdAt: now.getTime()
        },
        {
          group: 'Ejemplos Demo',
          homeTeam: 'PSG',
          awayTeam: 'Inter Milan',
          date: new Date(now.getTime() + DAY_MS).toISOString(), // Tomorrow - Por Jugar
          status: 'pending',
          homeScore: null,
          awayScore: null,
          isTest: true,
          createdAt: now.getTime()
        }
      ];

      for (const m of newMatches) {
        await addDoc(collection(db, 'matches'), m);
      }
      setFeedback({
        type: 'success',
        text: 'Se generaron 4 partidos de prueba bajo la etiqueta "Ejemplos Demo".'
      });
    } catch(e: any) {
      console.error(e);
      setFeedback({
        type: 'error',
        text: `Error al generar ejemplos: ${e?.message || 'Error desconocido'}`
      });
    } finally {
      setIsGeneratingTests(false);
    }
  };

  const handleSavePlayers = async (updatedList: PlayerItem[], message: string) => {
    setIsSavingPlayers(true);
    // Sanitizar completamente para evitar cualquier valor undefined que rechace Firestore
    const cleanedList = updatedList.map(cleanPlayerForStorage);
    // Actualización optimista inmediata en memoria para que la interfaz reaccione al instante
    setPodiumPlayers(cleanedList);
    try {
      // Usar deletedPlayerKeys sincronizado en tiempo real (evita un getDoc innecesario a Firestore)
      const existingDeleted = Array.from(deletedPlayerKeys);
      const updatedKeys = new Set(cleanedList.map(p => normalizePlayerKey(p.name)));
      const filteredDeleted = existingDeleted.filter(k => !updatedKeys.has(k));
      const payload = sanitizeForFirestore({
        players: cleanedList,
        deletedKeys: filteredDeleted,
        updatedAt: Date.now(),
        updatedBy: user?.email || 'admin'
      });
      await setDoc(doc(db, 'system', 'players'), payload);
      setFeedback({ type: 'success', text: message });
      vibrateSuccess();
    } catch (e: any) {
      console.error("Error al guardar jugadores en Firestore:", e);
      setFeedback({ type: 'error', text: `Error al guardar jugadores: ${e?.message || 'Error desconocido'}` });
      vibrateError();
    } finally {
      setIsSavingPlayers(false);
    }
  };

  const handleAddSinglePlayer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPlayerName.trim()) return;
    const incoming: PlayerItem = {
      name: newPlayerName.trim(),
      team: newPlayerTeam.trim() || undefined,
      position: formatPosition(newPlayerPosition.trim()) || undefined,
      nationality: formatNationality(newPlayerNationality.trim()) || undefined,
      imageUrl: newPlayerImage.trim() || undefined,
      image: newPlayerImage.trim() || undefined,
      id: Math.floor(100000 + Math.random() * 900000)
    };
    const { merged, addedCount } = deduplicatePlayers(podiumPlayers, [incoming]);
    const addedKey = normalizePlayerKey(incoming.name);
    setDeletedPlayerKeys(prev => {
      const next = new Set(prev);
      next.delete(addedKey);
      return next;
    });
    await handleSavePlayers(
      merged, 
      addedCount > 0 
        ? `Jugador "${incoming.name}" agregado con éxito.` 
        : `Jugador "${incoming.name}" ya existía y fue actualizado sin duplicar.`
    );
    setNewPlayerName('');
    setNewPlayerTeam('');
    setNewPlayerPosition('');
    setNewPlayerNationality('');
    setNewPlayerImage('');
  };

  const handleDeletePlayer = async (player: PlayerItem) => {
    if (!window.confirm(`¿Estás seguro de eliminar definitivamente a "${player.name}" del catálogo oficial?`)) return;
    const keyToDelete = normalizePlayerKey(player.name);
    const updated = podiumPlayers.filter(p => normalizePlayerKey(p.name) !== keyToDelete).map(cleanPlayerForStorage);
    setIsSavingPlayers(true);
    setPodiumPlayers(updated);
    setDeletedPlayerKeys(prev => new Set([...prev, keyToDelete]));
    try {
      const existingDeleted = Array.from(deletedPlayerKeys);
      const newDeleted = Array.from(new Set([...existingDeleted, keyToDelete]));
      const payload = sanitizeForFirestore({
        players: updated,
        deletedKeys: newDeleted,
        updatedAt: Date.now(),
        updatedBy: user?.email || 'admin'
      });
      await setDoc(doc(db, 'system', 'players'), payload);
      setFeedback({ type: 'success', text: `Jugador "${player.name}" eliminado definitivamente del catálogo.` });
      vibrateSuccess();
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', text: `Error al eliminar jugador: ${e?.message || 'Error desconocido'}` });
      vibrateError();
    } finally {
      setIsSavingPlayers(false);
    }
  };

  const handleImportAllMatchPlayersToCatalog = async () => {
    if (matchPlayersNotInCatalog.length === 0) return;
    setIsSavingPlayers(true);
    try {
      const newItems: PlayerItem[] = matchPlayersNotInCatalog.map(p => ({
        id: Math.floor(100000 + Math.random() * 900000),
        name: p.name,
        team: findUclTeam(p.team)?.name || getCanonicalTeamName(p.team) || p.team,
        position: p.type === 'Asistidor' ? 'Centrocampista' : 'Delantero'
      }));
      const { merged, addedCount } = deduplicatePlayers(podiumPlayers, newItems);
      setPodiumPlayers(merged);
      await handleSavePlayers(merged, `¡Listo! Se unificaron ${addedCount} jugadores de partidos al Catálogo Oficial.`);
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Error al unificar jugadores: ${err?.message || 'Error desconocido'}` });
    } finally {
      setIsSavingPlayers(false);
    }
  };

  const handleAddPlayerFromMatchToCatalog = async (name: string, team: string, type: 'Goleador' | 'Asistidor') => {
    setIsSavingPlayers(true);
    try {
      const canonical = findUclTeam(team)?.name || getCanonicalTeamName(team) || team;
      const incoming: PlayerItem = {
        name: name.trim(),
        team: canonical || undefined,
        position: type === 'Asistidor' ? 'Centrocampista' : 'Delantero',
        id: Math.floor(100000 + Math.random() * 900000)
      };
      const { merged } = deduplicatePlayers(podiumPlayers, [incoming]);
      setPodiumPlayers(merged);
      await handleSavePlayers(merged, `Jugador "${name}" agregado al Catálogo Oficial.`);
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Error al agregar jugador: ${err?.message || 'Error desconocido'}` });
    } finally {
      setIsSavingPlayers(false);
    }
  };

  const handleApplyJsonUpdate = async () => {
    if (updateJsonAnalysis.newPlayers.length === 0 && updateJsonAnalysis.clubUpdates.length === 0) {
      setUpdateJsonFeedback('No hay cambios nuevos para aplicar: todos los jugadores analizados ya están registrados con club oficial.');
      return;
    }
    setIsApplyingJsonUpdate(true);
    setUpdateJsonFeedback(null);
    try {
      // 1. Clonar catálogo actual
      let updatedList = [...podiumPlayers];

      // 2. Aplicar actualizaciones de club a jugadores existentes
      if (updateJsonAnalysis.clubUpdates.length > 0) {
        const updateMap = new Map(updateJsonAnalysis.clubUpdates.map(u => [
          normalizePlayerKey(u.catalogPlayer.name),
          u.newTeam
        ]));
        updatedList = updatedList.map(p => {
          const k = normalizePlayerKey(p.name);
          if (updateMap.has(k)) {
            return { ...p, team: updateMap.get(k) };
          }
          return p;
        });
      }

      // 3. Crear los nuevos jugadores
      const newItems: PlayerItem[] = updateJsonAnalysis.newPlayers.map(p => ({
        id: Math.floor(100000 + Math.random() * 900000),
        name: p.name,
        team: p.team || undefined,
        position: p.position
      }));

      // 4. Fusionar sin duplicados con deduplicatePlayers
      const { merged, addedCount } = deduplicatePlayers(updatedList, newItems);

      // 5. Guardar en Firestore
      await handleSavePlayers(
        merged,
        `¡Actualización con JSON exitosa! Se añadieron ${addedCount} jugadores nuevos y se actualizaron ${updateJsonAnalysis.clubUpdates.length} clubes oficiales (0 duplicados creados).`
      );

      setUpdateJsonModalOpen(false);
      setUpdateJsonPastedText('');
    } catch (e: any) {
      console.error(e);
      setUpdateJsonFeedback(`Error al aplicar actualización: ${e?.message || 'Error desconocido'}`);
    } finally {
      setIsApplyingJsonUpdate(false);
    }
  };

  // Copia rápida al portapapeles de todo el catálogo para entregar a una IA
  const handleQuickCopyPlayersJson = async () => {
    vibrateTap();
    try {
      const exportData = podiumPlayers.map(p => {
        const cleanNat = p.nationality
          ? p.nationality.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '').trim()
          : '';
        const item: Record<string, any> = {
          name: p.name,
          team: p.team || '',
          position: p.position || '',
          nationality: cleanNat
        };
        const photo = p.imageUrl || p.image || p.photo;
        if (photo && photo.trim()) item.photo = photo.trim();
        return item;
      });

      const jsonStr = JSON.stringify(exportData, null, 2);
      const ok = await copyTextToClipboard(jsonStr);

      if (ok) {
        vibrateSuccess();
        setCopiedQuickJson(true);
        setTimeout(() => setCopiedQuickJson(false), 2500);
        setFeedback({
          type: 'success',
          text: `¡Listo! Se copió al portapapeles el JSON de ${podiumPlayers.length} jugadores. Ya puedes pegarlo en ChatGPT, Claude o Gemini.`
        });
      } else {
        vibrateError();
        setFeedback({
          type: 'error',
          text: 'No se pudo acceder automáticamente al portapapeles. Abre el "Asistente IA" para copiarlo manualmente.'
        });
      }
    } catch (err: any) {
      console.error("[handleQuickCopyPlayersJson] Error:", err);
      vibrateError();
      setFeedback({
        type: 'error',
        text: `Error al copiar JSON: ${err?.message || 'Error desconocido'}`
      });
    }
  };

  const handleImportJson = async () => {
    if (!jsonInput.trim()) return;
    try {
      // Limpiar posibles bloques markdown de código ```json ... ```
      let cleaned = jsonInput.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '');
      cleaned = cleaned.replace(/^```\s*/i, '');
      cleaned = cleaned.replace(/\s*```$/i, '');
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      let incomingList: PlayerItem[] = [];
      if (Array.isArray(parsed)) {
        incomingList = parsed;
      } else if (Array.isArray(parsed.top_players)) {
        incomingList = parsed.top_players;
      } else if (Array.isArray(parsed.players)) {
        incomingList = parsed.players;
      } else {
        throw new Error('El JSON debe contener una lista o la propiedad "top_players" / "players".');
      }

      if (incomingList.length === 0) {
        throw new Error('No se encontraron jugadores en el JSON.');
      }

      const { merged, addedCount, updatedCount } = deduplicatePlayers(podiumPlayers, incomingList);
      await handleSavePlayers(
        merged, 
        `¡Fusión exitosa! Se añadieron ${addedCount} nuevos jugadores y se actualizaron ${updatedCount} existentes (0 duplicados). Total en lista: ${merged.length}`
      );
      setJsonInput('');
      setShowJsonInput(false);
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', text: `Error al procesar JSON: ${e?.message || 'Formato JSON inválido'}` });
    }
  };

  const handleResetToDefaultPlayers = async () => {
    if (!window.confirm(`¿Deseas restaurar la lista oficial 2026/27 predeterminada (${DEFAULT_PLAYERS.length} jugadores estrella de Champions)? Esto reemplazará la lista en Firestore.`)) return;
    setIsResettingPlayers(true);
    try {
      const payload = sanitizeForFirestore({
        players: DEFAULT_PLAYERS.map(cleanPlayerForStorage),
        deletedKeys: [],
        updatedAt: Date.now(),
        updatedBy: user?.email || 'admin'
      });
      await setDoc(doc(db, 'system', 'players'), payload);
      setFeedback({ type: 'success', text: `Lista oficial 2026/27 restaurada con éxito (${DEFAULT_PLAYERS.length} jugadores).` });
    } catch (e: any) {
      setFeedback({ type: 'error', text: `Error al restaurar lista: ${e?.message || 'Error desconocido'}` });
    } finally {
      setIsResettingPlayers(false);
    }
  };

  const [isNormalizingCatalogClubs, setIsNormalizingCatalogClubs] = useState(false);

  // Asignar rápidamente un club a un jugador específico
  const handleQuickLinkPlayerToTeam = async (player: PlayerItem, targetTeam: string) => {
    const canonical = findUclTeam(targetTeam)?.name || getCanonicalTeamName(targetTeam) || targetTeam;
    const keyToUpdate = normalizePlayerKey(player.name);
    const updated = podiumPlayers.map(p => {
      if (p.id === player.id || normalizePlayerKey(p.name) === keyToUpdate) {
        return { ...p, team: canonical };
      }
      return p;
    });
    await handleSavePlayers(updated, `Jugador "${player.name}" vinculado con éxito a "${canonical}".`);
  };

  // Auto-vincular clubes del catálogo oficial que tengan alias ortográficos o evidencia en partidos (goles, asistencias, cambios, etc.)
  const handleAutoNormalizeCatalogClubs = async () => {
    setIsNormalizingCatalogClubs(true);
    try {
      let changedCount = 0;
      const changedDetails: string[] = [];

      const updated = podiumPlayers.map(p => {
        // 1. Si coincide con un alias directo del mismo club oficial
        if (p.team) {
          const uclMatch = findUclTeam(p.team);
          if (uclMatch && uclMatch.name !== p.team) {
            changedCount++;
            changedDetails.push(`${p.name} ➡️ ${uclMatch.name}`);
            return { ...p, team: uclMatch.name };
          }
        }

        // 2. Si no tiene club oficial UCL pero tiene evidencia en partidos (goles, cambios, asistencias...)
        const isOfficial = !!p.team && UCL_36_TEAMS.some(t => t.name === p.team);
        if (!isOfficial) {
          const key = p.id ? String(p.id) : normalizePlayerKey(p.name);
          const evidence = catalogPlayerMatchEvidenceMap.get(key);
          if (evidence && evidence.canonicalTeam && UCL_36_TEAMS.some(t => t.name === evidence.canonicalTeam)) {
            changedCount++;
            changedDetails.push(`${p.name} ➡️ ${evidence.canonicalTeam}`);
            return { ...p, team: evidence.canonicalTeam };
          }
        }

        return p;
      });

      if (changedCount === 0) {
        setFeedback({ type: 'info', text: 'Todos los clubes con alias o registros en partidos ya están vinculados.' });
        return;
      }

      const summaryMsg = changedDetails.length <= 2
        ? `Se vincularon: ${changedDetails.join(', ')}`
        : `Se vincularon ${changedCount} jugadores a sus clubes oficiales según partidos y alias.`;

      await handleSavePlayers(updated, `¡Listo! ${summaryMsg}`);
    } catch (err: any) {
      console.error('Error auto-normalizing catalog clubs:', err);
      setFeedback({ type: 'error', text: `Error al auto-vincular clubes: ${err?.message || 'Error desconocido'}` });
    } finally {
      setIsNormalizingCatalogClubs(false);
    }
  };

  // Auto-normalizar clubes de goleadores en todos los partidos de Firestore
  const handleAutoNormalizeMatchClubs = async () => {
    setIsNormalizingMatchClubs(true);
    try {
      let updatedMatchesCount = 0;
      let updatedGoalsCount = 0;

      for (const m of matches) {
        if (!Array.isArray(m.goalscorers) || m.goalscorers.length === 0) continue;

        let matchChanged = false;
        const newGoalscorers = m.goalscorers.map((g: any) => {
          if (!g) return g;
          let playerName = '';
          let teamName = '';

          if (typeof g === 'object') {
            playerName = String(g.jugador || g.player || '').trim();
            teamName = String(g.equipo || g.team || '').trim();
          } else if (typeof g === 'string') {
            const matchStr = g.match(/^(.*?)\s*(\d+)?['’]?\s*(?:\((.*?)\))?$/);
            playerName = matchStr?.[1]?.trim() || g.trim();
            teamName = matchStr?.[3]?.trim() || '';
          }

          if (!playerName) return g;

          // Obtener nombre canónico de club oficial
          const uclFromTeam = findUclTeam(teamName);
          let canonicalTeam = uclFromTeam ? uclFromTeam.name : getCanonicalTeamName(teamName);

          // Si el gol no traía equipo o no se reconoció, buscar en catálogo oficial de jugadores
          if (!canonicalTeam || !UCL_36_TEAMS.some(t => t.name === canonicalTeam)) {
            const found = podiumPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (found && found.team) {
              const uclFromCatalog = findUclTeam(found.team);
              canonicalTeam = uclFromCatalog ? uclFromCatalog.name : getCanonicalTeamName(found.team);
            }
          }

          // Si aún no hay club, intentar inferir de los equipos del partido
          if (!canonicalTeam) {
            canonicalTeam = m.homeTeam;
          }

          if (typeof g === 'object') {
            if (g.equipo !== canonicalTeam) {
              matchChanged = true;
              updatedGoalsCount++;
              return { ...g, equipo: canonicalTeam };
            }
          } else {
            matchChanged = true;
            updatedGoalsCount++;
            return {
              jugador: playerName,
              equipo: canonicalTeam,
              minuto: ''
            };
          }
          return g;
        });

        if (matchChanged) {
          await updateDoc(doc(db, 'matches', m.id), {
            goalscorers: newGoalscorers,
            updatedAt: Date.now()
          });
          updatedMatchesCount++;
        }
      }

      setFeedback({
        type: 'success',
        text: `¡Normalización completada! Se actualizaron ${updatedGoalsCount} goles en ${updatedMatchesCount} partidos con los clubes canónicos de Champions.`
      });
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', text: `Error al normalizar clubes: ${e?.message || 'Error desconocido'}` });
    } finally {
      setIsNormalizingMatchClubs(false);
    }
  };

  // Actualizar el club de un jugador específico en todos los partidos donde participó (goleador o asistidor)
  const handleUpdatePlayerClubAcrossMatches = async (playerName: string, newTeamName: string) => {
    if (!newTeamName) return;
    setIsUpdatingScorerTeam(true);
    try {
      let matchesUpdated = 0;
      const canonical = findUclTeam(newTeamName)?.name || getCanonicalTeamName(newTeamName) || newTeamName;

      for (const m of matches) {
        const hasGoles = Array.isArray((m as any).goles) && (m as any).goles.length > 0;
        const hasGoalscorers = Array.isArray(m.goalscorers) && m.goalscorers.length > 0;
        if (!hasGoles && !hasGoalscorers) continue;

        let matchChanged = false;
        const updateScorerObj = (g: any) => {
          if (!g) return g;
          const pName = typeof g === 'object' ? (g.jugador || g.player || '') : (String(g).replace(/\d+.*$/, '') || String(g));
          const aName = typeof g === 'object' ? (g.asistencia || g.assist || '') : '';
          const isScorer = String(pName).trim().toLowerCase() === playerName.toLowerCase();
          const isAssist = String(aName).trim().toLowerCase() === playerName.toLowerCase();

          if (isScorer || isAssist) {
            matchChanged = true;
            if (typeof g === 'object') {
              return { ...g, equipo: canonical };
            } else {
              return { jugador: String(pName).trim(), equipo: canonical, minuto: '' };
            }
          }
          return g;
        };

        const updatePayload: any = {};
        if (hasGoles) {
          updatePayload.goles = (m as any).goles.map(updateScorerObj);
        }
        if (hasGoalscorers) {
          updatePayload.goalscorers = m.goalscorers.map(updateScorerObj);
        }

        if (matchChanged) {
          updatePayload.updatedAt = Date.now();
          await updateDoc(doc(db, 'matches', m.id), updatePayload);
          matchesUpdated++;
        }
      }

      // También actualizar en el catálogo oficial si el jugador está registrado
      const foundInCatalog = podiumPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
      if (foundInCatalog) {
        const updatedCatalog = podiumPlayers.map(p => 
          p.name.toLowerCase() === playerName.toLowerCase() ? { ...p, team: canonical } : p
        );
        await handleSavePlayers(updatedCatalog, `Club de "${playerName}" actualizado a "${canonical}" en catálogo y ${matchesUpdated} partidos.`);
      } else {
        setFeedback({
          type: 'success',
          text: `Club de "${playerName}" actualizado a "${canonical}" en ${matchesUpdated} partidos.`
        });
      }

      setEditingScorerPlayer(null);
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', text: `Error al actualizar club: ${e?.message || 'Error desconocido'}` });
    } finally {
      setIsUpdatingScorerTeam(false);
    }
  };

  // Guardar jugador manual en el catálogo oficial
  const handleSaveCustomPlayerToCatalog = async () => {
    if (!addingCustomPlayer || !addingCustomPlayer.name.trim()) return;
    const customPlayerCopy = { ...addingCustomPlayer };
    const incomingName = customPlayerCopy.name.trim();
    const incoming: PlayerItem = {
      name: incomingName,
      team: customPlayerCopy.team.trim() || undefined,
      position: formatPosition(customPlayerCopy.position.trim()) || undefined,
      nationality: formatNationality(customPlayerCopy.nationality.trim()) || undefined,
      imageUrl: customPlayerCopy.imageUrl?.trim() || undefined,
      image: customPlayerCopy.imageUrl?.trim() || undefined,
      id: Math.floor(100000 + Math.random() * 900000)
    };

    // 1. Cierre inmediato del modal y actualización optimista instantánea
    setAddingCustomPlayer(null);
    setModalCustomError(null);

    const customKey = normalizePlayerKey(customPlayerCopy.customName);
    const incomingKey = normalizePlayerKey(incomingName);
    setCustomPodiumList(prev => prev.filter(p => {
      const k = normalizePlayerKey(p.playerName);
      return k !== customKey && k !== incomingKey;
    }));

    const { merged } = deduplicatePlayers(podiumPlayers, [incoming]);
    setPodiumPlayers(merged);

    // 2. Persistir en Firestore en segundo plano (en paralelo)
    setIsSavingPlayers(true);
    try {
      let podiumsUpdated = 0;
      if (customPlayerCopy.occurrences && customPlayerCopy.occurrences.length > 0) {
        await Promise.all(customPlayerCopy.occurrences.map(async (occ) => {
          try {
            await updateDoc(doc(db, 'podiums', occ.podiumId), {
              [occ.role]: incomingName,
              updatedAt: Date.now()
            });
            podiumsUpdated++;
          } catch (podErr) {
            console.warn(`Podium update failed for ${occ.podiumId}:`, podErr);
          }
        }));
      }

      await handleSavePlayers(
        merged,
        `Jugador "${incoming.name}" agregado al catálogo oficial con club ${incoming.team || 'Sin Club'}.${podiumsUpdated > 0 ? ` Actualizados ${podiumsUpdated} podios.` : ''}`
      );
      fetchCustomPodiums();
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', text: `Error al guardar jugador: ${e?.message || 'Error desconocido'}` });
    } finally {
      setIsSavingPlayers(false);
    }
  };

  // Vincular jugador manual a jugador oficial existente en los podios
  const handleLinkCustomPlayerToOfficial = async () => {
    if (!linkingCustomPlayer || !linkingCustomPlayer.targetOfficialName) return;

    const confirmMsg = `¿Confirmas vincular "${linkingCustomPlayer.customName}" al jugador oficial "${linkingCustomPlayer.targetOfficialName}"? Se actualizarán ${linkingCustomPlayer.occurrences.length} podio(s).`;
    if (!window.confirm(confirmMsg)) return;

    const linkCopy = { ...linkingCustomPlayer };
    // Cierre inmediato del modal y actualización optimista
    setLinkingCustomPlayer(null);
    setModalLinkError(null);

    const linkedKey = normalizePlayerKey(linkCopy.customName);
    setCustomPodiumList(prev => prev.filter(p => normalizePlayerKey(p.playerName) !== linkedKey));

    setIsSavingPodiumLink(true);
    try {
      let count = 0;
      await Promise.all(linkCopy.occurrences.map(async (occ) => {
        await updateDoc(doc(db, 'podiums', occ.podiumId), {
          [occ.role]: linkCopy.targetOfficialName,
          updatedAt: Date.now()
        });
        count++;
      }));

      setFeedback({
        type: 'success',
        text: `¡Vinculación exitosa! Se actualizaron ${count} podio(s): "${linkCopy.customName}" ahora apunta a "${linkCopy.targetOfficialName}".`
      });
      fetchCustomPodiums();
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', text: `Error al vincular jugador en podios: ${e?.message || 'Error desconocido'}` });
    } finally {
      setIsSavingPodiumLink(false);
    }
  };

  // Guardar edición de jugador oficial del catálogo
  const handleSaveCatalogPlayerEdit = async () => {
    if (!editingCatalogPlayer) return;
    const playerToSave: PlayerItem = {
      ...editingCatalogPlayer,
      imageUrl: editingCatalogPlayer.imageUrl?.trim() || undefined,
      image: editingCatalogPlayer.imageUrl?.trim() || editingCatalogPlayer.image?.trim() || undefined,
    };
    const updated = podiumPlayers.map(p => 
      p.id === playerToSave.id || normalizePlayerKey(p.name) === normalizePlayerKey(playerToSave.name)
        ? playerToSave
        : p
    );

    // Cierre INMEDIATO del modal y actualización reactiva sin demora
    setEditingCatalogPlayer(null);
    setPodiumPlayers(updated);

    // Guardado en segundo plano
    handleSavePlayers(updated, `Jugador "${playerToSave.name}" actualizado con éxito.`);
  };

  if (!profile?.isAdmin) {
    return (
      <div className="p-8 text-center space-y-3 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Acceso Restringido</h2>
        <p className="text-sm text-zinc-400">Esta sección es exclusiva para el administrador del sistema.</p>
      </div>
    );
  }

  return (
    <div className={`font-sans text-[#e4e4e7] mx-auto max-w-4xl ${inline ? "space-y-3" : "p-3 sm:p-6 md:p-8 space-y-6 pb-[120px]"}`}>
      {/* Header */}
      {!inline && (
        <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-4 mb-4">
          {onBack && (
            <button onClick={onBack} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors shrink-0">
              ← Volver
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Panel Admin</h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Supervisión técnica de la plataforma.</p>
          </div>
        </div>
      )}
      {inline && (
        <div className="flex items-center gap-2 pb-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <h2 className="text-xs font-black text-white uppercase tracking-widest">Panel de Administración</h2>
        </div>
      )}
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
            : feedback.type === 'error'
            ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
            : feedback.type === 'warning'
            ? 'bg-amber-950/50 border-amber-600/60 text-amber-300'
            : 'bg-blue-950/40 border-blue-800/60 text-blue-300'
        }`}>
          {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />}
          {feedback.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />}
          {feedback.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />}
          {feedback.type === 'info' && <ShieldCheck className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />}
          <div className="flex-1 text-xs leading-relaxed font-medium">
            {feedback.text}
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-zinc-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          type="button"
          onClick={() => setAdminTab('actions')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
            adminTab === 'actions'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          Acciones
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('scores')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
            adminTab === 'scores'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          Resultados Reales
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
            adminTab === 'users'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          Usuarios
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('players')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            adminTab === 'players'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          <Users className="w-3 h-3 text-amber-300" />
          <span>Jugadores & Goleadores ({podiumPlayers.length})</span>
          {matchScorersAudit.some(s => s.isInconsistent) && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Hay clubes inconsistentes en partidos" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('stages')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            adminTab === 'stages'
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          <Trophy className="w-3 h-3 text-amber-300" />
          <span>Etapas ({stages.length})</span>
        </button>
      </div>


      {adminTab === 'actions' && (
        <div className="space-y-6">
          {/* Sincronización Híbrida: SerpAPI (Google Data) + Gemini (Parseo Estricto) */}
          <div className="bg-[#121215] border border-blue-500/30 rounded-xl p-3 sm:p-4 space-y-4 bg-gradient-to-b from-blue-950/20 to-transparent">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Sincronización Híbrida (SerpAPI + Gemini)</h3>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.2 rounded">
                      Google Live
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">Extracción de datos reales con SerpAPI + Formateo estricto con Gemini API</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGeminiConfig(!showGeminiConfig)}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors border border-zinc-700/60 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                title="Configurar claves de API"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">APIs</span>
              </button>
            </div>

            {/* Configuración de API Keys */}
            {showGeminiConfig && (
              <div className="bg-black/70 border border-zinc-800 rounded-xl p-3 space-y-3 animate-in fade-in">
                {/* SerpAPI Key */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">SerpAPI Key (Búsqueda en Google)</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={serpApiKeyInput}
                      onChange={e => setSerpApiKeyInput(e.target.value)}
                      placeholder="30ebec1be..."
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveSerpApiKey}
                      className="px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {serpKeySaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{serpKeySaved ? 'Guardado' : 'Guardar'}</span>
                    </button>
                  </div>
                </div>

                {/* Gemini API Key */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Gemini API Key (Parseo a JSON Estricto)</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={geminiApiKeyInput}
                      onChange={e => setGeminiApiKeyInput(e.target.value)}
                      placeholder="AQ.Ab8..."
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveGeminiKey}
                      className="px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {geminiKeySaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{geminiKeySaved ? 'Guardado' : 'Guardar'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-zinc-500">Ambas claves se guardan localmente en el navegador para uso administrativo seguro.</p>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Botón 1: Sincronizar Partidos del Día */}
                <button
                  type="button"
                  onClick={handleSyncSerpApiDailyMatches}
                  disabled={isSyncingSerpApiMatches}
                  className="bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
                >
                  {isSyncingSerpApiMatches ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                  <span>{isSyncingSerpApiMatches ? 'Consultando SerpAPI...' : 'Sincronizar Partidos del Día'}</span>
                </button>

                {/* Botón 2: Forzar Sincronización de Tabla */}
                <button
                  type="button"
                  onClick={handleSyncSerpApiStandings}
                  disabled={isSyncingSerpApiStandings}
                  className="bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 cursor-pointer"
                >
                  {isSyncingSerpApiStandings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4 text-yellow-300" />}
                  <span>{isSyncingSerpApiStandings ? 'Obteniendo Tabla...' : 'Forzar Sincronización de Tabla'}</span>
                </button>
              </div>

              {/* Botón Auto-Sync Escalonado en Lote (En Vivo + Cierre) */}
              <button
                type="button"
                onClick={handleRunAutoSyncNow}
                disabled={isAutoSyncing}
                className="w-full bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98 disabled:opacity-50"
              >
                {isAutoSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-emerald-400" />}
                <span>{isAutoSyncing ? 'Ejecutando Sincronización en Lote...' : '⚡ Sincronización Escalonada en Lote (En Vivo + Cierre)'}</span>
              </button>

              {/* Sincronización Manual por Jornada (Botón de Contingencia) */}
              <div className="pt-2.5 border-t border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span>🚨 Sincronización de Contingencia por Jornada</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">Fuerza actualización y recálculo</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedJornadaSync}
                    onChange={(e) => setSelectedJornadaSync(e.target.value)}
                    disabled={isSyncingJornada}
                    className="bg-zinc-900 border border-zinc-700/80 text-white text-xs font-bold rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 transition-colors disabled:opacity-50 cursor-pointer shrink-0 sm:w-48"
                  >
                    {availableJornadas.map(j => (
                      <option key={j} value={j} className="bg-zinc-900 text-white">
                        {j}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleSyncJornada}
                    disabled={isSyncingJornada}
                    className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-98 text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 cursor-pointer"
                  >
                    {isSyncingJornada ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-white" />}
                    <span>{isSyncingJornada ? 'Sincronizando...' : `Sincronizar ${selectedJornadaSync}`}</span>
                  </button>
                </div>

                {jornadaSyncProgress && (
                  <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span>Procesando ({jornadaSyncProgress.current} de {jornadaSyncProgress.total}):</span>
                      <span className="font-mono">{Math.round((jornadaSyncProgress.current / jornadaSyncProgress.total) * 100)}%</span>
                    </div>
                    <p className="text-[10px] text-zinc-300 truncate font-mono">
                      ⚽ {jornadaSyncProgress.match}
                    </p>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${(jornadaSyncProgress.current / jornadaSyncProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Caso de Prueba: Real Madrid vs Inter (Mock Test) */}
              <button
                type="button"
                onClick={handleRunMockTestCaseRealMadridVsInter}
                className="w-full bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/40 text-purple-300 hover:text-purple-200 font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
              >
                <span>🧪 Probar Caso de Prueba: Real Madrid 2 - 1 Inter (Mock Test)</span>
              </button>
            </div>
          </div>

          {/* Recálculo de Emergencia de Ranking y Logros (100% BBDD) */}
          <div className="bg-[#121215] border border-rose-500/40 rounded-xl p-3 sm:p-4 space-y-3 bg-gradient-to-b from-rose-950/20 to-transparent shadow-lg shadow-rose-950/10">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Recálculo de Ranking y Logros (BBDD)</h3>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.2 rounded">
                      CERO SerpAPI
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">Audita pronósticos, suma puntos absolutos sin deltas y reevalúa retroactivamente las 15 medallas oficiales</p>
                </div>
              </div>
            </div>

            {showConfirmRecalculateRanking ? (
              <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed font-medium">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <p className="font-bold text-white mb-1">¿Forzar recálculo total de ranking y medallas?</p>
                    <p className="text-zinc-400 text-[11px]">
                      Se recorrerán todos los usuarios en Firestore, sumando directamente los puntos de sus pronósticos en partidos finalizados y reasignando las 15 medallas legítimas (eliminando medallas de reglas antiguas). Cero llamadas a APIs externas.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-900/40">
                  <button
                    type="button"
                    onClick={() => setShowConfirmRecalculateRanking(false)}
                    disabled={isRecalculatingRanking}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRecalculateRanking}
                    disabled={isRecalculatingRanking}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 border border-rose-500/50 shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isRecalculatingRanking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                    <span>{isRecalculatingRanking ? 'Recalculando...' : 'Sí, Forzar Recálculo'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmRecalculateRanking(true)}
                disabled={isRecalculatingRanking}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/20 active:scale-[0.99]"
              >
                {isRecalculatingRanking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4 text-white" />}
                <span>{isRecalculatingRanking ? 'Recalculando Puntos y Medallas...' : '🚨 Forzar Recálculo de Ranking (BBDD)'}</span>
              </button>
            )}
          </div>

          {/* Recálculo Oficial de Tabla UCL (36 Equipos) */}
          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Table2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Tabla Oficial UCL (36 Equipos)</h3>
                  <p className="text-[10px] text-zinc-400">Calcula W/D/L, DG, GF, GC y puntos de todos los partidos finalizados</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRecalculateStandings}
              disabled={isRecalculatingStandings}
              className="w-full bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {isRecalculatingStandings ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-emerald-400" />}
              <span>{isRecalculatingStandings ? 'Recalculando Tabla...' : 'Recalcular Tabla UCL Ahora'}</span>
            </button>
          </div>

          <div className="bg-[#121215] border border-zinc-800 rounded-lg p-3 sm:p-4 space-y-4 mt-4">
            <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Gestión de Partidos y Ejemplos</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-800/50">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {matches.filter(m => !isTestMatch(m)).length} Oficiales UCL
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  matches.filter(isTestMatch).length > 0
                    ? 'bg-rose-950/50 text-rose-400 border-rose-800/50'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}>
                  {matches.filter(isTestMatch).length} de Prueba
                </span>
              </div>
            </div>

            {showConfirmDelete ? (
              <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <p>
                    ¿Confirmas eliminar los partidos de prueba? Se eliminarán únicamente los partidos de ejemplo y sus pronósticos. Los 144 partidos oficiales de Champions League se mantendrán intactos.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteTestMatches}
                    disabled={isDeletingTests}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer"
                  >
                    {isDeletingTests ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>{isDeletingTests ? 'Eliminando...' : 'Sí, Eliminar Ejemplos'}</span>
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    disabled={isDeletingTests}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => {
                    setFeedback(null);
                    setShowConfirmDelete(true);
                  }}
                  disabled={isDeletingTests || isGeneratingTests || isRestoringOfficial}
                  className="w-full bg-rose-600/15 border border-rose-600/30 hover:bg-rose-600/25 text-rose-400 font-bold py-2.5 px-3 rounded-lg text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingTests ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Eliminar Ejemplos {matches.filter(isTestMatch).length > 0 ? `(${matches.filter(isTestMatch).length})` : ''}</span>
                </button>
                <button
                  onClick={handleRestoreOfficialMatches}
                  disabled={isRestoringOfficial || isDeletingTests}
                  className="w-full bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 font-bold py-2.5 px-3 rounded-lg text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isRestoringOfficial ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <span>Verificar 144 Oficiales</span>
                </button>
                <button
                  onClick={handleGenerateTestMatches}
                  disabled={isGeneratingTests || isDeletingTests}
                  className="w-full bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 font-bold py-2.5 px-3 rounded-lg text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingTests ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Generar 4 Ejemplos</span>
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {adminTab === 'scores' && (
        <div className="space-y-4">
          {/* Top Quick Actions in Scores Tab */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleSyncGeminiDaily}
              disabled={isSyncingGemini}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isSyncingGemini ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              <span>{isSyncingGemini ? 'Consultando Gemini...' : 'Consultar Resultados con Gemini IA'}</span>
            </button>
            <button
              type="button"
              onClick={handleRecalculateStandings}
              disabled={isRecalculatingStandings}
              className="bg-zinc-900 border border-emerald-500/40 hover:bg-emerald-950/30 text-emerald-300 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isRecalculatingStandings ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-emerald-400" />}
              <span>Recalcular Tabla UCL</span>
            </button>
            <button
              type="button"
              onClick={handleRecalculateRanking}
              disabled={isRecalculatingRanking}
              className="bg-zinc-900 border border-rose-500/40 hover:bg-rose-950/30 text-rose-300 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isRecalculatingRanking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4 text-rose-400" />}
              <span>{isRecalculatingRanking ? 'Recalculando...' : 'Recalcular Ranking BBDD'}</span>
            </button>
          </div>

          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-2 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  placeholder="Buscar equipo o partido..."
                  className="w-full bg-[#121215] border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            {filteredMatches.map(m => {
              const ms = matchScores[m.id];
              const displayHome = (ms?.home !== '' && ms?.home !== undefined) ? ms.home : (m.homeScore !== null && m.homeScore !== undefined ? String(m.homeScore) : '-');
              const displayAway = (ms?.away !== '' && ms?.away !== undefined) ? ms.away : (m.awayScore !== null && m.awayScore !== undefined ? String(m.awayScore) : '-');
              const currentStatus = ms?.status || m.status || 'pending';

              return (
                <div 
                  key={m.id} 
                  onClick={() => handleOpenScoreModal(m)}
                  className="bg-[#121215] border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-black truncate">{m.homeTeam}</span>
                      <span className="text-zinc-600 text-[10px] font-bold">vs</span>
                      <span className="text-white text-xs font-black truncate">{m.awayTeam}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(m.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      <span className={cn(
                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                        currentStatus === 'finished' ? "bg-zinc-800 text-zinc-400 border border-zinc-700/50" :
                        (currentStatus === 'in_progress' || (m.estado && (m.estado.toLowerCase().includes('vivo') || /\d+['’]/.test(m.estado)))) ? "bg-orange-500/10 text-orange-400 border border-orange-500/30 animate-pulse" :
                        (m.estado && (m.estado.toLowerCase().includes('entretiempo') || m.estado.toLowerCase().includes('descanso'))) ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse" :
                        "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      )}>
                        {m.estado || (currentStatus === 'finished' ? 'Finalizado' : currentStatus === 'in_progress' ? 'En Juego' : 'Por Jugar')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="font-mono text-sm font-black text-white bg-black/70 px-2.5 py-1.5 rounded-lg border border-zinc-700 shadow-inner min-w-[54px] text-center">
                      {displayHome} - {displayAway}
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAdminJsonMatch({ match: m, mode: 'ai' }); }}
                      className="px-2 py-1.5 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-purple-500/40 cursor-pointer shadow-sm"
                      title="Auto-buscar estadísticas con IA (Gemini 3.8 Flash)"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[10px] uppercase font-bold">IA</span>
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenScoreModal(m); }}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-zinc-700/70 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] uppercase font-bold">Editar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {adminTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-lg overflow-hidden shadow-sm p-2">
            <h3 className="text-white font-bold mb-4">Usuarios</h3>
            <div className="space-y-2">
              {filteredUsers.map(u => (
                <div key={u.uid} className="flex justify-between items-center bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  <div>
                     <p className="text-sm font-bold text-white">
                       {u.nickname ? (
                         <span>{u.nickname} <span className="text-xs text-zinc-400 font-normal">({u.displayName})</span></span>
                       ) : (
                         u.displayName
                       )}
                     </p>
                     <p className="text-xs text-zinc-500">{u.email}</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => toggleUserPaid(u.uid, u.paid || false)} className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${u.paid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>{u.paid ? 'Pagado' : 'Pendiente'}</button>
                     <button onClick={() => toggleUserAdmin(u.uid, u.isAdmin || false)} className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${u.isAdmin ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400'}`}>{u.isAdmin ? 'Admin' : 'Jugador'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adminTab === 'players' && (
        <div className="space-y-6">
          {/* Subtabs Navigation */}
          <div className="flex gap-2 border-b border-zinc-800 pb-3 overflow-x-auto scrollbar-hide">
            <button
              type="button"
              onClick={() => setPlayersSubTab('catalog')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0",
                playersSubTab === 'catalog'
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800"
              )}
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>Catálogo Oficial ({podiumPlayers.length})</span>
              {unlinkedCatalogPlayers.length > 0 && (
                <span className="bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-sm" title={`${unlinkedCatalogPlayers.length} jugadores sin club oficial UCL`}>
                  {unlinkedCatalogPlayers.length} sin club
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPlayersSubTab('match_scorers')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 relative",
                playersSubTab === 'match_scorers'
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800"
              )}
            >
              <Shield className="w-4 h-4 text-blue-400" />
              <span>Goles & Asistencias ({matchScorersAudit.length + matchAssistsAudit.length})</span>
              {(matchScorersAudit.some(s => s.isInconsistent) || matchAssistsAudit.some(a => a.isInconsistent)) && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full" title="Hay clubes inconsistentes en partidos">
                  {matchScorersAudit.filter(s => s.isInconsistent).length + matchAssistsAudit.filter(a => a.isInconsistent).length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlayersSubTab('custom_podiums');
                fetchCustomPodiums();
              }}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0",
                playersSubTab === 'custom_podiums'
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800"
              )}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Podios Manuales de Usuarios ({customPodiumList.length})</span>
              {customPodiumList.length > 0 && (
                <span className="bg-purple-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {customPodiumList.length}
                </span>
              )}
            </button>
          </div>

          {/* SUBTAB 1: CATÁLOGO OFICIAL */}
          {playersSubTab === 'catalog' && (
            <div className="space-y-6">
              {/* Feedback en pestaña de Catálogo */}
              {feedback && (
                <div className={`p-3 rounded-xl border flex items-start gap-3 transition-all animate-in fade-in ${
                  feedback.type === 'success' 
                    ? 'bg-emerald-950/50 border-emerald-600/70 text-emerald-300' 
                    : feedback.type === 'error'
                    ? 'bg-rose-950/50 border-rose-600/70 text-rose-300'
                    : feedback.type === 'warning'
                    ? 'bg-amber-950/50 border-amber-600/70 text-amber-300'
                    : 'bg-blue-950/50 border-blue-600/70 text-blue-300'
                }`}>
                  {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />}
                  {feedback.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />}
                  {feedback.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />}
                  {feedback.type === 'info' && <ShieldCheck className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />}
                  <div className="flex-1 text-xs leading-relaxed font-semibold">
                    {feedback.text}
                  </div>
                  <button 
                    onClick={() => setFeedback(null)} 
                    className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Action Bar */}
              <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-400" />
                      <h3 className="text-base font-bold text-white">Catálogo Oficial de Estrellas UCL</h3>
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-black">
                        {podiumPlayers.length}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Estrellas oficiales disponibles en el selector de Goleador, Asistente y MVP del torneo.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {autoLinkableCatalogPlayers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoNormalizeCatalogClubs}
                        disabled={isNormalizingCatalogClubs || isSavingPlayers}
                        className="px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                        title="Vincular automáticamente nombres con alias reconocibles a su club oficial UCL"
                      >
                        {isNormalizingCatalogClubs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                        Auto-Vincular ({autoLinkableCatalogPlayers.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleQuickCopyPlayersJson}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border",
                        copiedQuickJson
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white"
                      )}
                      title="Copiar directamente todo el catálogo en formato JSON al portapapeles para entregárselo a una IA"
                    >
                      {copiedQuickJson ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-amber-400" />}
                      <span>{copiedQuickJson ? '¡JSON Copiado!' : `Copiar JSON (${podiumPlayers.length})`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAiAssistantModalOpen(true)}
                      className="px-3.5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-900/30 cursor-pointer hover:scale-[1.02]"
                      title="Asistente para exportar a IA, copiar prompts listos y pegar respuestas actualizadas"
                    >
                      <Bot className="w-4 h-4 text-purple-200" />
                      <span>Asistente IA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUpdateJsonFeedback(null);
                        setUpdateJsonModalOpen(true);
                      }}
                      className="px-3 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                      title="Sincronizar y actualizar catálogo desde partidos y JSONs con match inteligente sin duplicados"
                    >
                      <FileJson className="w-4 h-4 text-amber-200" />
                      Actualizar con JSON
                    </button>
                    <button
                      onClick={() => setShowJsonInput(!showJsonInput)}
                      className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileCode className="w-4 h-4 text-blue-400" />
                      {showJsonInput ? 'Ocultar JSON' : 'Importar JSON'}
                    </button>
                    <button
                      onClick={handleResetToDefaultPlayers}
                      disabled={isResettingPlayers || isSavingPlayers}
                      className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Restablece la lista a las estrellas oficiales 2026/27"
                    >
                      <RotateCcw className={cn("w-4 h-4 text-amber-400", isResettingPlayers && "animate-spin")} />
                      Restaurar 2026/27
                    </button>
                  </div>
                </div>

                {/* JSON Importer Panel */}
                {showJsonInput && (
                  <div className="bg-zinc-900/90 border border-blue-500/30 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        Pegar JSON de Jugadores (Fusión Inteligente sin Duplicados)
                      </span>
                      <span className="text-[10px] text-zinc-400">Acepta arreglo o {`{"top_players": [...]}`}</span>
                    </div>
                    <textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      rows={6}
                      placeholder={`{\n  "top_players": [\n    {\n      "name": "Michael Olise",\n      "team": "Bayern Munich",\n      "position": "Forward",\n      "nationality": "France"\n    }\n  ]\n}`}
                      className="w-full bg-black/60 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-blue-500 custom-scrollbar"
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-zinc-400">
                        ℹ️ Los jugadores existentes se actualizarán y los nuevos se agregarán sin repetir nombres.
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowJsonInput(false)}
                          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleImportJson}
                          disabled={isSavingPlayers || !jsonInput.trim()}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {isSavingPlayers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Procesar y Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Add Form */}
                <form onSubmit={handleAddSinglePlayer} className="space-y-3 bg-black/30 border border-zinc-800/80 rounded-xl p-3">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    Agregar Jugador Manualmente al Catálogo
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre Completo *"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500"
                      required
                    />
                    <select
                      value={newPlayerTeam}
                      onChange={(e) => setNewPlayerTeam(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                    >
                      <option value="">Seleccionar Club UCL...</option>
                      {UCL_36_TEAMS.map(t => (
                        <option key={t.id} value={t.name}>{t.name} ({t.country})</option>
                      ))}
                    </select>
                    <select
                      value={newPlayerPosition}
                      onChange={(e) => setNewPlayerPosition(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">Posición (opcional)...</option>
                      {AVAILABLE_POSITIONS.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                    <input
                      type="url"
                      placeholder="URL Foto (ej. UEFA.com)"
                      value={newPlayerImage}
                      onChange={(e) => setNewPlayerImage(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newPlayerNationality}
                        onChange={(e) => setNewPlayerNationality(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">Nacionalidad (opcional)...</option>
                        {AVAILABLE_NATIONALITIES.map(nat => (
                          <option key={nat} value={nat}>{nat}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={isSavingPlayers || !newPlayerName.trim()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        {isSavingPlayers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Agregar
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Banner de Aviso de Jugadores Sin Club Oficial UCL */}
              {unlinkedCatalogPlayers.length > 0 && (
                <div className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-amber-200">
                          ⚠️ {unlinkedCatalogPlayers.length} {unlinkedCatalogPlayers.length === 1 ? 'jugador no tiene' : 'jugadores no tienen'} club oficial UCL vinculado
                        </p>
                        {matchEventDetectedPlayers.length > 0 && (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                            {matchEventDetectedPlayers.length} detectados en partidos
                          </span>
                        )}
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-full">
                          Requieren revisión
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        {matchEventDetectedPlayers.length > 0 ? (
                          <span>
                            💡 Encontramos registros en los partidos (cambios, asistencias o goles) para: <strong className="text-emerald-300">{matchEventDetectedPlayers.map(p => {
                              const ev = catalogPlayerMatchEvidenceMap.get(p.id ? String(p.id) : normalizePlayerKey(p.name));
                              return `${p.name} (${ev?.canonicalTeam})`;
                            }).slice(0, 3).join(', ')}{matchEventDetectedPlayers.length > 3 ? '...' : ''}</strong>. Puedes auto-vincularlos de inmediato con un solo clic.
                          </span>
                        ) : (
                          'Tienen clubes no canónicos o de equipos no participantes en los 36 de esta Champions (ej. "Chelsea", "Bayer Leverkusen") o están vacíos. Corrígelos para que se muestre su escudo oficial y sumen correctamente.'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {autoLinkableCatalogPlayers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoNormalizeCatalogClubs}
                        disabled={isNormalizingCatalogClubs || isSavingPlayers}
                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-900/30 disabled:opacity-50"
                        title="Vincular automáticamente todos los detectados en partidos o con alias"
                      >
                        {isNormalizingCatalogClubs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                        Auto-Vincular ({autoLinkableCatalogPlayers.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowOnlyUnlinkedCatalog(!showOnlyUnlinkedCatalog)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                        showOnlyUnlinkedCatalog
                          ? "bg-amber-500 text-black font-black"
                          : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                      )}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {showOnlyUnlinkedCatalog ? 'Ver todos los jugadores' : `Filtrar los ${unlinkedCatalogPlayers.length} sin club`}
                    </button>
                  </div>
                </div>
              )}

              {/* Banner de Unificación de Jugadores de Partidos no Catalogados */}
              {matchPlayersNotInCatalog.length > 0 && (
                <div className="bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-xs text-blue-200 font-medium">
                        Hay <strong className="text-white font-bold">{matchPlayersNotInCatalog.length}</strong> {matchPlayersNotInCatalog.length === 1 ? 'jugador registrado' : 'jugadores registrados'} en partidos que aún no están en el Catálogo Oficial.
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Puedes revisarlos antes de sincronizar o agregarlos directamente sin crear duplicados.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setUpdateJsonFeedback(null);
                        setUpdateJsonModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-700"
                    >
                      <Search className="w-3.5 h-3.5 text-blue-400" />
                      Revisar Match
                    </button>
                    <button
                      type="button"
                      onClick={handleImportAllMatchPlayersToCatalog}
                      disabled={isSavingPlayers}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      {isSavingPlayers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                      Unificar Todos ({matchPlayersNotInCatalog.length})
                    </button>
                  </div>
                </div>
              )}

              {/* Player Search and List */}
              <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="Buscar jugador por nombre, equipo, nacionalidad..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {unlinkedCatalogPlayers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowOnlyUnlinkedCatalog(!showOnlyUnlinkedCatalog)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                          showOnlyUnlinkedCatalog
                            ? "bg-amber-500 text-black font-black"
                            : "bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30"
                        )}
                      >
                        <Filter className="w-3 h-3" />
                        {showOnlyUnlinkedCatalog ? 'Ver todos' : `Solo sin club (${unlinkedCatalogPlayers.length})`}
                      </button>
                    )}
                    {playersWithoutNationality.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowOnlyWithoutNat(!showOnlyWithoutNat)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                          showOnlyWithoutNat
                            ? "bg-purple-600 text-white font-black"
                            : "bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-purple-500/30"
                        )}
                      >
                        <Globe className="w-3 h-3" />
                        {showOnlyWithoutNat ? 'Ver todos' : `Sin nacionalidad (${playersWithoutNationality.length})`}
                      </button>
                    )}
                    <span className="text-xs text-zinc-500 whitespace-nowrap">
                      Mostrando {filteredPodiumPlayers.length} de {podiumPlayers.length}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredPodiumPlayers.map((player) => {
                    const isExactOfficial = !!player.team && UCL_36_TEAMS.some(t => t.name === player.team);
                    const aliasMatch = findUclTeam(player.team);
                    const pKey = player.id ? String(player.id) : normalizePlayerKey(player.name);
                    const matchEvidence = catalogPlayerMatchEvidenceMap.get(pKey);
                    const logo = matchEvidence?.canonicalTeam && !isExactOfficial
                      ? getTeamLogoByName(matchEvidence.canonicalTeam)
                      : getTeamLogoByName(player.team);
                    const playerPhoto = player.imageUrl || player.image;

                    return (
                      <div
                        key={player.id || player.name}
                        className={cn(
                          "rounded-xl p-3 flex items-center justify-between gap-3 group transition-all border",
                          !isExactOfficial
                            ? matchEvidence
                              ? "bg-emerald-950/15 border-emerald-500/40 hover:border-emerald-500/70"
                              : "bg-amber-950/15 border-amber-500/40 hover:border-amber-500/70"
                            : "bg-zinc-900/80 border-zinc-800/90 hover:border-zinc-700"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {playerPhoto ? (
                            <div className="relative shrink-0">
                              <img
                                src={playerPhoto}
                                alt={player.name}
                                className="w-10 h-10 rounded-full object-cover shrink-0 border border-amber-500/40 bg-zinc-800 shadow"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=27272a&color=fff&size=80&bold=true`;
                                }}
                              />
                              {logo && (
                                <img
                                  src={logo}
                                  alt=""
                                  className="w-4 h-4 object-contain absolute -bottom-1 -right-1 bg-black/90 rounded-full p-0.5 border border-zinc-700"
                                />
                              )}
                            </div>
                          ) : logo ? (
                            <img src={logo} alt={player.team || 'Club'} className="w-9 h-9 object-contain shrink-0" />
                          ) : (
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=27272a&color=fff&size=80&bold=true`}
                              alt={player.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0 border border-zinc-700/50"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-white truncate">{player.name}</p>
                              {!isExactOfficial && (
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.2 rounded font-black flex items-center gap-0.5",
                                  matchEvidence
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                )} title={matchEvidence ? `Detectado en partidos: ${matchEvidence.canonicalTeam}` : "No está vinculado exactamente a un club de los 36 de Champions"}>
                                  {matchEvidence ? <Sparkles className="w-2.5 h-2.5 text-amber-300" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                                  {matchEvidence ? 'Detectado en Partidos' : (player.team ? 'No oficial' : 'Sin club')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {player.team ? (
                                <span className={cn(
                                  "text-[10px] truncate max-w-[140px]",
                                  isExactOfficial ? "text-zinc-400" : "text-amber-300 font-bold"
                                )}>
                                  {isExactOfficial ? player.team : `BD: "${player.team}"`}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500 italic">
                                  (Sin club asignado)
                                </span>
                              )}
                              {aliasMatch && aliasMatch.name !== player.team && (
                                <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 py-0.2 rounded font-medium">
                                  Sugerido: {aliasMatch.short}
                                </span>
                              )}
                              {player.nationality && (
                                <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-medium border border-zinc-700/50">
                                  {formatNationality(player.nationality)}
                                </span>
                              )}
                            </div>
                            {!isExactOfficial && matchEvidence && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-black flex items-center gap-1" title={matchEvidence.summaryText}>
                                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                  En partidos: {matchEvidence.canonicalTeam}
                                </span>
                                <span className="text-[9px] text-zinc-400 truncate max-w-[140px]" title={matchEvidence.summaryText}>
                                  ({matchEvidence.summaryText})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!isExactOfficial && matchEvidence && (
                            <button
                              type="button"
                              onClick={() => handleQuickLinkPlayerToTeam(player, matchEvidence.canonicalTeam)}
                              disabled={isSavingPlayers}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer mr-1 shadow-sm"
                              title={`Asignar inmediatamente a ${matchEvidence.canonicalTeam} según eventos de partidos`}
                            >
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              <span>Asignar {matchEvidence.canonicalTeam.split(' ')[0]}</span>
                            </button>
                          )}
                          {!isExactOfficial && !matchEvidence && (
                            <button
                              type="button"
                              onClick={() => setEditingCatalogPlayer(player)}
                              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer mr-1"
                              title="Corregir y vincular a club oficial UCL"
                            >
                              <Edit3 className="w-3 h-3 text-amber-400" />
                              <span>Vincular</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingCatalogPlayer(player)}
                            className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Editar datos de ${player.name}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlayer(player)}
                            disabled={isSavingPlayers}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                            title={`Eliminar a ${player.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredPodiumPlayers.length === 0 && (
                  <div className="text-center py-8 text-zinc-500 text-xs">
                    No se encontraron jugadores que coincidan con "{playerSearch}".
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBTAB 2: GOLES Y ASISTENCIAS DE PARTIDOS */}
          {playersSubTab === 'match_scorers' && (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-400" />
                      <h3 className="text-base font-bold text-white">Goles y Asistencias en Partidos</h3>
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-black">
                        {matchScorersAudit.length} goleadores • {matchAssistsAudit.length} asistidores
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Audita, normaliza y corrige los clubes asignados a cada gol y asistencia en los partidos de Champions.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAutoNormalizeMatchClubs}
                      disabled={isNormalizingMatchClubs}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                      title="Normaliza 'FC Barcelona' -> 'Barcelona', 'PSG' -> 'Paris Saint-Germain', etc. en todos los partidos"
                    >
                      {isNormalizingMatchClubs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                      Auto-Normalizar Clubes
                    </button>
                  </div>
                </div>

                {/* Sub-selector: Goleadores vs Asistidores */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMatchStatsTab('scorers')}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm",
                      matchStatsTab === 'scorers'
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                    )}
                  >
                    <span>⚽ Goleadores ({matchScorersAudit.length})</span>
                    {matchScorersAudit.some(s => s.isInconsistent) && (
                      <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        {matchScorersAudit.filter(s => s.isInconsistent).length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchStatsTab('assists')}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm",
                      matchStatsTab === 'assists'
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                    )}
                  >
                    <span>👟 Asistidores ({matchAssistsAudit.length})</span>
                    {matchAssistsAudit.some(a => a.isInconsistent) && (
                      <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        {matchAssistsAudit.filter(a => a.isInconsistent).length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* SECCIÓN 1: GOLEADORES */}
              {matchStatsTab === 'scorers' && (
                <>
                  {/* Banner de Aviso de Goleadores con Clubes Inconsistentes */}
                  {matchScorersAudit.some(s => s.isInconsistent) && (
                    <div className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-amber-200">
                              ⚠️ {matchScorersAudit.filter(s => s.isInconsistent).length} goleadores tienen clubes no estándar o fuera de los 36 oficiales de Champions
                            </p>
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-full">
                              {matchScorersAudit.filter(s => s.isInconsistent).length} por revisar
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                            Puedes usar el botón "Auto-Normalizar Clubes" arriba para estandarizarlos automáticamente a los 36 oficiales de Champions, o corregirlos individualmente abajo.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowOnlyInconsistentScorers(!showOnlyInconsistentScorers)}
                          className={cn(
                            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                            showOnlyInconsistentScorers
                              ? "bg-amber-500 text-black font-black"
                              : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                          )}
                        >
                          <Filter className="w-3.5 h-3.5" />
                          {showOnlyInconsistentScorers ? 'Ver todos los goleadores' : `Filtrar los ${matchScorersAudit.filter(s => s.isInconsistent).length} con problemas`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search & Scorers List */}
                  <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={matchScorerSearch}
                          onChange={(e) => setMatchScorerSearch(e.target.value)}
                          placeholder="Buscar goleador o club..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {matchScorersAudit.some(s => s.isInconsistent) && (
                          <button
                            type="button"
                            onClick={() => setShowOnlyInconsistentScorers(!showOnlyInconsistentScorers)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                              showOnlyInconsistentScorers
                                ? "bg-amber-500 text-black font-black"
                                : "bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30"
                            )}
                          >
                            <Filter className="w-3 h-3" />
                            {showOnlyInconsistentScorers ? 'Ver todos' : `Solo con problemas (${matchScorersAudit.filter(s => s.isInconsistent).length})`}
                          </button>
                        )}
                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          Mostrando {filteredMatchScorers.length} de {matchScorersAudit.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {filteredMatchScorers.map((scorer) => {
                        const logo = getTeamLogoByName(scorer.canonicalTeam || scorer.teamsList[0]);
                        const inCatalog = podiumPlayers.some(p => normalizePlayerKey(p.name) === normalizePlayerKey(scorer.playerName));

                        return (
                          <div
                            key={scorer.key}
                            className={cn(
                              "bg-zinc-900/80 border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                              scorer.isInconsistent ? "border-amber-500/50 bg-amber-950/10" : "border-zinc-800/90 hover:border-zinc-700"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {logo ? (
                                <img src={logo} alt="Club" className="w-8 h-8 object-contain shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                                  ⚽
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-white">{scorer.playerName}</p>
                                  <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-500/30">
                                    {scorer.totalGoals} {scorer.totalGoals === 1 ? 'gol' : 'goles'}
                                  </span>
                                  {scorer.hasNonOfficialUclTeam && (
                                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                                      Club no oficial UCL
                                    </span>
                                  )}
                                  {!scorer.hasNonOfficialUclTeam && scorer.hasNonCanonicalTeam && (
                                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                                      Club no estándar
                                    </span>
                                  )}
                                  {inCatalog ? (
                                    <span className="text-[9px] text-zinc-400 bg-zinc-800/70 border border-zinc-700/50 px-2 py-0.5 rounded-full font-medium">
                                      ✓ En Catálogo
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                      No catalogado
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] text-zinc-400">
                                  <span>Club(es) en BD:</span>
                                  {scorer.teamsList.length > 0 ? (
                                    scorer.teamsList.map((t, idx) => {
                                      const isOfficialUcl = UCL_36_TEAMS.some(ucl => ucl.name === t);
                                      return (
                                        <span key={idx} className={cn(
                                          "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                          isOfficialUcl
                                            ? "bg-zinc-800 text-zinc-300 border-zinc-700/60"
                                            : "bg-rose-500/10 text-rose-300 border-rose-500/30 font-bold"
                                        )}>
                                          {t || 'Sin club'} {!isOfficialUcl && '(No UCL)'}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-rose-400 italic font-semibold">Sin club asignado</span>
                                  )}
                                  <span className="text-zinc-600">•</span>
                                  <span className="text-zinc-500">{scorer.matches.length} {scorer.matches.length === 1 ? 'partido' : 'partidos'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              {!inCatalog && (
                                <button
                                  type="button"
                                  onClick={() => handleAddPlayerFromMatchToCatalog(scorer.playerName, scorer.canonicalTeam || scorer.teamsList[0], 'Goleador')}
                                  disabled={isSavingPlayers}
                                  className="px-2.5 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                  title="Añadir este goleador al Catálogo Oficial de Champions"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Catálogo</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const currentT = scorer.teamsList[0] || scorer.canonicalTeam || '';
                                  const detected = findUclTeam(currentT);
                                  const initialTarget = detected ? detected.name : (UCL_36_TEAMS.find(t => t.name === currentT)?.name || UCL_36_TEAMS[0].name);

                                  setEditingScorerPlayer({
                                    playerName: scorer.playerName,
                                    currentTeam: currentT
                                  });
                                  setSelectedTargetTeam(initialTarget);
                                }}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                                Cambiar Club
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {filteredMatchScorers.length === 0 && (
                        <div className="text-center py-8 text-zinc-500 text-xs">
                          No se encontraron goleadores que coincidan con "{matchScorerSearch}".
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* SECCIÓN 2: ASISTIDORES */}
              {matchStatsTab === 'assists' && (
                <>
                  {/* Aviso / Disclaimer sobre Lista de Asistidores */}
                  <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-300">⚠️ Aviso sobre la Lista de Asistencias de Partidos</p>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        Esta lista está basada en datos recopilados manualmente, por lo que puede contener discrepancias. Utilízala para verificar asistidores, corregir clubes o integrarlos al catálogo oficial.
                      </p>
                    </div>
                  </div>

                  {/* Banner de Aviso de Asistidores con Clubes Inconsistentes */}
                  {matchAssistsAudit.some(a => a.isInconsistent) && (
                    <div className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-amber-200">
                              ⚠️ {matchAssistsAudit.filter(a => a.isInconsistent).length} asistidores tienen clubes no estándar o fuera de los 36 oficiales de Champions
                            </p>
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-full">
                              {matchAssistsAudit.filter(a => a.isInconsistent).length} por revisar
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                            Puedes corregir su club asignado en los partidos con el botón "Cambiar Club" de cada jugador.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowOnlyInconsistentAssisters(!showOnlyInconsistentAssisters)}
                          className={cn(
                            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                            showOnlyInconsistentAssisters
                              ? "bg-amber-500 text-black font-black"
                              : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                          )}
                        >
                          <Filter className="w-3.5 h-3.5" />
                          {showOnlyInconsistentAssisters ? 'Ver todos los asistidores' : `Filtrar los ${matchAssistsAudit.filter(a => a.isInconsistent).length} con problemas`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search & Assists List */}
                  <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={matchAssistSearch}
                          onChange={(e) => setMatchAssistSearch(e.target.value)}
                          placeholder="Buscar asistidor o club..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {matchAssistsAudit.some(a => a.isInconsistent) && (
                          <button
                            type="button"
                            onClick={() => setShowOnlyInconsistentAssisters(!showOnlyInconsistentAssisters)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                              showOnlyInconsistentAssisters
                                ? "bg-amber-500 text-black font-black"
                                : "bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30"
                            )}
                          >
                            <Filter className="w-3 h-3" />
                            {showOnlyInconsistentAssisters ? 'Ver todos' : `Solo con problemas (${matchAssistsAudit.filter(a => a.isInconsistent).length})`}
                          </button>
                        )}
                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          Mostrando {filteredMatchAssists.length} de {matchAssistsAudit.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {filteredMatchAssists.map((assistItem) => {
                        const logo = getTeamLogoByName(assistItem.canonicalTeam || assistItem.teamsList[0]);
                        const inCatalog = podiumPlayers.some(p => normalizePlayerKey(p.name) === normalizePlayerKey(assistItem.playerName));

                        return (
                          <div
                            key={assistItem.key}
                            className={cn(
                              "bg-zinc-900/80 border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                              assistItem.isInconsistent ? "border-amber-500/50 bg-amber-950/10" : "border-zinc-800/90 hover:border-zinc-700"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {logo ? (
                                <img src={logo} alt="Club" className="w-8 h-8 object-contain shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                                  👟
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-white">{assistItem.playerName}</p>
                                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    {assistItem.totalAssists} {assistItem.totalAssists === 1 ? 'asistencia' : 'asistencias'}
                                  </span>
                                  {assistItem.hasNonOfficialUclTeam && (
                                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                                      Club no oficial UCL
                                    </span>
                                  )}
                                  {!assistItem.hasNonOfficialUclTeam && assistItem.hasNonCanonicalTeam && (
                                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                                      Club no estándar
                                    </span>
                                  )}
                                  {inCatalog ? (
                                    <span className="text-[9px] text-zinc-400 bg-zinc-800/70 border border-zinc-700/50 px-2 py-0.5 rounded-full font-medium">
                                      ✓ En Catálogo
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                      No catalogado
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] text-zinc-400">
                                  <span>Club(es) en BD:</span>
                                  {assistItem.teamsList.length > 0 ? (
                                    assistItem.teamsList.map((t, idx) => {
                                      const isOfficialUcl = UCL_36_TEAMS.some(ucl => ucl.name === t);
                                      return (
                                        <span key={idx} className={cn(
                                          "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                          isOfficialUcl
                                            ? "bg-zinc-800 text-zinc-300 border-zinc-700/60"
                                            : "bg-rose-500/10 text-rose-300 border-rose-500/30 font-bold"
                                        )}>
                                          {t || 'Sin club'} {!isOfficialUcl && '(No UCL)'}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-rose-400 italic font-semibold">Sin club asignado</span>
                                  )}
                                  <span className="text-zinc-600">•</span>
                                  <span className="text-zinc-500">
                                    {assistItem.matches.slice(0, 2).map((m, i) => (
                                      <span key={i} className="mr-1">
                                        {m.scorerName ? `asistió a ${m.scorerName} (${m.minute}')` : m.matchTitle}
                                      </span>
                                    ))}
                                    {assistItem.matches.length > 2 && `(+${assistItem.matches.length - 2} más)`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              {!inCatalog && (
                                <button
                                  type="button"
                                  onClick={() => handleAddPlayerFromMatchToCatalog(assistItem.playerName, assistItem.canonicalTeam || assistItem.teamsList[0], 'Asistidor')}
                                  disabled={isSavingPlayers}
                                  className="px-2.5 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                  title="Añadir este asistidor al Catálogo Oficial de Champions"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Catálogo</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const currentT = assistItem.teamsList[0] || assistItem.canonicalTeam || '';
                                  const detected = findUclTeam(currentT);
                                  const initialTarget = detected ? detected.name : (UCL_36_TEAMS.find(t => t.name === currentT)?.name || UCL_36_TEAMS[0].name);

                                  setEditingScorerPlayer({
                                    playerName: assistItem.playerName,
                                    currentTeam: currentT
                                  });
                                  setSelectedTargetTeam(initialTarget);
                                }}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                                Cambiar Club
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {filteredMatchAssists.length === 0 && (
                        <div className="text-center py-8 text-zinc-500 text-xs">
                          No se encontraron asistidores que coincidan con "{matchAssistSearch}".
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SUBTAB 3: PODIOS MANUALES DE USUARIOS */}
          {playersSubTab === 'custom_podiums' && (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <h3 className="text-base font-bold text-white">Jugadores Manuales en Podios</h3>
                      <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs px-2.5 py-0.5 rounded-full font-black">
                        {customPodiumList.length} detectados
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Nombres que los participantes escribieron a mano porque no salían en la lista oficial.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={fetchCustomPodiums}
                    disabled={isLoadingCustomPodiums}
                    className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={cn("w-4 h-4 text-purple-400", isLoadingCustomPodiums && "animate-spin")} />
                    Reescanear Podios
                  </button>
                </div>

                <div className="bg-purple-950/20 border border-purple-800/40 rounded-lg p-3 text-xs text-purple-300 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">¿Cómo resolver los jugadores manuales?</p>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Puedes <strong>Añadir al Catálogo</strong> (seleccionando su Club de Champions y Nacionalidad para que en el podio se vea su escudo y bandera oficial) o <strong>Vincular a Jugador Oficial</strong> si el usuario escribió un apodo o error ortográfico (ej: "Haaland" ➡️ "Erling Haaland").
                    </p>
                  </div>
                </div>
              </div>

              {/* Search & List */}
              <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customPodiumSearch}
                      onChange={(e) => setCustomPodiumSearch(e.target.value)}
                      placeholder="Buscar por jugador manual, usuario o rol..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-blue-500"
                    />
                  </div>
                  <span className="text-xs text-zinc-500 whitespace-nowrap">
                    Mostrando {filteredCustomPodiums.length} de {customPodiumList.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {filteredCustomPodiums.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-900/80 border border-purple-500/20 hover:border-purple-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">"{item.playerName}"</span>
                          {item.roles.map((r, rIdx) => (
                            <span key={rIdx} className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-black px-2 py-0.5 rounded-full">
                              {r}
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Elegido por <span className="text-zinc-200 font-bold">{item.occurrences.length} usuario(s)</span>: {item.occurrences.map(o => o.userName).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setModalCustomError(null);
                            setAddingCustomPlayer({
                              customName: item.playerName,
                              occurrences: item.occurrences,
                              name: item.playerName,
                              team: UCL_36_TEAMS[0].name,
                              position: item.roles.includes('Goleador') ? 'Delantero' : item.roles.includes('Asistidor') ? 'Centrocampista' : 'Delantero',
                              nationality: '',
                              imageUrl: ''
                            });
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Añadir al Catálogo con Club
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalLinkError(null);
                            setOfficialPlayerSearch('');
                            setLinkingCustomPlayer({
                              customName: item.playerName,
                              occurrences: item.occurrences,
                              targetOfficialName: ''
                            });
                          }}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5 text-amber-400" />
                          Vincular a Oficial
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredCustomPodiums.length === 0 && !isLoadingCustomPodiums && (
                    <div className="text-center py-12 text-zinc-500 text-xs space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                      <p className="font-bold text-zinc-300">¡No hay jugadores manuales pendientes!</p>
                      <p className="text-zinc-500">Todos los participantes han elegido jugadores registrados en el catálogo oficial.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODAL 1: CAMBIAR CLUB DE GOLEADOR EN PARTIDOS */}
          {editingScorerPlayer && (
            <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#121215] border border-blue-500/40 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">Corregir Club de Jugador en Partidos</h3>
                  </div>
                  <button onClick={() => setEditingScorerPlayer(null)} className="text-zinc-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {(() => {
                  const currentScorerTeam = editingScorerPlayer.currentTeam?.trim() || '';
                  const detectedScorerUcl = findUclTeam(currentScorerTeam);
                  const isExactOfficialScorer = UCL_36_TEAMS.some(t => t.name === currentScorerTeam);

                  return (
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-zinc-400 block mb-1 font-semibold">Jugador:</label>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white font-bold text-sm">
                          {editingScorerPlayer.playerName}
                        </div>
                      </div>

                      {/* Recuadro de Club Actual en Partidos */}
                      <div className="bg-black/40 border border-zinc-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400 font-semibold">Club registrado en partidos:</span>
                          {isExactOfficialScorer ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px]">
                              <Check className="w-3 h-3" /> Oficial UCL
                            </span>
                          ) : (
                            <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px]">
                              <AlertTriangle className="w-3 h-3" /> No oficial
                            </span>
                          )}
                        </div>

                        <div className="text-zinc-200 font-mono text-xs bg-zinc-900 p-2.5 rounded-lg border border-zinc-700/60 font-bold flex items-center justify-between">
                          <span className="truncate">{currentScorerTeam ? `"${currentScorerTeam}"` : <span className="text-zinc-500 italic font-normal">Sin club asignado</span>}</span>
                          <span className="text-[10px] text-zinc-500 shrink-0">Valor en BD</span>
                        </div>

                        {detectedScorerUcl && detectedScorerUcl.name !== selectedTargetTeam && (
                          <div className="bg-blue-950/40 border border-blue-500/40 rounded-lg p-2.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-blue-200">
                              💡 Sugerido: <strong>{detectedScorerUcl.name}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedTargetTeam(detectedScorerUcl.name)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded shadow cursor-pointer shrink-0"
                            >
                              Usar sugerido
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-zinc-300 block mb-1 font-semibold">Nuevo Club Oficial (Champions League):</label>
                        <select
                          value={selectedTargetTeam}
                          onChange={(e) => setSelectedTargetTeam(e.target.value)}
                          className="w-full bg-zinc-900 border border-blue-500/50 rounded-lg p-2.5 text-white text-xs outline-none focus:border-blue-400 font-medium"
                        >
                          {currentScorerTeam && !isExactOfficialScorer && (
                            <option value={currentScorerTeam} className="text-amber-400 bg-zinc-950 font-bold">
                              ⚠️ Actual en BD: "{currentScorerTeam}" (No estándar)
                            </option>
                          )}
                          <optgroup label="Clubes Oficiales Champions League (36)">
                            {UCL_36_TEAMS.map(t => (
                              <option key={t.id} value={t.name}>{t.name} ({t.country})</option>
                            ))}
                          </optgroup>
                        </select>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          ℹ️ Se actualizará este club en todos los partidos donde participó este jugador (goles / asistencias) y en la tabla.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditingScorerPlayer(null)}
                    className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isUpdatingScorerTeam || !selectedTargetTeam}
                    onClick={() => handleUpdatePlayerClubAcrossMatches(editingScorerPlayer.playerName, selectedTargetTeam)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isUpdatingScorerTeam ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Guardar en Todos sus Partidos
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL 2: AÑADIR JUGADOR MANUAL AL CATÁLOGO OFICIAL */}
          {addingCustomPlayer && (
            <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#121215] border border-emerald-500/40 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Añadir Jugador al Catálogo Oficial</h3>
                  </div>
                  <button onClick={() => setAddingCustomPlayer(null)} className="text-zinc-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {modalCustomError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                    {modalCustomError}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-300 block mb-1 font-semibold">Nombre del Jugador:</label>
                    <input
                      type="text"
                      value={addingCustomPlayer.name}
                      onChange={(e) => setAddingCustomPlayer({ ...addingCustomPlayer, name: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-300 block mb-1 font-semibold">Club Oficial (UCL):</label>
                    <select
                      value={addingCustomPlayer.team}
                      onChange={(e) => setAddingCustomPlayer({ ...addingCustomPlayer, team: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500"
                    >
                      <option value="">Seleccionar Club...</option>
                      {UCL_36_TEAMS.map(t => (
                        <option key={t.id} value={t.name}>{t.name} ({t.country})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-300 block mb-1 font-semibold">Posición:</label>
                    <select
                      value={addingCustomPlayer.position}
                      onChange={(e) => setAddingCustomPlayer({ ...addingCustomPlayer, position: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500"
                    >
                      <option value="Delantero">Delantero</option>
                      <option value="Centrocampista">Centrocampista</option>
                      <option value="Defensa">Defensa</option>
                      <option value="Portero">Portero</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-300 block mb-1 font-semibold">Nacionalidad:</label>
                    <select
                      value={formatNationality(addingCustomPlayer.nationality) || ''}
                      onChange={(e) => setAddingCustomPlayer({ ...addingCustomPlayer, nationality: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500 cursor-pointer text-xs"
                    >
                      <option value="">Seleccionar Nacionalidad (opcional)...</option>
                      {getNationalityOptions(addingCustomPlayer.nationality).map(nat => (
                        <option key={nat} value={nat}>{nat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-300 block mb-1 font-semibold">URL de Foto / Imagen (Opcional):</label>
                    <input
                      type="url"
                      placeholder="https://img.uefa.com/... (link oficial UEFA o foto)"
                      value={addingCustomPlayer.imageUrl || ''}
                      onChange={(e) => setAddingCustomPlayer({ ...addingCustomPlayer, imageUrl: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setAddingCustomPlayer(null)}
                    className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPlayers || !addingCustomPlayer.name.trim()}
                    onClick={handleSaveCustomPlayerToCatalog}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingPlayers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Guardar en Catálogo Oficial
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL 3: VINCULAR JUGADOR MANUAL A OFICIAL */}
          {linkingCustomPlayer && (
            <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#121215] border border-amber-500/40 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Vincular a Jugador Oficial</h3>
                  </div>
                  <button onClick={() => setLinkingCustomPlayer(null)} className="text-zinc-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {modalLinkError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                    {modalLinkError}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-400 block mb-1 font-semibold">Nombre Escrito por el Usuario:</label>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-amber-300 font-bold text-sm">
                      "{linkingCustomPlayer.customName}"
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-300 block mb-1 font-semibold">Buscar Jugador Oficial Canónico:</label>
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={officialPlayerSearch}
                        onChange={(e) => setOfficialPlayerSearch(e.target.value)}
                        placeholder="Filtrar por nombre o club (ej: Grimaldo, Mbappe)..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-2.5 py-2 text-white text-xs outline-none focus:border-amber-400"
                      />
                    </div>

                    <label className="text-zinc-300 block mb-1 font-semibold">
                      Seleccionar Jugador Oficial ({filteredOfficialForLinking.length} disponibles):
                    </label>
                    <select
                      value={linkingCustomPlayer.targetOfficialName}
                      onChange={(e) => setLinkingCustomPlayer({ ...linkingCustomPlayer, targetOfficialName: e.target.value })}
                      className="w-full bg-zinc-900 border border-amber-500/50 rounded-lg p-2.5 text-white text-xs outline-none focus:border-amber-400 max-h-40"
                      size={filteredOfficialForLinking.length > 5 ? 5 : undefined}
                    >
                      <option value="" disabled>-- Selecciona un jugador oficial del catálogo --</option>
                      {filteredOfficialForLinking.map(p => (
                        <option key={p.id || p.name} value={p.name} className="py-1">
                          {p.name} {p.team ? `(${p.team})` : ''}
                        </option>
                      ))}
                    </select>
                    {filteredOfficialForLinking.length === 0 && (
                      <p className="text-[10px] text-rose-400 mt-1">
                        No se encontraron jugadores oficiales con "{officialPlayerSearch}".
                      </p>
                    )}

                    {!linkingCustomPlayer.targetOfficialName && (
                      <p className="text-[11px] text-amber-400/90 font-medium mt-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                        ⚠️ Debes hacer clic y seleccionar a qué jugador oficial corresponde antes de poder vincular.
                      </p>
                    )}

                    <div className="mt-3 bg-zinc-900/80 border border-zinc-800 rounded-lg p-2.5 max-h-36 overflow-y-auto space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 block mb-1">
                        Podios y usuarios que se actualizarán ({linkingCustomPlayer.occurrences.length}):
                      </span>
                      {linkingCustomPlayer.occurrences.map((occ, idx) => {
                        const roleLabel = occ.role === 'topScorer' ? 'Goleador' : occ.role === 'mostAssists' ? 'Asistidor' : 'MVP';
                        return (
                          <div key={idx} className="flex items-center justify-between text-[11px] text-zinc-300 py-1 border-b border-zinc-800/50 last:border-0">
                            <span className="font-semibold text-white truncate max-w-[180px]">{occ.userName}</span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-amber-400 font-bold shrink-0">{roleLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setLinkingCustomPlayer(null)}
                    className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPodiumLink || !linkingCustomPlayer.targetOfficialName}
                    onClick={handleLinkCustomPlayerToOfficial}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingPodiumLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Vincular y Actualizar Podios
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL 4: EDITAR JUGADOR DEL CATÁLOGO */}
          {editingCatalogPlayer && (
            <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#121215] border border-zinc-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Editar Jugador del Catálogo</h3>
                  </div>
                  <button onClick={() => setEditingCatalogPlayer(null)} className="text-zinc-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {(() => {
                  const currentDbTeam = editingCatalogPlayer.team?.trim() || '';
                  const detectedUcl = findUclTeam(currentDbTeam);
                  const isExactOfficial = UCL_36_TEAMS.some(t => t.name === currentDbTeam);
                  const pKey = editingCatalogPlayer.id ? String(editingCatalogPlayer.id) : normalizePlayerKey(editingCatalogPlayer.name);
                  const matchEvidence = catalogPlayerMatchEvidenceMap.get(pKey);

                  return (
                    <div className="space-y-3 text-xs">
                      {/* Recuadro Destacado: Club Registrado en Base de Datos */}
                      <div className="bg-black/40 border border-zinc-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400 font-semibold">Club registrado en base de datos:</span>
                          {isExactOfficial ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px]">
                              <Check className="w-3 h-3" /> Oficial UCL
                            </span>
                          ) : (
                            <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px]">
                              <AlertTriangle className="w-3 h-3" /> No oficial UCL
                            </span>
                          )}
                        </div>

                        <div className="bg-zinc-900 border border-zinc-700/60 rounded-lg p-2.5 flex items-center justify-between gap-2">
                          <div className="font-mono text-xs text-white font-bold truncate">
                            {currentDbTeam ? `"${currentDbTeam}"` : <span className="text-zinc-500 italic font-normal">Sin club asignado (vacío en BD)</span>}
                          </div>
                          {currentDbTeam && (
                            <span className="text-[10px] text-zinc-500 shrink-0">Valor en BD</span>
                          )}
                        </div>

                        {/* Sugerencia inteligente de coincidencia por alias ortográfico */}
                        {detectedUcl && detectedUcl.name !== currentDbTeam && (
                          <div className="bg-blue-950/40 border border-blue-500/40 rounded-lg p-2.5 flex items-center justify-between gap-2">
                            <div className="text-[11px] text-blue-200">
                              💡 Sugerencia por alias: Se detectó como <strong>{detectedUcl.name}</strong> ({detectedUcl.country})
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingCatalogPlayer({ ...editingCatalogPlayer, team: detectedUcl.name })}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-lg shadow transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              Vincular a {detectedUcl.short || detectedUcl.name}
                            </button>
                          </div>
                        )}

                        {/* Sugerencia destacada a partir de eventos de partidos de Champions (cambios, asistencias, goles, tarjetas) */}
                        {matchEvidence && matchEvidence.canonicalTeam && matchEvidence.canonicalTeam !== currentDbTeam && (
                          <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                Detectado en Partidos: <strong>{matchEvidence.canonicalTeam}</strong>
                              </span>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                {matchEvidence.totalEvents} evento(s)
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                              Este jugador participó en partidos para <strong>{matchEvidence.canonicalTeam}</strong>:
                            </p>
                            <ul className="text-[10px] text-emerald-100/80 space-y-1 pl-2 border-l border-emerald-500/30 max-h-24 overflow-y-auto">
                              {matchEvidence.sampleEvents.slice(0, 4).map((ev, i) => (
                                <li key={i}>• <strong>{ev.matchTitle}</strong>: {ev.description}</li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => setEditingCatalogPlayer({ ...editingCatalogPlayer, team: matchEvidence.canonicalTeam })}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Asignar a {matchEvidence.canonicalTeam}
                            </button>
                          </div>
                        )}

                        {!isExactOfficial && !detectedUcl && (!matchEvidence || matchEvidence.canonicalTeam === currentDbTeam) && currentDbTeam && (
                          <p className="text-[11px] text-amber-300/90 leading-tight">
                            ⚠️ "{currentDbTeam}" no coincide con ninguno de los 36 clubes de esta Champions. Búscalo en la lista desplegable abajo para vincularlo al club oficial correspondiente.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-zinc-300 block mb-1 font-semibold">Nombre:</label>
                        <input
                          type="text"
                          value={editingCatalogPlayer.name}
                          onChange={(e) => setEditingCatalogPlayer({ ...editingCatalogPlayer, name: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-zinc-300 block mb-1 font-semibold">Club Oficial (UCL):</label>
                        <select
                          value={editingCatalogPlayer.team || ''}
                          onChange={(e) => setEditingCatalogPlayer({ ...editingCatalogPlayer, team: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 font-medium"
                        >
                          <option value="">-- Sin Club --</option>
                          {matchEvidence && matchEvidence.canonicalTeam && matchEvidence.canonicalTeam !== currentDbTeam && (
                            <option value={matchEvidence.canonicalTeam} className="text-emerald-400 bg-zinc-950 font-bold">
                              🎯 Detectado en partidos: {matchEvidence.canonicalTeam}
                            </option>
                          )}
                          {currentDbTeam && !isExactOfficial && (
                            <option value={currentDbTeam} className="text-amber-400 bg-zinc-950 font-bold">
                              ⚠️ Actual en BD: "{currentDbTeam}" (No estándar)
                            </option>
                          )}
                          <optgroup label="Clubes Oficiales Champions League (36)">
                            {UCL_36_TEAMS.map(t => (
                              <option key={t.id} value={t.name}>{t.name} ({t.country})</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label className="text-zinc-300 block mb-1 font-semibold">Posición:</label>
                        <select
                          value={editingCatalogPlayer.position || ''}
                          onChange={(e) => setEditingCatalogPlayer({ ...editingCatalogPlayer, position: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                        >
                          <option value="Delantero">Delantero</option>
                          <option value="Centrocampista">Centrocampista</option>
                          <option value="Defensa">Defensa</option>
                          <option value="Portero">Portero</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-zinc-300 block mb-1 font-semibold">Nacionalidad:</label>
                        <select
                          value={formatNationality(editingCatalogPlayer.nationality) || ''}
                          onChange={(e) => setEditingCatalogPlayer({ ...editingCatalogPlayer, nationality: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 cursor-pointer text-xs"
                        >
                          <option value="">Seleccionar Nacionalidad (opcional)...</option>
                          {getNationalityOptions(editingCatalogPlayer.nationality).map(nat => (
                            <option key={nat} value={nat}>{nat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-zinc-300 block mb-1 font-semibold flex items-center justify-between">
                          <span>URL de Foto / Imagen (ej. UEFA.com):</span>
                          {(editingCatalogPlayer.imageUrl || editingCatalogPlayer.image) && (
                            <span className="text-[10px] text-emerald-400 font-bold">Foto vinculada</span>
                          )}
                        </label>
                        <div className="flex gap-2 items-center">
                          {(editingCatalogPlayer.imageUrl || editingCatalogPlayer.image) ? (
                            <img
                              src={editingCatalogPlayer.imageUrl || editingCatalogPlayer.image}
                              alt="Preview"
                              className="w-9 h-9 rounded-full object-cover shrink-0 border border-amber-500/50 bg-zinc-800"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(editingCatalogPlayer.name)}&background=27272a&color=fff`;
                              }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-500 shrink-0">
                              📷
                            </div>
                          )}
                          <input
                            type="url"
                            placeholder="https://img.uefa.com/... o enlace de imagen"
                            value={editingCatalogPlayer.imageUrl || editingCatalogPlayer.image || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingCatalogPlayer({
                                ...editingCatalogPlayer,
                                imageUrl: val,
                                image: val
                              });
                            }}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 text-xs"
                          />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Pega el enlace de la foto oficial del jugador en UEFA.com u otra web para mostrar su foto en su perfil y podios.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditingCatalogPlayer(null)}
                    className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPlayers || !editingCatalogPlayer.name.trim()}
                    onClick={handleSaveCatalogPlayerEdit}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingPlayers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL 5: ACTUALIZAR CATÁLOGO CON JSON (MATCH INTELIGENTE) */}
          {updateJsonModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-[#121215] border border-amber-500/40 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col text-white">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-white flex items-center gap-2">
                        Actualizar Catálogo con JSON
                        <span className="text-[10px] bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                          Match Inteligente
                        </span>
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        Detecta jugadores en partidos o JSON, actualiza clubes faltantes y evita duplicar variantes (ej: "L. Yamal" ➔ "Lamine Yamal").
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUpdateJsonModalOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Subtabs de origen: Partidos vs Pegar JSON */}
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateJsonTab('matches');
                      setUpdateJsonFeedback(null);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                      updateJsonTab === 'matches'
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    )}
                  >
                    <FileJson className="w-3.5 h-3.5 text-amber-400" />
                    Desde Partidos del Sistema ({matches.length} partidos)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateJsonTab('paste');
                      setUpdateJsonFeedback(null);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                      updateJsonTab === 'paste'
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    )}
                  >
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    Pegar JSON Externo
                  </button>
                </div>

                {/* Textarea si tab es 'paste' */}
                {updateJsonTab === 'paste' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-400 font-semibold flex items-center justify-between">
                      <span>Pega aquí JSON de jugadores o JSON de partidos:</span>
                      <span className="text-[10px] text-zinc-500">Acepta [&#123; name, team &#125;] o &#123; partidos: [...] &#125;</span>
                    </label>
                    <textarea
                      value={updateJsonPastedText}
                      onChange={(e) => setUpdateJsonPastedText(e.target.value)}
                      rows={4}
                      placeholder={`[\n  { "name": "L. Yamal", "team": "FC Barcelona", "position": "Delantero" },\n  { "name": "Alejandro Grimaldo", "team": "Bayer 04 Leverkusen", "position": "Defensa" }\n]`}
                      className="w-full bg-black/60 border border-zinc-700 rounded-lg p-2.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-500 custom-scrollbar"
                    />
                  </div>
                )}

                {/* Stat pills / Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-black text-emerald-400">{updateJsonAnalysis.newPlayers.length}</div>
                    <div className="text-[10px] text-emerald-300/80 font-bold">Nuevos para Catálogo</div>
                  </div>
                  <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-black text-blue-400">{updateJsonAnalysis.matchedExisting.length}</div>
                    <div className="text-[10px] text-blue-300/80 font-bold">Reconocidos (0 duplicados)</div>
                  </div>
                  <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-black text-amber-400">{updateJsonAnalysis.clubUpdates.length}</div>
                    <div className="text-[10px] text-amber-300/80 font-bold">Clubes a Actualizar</div>
                  </div>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-zinc-400 font-bold mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-zinc-400" /> Ver:
                  </span>
                  {(['all', 'new', 'matched', 'clubs'] as const).map((filterKey) => {
                    const label =
                      filterKey === 'all'
                        ? `Todos (${updateJsonAnalysis.totalScanned})`
                        : filterKey === 'new'
                        ? `Nuevos (${updateJsonAnalysis.newPlayers.length})`
                        : filterKey === 'matched'
                        ? `Reconocidos (${updateJsonAnalysis.matchedExisting.length})`
                        : `Clubes (${updateJsonAnalysis.clubUpdates.length})`;
                    return (
                      <button
                        key={filterKey}
                        type="button"
                        onClick={() => setUpdateJsonFilter(filterKey)}
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer",
                          updateJsonFilter === filterKey
                            ? "bg-zinc-200 text-black shadow-sm"
                            : "bg-zinc-800 text-zinc-400 hover:text-white"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable list preview */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[160px] max-h-[300px]">
                  {/* Si no hay nada analizado */}
                  {updateJsonAnalysis.totalScanned === 0 && (
                    <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                      {updateJsonTab === 'matches'
                        ? 'No se encontraron eventos de jugadores en los partidos actuales.'
                        : 'Pega un JSON válido para analizar jugadores y clubes.'}
                    </div>
                  )}

                  {/* Club Updates */}
                  {(updateJsonFilter === 'all' || updateJsonFilter === 'clubs') && updateJsonAnalysis.clubUpdates.map((c, i) => (
                    <div key={`club-${i}`} className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{c.catalogPlayer.name}</span>
                          <span className="text-[10px] text-zinc-400 font-normal">
                            (evento: "{c.eventName}")
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-300/90 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="line-through text-zinc-400">{c.oldTeam}</span>
                          <span>➔</span>
                          <span className="font-bold text-amber-400 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" /> {c.newTeam} (Oficial UCL)
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-1 rounded-lg shrink-0">
                        Actualizar Club
                      </span>
                    </div>
                  ))}

                  {/* Matched (Intelligent Equivalence) */}
                  {(updateJsonFilter === 'all' || updateJsonFilter === 'matched') && updateJsonAnalysis.matchedExisting.map((m, i) => (
                    <div key={`matched-${i}`} className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="text-zinc-300">"{m.eventName}"</span>
                          <span className="text-blue-400">➔</span>
                          <span className="text-blue-300 font-bold">{m.catalogPlayer.name}</span>
                          {m.catalogPlayer.team && (
                            <span className="text-[10px] text-zinc-400">({m.catalogPlayer.team})</span>
                          )}
                        </div>
                        <div className="text-[11px] text-blue-200/70 mt-0.5">
                          {m.reason}
                        </div>
                      </div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-1 rounded-lg shrink-0 flex items-center gap-1">
                        <Check className="w-3 h-3 text-blue-400" />
                        0 Duplicados
                      </span>
                    </div>
                  ))}

                  {/* New Players */}
                  {(updateJsonFilter === 'all' || updateJsonFilter === 'new') && updateJsonAnalysis.newPlayers.map((p, i) => (
                    <div key={`new-${i}`} className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="text-emerald-300 font-bold">{p.name}</span>
                          <span className="text-[10px] text-zinc-400 font-normal">({p.position})</span>
                        </div>
                        <div className="text-[11px] text-emerald-200/80 mt-0.5">
                          Club: <strong className="text-white">{p.team || 'Sin club'}</strong> • {p.evidenceCount} evento(s)
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-1 rounded-lg shrink-0">
                        + Nuevo Jugador
                      </span>
                    </div>
                  ))}
                </div>

                {/* Feedback message if any */}
                {updateJsonFeedback && (
                  <div className="p-2.5 rounded-lg text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    {updateJsonFeedback}
                  </div>
                )}

                {/* Footer buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800 gap-2">
                  <div className="text-[11px] text-zinc-400">
                    {updateJsonAnalysis.newPlayers.length === 0 && updateJsonAnalysis.clubUpdates.length === 0
                      ? 'Catálogo al día con los datos analizados.'
                      : `${updateJsonAnalysis.newPlayers.length} nuevos y ${updateJsonAnalysis.clubUpdates.length} clubes a actualizar.`}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUpdateJsonModalOpen(false)}
                      className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      disabled={isApplyingJsonUpdate || (updateJsonAnalysis.newPlayers.length === 0 && updateJsonAnalysis.clubUpdates.length === 0)}
                      onClick={handleApplyJsonUpdate}
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isApplyingJsonUpdate ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Aplicando cambios...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                          Confirmar y Aplicar al Catálogo
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODAL 6: ASISTENTE IA PARA JUGADORES */}
          <AiPlayersModal
            isOpen={isAiAssistantModalOpen}
            onClose={() => setIsAiAssistantModalOpen(false)}
            players={podiumPlayers}
            onSavePlayers={handleSavePlayers}
            isSaving={isSavingPlayers}
          />
        </div>
      )}

      {adminTab === 'stages' && (() => {
        const activeStage = stages.find(s => s.status === 'active');
        const closedStages = stages.filter(s => s.status === 'closed').sort((a, b) => (b.closedAt || b.createdAt) - (a.closedAt || a.createdAt));

        const activeStageMatches = activeStage
          ? matches.filter(m => (activeStage.matchGroups || []).includes(m.group || 'Fase Regular'))
          : [];
        const activeStageMatchesFinished = activeStageMatches.filter(m => m.status === 'finished').length;
        const activeStageMatchesTotal = activeStageMatches.length;

        const liveStandings = activeStage
          ? calculateStageStandings(activeStage, matches, groupPredictions, users)
          : [];

        return (
          <div className="space-y-6">
            {/* Header / Intro */}
            <div className="bg-[#121215] border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap bg-gradient-to-r from-amber-950/20 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                    Torneo por Etapas
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Define fases flexibles, cierra etapas y congela a los ganadores en el registro histórico.
                  </p>
                </div>
              </div>

              {closedStages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWinnersModal(true)}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Ver Salón de Ganadores ({closedStages.length})</span>
                </button>
              )}
            </div>

            {/* SECCIÓN 1: ETAPA ACTIVA */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-black uppercase text-zinc-300 tracking-wider">
                  Etapa en Curso
                </h4>
              </div>

              {activeStage ? (
                <div className="bg-gradient-to-br from-emerald-950/20 via-[#121215] to-[#121215] border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          En Juego
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Iniciada el {format(new Date(activeStage.createdAt), "d MMM, HH:mm", { locale: es })}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white">{activeStage.name}</h3>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Jornadas:</span>
                        {activeStage.matchGroups.map(g => (
                          <span key={g} className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-bold">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-right">
                      <p className="text-[9px] text-zinc-400 uppercase font-black">Progreso de Partidos</p>
                      <p className={`text-xs font-mono font-bold ${
                        activeStageMatchesTotal > 0 && activeStageMatchesFinished === activeStageMatchesTotal
                          ? 'text-emerald-400 flex items-center justify-end gap-1'
                          : 'text-emerald-400'
                      }`}>
                        {activeStageMatchesTotal > 0 && activeStageMatchesFinished === activeStageMatchesTotal && (
                          <Check className="w-3 h-3 text-emerald-400 inline" />
                        )}
                        {activeStageMatchesFinished} / {activeStageMatchesTotal} finalizados
                      </p>
                    </div>
                  </div>

                  {/* Banner si todos los partidos de la etapa activa ya finalizaron */}
                  {activeStageMatchesTotal > 0 && activeStageMatchesFinished === activeStageMatchesTotal && (
                    <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-emerald-300">
                            ¡Todos los partidos de esta etapa han finalizado! ({activeStageMatchesFinished}/{activeStageMatchesTotal})
                          </p>
                          <p className="text-[11px] text-emerald-400/80">
                            Ya puedes pulsar "Terminar y Cerrar Etapa" para premiar a los ganadores y guardarlos en el Salón de la Fama.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInitiateCloseStage(activeStage)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Cerrar Ahora</span>
                      </button>
                    </div>
                  )}

                  {/* Previsualización en Vivo de Líderes */}
                  {liveStandings.length > 0 && (
                    <div className="bg-zinc-950/60 rounded-xl border border-zinc-800/80 p-3 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        Top 3 actual de esta etapa:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {liveStandings.slice(0, 3).map((item, idx) => (
                          <div key={item.userId} className="flex items-center gap-2 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                              idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                              idx === 1 ? 'bg-zinc-700/30 text-zinc-300 border border-zinc-600' :
                              'bg-amber-900/30 text-amber-600 border border-amber-800/50'
                            }`}>
                              {idx + 1}
                            </span>
                            <UserAvatar src={item.photoURL} name={item.nickname || item.displayName} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-white truncate">{item.nickname || item.displayName}</p>
                              <p className="text-[10px] font-mono text-zinc-400">{item.points} pts · {item.exactMatches} exactos</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón para finalizar etapa */}
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-zinc-400 max-w-sm">
                      Al terminar la etapa, las posiciones y puntos se congelarán de manera permanente en el registro histórico.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleInitiateCloseStage(activeStage)}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4 text-amber-200" />
                      <span>Terminar y Cerrar Etapa</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/80 text-zinc-400 flex items-center justify-center mx-auto text-xl">
                    🏁
                  </div>
                  <h4 className="text-sm font-black text-white">No hay ninguna etapa activa</h4>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Crea una nueva etapa a continuación para comenzar a evaluar los puntos de las siguientes jornadas.
                  </p>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: CREAR NUEVA ETAPA */}
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
              <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                <Plus className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Crear Nueva Etapa</h3>
                  <p className="text-[10px] text-zinc-400">Asigna un nombre y selecciona qué jornadas componen esta fase.</p>
                </div>
              </div>

              <form onSubmit={handleCreateStage} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1.5">
                    Nombre de la Etapa
                  </label>
                  <input
                    type="text"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="Ej: Etapa 1 - Jornada 1, o Etapa 2 - Fase de Liga (J2 a J8)..."
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                      Jornadas o Fases Incluidas ({selectedMatchGroups.length} seleccionadas)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllMatchGroups}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 cursor-pointer"
                      >
                        Seleccionar todas
                      </button>
                      <button
                        type="button"
                        onClick={handleClearMatchGroups}
                        className="text-[10px] font-bold text-zinc-400 hover:text-zinc-300 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 cursor-pointer"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableMatchGroups.map(groupName => {
                      const isSelected = selectedMatchGroups.includes(groupName);
                      const st = matchGroupStats[groupName] || { total: 0, finished: 0, live: 0, pending: 0 };
                      const isGroupFinished = st.total > 0 && st.finished === st.total;
                      const hasGroupLive = st.live > 0;

                      return (
                        <button
                          key={groupName}
                          type="button"
                          onClick={() => handleToggleMatchGroup(groupName)}
                          className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                            )}
                            <span className="text-xs font-bold truncate text-white">{groupName}</span>
                          </div>

                          <div className="mt-1.5 pl-6 flex items-center gap-1.5 flex-wrap">
                            {st.total === 0 ? (
                              <span className="text-[10px] text-zinc-500 font-medium">Sin partidos</span>
                            ) : isGroupFinished ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                <Check className="w-2.5 h-2.5" />
                                <span>{st.finished}/{st.total} Finalizados</span>
                              </span>
                            ) : hasGroupLive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                <span>En vivo ({st.live})</span>
                              </span>
                            ) : st.finished > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                <span>{st.finished}/{st.total} Jugados</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
                                <span>{st.total} por jugar</span>
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Mensaje Informativo según estado de los partidos seleccionados */}
                  {selectedMatchGroups.length > 0 && (
                    <div className="mt-3">
                      {selectedGroupsStats.isAllFinished && (
                        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 sm:p-3.5 flex items-start gap-3 text-emerald-200">
                          <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                              <span>✓ Jornada ya disputada ({selectedGroupsStats.finished} de {selectedGroupsStats.total} partidos finalizados)</span>
                            </p>
                            <p className="text-emerald-400/90 leading-relaxed text-[11px]">
                              <strong>¡Puedes crear esta etapa de forma retroactiva sin problemas!</strong> Al crearla, el sistema calculará inmediatamente los puntos acumulados por los usuarios en esta jornada. Luego podrás hacer clic en <strong>"Terminar y Cerrar Etapa"</strong> para proclamar y guardar a los ganadores en el Salón de la Fama.
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedGroupsStats.hasLive && (
                        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 sm:p-3.5 flex items-start gap-3 text-amber-200">
                          <Flame className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-bold text-amber-300">
                              Partidos en vivo en progreso ({selectedGroupsStats.live} en juego, {selectedGroupsStats.finished}/{selectedGroupsStats.total} terminados)
                            </p>
                            <p className="text-amber-400/90 leading-relaxed text-[11px]">
                              La etapa registrará los puntos conforme terminen los encuentros y la tabla se actualizará dinámicamente.
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedGroupsStats.isPartiallyFinished && !selectedGroupsStats.hasLive && (
                        <div className="bg-blue-950/40 border border-blue-500/40 rounded-xl p-3 sm:p-3.5 flex items-start gap-3 text-blue-200">
                          <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-bold text-blue-300">
                              Etapa en desarrollo ({selectedGroupsStats.finished} de {selectedGroupsStats.total} partidos finalizados)
                            </p>
                            <p className="text-blue-400/90 leading-relaxed text-[11px]">
                              Aún restan {selectedGroupsStats.pending} partidos programados. Los puntos se irán sumando según los resultados finales.
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedGroupsStats.isAllUpcoming && (
                        <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl p-3 sm:p-3.5 flex items-start gap-3 text-zinc-300">
                          <Calendar className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-bold text-zinc-200">
                              Próxima etapa ({selectedGroupsStats.total} partidos programados)
                            </p>
                            <p className="text-zinc-400 leading-relaxed text-[11px]">
                              Todos los partidos de estas jornadas están por jugarse. Los participantes competirán una vez arranquen los encuentros.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isCreatingStage || !newStageName.trim() || selectedMatchGroups.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {isCreatingStage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{isCreatingStage ? 'Creando etapa...' : 'Crear e Iniciar Etapa'}</span>
                </button>
              </form>
            </div>

            {/* SECCIÓN 3: HISTORIAL DE ETAPAS CERRADAS */}
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Historial de Etapas Finalizadas ({closedStages.length})
                  </h3>
                </div>
              </div>

              {closedStages.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  Aún no has cerrado ninguna etapa. Cuando termines una etapa, quedará archivada aquí permanentemente.
                </div>
              ) : (
                <div className="space-y-3">
                  {closedStages.map((stage) => {
                    const winners = stage.winners || [];
                    const top1 = winners.find(w => w.rank === 1);
                    const top2 = winners.find(w => w.rank === 2);
                    const top3 = winners.find(w => w.rank === 3);

                    return (
                      <div
                        key={stage.id}
                        className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold border border-zinc-700">
                                {stage.matchGroups.join(', ')}
                              </span>
                              <h4 className="text-xs sm:text-sm font-black text-white">{stage.name}</h4>
                            </div>
                            {stage.closedAt && (
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                Finalizada el {format(new Date(stage.closedAt), "d 'de' MMMM, yyyy · HH:mm", { locale: es })}
                              </p>
                            )}
                          </div>

                          {/* Botones de acción admin */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRecalculateStage(stage)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                              title="Recalcular podio de la etapa"
                            >
                              Recalcular
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReopenStage(stage)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-amber-900/40 text-amber-300 text-[10px] font-bold rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                              title="Reabrir etapa"
                            >
                              Reabrir
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStage(stage)}
                              className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar etapa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Podio mini preview */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-zinc-900">
                          {/* 2do */}
                          <div className="bg-zinc-900/60 p-2 rounded-lg text-center border border-zinc-800/80">
                            <span className="text-[9px] font-black text-zinc-400 uppercase">🥈 2° Lugar</span>
                            <p className="text-xs font-bold text-zinc-200 truncate">{top2?.nickname || top2?.displayName || '—'}</p>
                            <p className="text-[10px] font-mono text-zinc-400">{top2?.points || 0} pts</p>
                          </div>
                          {/* 1ro */}
                          <div className="bg-amber-500/10 p-2 rounded-lg text-center border border-amber-500/30">
                            <span className="text-[9px] font-black text-amber-400 uppercase">🥇 1° Lugar</span>
                            <p className="text-xs font-bold text-amber-200 truncate">{top1?.nickname || top1?.displayName || '—'}</p>
                            <p className="text-[10px] font-mono text-amber-300 font-bold">{top1?.points || 0} pts</p>
                          </div>
                          {/* 3ro */}
                          <div className="bg-zinc-900/60 p-2 rounded-lg text-center border border-zinc-800/80">
                            <span className="text-[9px] font-black text-amber-700 uppercase">🥉 3° Lugar</span>
                            <p className="text-xs font-bold text-zinc-200 truncate">{top3?.nickname || top3?.displayName || '—'}</p>
                            <p className="text-[10px] font-mono text-zinc-400">{top3?.points || 0} pts</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}


      {/* Touch-Friendly Score Editor Modal (Bottom Sheet) */}
      {editingMatch && (
        <BaseBottomSheet
          isOpen={!!editingMatch}
          onClose={() => setEditingMatch(null)}
          title="Editar Resultado Oficial"
          zIndexClassName="z-[1050]"
        >
          <div className="space-y-6 pb-28 pt-2">
            {/* Teams Header with Badges */}
            <div className="flex items-center justify-around bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80">
              {/* Home Team */}
              <div className="flex flex-col items-center gap-2 flex-1 text-center">
                <TeamBadge teamName={editingMatch.homeTeam} size="md" />
                <span className="text-xs font-black text-white line-clamp-1">{editingMatch.homeTeam}</span>
                <span className="text-[10px] text-blue-400 font-bold uppercase">Local</span>
                
                {/* Stepper Local */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => { setModalHomeScore(prev => Math.max(0, prev - 1)); vibrateTap(); }}
                    className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-90 text-white font-black text-xl flex items-center justify-center border border-zinc-700 transition-transform cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-mono text-2xl font-black text-white">{modalHomeScore}</span>
                  <button
                    type="button"
                    onClick={() => { setModalHomeScore(prev => prev + 1); vibrateTap(); }}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-90 text-white font-black text-xl flex items-center justify-center shadow-md shadow-blue-600/30 transition-transform cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center px-2">
                <span className="text-xl font-black text-zinc-600 font-mono">VS</span>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center gap-2 flex-1 text-center">
                <TeamBadge teamName={editingMatch.awayTeam} size="md" />
                <span className="text-xs font-black text-white line-clamp-1">{editingMatch.awayTeam}</span>
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Visita</span>

                {/* Stepper Visita */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => { setModalAwayScore(prev => Math.max(0, prev - 1)); vibrateTap(); }}
                    className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-90 text-white font-black text-xl flex items-center justify-center border border-zinc-700 transition-transform cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-mono text-2xl font-black text-white">{modalAwayScore}</span>
                  <button
                    type="button"
                    onClick={() => { setModalAwayScore(prev => prev + 1); vibrateTap(); }}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-90 text-white font-black text-xl flex items-center justify-center shadow-md shadow-blue-600/30 transition-transform cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Score Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-center">Marcadores Frecuentes</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  [0, 0], [1, 0], [0, 1], [1, 1], [2, 1],
                  [1, 2], [2, 0], [0, 2], [2, 2], [3, 1]
                ].map(([h, a]) => (
                  <button
                    key={`${h}-${a}`}
                    type="button"
                    onClick={() => { setModalHomeScore(h); setModalAwayScore(a); vibrateTap(); }}
                    className={cn(
                      "py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer",
                      modalHomeScore === h && modalAwayScore === a
                        ? "bg-blue-600 text-white border-blue-400"
                        : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800"
                    )}
                  >
                    {h}-{a}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Segmented Control */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-center">Estado del Partido</span>
              <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setModalStatus('pending'); vibrateTap(); }}
                  className={cn(
                    "py-2.5 text-xs font-black uppercase rounded-lg transition-all cursor-pointer",
                    modalStatus === 'pending'
                      ? "bg-zinc-700 text-white shadow"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Por Jugar
                </button>
                <button
                  type="button"
                  onClick={() => { setModalStatus('in_progress'); vibrateTap(); }}
                  className={cn(
                    "py-2.5 text-xs font-black uppercase rounded-lg transition-all cursor-pointer",
                    modalStatus === 'in_progress'
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  En Juego
                </button>
                <button
                  type="button"
                  onClick={() => { setModalStatus('finished'); vibrateTap(); }}
                  className={cn(
                    "py-2.5 text-xs font-black uppercase rounded-lg transition-all cursor-pointer",
                    modalStatus === 'finished'
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Finalizado
                </button>
              </div>
            </div>

            {/* Save and Cancel Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isSavingScoreModal}
                onClick={handleSaveScoreModal}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-98 cursor-pointer"
              >
                {isSavingScoreModal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSavingScoreModal ? 'Guardando...' : 'Guardar Resultado'}</span>
              </button>
              <button
                type="button"
                disabled={isSavingScoreModal}
                onClick={() => setEditingMatch(null)}
                className="px-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </BaseBottomSheet>
      )}

      {/* Gemini / SerpAPI Match Results & Validation Modal */}
      <GeminiApiResultsModal
        isOpen={geminiPreviewData !== null}
        onClose={() => setGeminiPreviewData(null)}
        partidos={geminiPreviewData?.partidos || []}
        rawJson={geminiPreviewData?.rawJson || ''}
        searchQueries={geminiPreviewData?.searchQueries || []}
        isGrounded={geminiPreviewData?.isGrounded || false}
        searchSummary={geminiPreviewData?.searchSummary || ''}
        onConfirm={handleConfirmCommitGemini}
        isSaving={isCommittingGemini}
      />

      {/* SerpAPI Forced Standings Validation Modal */}
      <SerpApiStandingsModal
        isOpen={serpStandingsPreview !== null}
        onClose={() => setSerpStandingsPreview(null)}
        tabla={serpStandingsPreview || []}
        rawJson={serpStandingsRawJson}
        onConfirm={handleConfirmCommitStandings}
        isSaving={isCommittingStandings}
      />

      {/* Modal de Confirmación para Terminar Etapa */}
      {showCloseModal && stageToClose && (
        <BaseBottomSheet
          isOpen={showCloseModal}
          onClose={() => { if (!isClosingStage) setShowCloseModal(false); }}
          title="Finalizar y Cerrar Etapa"
          zIndexClassName="z-[1050]"
        >
          <div className="space-y-4 pb-28 pt-1">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-2">
              <Trophy className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-base font-black text-white">¿Finalizar "{stageToClose.name}"?</h3>
              <p className="text-xs text-zinc-300 max-w-sm mx-auto leading-relaxed">
                Al confirmar, los puntos de los partidos incluidos se congelarán de manera definitiva y se registrará a los siguientes ganadores en el Salón de la Fama:
              </p>
            </div>

            {/* Resumen del Podio que se congelará */}
            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-3 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Podio Oficial de la Etapa:
              </p>
              <div className="space-y-1.5">
                {stageStandingsPreview.slice(0, 3).map((item, idx) => (
                  <div key={item.userId} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                        idx === 0 ? 'bg-amber-500 text-zinc-950' :
                        idx === 1 ? 'bg-zinc-300 text-zinc-950' :
                        'bg-amber-700 text-amber-100'
                      }`}>
                        {idx + 1}
                      </span>
                      <UserAvatar src={item.photoURL} name={item.nickname || item.displayName} size="sm" />
                      <span className="text-xs font-bold text-white truncate max-w-[150px]">
                        {item.nickname || item.displayName}
                      </span>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="text-xs font-black text-amber-400">{item.points} pts</span>
                      <span className="text-[10px] text-zinc-400 block">{item.exactMatches} exactos</span>
                    </div>
                  </div>
                ))}

                {stageStandingsPreview.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-2">
                    No hay participantes registrados con pronósticos para esta etapa.
                  </p>
                )}
              </div>
            </div>

            {/* Botones de Confirmación */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isClosingStage}
                onClick={handleConfirmCloseStage}
                className="flex-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer"
              >
                {isClosingStage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                <span>{isClosingStage ? 'Cerrando y congelando...' : 'Confirmar y Cerrar Etapa'}</span>
              </button>
              <button
                type="button"
                disabled={isClosingStage}
                onClick={() => setShowCloseModal(false)}
                className="px-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </BaseBottomSheet>
      )}

      {/* Salón de Ganadores Históricos Modal */}
      <StageWinnersModal
        isOpen={showWinnersModal}
        onClose={() => setShowWinnersModal(false)}
        stages={stages}
      />

      {/* Match JSON / IA Admin Modal */}
      <MatchJsonModal
        isOpen={!!adminJsonMatch}
        onClose={() => setAdminJsonMatch(null)}
        match={adminJsonMatch?.match || null}
        settings={settings}
        initialMode={adminJsonMatch?.mode || 'manual'}
      />
    </div>

  );
}
