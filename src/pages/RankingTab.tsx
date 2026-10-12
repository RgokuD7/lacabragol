import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Podium, Match, Prediction, Stage, StageStandingItem } from '../types';
import { useAuth } from '../components/AuthProvider';
import { useGroups } from '../components/GroupsProvider';
import { useSettings } from '../components/SettingsProvider';
import { useGroupScores } from '../hooks/useGroupScores';
import { getGroupPodium } from '../lib/podium';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { subscribeStages, calculateStageStandings } from '../lib/stages';
import { StageWinnersModal } from '../components/StageWinnersModal';
import { 
  Search, 
  Crown,
  Target,
  Trophy,
  Flame,
  UserCheck,
  Medal,
  Award,
  Zap,
  Mail,
  Hash,
  ChevronRight,
  Layers,
  Sparkles
} from 'lucide-react';
import { BaseBottomSheet } from '../components/BaseBottomSheet';
import { UserAvatar } from '../components/UserAvatar';
import { UserProfileModal } from '../components/UserProfileModal';

export function RankingTab() {
  const { profile } = useAuth();
  const { groups, activeGroupId } = useGroups();
  const { settings } = useSettings();
  const { memberScores } = useGroupScores(
    activeGroupId,
    profile?.uid,
    settings?.pointsExactMatch || 3
  );

  const [rawUsers, setRawUsers] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [userSelectedFilter, setUserSelectedFilter] = useState(false);
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [groupPredictions, setGroupPredictions] = useState<Prediction[]>([]);

  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserPodium, setSelectedUserPodium] = useState<Podium | null>(null);
  const [loadingPodium, setLoadingPodium] = useState(false);

  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Reset user manual selection when switching active groups
  useEffect(() => {
    setUserSelectedFilter(false);
  }, [activeGroupId]);

  // Subscribe to stages of activeGroup (defaults to active stage if present)
  useEffect(() => {
    const unsub = subscribeStages(activeGroupId, (fetched) => {
      setStages(fetched);
      if (!userSelectedFilter) {
        const activeStage = fetched.find(s => s.status === 'active');
        if (activeStage) {
          setSelectedStageId(activeStage.id);
        } else {
          setSelectedStageId('all');
        }
      }
    });
    return () => unsub();
  }, [activeGroupId, userSelectedFilter]);

  // Subscribe to matches (for live stage standings)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'matches'), (snap) => {
      const ms = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(ms);
    });
    return () => unsub();
  }, []);

  // Subscribe to group predictions (for live stage standings)
  useEffect(() => {
    if (!activeGroupId) return;
    const q = query(
      collection(db, 'predictions'),
      where('groupId', '==', activeGroupId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const preds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prediction));
      setGroupPredictions(preds);
    });
    return () => unsub();
  }, [activeGroupId]);

  // Subscribe to users of the active group
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      let u = snap.docs.map(d => d.data() as User);
      if (activeGroup?.members) {
        u = u.filter(user => activeGroup.members.includes(user.uid));
      }
      setRawUsers(u);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));
    return () => unsub();
  }, [activeGroup?.members]);

  // Compute users according to selectedStageId ('all' vs specific stage)
  useEffect(() => {
    if (rawUsers.length === 0) {
      setUsers([]);
      return;
    }

    if (selectedStageId === 'all') {
      // General Ranking (Acumulado)
      const uWithScores = rawUsers.map(user => ({
        ...user,
        points: memberScores[user.uid]?.points || 0,
        exactMatches: memberScores[user.uid]?.exactMatches || 0,
        streak_pleno: memberScores[user.uid]?.streak_pleno ?? user.streak_pleno,
        streak_normal: memberScores[user.uid]?.streak_normal ?? user.streak_normal,
      }));
      uWithScores.sort((a,b) => (b.points || 0) - (a.points || 0) || (b.exactMatches || 0) - (a.exactMatches || 0));
      setUsers(uWithScores);
    } else {
      // Stage Ranking (Activa o Cerrada)
      const stage = stages.find(s => s.id === selectedStageId);
      if (!stage) {
        setSelectedStageId('all');
        return;
      }

      let stageStandings: StageStandingItem[] = [];
      if (stage.status === 'closed' && stage.fullStandings && stage.fullStandings.length > 0) {
        stageStandings = stage.fullStandings;
      } else {
        stageStandings = calculateStageStandings(stage, matches, groupPredictions, rawUsers);
      }

      const standingsMap = new Map<string, StageStandingItem>();
      stageStandings.forEach(s => standingsMap.set(s.userId, s));

      const uWithScores = rawUsers.map(user => {
        const item = standingsMap.get(user.uid);
        return {
          ...user,
          points: item?.points || 0,
          exactMatches: item?.exactMatches || 0,
          streak_pleno: undefined,
          streak_normal: undefined,
        };
      });

      uWithScores.sort((a,b) => (b.points || 0) - (a.points || 0) || (b.exactMatches || 0) - (a.exactMatches || 0));
      setUsers(uWithScores);
    }
  }, [rawUsers, selectedStageId, memberScores, stages, matches, groupPredictions]);


  const handleUserClick = async (u: User) => {
    setSelectedUser(u);
    setSelectedUserPodium(null);
    setLoadingPodium(true);
    try {
      const p = await getGroupPodium(activeGroupId, u.uid);
      setSelectedUserPodium(p);
    } catch (e) {
      console.error(e);
    }
    setLoadingPodium(false);
  };

  const filteredUsers = users.filter(u => 
    (u.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const currentUserIndex = users.findIndex(u => u.uid === profile?.uid);
  const hasAnyPoints = users.some(u => (u.points || 0) > 0);
  const top1 = users[0];
  const top2 = users[1];
  const top3 = users[2];

  const renderStreakBadge = (u: User) => {
    const sp = memberScores[u.uid]?.streak_pleno ?? u.streak_pleno;
    const sn = memberScores[u.uid]?.streak_normal ?? u.streak_normal;
    if (u.streak_ausente && u.streak_ausente >= 4) return `👻 ${u.streak_ausente}`;
    if (sp && sp >= 2) return `🐐🔥 ${sp}`;
    if (sn && sn >= 3) return `🔥 ${sn}`;
    if (u.streak_falla && u.streak_falla >= 3) return `🥶 ${u.streak_falla}`;
    return null;
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-2.5 font-sans text-[#e4e4e7] max-w-4xl mx-auto pb-[120px]">
      {/* Header Denso */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
        <div>
          <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
            Ranking de Participantes
          </h1>
          <p className="text-[10px] sm:text-xs text-zinc-400">
            {selectedStageId === 'all'
              ? `Acumulado General · ${users.length} ${users.length === 1 ? 'jugador' : 'jugadores'}`
              : `${stages.find(s => s.id === selectedStageId)?.name || 'Etapa'} · ${users.length} ${users.length === 1 ? 'jugador' : 'jugadores'}`}
          </p>
        </div>

        {/* Current user position badge without repeating points already on top navbar */}
        {profile && currentUserIndex !== -1 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1 flex items-center gap-2 shrink-0 shadow-sm">
            <span className="w-5 h-5 rounded-lg bg-blue-600 text-white font-black text-[10px] flex items-center justify-center font-mono">
              #{currentUserIndex + 1}
            </span>
            <div className="leading-tight">
              <p className="text-[9px] text-zinc-400 font-bold uppercase">Tu Posición</p>
              <p className="text-[11px] font-bold text-emerald-400 font-mono">
                {users[currentUserIndex]?.exactMatches || 0} <span className="text-[9px] text-zinc-400 font-normal">exactos</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Salón de Ganadores por Etapa Banner */}
      {stages.some(s => s.status === 'closed') && (
        <div
          onClick={() => setShowWinnersModal(true)}
          className="bg-gradient-to-r from-amber-500/15 via-[#141418] to-zinc-900 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:border-amber-500/50 transition-all shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-sm shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              🏆
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                  Salón de Ganadores por Etapa
                </span>
                <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/30">
                  {stages.filter(s => s.status === 'closed').length}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Consulta los podios y campeones registrados por cada fase
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </div>
      )}

      {/* Selector de Etapas / Filtro */}
      {stages.length > 0 && (() => {
        const activeStage = stages.find(s => s.status === 'active');
        const closedStages = stages.filter(s => s.status === 'closed');

        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {/* Etapa Activa (por defecto si existe) */}
              {activeStage && (
                <button
                  type="button"
                  onClick={() => {
                    setUserSelectedFilter(true);
                    setSelectedStageId(activeStage.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedStageId === activeStage.id
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                      : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>{activeStage.name}</span>
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-bold">EN VIVO</span>
                </button>
              )}

              {/* Acumulado General */}
              <button
                type="button"
                onClick={() => {
                  setUserSelectedFilter(true);
                  setSelectedStageId('all');
                }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  selectedStageId === 'all'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                    : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                }`}
              >
                🌐 Acumulado General
              </button>

              {/* Etapas Cerradas */}
              {closedStages.map(st => {
                const isSelected = selectedStageId === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setUserSelectedFilter(true);
                      setSelectedStageId(st.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                        : 'bg-[#121215] text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>{st.name}</span>
                    <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 rounded font-bold">CERRADA</span>
                  </button>
                );
              })}
            </div>

            {/* Banner indicador cuando hay una etapa seleccionada */}
            {selectedStageId !== 'all' && (() => {
              const currentStageObj = stages.find(s => s.id === selectedStageId);
              if (!currentStageObj) return null;
              return (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-300">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      Viendo: <strong className="text-white">{currentStageObj.name}</strong> ({currentStageObj.matchGroups.join(', ')})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserSelectedFilter(true);
                      setSelectedStageId('all');
                    }}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 shrink-0 cursor-pointer"
                  >
                    Ver General
                  </button>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Top 3 Visual Mini Podium Cards with Google Avatars */}
      {users.length >= 3 && (
        <div className="grid grid-cols-3 gap-1.5 items-end pt-1">

          {/* 2nd Place */}
          <div 
            onClick={() => handleUserClick(top2)}
            className="bg-[#121215] border border-zinc-700/80 rounded-xl p-2 text-center flex flex-col items-center order-1 shadow-sm cursor-pointer hover:bg-zinc-900/80 transition-colors"
          >
            <div className="relative mb-1">
              <UserAvatar src={top2?.photoURL} name={top2?.nickname || top2?.displayName || ''} size="md" className="border-zinc-500" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-700 text-zinc-200 border border-zinc-600 flex items-center justify-center font-black text-[8px]">
                2
              </span>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-0.5 w-full min-w-0 px-1">
              <span className="font-bold text-xs text-white truncate max-w-full block leading-tight">
                {top2?.nickname || top2?.displayName || 'Participante'}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
                {top2?.title && <span className="text-[9px] text-zinc-400 font-medium">{top2.title}</span>}
                {top2 && renderStreakBadge(top2) && (
                  <span className="text-[10px] bg-zinc-800/80 px-1 rounded shadow-sm border border-zinc-700">
                    {renderStreakBadge(top2)}
                  </span>
                )}
              </div>
            </div>
            {top2?.medallas && top2?.medallas.length > 0 && (
                <div className="flex justify-center gap-0.5 mt-0.5" title={top2.medallas.join(', ')}>
                  {Array.from(new Set(top2.medallas.map(m => Array.from(m as string)[0]))).map((emoji, i) => (
                    <span key={i} className="text-[10px] opacity-80">{emoji}</span>
                  ))}
                </div>
            )}
            <span className="font-mono font-black text-zinc-300 text-xs mt-0.5">
              {top2?.points || 0} <span className="text-[9px] font-normal text-zinc-400">PTS</span>
            </span>
            <span className="text-[9px] text-zinc-400">
              {top2?.exactMatches || 0} exactos
            </span>
          </div>

          {/* 1st Place */}
          <div 
            onClick={() => handleUserClick(top1)}
            className="bg-gradient-to-b from-amber-500/20 to-[#121215] border border-amber-500/50 rounded-xl p-2 text-center flex flex-col items-center order-2 shadow-md cursor-pointer hover:from-amber-500/30 transition-colors"
          >
            <Crown className="w-4 h-4 text-amber-400 mb-0.5 drop-shadow-sm" />
            <div className="relative mb-1">
              <UserAvatar src={top1?.photoURL} name={top1?.nickname || top1?.displayName || ''} size="lg" className="border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-zinc-950 font-black text-[8px] flex items-center justify-center">
                1
              </span>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-0.5 w-full min-w-0 px-1">
              <span className="font-black text-xs text-amber-100 truncate max-w-full block leading-tight">
                {top1?.nickname || top1?.displayName || 'Líder'}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
                {hasAnyPoints && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-black">
                    🐐 Cabra
                  </span>
                )}
                {top1?.title && <span className="text-[9px] text-amber-200/80 font-medium">{top1.title}</span>}
                {top1 && renderStreakBadge(top1) && (
                  <span className="text-[10px] bg-zinc-800/80 px-1 rounded shadow-sm border border-zinc-700">
                    {renderStreakBadge(top1)}
                  </span>
                )}
              </div>
            </div>
            <span className="font-mono font-black text-amber-400 text-sm mt-0.5">
              {top1?.points || 0} <span className="text-[9px] font-bold text-amber-500/80">PTS</span>
            </span>
            <span className="text-[9px] text-amber-300 font-bold">
              🎯 {top1?.exactMatches || 0} exactos
            </span>
          </div>

          {/* 3rd Place */}
          <div 
            onClick={() => handleUserClick(top3)}
            className="bg-[#121215] border border-amber-800/40 rounded-xl p-2 text-center flex flex-col items-center order-3 shadow-sm cursor-pointer hover:bg-zinc-900/80 transition-colors"
          >
            <div className="relative mb-1">
              <UserAvatar src={top3?.photoURL} name={top3?.nickname || top3?.displayName || ''} size="md" className="border-amber-700/80" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-900 text-amber-300 border border-amber-800 flex items-center justify-center font-black text-[8px]">
                3
              </span>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-0.5 w-full min-w-0 px-1">
              <span className="font-bold text-xs text-white truncate max-w-full block leading-tight">
                {top3?.nickname || top3?.displayName || 'Participante'}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
                {top3?.title && <span className="text-[9px] text-zinc-400 font-medium">{top3.title}</span>}
                {top3 && renderStreakBadge(top3) && (
                  <span className="text-[10px] bg-zinc-800/80 px-1 rounded shadow-sm border border-zinc-700">
                    {renderStreakBadge(top3)}
                  </span>
                )}
              </div>
            </div>
            {top3?.medallas && top3?.medallas.length > 0 && (
                <div className="flex justify-center gap-0.5 mt-0.5" title={top3.medallas.join(', ')}>
                  {Array.from(new Set(top3.medallas.map(m => Array.from(m as string)[0]))).map((emoji, i) => (
                    <span key={i} className="text-[10px] opacity-80">{emoji}</span>
                  ))}
                </div>
            )}
            <span className="font-mono font-black text-amber-600 text-xs mt-0.5">
              {top3?.points || 0} <span className="text-[9px] font-normal text-zinc-400">PTS</span>
            </span>
            <span className="text-[9px] text-zinc-400">
              {top3?.exactMatches || 0} exactos
            </span>
          </div>
        </div>
      )}

      {/* Search Input Denso */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar participante..."
          className="w-full bg-[#121215] border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Full Leaderboard Table Denso with Google Avatars */}
      <div className="bg-[#121215] rounded-xl border border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] relative overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
          <table className="w-full text-left whitespace-nowrap text-xs border-collapse">
            <thead className="bg-[#18181b] text-[10px] uppercase font-black text-zinc-400 border-b border-zinc-800 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="px-2.5 py-2 text-center w-8 sticky top-0 z-30 bg-[#18181b] border-b border-zinc-800">#</th>
                <th className="px-2.5 py-2 sticky top-0 z-30 bg-[#18181b] border-b border-zinc-800">Participante</th>
                <th className="px-2.5 py-2 text-center sticky top-0 z-30 bg-[#18181b] border-b border-zinc-800">PTS</th>
                <th className="px-2.5 py-2 text-center sticky top-0 z-30 bg-[#18181b] border-b border-zinc-800">Exactos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {filteredUsers.map((u, index) => {
                const isMe = u.uid === profile?.uid;
                return (
                  <tr 
                    key={u.uid} 
                    onClick={() => handleUserClick(u)}
                    className={`transition-colors cursor-pointer ${
                      isMe 
                        ? 'bg-blue-600/15 border-l-2 border-blue-500' 
                        : 'hover:bg-zinc-800/30'
                    }`}
                  >
                    {/* Position */}
                    <td className="px-2.5 py-1.5 text-center font-bold">
                      {index === 0 ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-black text-[10px] border border-amber-500/40">1</span>
                      ) : index === 1 ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-700/30 text-zinc-300 font-black text-[10px] border border-zinc-600">2</span>
                      ) : index === 2 ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-900/30 text-amber-600 font-black text-[10px] border border-amber-800/50">3</span>
                      ) : (
                        <span className="text-zinc-500 font-mono text-[11px]">{index + 1}</span>
                      )}
                    </td>

                    {/* Participant with Google Avatar */}
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <UserAvatar 
                          src={u.photoURL} 
                          name={u.nickname || u.displayName || 'Usuario'} 
                          size="sm" 
                          className={isMe ? 'ring-1 ring-blue-500' : ''}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`font-bold truncate max-w-[130px] text-xs ${isMe ? 'text-blue-300' : 'text-white'}`} title={u.nickname || u.displayName}>
                              {u.title && <span className="mr-1">{u.title}</span>}
                              {u.nickname || u.displayName || 'Sin Nombre'}
                            </p>

                            {/* Badges dinámicos de Líder y Último Lugar (sólo cuando la tabla suma puntos) */}
                            {hasAnyPoints && index === 0 && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/50 px-1.5 py-0.2 rounded font-black tracking-wider inline-flex items-center gap-0.5 shadow-sm">
                                🐐 Cabra
                              </span>
                            )}
                            {hasAnyPoints && filteredUsers.length > 1 && index === filteredUsers.length - 1 && (
                              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 px-1.5 py-0.2 rounded font-black tracking-wider inline-flex items-center gap-0.5 shadow-sm">
                                🥶 Frío
                              </span>
                            )}

                            {renderStreakBadge(u) && <span className="text-[10px] bg-zinc-800/80 px-1 py-0.5 rounded shadow-sm border border-zinc-700">{renderStreakBadge(u)}</span>}
                            {u.medallas && u.medallas.length > 0 && (
                              <div className="flex gap-0.5 mt-0.5" title={u.medallas.join(', ')}>
                                {Array.from(new Set(u.medallas.map(m => Array.from(m)[0]))).map((emoji, i) => (
                                  <span key={i} className="text-[10px] opacity-80">{emoji}</span>
                                ))}
                              </div>
                            )}
                            {isMe && (
                              <span className="bg-blue-600/30 text-blue-400 text-[8px] font-bold px-1 py-0.1 rounded">TÚ</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Points */}
                    <td className="px-2.5 py-1.5 text-center font-mono font-black text-white text-xs">
                      {u.points || 0}
                    </td>

                    {/* Exact Matches */}
                    <td className="px-2.5 py-1.5 text-center font-mono text-zinc-400 text-xs">
                      <div className="inline-flex items-center gap-0.5">
                        <Target className="w-2.5 h-2.5 text-emerald-400" />
                        <span>{u.exactMatches || 0}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-zinc-500 text-xs">
                    No se encontraron participantes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserProfileModal user={selectedUser} isOpen={selectedUser !== null} onClose={() => setSelectedUser(null)} groupId={activeGroupId} />

      <StageWinnersModal
        isOpen={showWinnersModal}
        onClose={() => setShowWinnersModal(false)}
        stages={stages}
        onSelectUser={(uid) => {
          const u = rawUsers.find(x => x.uid === uid) || users.find(x => x.uid === uid);
          if (u) {
            handleUserClick(u);
          }
        }}
      />
    </div>
  );
}

