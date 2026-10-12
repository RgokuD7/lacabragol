import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useGroups } from '../components/GroupsProvider';
import { db } from '../lib/firebase';
import { collection, doc, query, where, onSnapshot, getDocs, writeBatch, updateDoc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Match, Prediction, User, Setting, Stage, StageStandingItem } from '../types';
import { ShieldAlert, RefreshCw, Sparkles, PlayCircle, Search, ShieldCheck, Check, X, AlertCircle, AlertTriangle, Trash2, Loader2, CheckCircle2, UserPlus, FileCode, RotateCcw, Users, Plus, Table2, Edit3, Save, Key, Trophy, Flame, Layers, Flag, Calendar, Clock, Crown, Medal, Target, CheckSquare, Square, ChevronRight } from 'lucide-react';
import { TeamBadge } from '../components/TeamBadge';
import { UCL_LEAGUE_PHASE_MATCHES } from '../data/fixtures';
import { PlayerItem, DEFAULT_PLAYERS, deduplicatePlayers, normalizePlayerKey, formatNationality, formatPosition } from '../data/players';
import { cn } from '../lib/utils';
import { useSettings } from '../components/SettingsProvider';
import { BaseBottomSheet } from '../components/BaseBottomSheet';
import { UserAvatar } from '../components/UserAvatar';
import { recalculateStandings } from '../lib/standings';
import { recalculateAllUsersFromDatabase } from '../lib/recalculation';
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
  const [playerSearch, setPlayerSearch] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('');
  const [newPlayerNationality, setNewPlayerNationality] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [isSavingPlayers, setIsSavingPlayers] = useState(false);
  const [isResettingPlayers, setIsResettingPlayers] = useState(false);

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
        const firestoreFormatted: PlayerItem[] = snap.data().players.map((p: any) => ({
          ...p,
          nationality: formatNationality(p.nationality),
          position: formatPosition(p.position)
        }));
        const { merged } = deduplicatePlayers(DEFAULT_PLAYERS, firestoreFormatted);
        setPodiumPlayers(merged);
      } else {
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

  const filteredPodiumPlayers = podiumPlayers.filter(p => {
    const q = playerSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || 
      (p.team && p.team.toLowerCase().includes(q)) ||
      (p.position && p.position.toLowerCase().includes(q)) ||
      (p.nationality && p.nationality.toLowerCase().includes(q));
  });

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
    try {
      await setDoc(doc(db, 'system', 'players'), {
        players: updatedList,
        updatedAt: Date.now(),
        updatedBy: user?.email || 'admin'
      });
      setFeedback({ type: 'success', text: message });
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', text: `Error al guardar jugadores: ${e?.message || 'Error desconocido'}` });
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
      id: Math.floor(100000 + Math.random() * 900000)
    };
    const { merged, addedCount, updatedCount } = deduplicatePlayers(podiumPlayers, [incoming]);
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
  };

  const handleDeletePlayer = async (player: PlayerItem) => {
    if (!window.confirm(`¿Estás seguro de eliminar a "${player.name}" de la lista de candidatos?`)) return;
    const keyToDelete = normalizePlayerKey(player.name);
    const updated = podiumPlayers.filter(p => normalizePlayerKey(p.name) !== keyToDelete);
    await handleSavePlayers(updated, `Jugador "${player.name}" eliminado de la lista.`);
  };

  const handleImportJson = async () => {
    if (!jsonInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonInput);
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
      await setDoc(doc(db, 'system', 'players'), {
        players: DEFAULT_PLAYERS,
        updatedAt: Date.now(),
        updatedBy: user?.email || 'admin'
      });
      setFeedback({ type: 'success', text: `Lista oficial 2026/27 restaurada con éxito (${DEFAULT_PLAYERS.length} jugadores).` });
    } catch (e: any) {
      setFeedback({ type: 'error', text: `Error al restaurar lista: ${e?.message || 'Error desconocido'}` });
    } finally {
      setIsResettingPlayers(false);
    }
  };

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
          onClick={() => setAdminTab('actions')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
            adminTab === 'actions'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          Acciones
        </button>
        <button
          onClick={() => setAdminTab('scores')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
            adminTab === 'scores'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          Resultados Reales
        </button>
        <button
          onClick={() => setAdminTab('users')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
            adminTab === 'users'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          Usuarios
        </button>
        <button
          onClick={() => setAdminTab('players')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
            adminTab === 'players'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-300'
          }`}
        >
          Jugadores Podio ({podiumPlayers.length})
        </button>
        <button
          onClick={() => setAdminTab('stages')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
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
                        (currentStatus === 'in_progress' || (m.estado && (m.estado.toLowerCase().includes('vivo') || /\d+['’]/.test(m.estado)))) ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse" :
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
          {/* Action Bar */}
          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Jugadores para Podio / Candidatos</h3>
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-black">
                    {podiumPlayers.length}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Controla la lista de estrellas disponibles para que los participantes elijan Goleador, Asistente y MVP.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowJsonInput(!showJsonInput)}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <FileCode className="w-4 h-4 text-blue-400" />
                  {showJsonInput ? 'Ocultar JSON' : 'Importar JSON'}
                </button>
                <button
                  onClick={handleResetToDefaultPlayers}
                  disabled={isResettingPlayers || isSavingPlayers}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Restablece la lista a las estrellas oficiales 2026/27 (con Olise, sin Lewandowski)"
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
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center gap-1.5"
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
                Agregar Jugador Manualmente
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Nombre Completo *"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Equipo (Ej: Real Madrid)"
                  value={newPlayerTeam}
                  onChange={(e) => setNewPlayerTeam(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Posición (Ej: Delantero)"
                  value={newPlayerPosition}
                  onChange={(e) => setNewPlayerPosition(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nacionalidad (Ej: Francia)"
                    value={newPlayerNationality}
                    onChange={(e) => setNewPlayerNationality(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isSavingPlayers || !newPlayerName.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1"
                  >
                    {isSavingPlayers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Agregar
                  </button>
                </div>
              </div>
            </form>
          </div>

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
              <span className="text-xs text-zinc-500 whitespace-nowrap">
                Mostrando {filteredPodiumPlayers.length} de {podiumPlayers.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredPodiumPlayers.map((player) => (
                <div
                  key={player.id || player.name}
                  className="bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 group transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=27272a&color=fff&size=80&bold=true`}
                      alt={player.name}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-zinc-700/50"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{player.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {player.team && (
                          <span className="text-[10px] text-zinc-400 truncate max-w-[120px]">
                            {player.team}
                          </span>
                        )}
                        {player.nationality && (
                          <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-medium border border-zinc-700/50">
                            {formatNationality(player.nationality)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeletePlayer(player)}
                    disabled={isSavingPlayers}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0 disabled:opacity-30"
                    title={`Eliminar a ${player.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {filteredPodiumPlayers.length === 0 && (
              <div className="text-center py-8 text-zinc-500 text-xs">
                No se encontraron jugadores que coincidan con "{playerSearch}".
              </div>
            )}
          </div>
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
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
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
    </div>

  );
}
