import { vibrateSuccess, vibrateError, vibrateJackpot, vibratePop } from '../lib/haptics';
import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, writeBatch, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match, Prediction } from '../types';
import { useAuth } from '../components/AuthProvider';
import { useSettings } from '../components/SettingsProvider';
import { useGroups } from '../components/GroupsProvider';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TeamBadge } from '../components/TeamBadge';
import { MatchPredictions } from '../components/MatchPredictions';
import { MultiGroupPredictionModal } from '../components/MultiGroupPredictionModal';
import { ScoreNumpadModal } from '../components/ScoreNumpadModal';
import { UCL_LEAGUE_PHASE_MATCHES } from '../data/fixtures';
import { evaluatePrediction } from '../lib/scoring';
import { checkAndAutoSyncFinishedMatches } from '../lib/serpapiSync';
import { 
  Check, 
  Calendar, 
  PlayCircle, 
  CheckCircle, 
  Filter, 
  CheckCircle2, 
  Lock,
  Save,
  Trophy,
  AlertTriangle,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export type StatusFilterType = 'all' | 'open' | 'live' | 'finished';

const TUTORIAL_MOCK_MATCH: Match = {
  id: 'tutorial-mock-match',
  group: 'Jornada 1',
  date: new Date().toISOString(),
  homeTeam: 'FC Barcelona',
  awayTeam: 'Real Madrid',
  homeFlag: 'https://img.sofascore.com/api/v1/team/2817/image',
  awayFlag: 'https://img.sofascore.com/api/v1/team/2829/image',
  homeScore: 2,
  awayScore: 1,
  status: 'in_progress',
  apiId: 99999999,
};

interface PredictionsTabProps {
  isTutorialActive?: boolean;
}

export function PredictionsTab({ isTutorialActive = false }: PredictionsTabProps = {}) {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const { groups: userCommunityGroups, activeGroupId } = useGroups();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [localScores, setLocalScores] = useState<Record<string, {home: string, away: string}>>({});
  const [isRestoring, setIsRestoring] = useState(false);
  const [crossGroupModal, setCrossGroupModal] = useState<{
    isOpen: boolean;
    match: Match | null;
    homeScore: number;
    awayScore: number;
  }>({
    isOpen: false,
    match: null,
    homeScore: 0,
    awayScore: 0
  });
  const [isCrossGroupSaving, setIsCrossGroupSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [scoreModal, setScoreModal] = useState<{
    isOpen: boolean;
    match: Match | null;
    initialFocus: 'home' | 'away';
  }>({
    isOpen: false,
    match: null,
    initialFocus: 'home'
  });

  // Keep live match minutes and lock states reactive in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000); // Re-evaluate every 30 seconds
    return () => clearInterval(timer);
  }, []);

  // Helper to detect corrupt, test, or legacy season matches
  const isCorruptMatch = (m: Match) => {
    if (!m.homeTeam || !m.awayTeam) return true;
    if (m.group === 'Ejemplos Demo') return true;
    if (!m.id?.startsWith('ucl_26_')) return true;
    if (m.homeTeam === 'FC Barcelona' && m.awayTeam === 'Real Madrid') return true;
    if (m.homeTeam === 'Real Madrid' && m.awayTeam === 'FC Barcelona') return true;
    if (m.homeTeam === 'Mexico' || m.awayTeam === 'Team 2') return true;
    if (m.id?.startsWith('match_')) return true;
    // Mark legacy 24/25 fixtures so they migrate to official 26/27
    if (m.apiId && Number(m.apiId) < 16000000) return true;
    if (m.homeTeam === 'BSC Young Boys' || m.awayTeam === 'BSC Young Boys') return true;
    if (m.homeTeam === 'AC Sparta Praha' || m.awayTeam === 'AC Sparta Praha') return true;
    if (m.homeTeam === 'Stade Brestois' || m.awayTeam === 'Stade Brestois') return true;
    if (m.homeTeam === 'Red Bull Salzburg' || m.awayTeam === 'Red Bull Salzburg') return true;
    if (m.homeTeam === 'Juventus' || m.awayTeam === 'Juventus') return true;
    if (m.homeTeam === 'AC Milan' || m.awayTeam === 'AC Milan') return true;
    return false;
  };

  const handleRestoreOfficialMatches = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const snap = await getDocs(collection(db, 'matches'));
      // Delete old/corrupt docs in chunks of 300
      for (let i = 0; i < snap.docs.length; i += 300) {
        const chunk = snap.docs.slice(i, i + 300);
        const deleteBatch = writeBatch(db);
        chunk.forEach(d => deleteBatch.delete(d.ref));
        await deleteBatch.commit();
      }

      // Seed official 144 UCL matches in chunks of 300
      for (let i = 0; i < UCL_LEAGUE_PHASE_MATCHES.length; i += 300) {
        const chunk = UCL_LEAGUE_PHASE_MATCHES.slice(i, i + 300);
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
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Error restoring official matches:", e);
    } finally {
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsubMatches = onSnapshot(collection(db, 'matches'), async (snap) => {
      const rawMatches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      const hasCorrupt = rawMatches.some(isCorruptMatch);
      const isAdminUser = profile?.isAdmin || user.email === 'richarddiaz0107@gmail.com';

      

      // Filter out any corrupted test matches so they NEVER appear in UI
      let cleanMatches = rawMatches.filter(m => !isCorruptMatch(m))
                                   .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      

      const uniqueGroups = Array.from(new Set(cleanMatches.map(m => m.group || 'Fase Regular'))).sort();
      setGroups(['All', ...uniqueGroups]);
      setMatches(cleanMatches);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'matches'));

    return () => unsubMatches();
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;
    setPredictions({});
    setLocalScores({});

    const currentGroupId = activeGroupId || 'default';
    const predictionsQuery = query(
      collection(db, 'predictions'),
      where('userId', '==', user.uid),
      where('groupId', '==', currentGroupId)
    );

    const unsubPreds = onSnapshot(predictionsQuery, (snap) => {
      const preds: Record<string, Prediction> = {};
      const scores: Record<string, {home: string, away: string}> = {};
      snap.docs.forEach(d => {
        const p = d.data() as Prediction;
        preds[p.matchId] = { ...p, id: d.id };
        scores[p.matchId] = { home: String(p.homeScore), away: String(p.awayScore) };
      });
      setPredictions(preds);
      setLocalScores(scores);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'predictions'));

    return () => unsubPreds();
  }, [user, activeGroupId]);

  // Sistema de Actualización Inteligente y Automática por Partido (SerpAPI + Gemini + Candado)
  useEffect(() => {
    if (!matches || matches.length === 0) return;

    // Ejecuta la verificación automática cuando los partidos cargan o cambian
    checkAndAutoSyncFinishedMatches(matches, settings).catch(err => {
      console.warn("[PredictionsTab] Error en auto-sync de partidos:", err);
    });

    // Revisa periódicamente cada 60 segundos
    const interval = setInterval(() => {
      checkAndAutoSyncFinishedMatches(matches, settings).catch(err => {
        console.warn("[PredictionsTab] Error en intervalo de auto-sync:", err);
      });
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [matches, settings]);

  const handleScoreChange = (matchId: string, type: 'home' | 'away', val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(0, 2);
    setLocalScores(prev => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || { home: '', away: '' }),
        [type]: cleanVal
      }
    }));
  };

  const isMatchLocked = (matchDateStr: string) => {
    const matchTime = new Date(matchDateStr).getTime();
    const lockMins = settings?.blockMinutesBeforeMatch ?? 15;
    return currentTime >= (matchTime - (lockMins * 60 * 1000));
  };

  const getMatchLiveInfo = (match: Match) => {
    if (match.status === 'finished') {
      return { isLive: false, label: 'Finalizado' };
    }
    
    const matchTime = new Date(match.date).getTime();
    const isStarted = currentTime >= matchTime;
    
    if (match.status === 'in_progress' || isStarted) {
      const elapsedMinutes = Math.floor((currentTime - matchTime) / (60 * 1000));
      
      if (elapsedMinutes < 0) {
        return { isLive: false, label: 'Por Jugar' };
      }
      
      if (elapsedMinutes <= 45) {
        return { isLive: true, label: `1T ${Math.max(1, elapsedMinutes)}'` };
      } else if (elapsedMinutes <= 60) {
        return { isLive: true, label: 'Entretiempo' };
      } else if (elapsedMinutes <= 105) {
        const secondHalfMin = 45 + (elapsedMinutes - 60);
        return { isLive: true, label: `2T ${Math.min(90, secondHalfMin)}'` };
      } else if (elapsedMinutes <= 125) {
        return { isLive: true, label: '90+\'' };
      } else {
        return { isLive: true, label: 'Por Confirmar' };
      }
    }
    
    return { isLive: false, label: 'Por Jugar' };
  };

  const openScoreModal = (match: Match, focus: 'home' | 'away' = 'home') => {
    const isLocked = isMatchLocked(match.date);
    const liveInfo = getMatchLiveInfo(match);
    if (match.status === 'finished' || match.status === 'in_progress' || isLocked || liveInfo.isLive) {
      vibrateError();
      return;
    }
    vibratePop();
    setScoreModal({
      isOpen: true,
      match,
      initialFocus: focus
    });
  };

  const savePrediction = async (matchId: string, overrideHome?: number, overrideAway?: number) => {
    if (!user) return;

    const match = matches.find(m => m.id === matchId);
    if (match) {
      const isLocked = isMatchLocked(match.date);
      const liveInfo = getMatchLiveInfo(match);
      if (match.status === 'finished' || match.status === 'in_progress' || isLocked || liveInfo.isLive) {
        console.warn("Partido bloqueado o en juego, no se puede pronosticar");
        return;
      }
    }

    const scores = localScores[matchId] || { home: '', away: '' };
    
    // Si se especifican valores (desde el modal numpad), se usan directamente; sino, se transforman los inputs locales
    const homeVal = overrideHome !== undefined
      ? overrideHome
      : (scores.home === '' || isNaN(parseInt(scores.home, 10)) ? 0 : Math.max(0, parseInt(scores.home, 10)));
    const awayVal = overrideAway !== undefined
      ? overrideAway
      : (scores.away === '' || isNaN(parseInt(scores.away, 10)) ? 0 : Math.max(0, parseInt(scores.away, 10)));

    // Update local state immediately to reflect '0'
    setLocalScores(prev => ({
      ...prev,
      [matchId]: { home: String(homeVal), away: String(awayVal) }
    }));
    
    setSavingId(matchId);
    try {
      const currentGroupId = activeGroupId || 'default';
      const predId = `${user.uid}_${currentGroupId}_${matchId}`;
      const predRef = doc(db, 'predictions', predId);
      const batch = writeBatch(db);
      
      const match = matches.find(m => m.id === matchId);
      let calculatedPoints = 0;
      if (match && match.status === 'finished') {
        const evalRes = evaluatePrediction(match.homeScore, match.awayScore, homeVal, awayVal, 'finished', true, settings);
        calculatedPoints = evalRes.points;
      }
      
      const data: Prediction = {
        id: predId,
        userId: user.uid,
        matchId,
        groupId: currentGroupId,
        homeScore: homeVal,
        awayScore: awayVal,
        pointsEarned: calculatedPoints,
        updatedAt: Date.now(),
      };
      
      batch.set(predRef, data);
      await batch.commit();
      vibrateSuccess();

      // Check if user belongs to more than 1 active group
      const otherGroups = userCommunityGroups.filter(g => g.id !== currentGroupId);
      if (otherGroups.length > 0 && match) {
        setCrossGroupModal({
          isOpen: true,
          match,
          homeScore: homeVal,
          awayScore: awayVal
        });
      }
    } catch(e) {
      console.error(e);
      vibrateError();
      alert('Error al guardar la apuesta');
    }
    setSavingId(null);
  };

  const handleConfirmCrossGroupSave = async (selectedGroupIds: string[]) => {
    if (!user || !crossGroupModal.match) return;
    const match = crossGroupModal.match;
    const isLocked = isMatchLocked(match.date);
    const liveInfo = getMatchLiveInfo(match);
    if (match.status === 'finished' || match.status === 'in_progress' || isLocked || liveInfo.isLive) {
      console.warn("Partido bloqueado o en juego, no se puede pronosticar");
      setCrossGroupModal(prev => ({ ...prev, isOpen: false }));
      return;
    }

    setIsCrossGroupSaving(true);
    try {
      const matchId = crossGroupModal.match.id;
      const homeVal = crossGroupModal.homeScore;
      const awayVal = crossGroupModal.awayScore;

      let calculatedPoints = 0;
      if (match.status === 'finished') {
        const evalRes = evaluatePrediction(match.homeScore, match.awayScore, homeVal, awayVal, 'finished', true, settings);
        calculatedPoints = evalRes.points;
      }

      const batch = writeBatch(db);
      for (const targetGroupId of selectedGroupIds) {
        const targetPredId = `${user.uid}_${targetGroupId}_${matchId}`;
        const targetPredRef = doc(db, 'predictions', targetPredId);
        const data: Prediction = {
          id: targetPredId,
          userId: user.uid,
          matchId,
          groupId: targetGroupId,
          homeScore: homeVal,
          awayScore: awayVal,
          pointsEarned: calculatedPoints,
          updatedAt: Date.now(),
        };
        batch.set(targetPredRef, data);
      }

      await batch.commit();
      vibrateSuccess();
      setCrossGroupModal(prev => ({ ...prev, isOpen: false }));
    } catch(e) {
      console.error('Error saving predictions across groups:', e);
      vibrateError();
      alert('Error al guardar en los otros grupos');
    } finally {
      setIsCrossGroupSaving(false);
    }
  };

  const openMatchesCount = matches.filter(m => m.status === 'pending' && !isMatchLocked(m.date) && !getMatchLiveInfo(m).isLive).length;
  const liveMatchesCount = matches.filter(m => getMatchLiveInfo(m).isLive).length;
  const finishedMatchesCount = matches.filter(m => m.status === 'finished').length;
  const totalMatchesCount = matches.length;

  const filteredMatches = matches.filter(match => {
    const liveInfo = getMatchLiveInfo(match);
    if (statusFilter === 'open') {
      const isLocked = isMatchLocked(match.date);
      if (match.status !== 'pending' || isLocked || liveInfo.isLive) return false;
    }
    if (statusFilter === 'live') {
      if (!liveInfo.isLive) return false;
    }
    if (statusFilter === 'finished') {
      if (match.status !== 'finished') return false;
    }
    if (selectedGroup !== 'All' && (match.group || 'Fase Regular') !== selectedGroup) return false;
    return true;
  });

  const formatMatchDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, "EEE d MMM · HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const getGroupButtonLabel = (g: string) => {
    if (g === 'All') return 'TODAS';
    if (g.toLowerCase().startsWith('jornada') || g.toLowerCase().startsWith('round') || g.toLowerCase().startsWith('grupo') || g.toLowerCase().startsWith('fase')) {
      return g.toUpperCase();
    }
    return `J${g}`.toUpperCase();
  };

  if (loading && !isTutorialActive) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 text-zinc-400">
        <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-zinc-800 animate-spin" />
        <p className="text-sm font-bold uppercase tracking-widest">Cargando partidos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] p-2 sm:p-4 md:p-6 space-y-2.5 max-w-4xl mx-auto font-sans text-zinc-200 pb-28 sm:pb-32">
      {/* Header Denso con Título Arriba */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1.5">
        <div>
          <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <span>Partidos y Apuestas</span>
          </h1>
          <p className="text-[10px] sm:text-xs text-zinc-400">
            Ingresa tus marcadores antes del cierre
          </p>
        </div>
        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
          {matches.length} partidos
        </span>
      </div>

      {/* Tutorial Highlight Target for Filters & Jornadas */}
      <div id="tutorial-filters-and-rounds" className="space-y-2">
        {/* Status Filter Tabs (TODOS, ABIERTOS, EN VIVO, FINALIZADOS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-[#121215] p-0.5 rounded-xl border border-zinc-800 shadow-inner gap-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Todos</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
              statusFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {totalMatchesCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('open')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              statusFilter === 'open'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'open' ? 'bg-white' : 'bg-emerald-400'}`} />
              Abiertos
            </span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
              statusFilter === 'open' ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {openMatchesCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('live')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              statusFilter === 'live'
                ? 'bg-amber-600 text-white shadow-sm font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${liveMatchesCount > 0 ? 'animate-pulse' : ''} ${statusFilter === 'live' ? 'bg-white' : 'bg-amber-400'}`} />
              En Vivo
            </span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
              statusFilter === 'live' ? 'bg-amber-700 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {liveMatchesCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('finished')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              statusFilter === 'finished'
                ? 'bg-blue-600 text-white shadow-sm font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Finalizados</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
              statusFilter === 'finished' ? 'bg-blue-700 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {finishedMatchesCount}
            </span>
          </button>
        </div>

        {/* Jornadas Horizontal Scroller Denso */}
        {((isTutorialActive && groups.length <= 1 ? ['All', 'Jornada 1', 'Jornada 2', 'Jornada 3'] : groups).length > 1) && (
          <div className="flex gap-1 overflow-x-auto pb-0.5 pt-0.5 scrollbar-none -mx-1 px-1">
            {(isTutorialActive && groups.length <= 1 ? ['All', 'Jornada 1', 'Jornada 2', 'Jornada 3'] : groups).map(g => (
               <button 
                 key={g} 
                 onClick={() => setSelectedGroup(g)}
                 className={`h-7 px-2.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all select-none shrink-0 ${
                   selectedGroup === g 
                     ? 'bg-white text-zinc-950 font-black shadow-sm' 
                     : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                 }`}
               >
                 {getGroupButtonLabel(g)}
               </button>
            ))}
          </div>
        )}
      </div>

      {/* Match Cards List Denso y Estructurado */}
      <div className="space-y-2 pb-8">
        {(isTutorialActive ? [TUTORIAL_MOCK_MATCH, ...filteredMatches.filter(m => m.id !== 'tutorial-mock-match')] : filteredMatches).map((match, idx) => {
          const isTutorialItem = match.id === 'tutorial-mock-match';
          const isFinished = match.status === 'finished';
          const liveInfo = getMatchLiveInfo(match);
          const isInProgress = isTutorialItem ? false : (liveInfo.isLive || match.status === 'in_progress');
          const isScheduleLocked = isTutorialItem ? false : isMatchLocked(match.date);
          const locked = isTutorialItem ? false : (isFinished || isInProgress || isScheduleLocked);
          const pred = isTutorialItem
            ? ({ id: 'tutorial-pred-me', userId: user?.uid || 'me', matchId: match.id, homeScore: 2, awayScore: 1, pointsEarned: 5, updatedAt: Date.now() } as Prediction)
            : predictions[match.id];
          const hasSaved = isTutorialItem ? true : !!pred;
          
          const scores = isTutorialItem 
            ? { home: '2', away: '1' }
            : (localScores[match.id] || { 
                home: pred ? String(pred.homeScore) : '', 
                away: pred ? String(pred.awayScore) : '' 
              });

          const isSaving = savingId === match.id;
          const hasValidInputs = scores.home !== '' && scores.away !== '';
          const hasChanges = hasValidInputs && (
            !pred || 
            String(pred.homeScore) !== scores.home || 
            String(pred.awayScore) !== scores.away
          );

          const effectiveStatus: 'pending' | 'in_progress' | 'finished' = isFinished
            ? 'finished'
            : (isInProgress ? 'in_progress' : 'pending');

          const evalResult = evaluatePrediction(
            match.homeScore,
            match.awayScore,
            pred?.homeScore ?? null,
            pred?.awayScore ?? null,
            effectiveStatus,
            locked,
            settings
          );

          return (
            <div 
              key={match.id} 
              id={isTutorialItem ? "tutorial-first-match-card" : (idx === 0 && !isTutorialActive ? "tutorial-first-match-card" : undefined)}
              className={`bg-[#111114] border rounded-xl p-2 sm:p-3 shadow-sm transition-all ${
                evalResult.type === 'exact'
                  ? 'border-emerald-500/50 bg-[#0a1712]'
                  : evalResult.type === 'outcome'
                    ? 'border-blue-500/40 bg-[#0c1a2e]'
                    : isFinished 
                      ? 'border-zinc-800/80 bg-[#111113]' 
                      : isInProgress
                        ? 'border-amber-900/40 bg-[#141210]' 
                        : locked
                          ? 'border-zinc-800/80 bg-[#111113]'
                          : 'border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              {/* Header: Date + Round + Status Badge */}
              <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-1.5 mb-1.5 border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center">
                    {isFinished ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-700/50">Finalizado</span>
                    ) : isInProgress ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        {liveInfo.label === 'Por Confirmar' ? 'Por Confirmar' : `En Vivo · ${liveInfo.label}`}
                      </span>
                    ) : locked ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Cerrado</span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Abierto</span>
                    )}
                  </div>
                  <span className="font-mono flex items-center gap-1 capitalize truncate">
                    <Calendar className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span>{formatMatchDate(match.date)}</span>
                  </span>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800/80">
                    {match.group || 'Fase de Liga'}
                  </span>
                </div>
              </div>

              {/* Matchup Layout Denso */}
              <div className="flex items-center justify-between gap-1 sm:gap-3 py-0.5">
                
                {/* Home Team */}
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <TeamBadge 
                    src={match.homeFlag} 
                    teamName={match.homeTeam} 
                    className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 drop-shadow-sm" 
                  />
                  <span className="text-[11px] sm:text-xs font-bold text-white leading-tight line-clamp-2 whitespace-normal break-words" title={match.homeTeam}>
                    {match.homeTeam}
                  </span>
                </div>

                {/* Center Score & Betting Controls */}
                <div className="shrink-0 flex flex-col items-center justify-center gap-1 px-1">
                  {isFinished || locked ? (
                    <>
                      <div className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-700/80 px-2 py-0.5 rounded-lg font-mono text-sm sm:text-base font-black text-white">
                        <span>{isInProgress || isFinished ? (match.homeScore ?? 0) : (match.homeScore ?? '-')}</span>
                        <span className="text-zinc-500 text-xs">-</span>
                        <span>{isInProgress || isFinished ? (match.awayScore ?? 0) : (match.awayScore ?? '-')}</span>
                      </div>
                      <div className="flex items-center justify-center mt-1">
                        {hasSaved ? (
                          <div className="flex items-center gap-1.5 bg-blue-900/20 border border-blue-500/30 rounded-lg px-2 py-0.5">
                            <span className="text-[9px] text-blue-400 uppercase tracking-widest font-bold">Apuesta:</span>
                            <span className="text-xs font-black text-blue-300 font-mono">{pred.homeScore}-{pred.awayScore}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-800">Sin apuesta</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onTouchStart={() => vibratePop()}
                          onClick={() => openScoreModal(match, 'home')}
                          className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-900/30 hover:bg-blue-900/50 active:scale-95 border-2 border-blue-500/60 hover:border-blue-400 rounded-xl text-center text-sm sm:text-base font-black text-white font-mono flex items-center justify-center transition-all shadow-sm cursor-pointer select-none"
                          title="Pronosticar goles Local"
                        >
                          {scores.home !== '' ? scores.home : (hasSaved ? pred.homeScore : '-')}
                        </button>
                        <span className="text-zinc-500 font-black text-[10px] select-none">VS</span>
                        <button
                          type="button"
                          onTouchStart={() => vibratePop()}
                          onClick={() => openScoreModal(match, 'away')}
                          className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-900/30 hover:bg-blue-900/50 active:scale-95 border-2 border-blue-500/60 hover:border-blue-400 rounded-xl text-center text-sm sm:text-base font-black text-white font-mono flex items-center justify-center transition-all shadow-sm cursor-pointer select-none"
                          title="Pronosticar goles Visitante"
                        >
                          {scores.away !== '' ? scores.away : (hasSaved ? pred.awayScore : '-')}
                        </button>
                      </div>
                      <div className="flex items-center justify-center mt-1 min-h-[22px]">
                        {hasSaved ? (
                          <button
                            type="button"
                            onTouchStart={() => vibratePop()}
                            onClick={() => openScoreModal(match, 'home')}
                            className="text-[9px] text-emerald-400 hover:text-emerald-300 uppercase tracking-widest font-bold bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer select-none"
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>Guardado</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onTouchStart={() => vibratePop()}
                            onClick={() => openScoreModal(match, 'home')}
                            className="text-[9px] text-blue-400 hover:text-blue-300 uppercase tracking-widest font-bold bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-lg border border-blue-500/30 transition-all cursor-pointer select-none"
                          >
                            Tu Pronóstico
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0 text-right">
                  <span className="text-[11px] sm:text-xs font-bold text-white leading-tight line-clamp-2 whitespace-normal break-words" title={match.awayTeam}>
                    {match.awayTeam}
                  </span>
                  <TeamBadge 
                    src={match.awayFlag} 
                    teamName={match.awayTeam} 
                    className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 drop-shadow-sm" 
                  />
                </div>

              </div>
              <MatchPredictions 
                matchId={match.id} 
                locked={locked || isFinished} 
                matchStatus={effectiveStatus} 
                matchHomeTeam={match.homeTeam} 
                matchAwayTeam={match.awayTeam} 
                matchHomeScore={match.homeScore}
                matchAwayScore={match.awayScore}
                isJackpot={evalResult.type === 'exact'}
                isTutorialActive={isTutorialItem}
                pointsNode={
                  (isFinished || isTutorialItem) && hasSaved && evalResult.points > 0 ? (
                    <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shadow-sm border border-amber-500/20">
                      +{evalResult.points}p
                    </span>
                  ) : null
                }
              />
            </div>
          );
        })}

        {!isTutorialActive && filteredMatches.length === 0 && (
          <div className="text-center bg-[#121215] border border-zinc-800 rounded-xl text-zinc-400 p-6 space-y-2">
            <Filter className="w-5 h-5 mx-auto text-zinc-500" />
            <p className="text-xs font-semibold text-white">No hay partidos en este filtro</p>
          </div>
        )}
      </div>

      <MultiGroupPredictionModal
        isOpen={crossGroupModal.isOpen}
        onClose={() => setCrossGroupModal(prev => ({ ...prev, isOpen: false }))}
        match={crossGroupModal.match}
        homeScore={crossGroupModal.homeScore}
        awayScore={crossGroupModal.awayScore}
        otherGroups={userCommunityGroups.filter(g => g.id !== (activeGroupId || 'default'))}
        onConfirm={handleConfirmCrossGroupSave}
        isSaving={isCrossGroupSaving}
      />

      <ScoreNumpadModal
        isOpen={scoreModal.isOpen}
        onClose={() => setScoreModal(prev => ({ ...prev, isOpen: false }))}
        match={scoreModal.match}
        initialHomeScore={scoreModal.match ? (localScores[scoreModal.match.id]?.home ?? (predictions[scoreModal.match.id]?.homeScore !== undefined ? String(predictions[scoreModal.match.id].homeScore) : '')) : ''}
        initialAwayScore={scoreModal.match ? (localScores[scoreModal.match.id]?.away ?? (predictions[scoreModal.match.id]?.awayScore !== undefined ? String(predictions[scoreModal.match.id].awayScore) : '')) : ''}
        initialFocus={scoreModal.initialFocus}
        onSave={async (matchId, homeVal, awayVal) => {
          await savePrediction(matchId, homeVal, awayVal);
        }}
        isSaving={savingId === scoreModal.match?.id}
      />
    </div>
  );
}
