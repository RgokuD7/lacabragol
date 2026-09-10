import { vibrateTap, vibrateJackpot, vibratePop } from '../lib/haptics';
import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, documentId, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Prediction, User } from '../types';
import { useGroups } from './GroupsProvider';
import { useAuth } from './AuthProvider';
import { useSettings } from './SettingsProvider';
import { evaluatePrediction } from '../lib/scoring';
import { Users, Plus } from 'lucide-react';
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
  setContextMenuPredId, 
  matchStatus,
  matchHomeScore,
  matchAwayScore,
  settings 
}: any) {
  const isMe = p.userId === currentUser?.uid;
  const isFinished = matchStatus === 'finished';
  const hasRealScores = matchHomeScore !== null && matchHomeScore !== undefined && matchAwayScore !== null && matchAwayScore !== undefined;

  let effectivePoints = p.pointsEarned ?? 0;
  let isExact = false;

  if (hasRealScores && (isFinished || matchStatus === 'in_progress')) {
    const evalRes = evaluatePrediction(matchHomeScore, matchAwayScore, p.homeScore, p.awayScore, matchStatus as any, true, settings);
    effectivePoints = evalRes.points;
    isExact = evalRes.type === 'exact';
  } else if (isFinished && effectivePoints > 0) {
    const exactPts = settings?.pointsExactMatch ?? 3;
    isExact = effectivePoints === exactPts;
  }

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
          {isFinished && isExact && (
            <span className="w-20 justify-center text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)] flex items-center gap-1 shrink-0">
              <span>🎯</span>
              <span>+{effectivePoints} pts</span>
            </span>
          )}
          {isFinished && !isExact && effectivePoints > 0 && (
            <span className="w-20 justify-center text-[10px] font-black text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-md border border-blue-500/30 flex items-center gap-1 shrink-0">
              <span>⚽</span>
              <span>+{effectivePoints} pts</span>
            </span>
          )}
          {isFinished && effectivePoints === 0 && (
            <span className="w-20 justify-center text-[10px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50 flex items-center gap-1 shrink-0">
              <span className="text-zinc-500 text-xs">✕</span>
              <span>0 pts</span>
            </span>
          )}
          {matchStatus === 'in_progress' && hasRealScores && (
            isExact ? (
              <span className="w-24 justify-center text-[9px] font-black text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 animate-pulse flex items-center gap-1 shrink-0">
                <span>🎯</span>
                <span>{effectivePoints}p vivo</span>
              </span>
            ) : effectivePoints > 0 ? (
              <span className="w-24 justify-center text-[9px] font-black text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1 shrink-0">
                <span>⚽</span>
                <span>{effectivePoints}p vivo</span>
              </span>
            ) : null
          )}
        </div>
      </div>
      
      {/* Reactions Bar with Accessible Add-Reaction Button */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-zinc-800/50 min-h-[28px]">
        <div className="flex flex-wrap items-center gap-1.5">
          {validReactions.map(([emoji, count]) => {
            const numCount = Array.isArray(count) ? count.length : count as number;
            if (numCount === 0) return null;
            const hasReacted = Array.isArray(count) && count.includes(currentUser?.uid);
            
            return (
              <button
                key={emoji}
                type="button"
                onClick={(e) => { 
                  e.stopPropagation();
                  handleReaction(p.id, emoji); 
                  vibrateTap(); 
                }}
                className={`flex items-center gap-1 text-xs hover:scale-110 active:scale-95 transition-transform py-0.5 px-2 rounded-full select-none cursor-pointer border ${
                  hasReacted ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="text-sm">{emoji}</span>
                <span className="text-[11px] font-bold">{numCount}</span>
              </button>
            );
          })}
        </div>

        {/* Add Reaction Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            vibrateTap();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setContextMenuPos({ top: rect.top, left: rect.left + rect.width / 2 });
            setContextMenuPredId(p.id);
          }}
          className="text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded-lg hover:bg-zinc-800/80 transition-colors flex items-center gap-1 text-[11px] font-medium ml-auto select-none cursor-pointer"
          title="Reaccionar"
        >
          <span className="text-sm">😊</span>
          <span className="text-[10px] text-zinc-500 font-bold">+</span>
        </button>
      </div>
    </div>
  );
}

export function MatchPredictions({ 
  matchId, 
  locked, 
  matchStatus, 
  matchHomeTeam, 
  matchAwayTeam, 
  matchHomeScore,
  matchAwayScore,
  pointsNode, 
  extraRightNode,
  isJackpot,
  isTutorialActive 
}: { 
  matchId: string; 
  locked: boolean; 
  matchStatus: string; 
  matchHomeTeam: string; 
  matchAwayTeam: string; 
  matchHomeScore?: number | null;
  matchAwayScore?: number | null;
  pointsNode?: React.ReactNode; 
  extraRightNode?: React.ReactNode;
  isJackpot?: boolean;
  isTutorialActive?: boolean;
}) {
  const { activeGroupId, groups } = useGroups();
  const { user: currentUser } = useAuth();
  const { settings } = useSettings();
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
      
      const currentReactions: Record<string, any> = pred.reactions || {};
      const newReactions: Record<string, string[]> = {};

      // Normalize current reactions so each key maps to string[]
      Object.entries(currentReactions).forEach(([key, val]) => {
        if (Array.isArray(val)) {
          newReactions[key] = [...val];
        }
      });
      
      // WhatsApp logic: 1 reaction per user across all emojis
      Object.keys(newReactions).forEach(key => {
        newReactions[key] = newReactions[key].filter(id => id !== currentUser.uid);
        if (newReactions[key].length === 0) {
          delete newReactions[key];
        }
      });
      
      const usersReactedToTarget = Array.isArray(currentReactions[emoji]) ? currentReactions[emoji] : [];
      const hasReacted = usersReactedToTarget.includes(currentUser.uid);
      
      if (!hasReacted) {
        if (!newReactions[emoji]) newReactions[emoji] = [];
        newReactions[emoji].push(currentUser.uid);
      }

      // Optimistic UI update for instant feedback
      setPredictions(prev => prev.map(p => p.id === predId ? { ...p, reactions: newReactions } : p));
      vibrateTap();
        
      await updateDoc(doc(db, 'predictions', predId), {
        reactions: newReactions
      });
    } catch(e) {
      console.error('Error updating reaction:', e);
      loadPredictions();
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
        
        const hasRealScores = matchHomeScore !== null && matchHomeScore !== undefined && matchAwayScore !== null && matchAwayScore !== undefined;
        predsWithUsers.sort((a, b) => {
          const aPts = hasRealScores 
            ? evaluatePrediction(matchHomeScore, matchAwayScore, a.homeScore, a.awayScore, matchStatus as any, true, settings).points
            : (a.pointsEarned ?? 0);
          const bPts = hasRealScores
            ? evaluatePrediction(matchHomeScore, matchAwayScore, b.homeScore, b.awayScore, matchStatus as any, true, settings).points
            : (b.pointsEarned ?? 0);
          if (bPts !== aPts) return bPts - aPts;
          return (a.user?.nickname || a.user?.displayName || '').localeCompare(b.user?.nickname || b.user?.displayName || '');
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
  }, [expanded, activeGroup, isMatchOpen, matchHomeScore, matchAwayScore]);

  return (
    <>
      {(!isMatchOpen || pointsNode || extraRightNode) && (
        <div className="mt-2 border-t border-zinc-800/60 pt-2 flex items-center justify-between gap-2">
          {!isMatchOpen ? (
            <button 
              id={isTutorialMatch ? "tutorial-group-predictions-btn" : undefined}
              onClick={() => { setExpanded(true); if (isJackpot) vibrateJackpot(); else vibratePop(); }}
              className="flex items-center justify-start text-[10px] text-zinc-400 hover:text-blue-400 transition-colors py-1 cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-widest">
                <Users className="w-3.5 h-3.5" />
                <span>Ver Pronósticos del Grupo</span>
              </div>
            </button>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-2 shrink-0">
            {pointsNode}
            {extraRightNode}
          </div>
        </div>
      )}

      <BaseBottomSheet
        id={isTutorialMatch ? "tutorial-predictions-sheet" : undefined}
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
                  matchHomeScore={matchHomeScore}
                  matchAwayScore={matchAwayScore}
                  settings={settings}
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
