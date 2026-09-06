import { vibrateSuccess, vibrateError, vibrateTap, vibratePop } from '../lib/haptics';
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, getDocs, updateDoc, doc, documentId } from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { Send, MessageSquare, Reply, Plus, X } from 'lucide-react';
import { BaseBottomSheet } from './BaseBottomSheet';
import { useGroups } from './GroupsProvider';
import { EmojiPicker } from './EmojiPicker';
import { ContextMenu } from './ContextMenu';
import { useLongPress } from '../hooks/useLongPress';
import { User } from '../types';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  text: string;
  replyTo?: string;
  reactions?: Record<string, number>;
  createdAt: number;
}


function ChatMessageItem({ 
  msg, 
  idx, 
  messages, 
  user, 
  activeGroup, 
  setContextMenuPos, 
  setContextMenuMsgId, 
  setReplyToMsg, 
  setActiveEmojiPicker, 
  activeEmojiPicker, 
  handleReaction 
}: any) {
  const isMe = msg.userId === user?.uid;
  const showName = !isMe && (idx === 0 || messages[idx - 1].userId !== msg.userId);
  const repliedMsg = msg.replyTo ? messages.find((m: any) => m.id === msg.replyTo) : null;
  const reactionEntries = Object.entries(msg.reactions || {}).filter(([_, users]) => Array.isArray(users) ? users.length > 0 : (users as number) > 0);

  const handleLongPress = (e: React.TouchEvent | React.MouseEvent, pos: {x: number, y: number}) => {
    setContextMenuPos({ top: pos.y, left: pos.x });
    setContextMenuMsgId(msg.id);
  };

  const longPressProps = useLongPress({ onLongPress: handleLongPress });

  const isOwner = msg.userId === activeGroup?.adminId;
  const isCoAdmin = activeGroup?.coAdmins?.includes(msg.userId);

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      {showName && (
        <div className="flex items-center gap-1.5 ml-2 mb-0.5">
          <span className="text-sm font-black text-white">
            {msg.userName}
          </span>
          {isOwner && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase font-black border border-amber-500/30 tracking-widest">El Cabrón</span>}
          {!isOwner && isCoAdmin && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-black border border-blue-500/30 tracking-widest">Cabra</span>}
          {!isOwner && !isCoAdmin && <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase font-black border border-zinc-700 tracking-widest">Chivo</span>}
        </div>
      )}
      
      <div className={`group relative max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Reply Context */}
        {repliedMsg && (
          <div className={`text-[10px] mb-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 truncate max-w-full opacity-90 ${isMe ? 'mr-1' : 'ml-1'}`}>
            <span className="font-bold text-blue-400">{repliedMsg.userName}: </span>
            {repliedMsg.text}
          </div>
        )}

        {/* Message Bubble & Quick Reply Action */}
        <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          <div 
            {...longPressProps}
            className={`px-3 py-2 rounded-2xl relative select-none cursor-pointer ${
              isMe 
                ? 'bg-blue-600 text-white rounded-tr-sm' 
                : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
            }`}
          >
            <p className="text-sm break-words leading-snug whitespace-pre-wrap">{msg.text}</p>
            <div className={`text-[9px] mt-1 opacity-60 flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Quick Reply Icon Button */}
          <button
            onClick={() => {
              vibrateTap();
              setReplyToMsg(msg);
            }}
            title="Responder"
            className="p-1 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800/80 rounded-full transition-all opacity-40 hover:opacity-100 shrink-0"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reactions Bar - Clean Without Gray Boxes/Badges */}
        {reactionEntries.length > 0 && (
          <div className={`flex flex-wrap items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {reactionEntries.map(([emoji, count]) => {
              const numCount = Array.isArray(count) ? count.length : count as number;
              if (numCount === 0) return null;
              const hasReacted = Array.isArray(count) && count.includes(user?.uid || '');
              
              return (
                <button
                  key={emoji}
                  onClick={() => handleReaction(msg.id, emoji)}
                  className="flex items-center gap-1 text-xs hover:scale-110 active:scale-95 transition-transform py-0.5 px-1 select-none"
                >
                  <span className="text-sm">{emoji}</span>
                  <span className={`text-[11px] font-bold ${hasReacted ? 'text-blue-400' : 'text-zinc-400'}`}>{numCount}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function GroupChat({ 
  isOpen = true, 
  onClose = () => {}
}: { 
  isOpen?: boolean; 
  onClose?: () => void;
}) {

  const { user, profile } = useAuth();
  const { activeGroupId, groups } = useGroups();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [members, setMembers] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  
  const [replyToMsg, setReplyToMsg] = useState<Message | null>(null);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<string | null>(null);
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ top: 0, left: 0 });

  const activeGroup = groups.find(g => g.id === activeGroupId);

  useEffect(() => {
    if (!activeGroup || !isOpen) return;
    
    // Fetch members for mentions
    const fetchMembers = async () => {
      if (!activeGroup.members?.length) return;
      const chunks = [];
      for (let i = 0; i < activeGroup.members.length; i += 10) {
        chunks.push(activeGroup.members.slice(i, i + 10));
      }
      const allUsers: User[] = [];
      for (const chunk of chunks) {
        const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        snap.docs.forEach(d => allUsers.push(d.data() as User));
      }
      setMembers(allUsers);
    };
    fetchMembers();

    const q = query(
      collection(db, 'messages'),
      where('groupId', '==', activeGroupId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      msgs.sort((a, b) => b.createdAt - a.createdAt);
      setMessages(msgs.slice(0, 50).reverse());
    });

    return () => unsubscribe();
  }, [activeGroupId, isOpen, activeGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showMentions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    
    const lastWord = val.split(' ').pop();
    if (lastWord?.startsWith('@')) {
      setShowMentions(true);
      setMentionFilter(lastWord.substring(1).toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (nickname: string) => {
    const words = newMessage.split(' ');
    words.pop();
    setNewMessage(words.join(' ') + (words.length > 0 ? ' ' : '') + '@' + nickname + ' ');
    setShowMentions(false);
    document.getElementById('chat-input')?.focus();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeGroupId || !newMessage.trim() || sending) return;

    const msgText = newMessage.trim();
    setNewMessage('');
    setSending(true);
    setShowMentions(false);
    
    const payload: any = {
      groupId: activeGroupId,
      userId: user.uid,
      userName: profile?.nickname || profile?.displayName || 'Usuario',
      text: msgText,
      createdAt: Date.now()
    };
    if (replyToMsg) {
      payload.replyTo = replyToMsg.id;
      setReplyToMsg(null);
    }

    try {
      await addDoc(collection(db, 'messages'), payload);
      vibrateSuccess();
    } catch (error) {
      console.error('Error sending message:', error);
      vibrateError();
    }
    setSending(false);
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    try {
      const msg = messages.find(m => m.id === msgId);
      if (!msg || !user?.uid) return;
      
      const currentReactions = msg.reactions || {};
      const newReactions = { ...currentReactions };
      
      // Remove user from ALL emojis first (WhatsApp logic: 1 emoji per user)
      Object.keys(newReactions).forEach(key => {
        if (Array.isArray(newReactions[key])) {
          newReactions[key] = newReactions[key].filter(id => id !== user.uid);
          if (newReactions[key].length === 0) {
            delete newReactions[key];
          }
        }
      });
      
      const usersReactedToTarget = Array.isArray(currentReactions[emoji]) ? currentReactions[emoji] : [];
      const hasReacted = usersReactedToTarget.includes(user.uid);
      
      if (!hasReacted) {
         if (!newReactions[emoji]) newReactions[emoji] = [];
         newReactions[emoji].push(user.uid);
      }
        
      await updateDoc(doc(db, 'messages', msgId), {
        reactions: newReactions
      });
      vibrateTap();
    } catch(e) {
      console.error(e);
    }
  };

  const filteredMembers = members.filter(m => 
    (m.nickname || m.displayName)?.toLowerCase().includes(mentionFilter)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0b] flex flex-col h-[100dvh] overflow-hidden">
      <div className="flex-1 relative flex flex-col max-w-4xl mx-auto w-full h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800/80 bg-[#111114]/90 backdrop-blur-sm z-10 sticky top-0 flex items-center justify-between shrink-0 pt-[max(env(safe-area-inset-top),12px)]">
            <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <span>Chat del Grupo</span>
            </h1>
            <button 
              id="close-group-chat-btn"
              onClick={onClose} 
              className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
        </div>

      {contextMenuMsgId && (
        <ContextMenu
          position={contextMenuPos}
          onClose={() => setContextMenuMsgId(null)}
          onSelectEmoji={(emoji) => handleReaction(contextMenuMsgId, emoji)}
          onReply={() => {
            const msgToReply = messages.find(m => m.id === contextMenuMsgId);
            if (msgToReply) setReplyToMsg(msgToReply);
          }}
          onMoreEmojis={() => setActiveEmojiPicker(contextMenuMsgId)}
        />
      )}
      
      <BaseBottomSheet isOpen={!!activeEmojiPicker} onClose={() => setActiveEmojiPicker(null)} title="Reacciones">
        <EmojiPicker 
          onSelect={(emoji) => {
            if (activeEmojiPicker) handleReaction(activeEmojiPicker, emoji);
          }}
          onClose={() => setActiveEmojiPicker(null)}
        />
      </BaseBottomSheet>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Messages Area */}
        <div 
          id="tutorial-chat-messages-container"
          className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 relative z-0"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50 space-y-2">
              <MessageSquare className="w-8 h-8" />
              <p className="text-xs">No hay mensajes aún.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <ChatMessageItem
                key={msg.id}
                msg={msg}
                idx={idx}
                messages={messages}
                user={user}
                activeGroup={activeGroup}
                setContextMenuPos={setContextMenuPos}
                setContextMenuMsgId={setContextMenuMsgId}
                setReplyToMsg={setReplyToMsg}
                setActiveEmojiPicker={setActiveEmojiPicker}
                activeEmojiPicker={activeEmojiPicker}
                handleReaction={handleReaction}
              />
            ))
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Reply To Preview */}
        {replyToMsg && (
          <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800/50 flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Respondiendo a {replyToMsg.userName}</span>
              <span className="text-xs text-zinc-400 truncate">{replyToMsg.text}</span>
            </div>
            <button onClick={() => setReplyToMsg(null)} className="p-1 text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Mentions Auto-complete */}
        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute bottom-[70px] left-4 right-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto z-10">
            {filteredMembers.map(m => (
              <button
                key={m.uid}
                onClick={() => handleMentionSelect(m.nickname || m.displayName || 'Usuario')}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 text-left transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-400 border border-blue-500/20 uppercase">
                  {(m.nickname || m.displayName || 'U')[0]}
                </div>
                <span className="text-xs font-bold text-white">{m.nickname || m.displayName}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="p-2 sm:p-3 bg-[#121215] border-t border-zinc-800/80 w-full shrink-0 pb-[max(env(safe-area-inset-bottom),32px)]">
          <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
            <input
              id="chat-input"
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-black border border-zinc-800 rounded-full px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-600"
              maxLength={500}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center text-white shrink-0 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4 ml-[-2px]" />
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
