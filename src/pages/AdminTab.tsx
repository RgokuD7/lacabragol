import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useGroups } from '../components/GroupsProvider';
import { db } from '../lib/firebase';
import { collection, doc, query, onSnapshot, getDocs, writeBatch, updateDoc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { Match, Prediction, User, Setting } from '../types';
import { ShieldAlert, RefreshCw, Sparkles, PlayCircle, Search, ShieldCheck, Check, X, AlertCircle, AlertTriangle, Trash2, Loader2, CheckCircle2, UserPlus, FileCode, RotateCcw, Users, Plus, Table2, Edit3, Save, Key } from 'lucide-react';
import { TeamBadge } from '../components/TeamBadge';
import { UCL_LEAGUE_PHASE_MATCHES } from '../data/fixtures';
import { PlayerItem, DEFAULT_PLAYERS, deduplicatePlayers, normalizePlayerKey, formatNationality, formatPosition } from '../data/players';
import { cn } from '../lib/utils';
import { useSettings } from '../components/SettingsProvider';
import { BaseBottomSheet } from '../components/BaseBottomSheet';
import { recalculateStandings } from '../lib/standings';
import { 
  fetchGeminiMatchesPreview, 
  commitGeminiMatchesToFirestore, 
  getGeminiApiKey, 
  setGeminiApiKey, 
  GeminiPreviewResult 
} from '../lib/geminiSync';
import { GeminiApiResultsModal } from '../components/GeminiApiResultsModal';
import { syncMatchPredictionsAndPoints } from '../lib/sync';
import { vibrateTap, vibrateSuccess, vibrateError } from '../lib/haptics';

export function AdminTab({ inline, onBack }: { inline?: boolean, onBack?: () => void }) {
  const { user, profile } = useAuth();
  const { groups, activeGroupId } = useGroups();
  const { settings } = useSettings();
  const [adminTab, setAdminTab] = useState<'actions' | 'scores' | 'users' | 'players'>('actions');

  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [matchSearch, setMatchSearch] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  
  const [matchScores, setMatchScores] = useState<Record<string, { home: string, away: string, status: string }>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Admin touch score editor modal state (prevents virtual keyboard layout shifts)
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [modalHomeScore, setModalHomeScore] = useState<number>(0);
  const [modalAwayScore, setModalAwayScore] = useState<number>(0);
  const [modalStatus, setModalStatus] = useState<'pending' | 'in_progress' | 'finished'>('pending');
  const [isSavingScoreModal, setIsSavingScoreModal] = useState(false);

  // Standings recalculation state
  const [isRecalculatingStandings, setIsRecalculatingStandings] = useState(false);

  // Gemini Daily Sync state
  const [isSyncingGemini, setIsSyncingGemini] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(getGeminiApiKey());
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [geminiPreviewData, setGeminiPreviewData] = useState<GeminiPreviewResult | null>(null);
  const [isCommittingGemini, setIsCommittingGemini] = useState(false);

  // Status and management states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
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
    try {
      const res = await recalculateStandings();
      if (res.success) {
        vibrateSuccess();
        setFeedback({ 
          type: 'success', 
          text: `Tabla UCL recalculada exitosamente: ${res.processedMatches} partidos procesados para los 36 equipos.` 
        });
      } else {
        vibrateError();
        setFeedback({ type: 'error', text: res.error || 'Error al recalcular la tabla.' });
      }
    } catch (err: any) {
      vibrateError();
      setFeedback({ type: 'error', text: err.message });
    }
    setIsRecalculatingStandings(false);
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

  const toggleUserPaid = async (uid: string, current: boolean) => {
    try { await updateDoc(doc(db, 'users', uid), { paid: !current }); } catch(e) {}
  };
  
  const toggleUserAdmin = async (uid: string, current: boolean) => {
    try { await updateDoc(doc(db, 'users', uid), { isAdmin: !current }); } catch(e) {}
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
            : 'bg-blue-950/40 border-blue-800/60 text-blue-300'
        }`}>
          {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />}
          {feedback.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />}
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
      </div>

      {adminTab === 'actions' && (
        <div className="space-y-6">
          {/* Sincronización Inteligente con Gemini IA */}
          <div className="bg-[#121215] border border-blue-500/30 rounded-xl p-3 sm:p-4 space-y-4 bg-gradient-to-b from-blue-950/20 to-transparent">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Sincronización Inteligente Gemini IA</h3>
                  <p className="text-[10px] text-zinc-400">Actualiza resultados de hoy y en juego vía Google Gemini API</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGeminiConfig(!showGeminiConfig)}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors border border-zinc-700/60"
                title="Configurar Gemini API Key"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            </div>

            {showGeminiConfig && (
              <div className="bg-black/60 border border-zinc-800 rounded-xl p-3 space-y-2 animate-in fade-in">
                <label className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Gemini API Key</label>
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
                    className="px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    {geminiKeySaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{geminiKeySaved ? 'Guardado' : 'Guardar'}</span>
                  </button>
                </div>
                <p className="text-[9px] text-zinc-500">Se guarda localmente en el navegador para consultas de administrador.</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleSyncGeminiDaily}
                disabled={isSyncingGemini}
                className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                {isSyncingGemini ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                <span>{isSyncingGemini ? 'Consultando Gemini IA...' : 'Consultar Resultados de Hoy (Gemini IA)'}</span>
              </button>
            </div>
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
                        currentStatus === 'in_progress' ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse" :
                        "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      )}>
                        {currentStatus === 'finished' ? 'Finalizado' : currentStatus === 'in_progress' ? 'En Juego' : 'Por Jugar'}
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

      {/* Touch-Friendly Score Editor Modal (Bottom Sheet) */}
      {editingMatch && (
        <BaseBottomSheet
          isOpen={!!editingMatch}
          onClose={() => setEditingMatch(null)}
          title="Editar Resultado Oficial"
        >
          <div className="space-y-6 pb-6 pt-2">
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

      {/* Gemini API Results & Validation Modal */}
      <GeminiApiResultsModal
        isOpen={geminiPreviewData !== null}
        onClose={() => setGeminiPreviewData(null)}
        partidos={geminiPreviewData?.partidos || []}
        rawJson={geminiPreviewData?.rawJson || ''}
        searchQueries={geminiPreviewData?.searchQueries || []}
        isGrounded={geminiPreviewData?.isGrounded || false}
        onConfirm={handleConfirmCommitGemini}
        isSaving={isCommittingGemini}
      />
    </div>
  );
}
