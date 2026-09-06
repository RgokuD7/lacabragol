import { vibrateTap, vibrateJackpot, vibratePop } from '../lib/haptics';
import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, documentId, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Prediction, User } from '../types';
import { useGroups } from './GroupsProvider';
import { useAuth } from './AuthProvider';
import { Users, Plus, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { BaseBottomSheet } from './BaseBottomSheet';
import { EmojiPicker } from './EmojiPicker';
import { ContextMenu } from './ContextMenu';
import { useLongPress } from '../hooks/useLongPress';
import { onSnapshot } from 'firebase/firestore';


function PredictionCard({ 
  p, 
  currentUser, 
  activeEmojiPicker, 
  setActiveEmojiPicker, 
  handleReaction, 
  setContextMenuPos, 
  setContextMenuPredId, matchStatus }: any) {
  const isMe = p.userId === currentUser?.uid;
  const validReactions = Object.entries(p.reactions || {}).filter(([_, users]) => 
    Array.isArray(users) ? users.length > 0 : (users as number) > 0
  );

  const handleLongPress = (e: React.TouchEvent | React.MouseEvent, pos: {x: number, y: number}) => {
    setContextMenuPos({ top: pos.y, left: pos.x });
    setContextMenuPredId(p.id);
  };

  const longPressProps = useLongPress({ onLongPress: handleLongPress });

  return (
    <div {...longPressProps} className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/80 space-y-3 select-none">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-black truncate pr-2 ${isMe ? "text-blue-400" : "text-zinc-300"}`}>
          {isMe ? 'Tú' : (p.user?.nickname || p.user?.displayName || 'Usuario')}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-sm font-black text-white bg-[#111114] px-2 py-1 rounded-md border border-zinc-700 shadow-inner">
            {p.homeScore} - {p.awayScore}
          </span>
          {matchStatus === 'finished' && p.pointsEarned > 0 && (
            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shadow-sm border border-emerald-500/20">
              +{p.pointsEarned} pts
            </span>
          )}
          {matchStatus === 'finished' && (p.pointsEarned === 0 || p.pointsEarned === undefined) && (
            <span className="text-[10px] font-black text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded shadow-sm border border-zinc-700/50">
              0 pts
            </span>
          )}
        </div>
      </div>
      
      {/* Reactions Bar - Rendered strictly when validReactions > 0 without gray badge backgrounds */}
      {validReactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-800/50">
          {validReactions.map(([emoji, count]) => {
            const numCount = Array.isArray(count) ? count.length : count as number;
            if (numCount === 0) return null;
            const hasReacted = Array.isArray(count) && count.includes(currentUser?.uid);
            
            return (
              <button
                key={emoji}
                onClick={() => { handleReaction(p.id, emoji); vibrateTap(); }}
                className="flex items-center gap-1 text-xs hover:scale-110 active:scale-95 transition-transform py-0.5 px-1 select-none cursor-pointer"
              >
                <span className="text-sm">{emoji}</span>
                <span className={`text-[11px] font-bold ${hasReacted ? 'text-blue-400' : 'text-zinc-400'}`}>{numCount}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MatchPredictions({ 
  matchId, 
  locked, 
  matchStatus, 
  matchHomeTeam, 
  matchAwayTeam, 
  pointsNode, 
  isJackpot,
  isTutorialActive 
}: { 
  matchId: string; 
  locked: boolean; 
  matchStatus: string; 
  matchHomeTeam: string; 
  matchAwayTeam: string; 
  pointsNode?: React.ReactNode; 
  isJackpot?: boolean;
  isTutorialActive?: boolean;
}) {
  const { activeGroupId, groups } = useGroups();
  const { user: currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [predictions, setPredictions] = useState<(Prediction & { user?: User })[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<string | null>(null);
  const [contextMenuPredId, setContextMenuPredId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ top: 0, left: 0 });
  
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const isTutorialMatch = isTutorialActive || matchId === 'tutorial-mock-match';

  const handleReaction = async (predId: string, emoji: string) => {
    if (!currentUser) return;
    if (isTutorialMatch) {
      setPredictions(prev => prev.map(p => {
        if (p.id !== predId) return p;
        const curr = p.reactions || {};
        const currentList = Array.isArray(curr[emoji]) ? [...curr[emoji]] : [];
        const has = currentList.includes(currentUser.uid);
        const updated = { ...curr };
        if (has) {
          updated[emoji] = currentList.filter(u => u !== currentUser.uid);
        } else {
          updated[emoji] = [...currentList, currentUser.uid];
        }
        return { ...p, reactions: updated };
      }));
      vibrateTap();
      return;
    }
    try {
      const pred = predictions.find(p => p.id === predId);
      if (!pred) return;
      
      const currentReactions = pred.reactions || {};
      const newReactions = { ...currentReactions };
      
      // Remove user from ALL emojis first (WhatsApp logic: 1 emoji per user)
      Object.keys(newReactions).forEach(key => {
        if (Array.isArray(newReactions[key])) {
          newReactions[key] = newReactions[key].filter(id => id !== currentUser.uid);
          if (newReactions[key].length === 0) {
            delete newReactions[key];
          }
        }
      });
      
      const usersReactedToTarget = Array.isArray(currentReactions[emoji]) ? currentReactions[emoji] : [];
      const hasReacted = usersReactedToTarget.includes(currentUser.uid);
      
      if (!hasReacted) {
         if (!newReactions[emoji]) newReactions[emoji] = [];
         newReactions[emoji].push(currentUser.uid);
      }
        
      await updateDoc(doc(db, 'predictions', predId), {
        reactions: newReactions
      });
    } catch(e) {
      console.error(e);
    }
  };

  const isMatchOpen = !isTutorialMatch && !locked && matchStatus !== 'in_progress' && matchStatus !== 'finished';

  const loadPredictions = () => {
    if (isTutorialMatch) {
      setPredictions([
        {
          id: 'tutorial-pred-carlos',
          userId: 'tutorial-user-carlos',
          matchId,
          homeScore: 2,
          awayScore: 1,
          pointsEarned: 5,
          updatedAt: Date.now(),
          reactions: { '🔥': ['u1', 'u2'], '🐐': ['u3'] },
          user: {
            uid: 'tutorial-user-carlos',
            displayName: 'Carlos Mendoza',
            nickname: 'Carlos M.',
            email: 'carlos@example.com',
            points: 45,
            exactMatches: 8,
            paid: true,
            isAdmin: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        },
        {
          id: 'tutorial-pred-mateo',
          userId: 'tutorial-user-mateo',
          matchId,
          homeScore: 2,
          awayScore: 0,
          pointsEarned: 3,
          updatedAt: Date.now(),
          reactions: { '👏': ['u1'] },
          user: {
            uid: 'tutorial-user-mateo',
            displayName: 'Mateo González',
            nickname: 'Mateo G.',
            email: 'mateo@example.com',
            points: 38,
            exactMatches: 5,
            paid: true,
            isAdmin: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        },
        {
          id: 'tutorial-pred-lucas',
          userId: 'tutorial-user-lucas',
          matchId,
          homeScore: 1,
          awayScore: 1,
          pointsEarned: 0,
          updatedAt: Date.now(),
          reactions: { '😂': ['u2'] },
          user: {
            uid: 'tutorial-user-lucas',
            displayName: 'Lucas Romero',
            nickname: 'Lucas R.',
            email: 'lucas@example.com',
            points: 29,
            exactMatches: 3,
            paid: true,
            isAdmin: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        }
      ]);
      setLoading(false);
      return;
    }
    if (isMatchOpen) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    if (!activeGroup || !activeGroup.members || activeGroup.members.length === 0) return;
    setLoading(true);
    
    const currentGroupId = activeGroupId || 'default';
    const matchPredsQ = query(
      collection(db, 'predictions'), 
      where('matchId', '==', matchId),
      where('groupId', '==', currentGroupId)
    );
    
    const unsubscribe = onSnapshot(matchPredsQ, async (snapshot) => {
      try {
        const allPreds = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }) as Prediction)
          .filter(p => p.groupId === currentGroupId && activeGroup.members.includes(p.userId));
          
        if (allPreds.length === 0) {
          setPredictions([]);
          setLoading(false);
          return;
        }
        
        const userIds = allPreds.map(p => p.userId);
        const users = {};
        
        for (let i = 0; i < userIds.length; i += 10) {
          const chunk = userIds.slice(i, i + 10);
          const usersQ = query(collection(db, 'users'), where(documentId(), 'in', chunk));
          const usersSnap = await getDocs(usersQ);
          usersSnap.docs.forEach(d => {
            users[d.id] = d.data();
          });
        }
        
        const predsWithUsers = allPreds.map(p => ({
          ...p,
          user: users[p.userId]
        }));
        
        predsWithUsers.sort((a, b) => {
          if (b.pointsEarned !== a.pointsEarned) return b.pointsEarned - a.pointsEarned;
          return (a.user?.nickname || '').localeCompare(b.user?.nickname || '');
        });
        
        setPredictions(predsWithUsers);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    });
    
    return unsubscribe;
  };

  useEffect(() => {
    let unsub;
    if (expanded && !isMatchOpen) {
      unsub = loadPredictions();
    }
    return () => {
      if (unsub) unsub();
    }
  }, [expanded, activeGroup, isMatchOpen]);

  return (
    <>
      <div className="mt-2 border-t border-zinc-800/50 pt-2 flex items-center justify-between">
        {isMatchOpen ? (
          <div className="flex-1 flex items-center justify-start text-[10px] text-zinc-500 py-1 select-none">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-500/80">
              <Lock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span>Pronósticos ocultos hasta el inicio</span>
            </div>
          </div>
        ) : (
          <button 
            id="tutorial-group-predictions-btn"
            onClick={() => { setExpanded(true); if (isJackpot) vibrateJackpot(); else vibratePop(); }}
            className="flex-1 flex items-center justify-start text-[10px] text-zinc-400 hover:text-blue-400 transition-colors py-1 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-widest">
              <Users className="w-3.5 h-3.5" />
              Ver Pronósticos del Grupo
            </div>
          </button>
        )}
        {pointsNode}
      </div>

      <BaseBottomSheet
        id="tutorial-predictions-sheet"
        closeButtonId="close-predictions-modal-btn"
        isOpen={expanded}
        onClose={() => setExpanded(false)}
        title={`Pronósticos: ${matchHomeTeam} vs ${matchAwayTeam}`}
      >
        <div className="space-y-3 pb-8">
          {loading ? (
            <div className="text-xs text-zinc-500 text-center py-4 font-bold uppercase tracking-widest">Cargando pronósticos...</div>
          ) : predictions.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-4 font-bold uppercase tracking-widest">Nadie hizo pronósticos para este partido.</div>
          ) : (
            <div className="space-y-3">
              {predictions.map(p => (
                <PredictionCard
                  key={p.id}
                  p={p}
                  currentUser={currentUser}
                  activeEmojiPicker={activeEmojiPicker}
                  setActiveEmojiPicker={setActiveEmojiPicker}
                  handleReaction={handleReaction}
                  setContextMenuPos={setContextMenuPos}
                  setContextMenuPredId={setContextMenuPredId}
                  matchStatus={isTutorialMatch ? 'finished' : matchStatus}
                />
              ))}
            </div>
          )}
        </div>
        
        <BaseBottomSheet isOpen={!!activeEmojiPicker} onClose={() => setActiveEmojiPicker(null)} title="Reacciones">
          <EmojiPicker 
            onSelect={(emoji) => {
              if (activeEmojiPicker) handleReaction(activeEmojiPicker, emoji);
            }}
            onClose={() => setActiveEmojiPicker(null)}
          />
        </BaseBottomSheet>
      </BaseBottomSheet>
      
      {/* Context Menu rendered outside the bottom sheet stacking context */}
      {contextMenuPredId && (
        <ContextMenu
          position={contextMenuPos}
          onClose={() => setContextMenuPredId(null)}
          onSelectEmoji={(emoji) => handleReaction(contextMenuPredId, emoji)}
          onMoreEmojis={() => setActiveEmojiPicker(contextMenuPredId)}
        />
      )}
    </>
  );
}
