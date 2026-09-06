import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Podium } from '../types';
import { useAuth } from '../components/AuthProvider';
import { useGroups } from '../components/GroupsProvider';
import { useSettings } from '../components/SettingsProvider';
import { useGroupScores } from '../hooks/useGroupScores';
import { getGroupPodium } from '../lib/podium';
import { handleFirestoreError, OperationType } from '../lib/utils';
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
  Hash
} from 'lucide-react';
import { BaseBottomSheet } from '../components/BaseBottomSheet';
import { UserAvatar } from '../components/UserAvatar';
import { UserProfileModal } from '../components/UserProfileModal';

export function RankingTab() {
  const { profile } = useAuth();
  const { groups, activeGroupId } = useGroups();
  const { settings } = useSettings();
  const { memberScores, currentUserPoints, currentUserExactMatches } = useGroupScores(
    activeGroupId,
    profile?.uid,
    settings?.pointsExactMatch || 3
  );

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserPodium, setSelectedUserPodium] = useState<Podium | null>(null);
  const [loadingPodium, setLoadingPodium] = useState(false);

  const activeGroup = groups.find(g => g.id === activeGroupId);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      let u = snap.docs.map(d => d.data() as User);
      
      // Filter by active group members
      if (activeGroup?.members) {
        u = u.filter(user => activeGroup.members.includes(user.uid));
      }
      
      const uWithScores = u.map(user => ({
        ...user,
        points: memberScores[user.uid]?.points || 0,
        exactMatches: memberScores[user.uid]?.exactMatches || 0,
      }));

      uWithScores.sort((a,b) => (b.points || 0) - (a.points || 0) || (b.exactMatches || 0) - (a.exactMatches || 0));
      setUsers(uWithScores);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));
    return () => unsub();
  }, [activeGroup?.members, memberScores]);

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
    (u.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const currentUserIndex = users.findIndex(u => u.uid === profile?.uid);
  const top1 = users[0];
  const top2 = users[1];
  const top3 = users[2];

    const renderStreakBadge = (u: User) => {
    if (u.streak_ausente && u.streak_ausente >= 4) return `👻 ${u.streak_ausente}`;
    if (u.streak_pleno && u.streak_pleno >= 2) return `🐐🔥 ${u.streak_pleno}`;
    if (u.streak_normal && u.streak_normal >= 3) return `🔥 ${u.streak_normal}`;
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
            {users.length} {users.length === 1 ? 'jugador registrado' : 'jugadores compitiendo'}
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
                {currentUserExactMatches || 0} <span className="text-[9px] text-zinc-400 font-normal">exactos</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top 3 Visual Mini Podium Cards with Google Avatars */}
      {users.length >= 3 && (
        <div className="grid grid-cols-3 gap-1.5 items-end pt-1">
          {/* 2nd Place */}
          <div 
            onClick={() => handleUserClick(top2)}
            className="bg-[#121215] border border-zinc-700/80 rounded-xl p-2 text-center flex flex-col items-center order-1 shadow-sm cursor-pointer hover:bg-zinc-900/80 transition-colors"
          >
            <div className="relative mb-1">
              <UserAvatar src={top2?.photoURL} name={top2?.displayName || ''} size="md" className="border-zinc-500" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-700 text-zinc-200 border border-zinc-600 flex items-center justify-center font-black text-[8px]">
                2
              </span>
            </div>
            <p className="font-bold text-xs text-white truncate max-w-full">
              {top2?.title && <span className="mr-1">{top2.title}</span>}
              {top2?.displayName || 'Participante'}
              {top2 && renderStreakBadge(top2) && <span className="text-[10px] ml-1 bg-zinc-800/80 px-1 rounded shadow-sm border border-zinc-700">{renderStreakBadge(top2)}</span>}
            </p>
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
              <UserAvatar src={top1?.photoURL} name={top1?.displayName || ''} size="lg" className="border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-zinc-950 font-black text-[8px] flex items-center justify-center">
                1
              </span>
            </div>
            <p className="font-black text-xs text-amber-100 truncate max-w-full">
              {top1?.displayName || 'Líder'}
              {top1 && renderStreakBadge(top1) && <span className="text-[10px] ml-1 bg-zinc-800/80 px-1 rounded shadow-sm border border-zinc-700">{renderStreakBadge(top1)}</span>}
            </p>
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
              <UserAvatar src={top3?.photoURL} name={top3?.displayName || ''} size="md" className="border-amber-700/80" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-900 text-amber-300 border border-amber-800 flex items-center justify-center font-black text-[8px]">
                3
              </span>
            </div>
            <p className="font-bold text-xs text-white truncate max-w-full">
              {top3?.title && <span className="mr-1">{top3.title}</span>}
              {top3?.displayName || 'Participante'}
              {top3 && renderStreakBadge(top3) && <span className="text-[10px] ml-1 bg-zinc-800/80 px-1 rounded shadow-sm border border-zinc-700">{renderStreakBadge(top3)}</span>}
            </p>
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
                <th className="px-2.5 py-2 text-center w-8">#</th>
                <th className="px-2.5 py-2">Participante</th>
                <th className="px-2.5 py-2 text-center">PTS</th>
                <th className="px-2.5 py-2 text-center">Exactos</th>
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
                          name={u.displayName || 'Usuario'} 
                          size="sm" 
                          className={isMe ? 'ring-1 ring-blue-500' : ''}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className={`font-bold truncate max-w-[140px] text-xs ${isMe ? 'text-blue-300' : 'text-white'}`}>
                              {u.title && <span className="mr-1">{u.title}</span>}
                              {u.displayName || 'Sin Nombre'}
                              {renderStreakBadge(u) && <span className="text-[10px] ml-1 bg-zinc-800/80 px-1 py-0.5 rounded shadow-sm border border-zinc-700">{renderStreakBadge(u)}</span>}
                            </p>
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
    </div>
  );
}
