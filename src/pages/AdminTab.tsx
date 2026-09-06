import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useGroups } from '../components/GroupsProvider';
import { db } from '../lib/firebase';
import { collection, doc, query, onSnapshot, getDocs, writeBatch, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Match, Prediction, User, Setting } from '../types';
import { ShieldAlert, RefreshCw, Sparkles, PlayCircle, Search, ShieldCheck, Check, X, AlertCircle, AlertTriangle, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { TeamBadge } from '../components/TeamBadge';
import { UCL_LEAGUE_PHASE_MATCHES } from '../data/fixtures';

export function AdminTab({ inline, onBack }: { inline?: boolean, onBack?: () => void }) {
  const { user, profile } = useAuth();
  const { groups, activeGroupId } = useGroups();
  const [adminTab, setAdminTab] = useState<'actions' | 'scores' | 'users'>('actions');

  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [matchSearch, setMatchSearch] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  
  const [matchScores, setMatchScores] = useState<Record<string, { home: string, away: string, status: string }>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Status and management states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isDeletingTests, setIsDeletingTests] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isRestoringOfficial, setIsRestoringOfficial] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);

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

    return () => {
      unsubMatches();
      unsubUsers();
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
    return (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
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
      setFeedback({ type: 'success', text: 'Resultado del partido actualizado correctamente.' });
    } catch(e) {
      console.error(e);
      setFeedback({ type: 'error', text: 'Error guardando partido' });
    }
    setIsSaving(false);
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
      </div>

      {adminTab === 'actions' && (
        <div className="space-y-6">
          <div className="bg-[#121215] border border-zinc-800 rounded-lg p-3 sm:p-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-400" />
              <span>Sincronización Técnica</span>
            </h3>
            
            <div className="bg-[#121215] border border-blue-500/30 rounded-xl p-3 sm:p-2 flex flex-col justify-between space-y-3 hover:border-blue-500/60 transition-all bg-gradient-to-b from-blue-950/10 to-transparent">
              <div>
                <h3 className="text-xs font-black text-white">Re-evaluar Partidos</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Fuerza una re-evaluación completa (Proximamente un Cloud Function).</p>
              </div>
            </div>
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
          <div className="bg-[#121215] border border-zinc-800 rounded-lg p-2 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  placeholder="Buscar equipo..."
                  className="w-full bg-[#121215] border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            {filteredMatches.map(m => {
              const ms = matchScores[m.id] || { home: '', away: '', status: 'pending' };
              return (
                <div key={m.id} className="bg-zinc-900 border border-zinc-800/80 rounded-lg p-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                       <span className="text-white text-xs font-bold truncate block">{m.homeTeam} vs {m.awayTeam}</span>
                       <span className="text-[10px] text-zinc-500">{new Date(m.date).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input 
                        type="number" 
                        min="0"
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') {
                            e.preventDefault();
                          }
                        }}
                        value={ms.home} 
                        onChange={e => handleMatchScoreChange(m.id, 'home', e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} 
                        className="w-10 h-8 bg-black border border-zinc-700 rounded-md text-center text-xs font-black text-white outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      />
                      <span className="text-zinc-600 font-black">-</span>
                      <input 
                        type="number" 
                        min="0"
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') {
                            e.preventDefault();
                          }
                        }}
                        value={ms.away} 
                        onChange={e => handleMatchScoreChange(m.id, 'away', e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} 
                        className="w-10 h-8 bg-black border border-zinc-700 rounded-md text-center text-xs font-black text-white outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      />
                      <select value={ms.status} onChange={e => handleMatchScoreChange(m.id, 'status', e.target.value)} className="bg-black border border-zinc-700 h-8 rounded-md px-1 text-[10px] font-semibold text-zinc-300 outline-none w-24">
                        <option value="pending">Por Jugar</option>
                        <option value="in_progress">En Juego</option>
                        <option value="finished">Finalizado</option>
                      </select>
                      <button disabled={isSaving} onClick={() => updateMatchResult(m.id)} className="h-8 px-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-md transition-all disabled:opacity-50">
                        {isSaving ? '...' : 'Guardar'}
                      </button>
                    </div>
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
                     <p className="text-sm font-bold text-white">{u.displayName}</p>
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
    </div>
  );
}
