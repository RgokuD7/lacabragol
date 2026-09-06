import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Trophy, 
  Users, 
  Info, 
  Settings as SettingsIcon, 
  Table2, 
  LogOut,
  Share2,
  Copy,
  Check,
  X,
  Scan,
  Plus,
  MessageCircle
, Shield} from 'lucide-react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { PredictionsTab } from '../pages/PredictionsTab';
import { StandingsTab } from '../pages/StandingsTab';
import { RankingTab } from '../pages/RankingTab';
import { AdminTab } from '../pages/AdminTab';
import { SettingsTab } from '../pages/SettingsTab';
import { ProfileTab } from '../pages/ProfileTab';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from './AuthProvider';
import { useGroups } from './GroupsProvider';
import { useUnpredictedCount } from '../hooks/useUnpredictedCount';
import { QRCodeSVG } from 'qrcode.react';
import { QuickQRScannerModal } from './QuickQRScannerModal';
import { doc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BaseBottomSheet } from './BaseBottomSheet';
import { GroupChat } from './GroupChat';
import { startInteractiveTutorial } from '../lib/driver';
import { User as UserIcon } from 'lucide-react';

export function Layout() {
  const [activeTab, setActiveTab] = useState('predictions');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const unpredictedCount = useUnpredictedCount();
  
  const { profile, logout, user } = useAuth();
  const { groups, activeGroupId, setActiveGroupId } = useGroups();
  
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const inviteLink = `${window.location.origin}?invite=${activeGroup?.code || ''}`;

  useEffect(() => {
    if (!activeGroupId) {
      setUnreadChatCount(0);
      return;
    }
    const lastRead = Number(localStorage.getItem(`last_read_chat_${activeGroupId}`) || Date.now());
    const q = query(
      collection(db, 'chatMessages'),
      where('groupId', '==', activeGroupId),
      where('createdAt', '>', lastRead)
    );
    const unsub = onSnapshot(q, (snap) => {
      const count = snap.docs.filter(d => d.data().userId !== user?.uid).length;
      setUnreadChatCount(count);
    }, (err) => {
      console.warn("Unread chat listener:", err);
    });
    return () => unsub();
  }, [activeGroupId, user?.uid]);

  const openChat = () => {
    setIsChatOpen(true);
    if (activeGroupId) {
      localStorage.setItem(`last_read_chat_${activeGroupId}`, Date.now().toString());
    }
    setUnreadChatCount(0);
  };
  
  const runTutorial = () => {
    setActiveTab('predictions');
    setIsTutorialActive(true);
    setTimeout(() => {
      startInteractiveTutorial({
        onComplete: () => {
          setIsTutorialActive(false);
          if (user) {
            localStorage.setItem(`hasSeenTutorial_${user.uid}`, 'true');
            try {
              updateDoc(doc(db, 'users', user.uid), { hasSeenTutorial: true }).catch(() => {});
            } catch (e) {
              console.warn("Could not save hasSeenTutorial:", e);
            }
          }
        }
      });
    }, 150);
  };

  // Auto-launch tutorial for new users who haven't completed it
  useEffect(() => {
    if (!user || !activeGroupId) return;
    const storageKey = `hasSeenTutorial_${user.uid}`;
    const seenLocal = localStorage.getItem(storageKey) === 'true';
    const seenFirestore = (profile as any)?.hasSeenTutorial === true;
    if (!seenLocal && !seenFirestore) {
      const timer = setTimeout(() => {
        runTutorial();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, activeGroupId, profile]);

  useEffect(() => {
    const handleRestart = () => {
      setActiveTab('predictions');
      setTimeout(() => {
        runTutorial();
      }, 300);
    };
    window.addEventListener('restart-tutorial', handleRestart);
    window.addEventListener('start-lacabragol-tutorial', handleRestart);
    return () => {
      window.removeEventListener('restart-tutorial', handleRestart);
      window.removeEventListener('start-lacabragol-tutorial', handleRestart);
    };
  }, [user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a mi grupo en LaCabraGol',
          text: `¡Únete a mi grupo ${activeGroup?.name} y compite en la Champions!`,
          url: inviteLink,
        });
      } catch (err) {
        console.log('Share error:', err);
      }
    } else {
      handleCopy();
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroup || !user) return;
    if (activeGroup.adminId === user.uid) {
      alert("Eres el administrador, no puedes salir del grupo.");
      return;
    }
    
    if (confirm(`¿Estás seguro de que deseas salir del grupo ${activeGroup.name}?`)) {
      try {
        const groupRef = doc(db, 'groups', activeGroup.id);
        await updateDoc(groupRef, {
          members: arrayRemove(user.uid)
        });
        
        const otherGroup = groups.find(g => g.id !== activeGroup.id);
        if (otherGroup) {
          setActiveGroupId(otherGroup.id);
        }
      } catch (error) {
        console.error("Error leaving group:", error);
      }
    }
  };

  const handleJoin = async () => {
    if (!joinCode || !user) return;
    setJoining(true);
    setJoinError('');
    try {
      const q = query(collection(db, 'groups'), where('code', '==', joinCode.toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setJoinError('Código no válido');
        setJoining(false);
        return;
      }
      
      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data();
      
      if (groupData.blockedMembers?.includes(user.uid)) {
        setJoinError('Has sido bloqueado de este grupo.');
        setJoining(false);
        return;
      }

      if (groupData.members?.includes(user.uid)) {
        setActiveGroupId(groupDoc.id);
        setIsJoinModalOpen(false);
        setJoining(false);
        return;
      }

      await updateDoc(groupDoc.ref, {
        members: arrayUnion(user.uid)
      });
      
      setActiveGroupId(groupDoc.id);
      setIsJoinModalOpen(false);
      setJoinCode('');
      setJoining(false);
    } catch (e: any) {
      setJoinError(e.message);
      setJoining(false);
    }
  };

  const tabs = [
    { id: 'predictions', label: 'Partidos', icon: Home, domId: 'nav-matches' },
    { id: 'standings', label: 'Tabla', icon: Table2, domId: 'nav-standings' },
    { id: 'ranking', label: 'Ranking', icon: Users, domId: 'nav-ranking' },
    { id: 'settings', label: 'Grupo', icon: Shield, domId: 'nav-settings' },
    { id: 'profile', label: 'Perfil', icon: UserIcon, domId: 'nav-profile' },
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-[#09090b] text-[#e4e4e7] font-sans overflow-hidden">
      {/* Top Navbar Compacto para Teléfono */}
      <header className="bg-[#111114]/95 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-40 shrink-0 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src="/logo.png" 
              alt="La Cabra Gol Logo" 
              className="w-8 h-8 object-contain shrink-0 drop-shadow-md"
            />
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="font-black text-sm text-white tracking-tight leading-none truncate">
                {activeGroup?.name || 'LaCabraGol'}
              </h1>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 truncate">
                Champions League
              </span>
            </div>
          </div>

          {/* Right Actions: Points, Share Group, Install */}
          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <button 
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2 bg-[#121215] border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                title="Ver mi Perfil"
              >
                <UserIcon className="w-4 h-4 text-zinc-400" />
                <span className="text-blue-400 font-black text-xs">
                  {profile.points || 0} <span className="font-bold opacity-80">puntos</span>
                </span>
              </button>
            )}
            
            <PWAInstallButton />

            {activeGroup && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  title="Compartir Invitación"
                  className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-colors shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 w-full min-h-0 ${activeTab === 'standings' ? 'overflow-hidden flex flex-col pb-[calc(56px+env(safe-area-inset-bottom,0px))]' : 'overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom,0px))] scrollbar-thin scrollbar-thumb-zinc-800'}`}>
        <div className={`w-full max-w-4xl mx-auto relative ${activeTab === 'standings' ? 'flex-1 flex flex-col min-h-0 overflow-hidden h-full' : 'h-full'}`}>
          {activeTab === 'predictions' && <PredictionsTab isTutorialActive={isTutorialActive} />}
          {activeTab === 'standings' && <StandingsTab />}
          {activeTab === 'ranking' && <RankingTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'profile' && <ProfileTab />}
        </div>
      </main>

      {/* Floating Action Button for Chat */}
      {(activeGroupId || isTutorialActive) && (
        <button
          id="fab-group-chat"
          onClick={openChat}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] right-5 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full shadow-2xl flex items-center justify-center text-white transition-transform active:scale-90 border border-blue-400/30"
          title="Chat del Grupo"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-500 border-2 border-[#09090b] rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg animate-bounce">
              {unreadChatCount > 99 ? '99+' : unreadChatCount}
            </span>
          )}
        </button>
      )}

      {/* Group Chat Full Screen Modal */}
      {isChatOpen && (
        <GroupChat 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)} 
          isTutorialActive={isTutorialActive}
        />
      )}

      {/* Bottom Navigation Bar Compacto */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111114]/70 backdrop-blur-2xl border-t border-white/5 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-4xl mx-auto flex justify-between px-1 py-1">
          {/* Main 2 Tabs: Partidos y Tabla */}
          {tabs.slice(0, 2).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={tab.domId || ''}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold tracking-tight transition-all relative",
                  isActive ? "text-blue-400 font-black" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                )}
                <div className={cn(
                  "p-1 rounded-lg transition-all relative",
                  isActive ? "text-blue-400" : ""
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "stroke-[2.5px]" : "stroke-[1.75px]")} />
                  {tab.id === 'predictions' && unpredictedCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-[#111114] rounded-full animate-pulse" />
                  )}
                </div>
                <span className="mt-0.5 leading-none truncate">{tab.label}</span>
              </button>
            );
          })}

          {/* Grouping for Ranking, Grupo and Perfil */}
          <div id="nav-group-ranking-profile" className="flex flex-[3] justify-between">
            {tabs.slice(2).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={tab.domId || ''}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold tracking-tight transition-all relative",
                    isActive ? "text-blue-400 font-black" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                  )}
                  <div className={cn(
                    "p-1 rounded-lg transition-all relative",
                    isActive ? "text-blue-400" : ""
                  )}>
                    <Icon className={cn("w-4 h-4", isActive ? "stroke-[2.5px]" : "stroke-[1.75px]")} />
                  </div>
                  <span className="mt-0.5 leading-none truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Share Group Modal using BaseBottomSheet */}
      <BaseBottomSheet
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Invitar al Grupo"
      >
        {activeGroup && (
          <div className="flex flex-col items-center space-y-6 pb-6">
            <div className="text-center space-y-1">
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Código del Grupo</p>
              <p className="text-3xl font-black text-white tracking-[0.2em] font-mono">{activeGroup.code}</p>
            </div>

            <div className="bg-white p-3 rounded-xl shadow-lg border-2 border-zinc-200">
              <QRCodeSVG value={inviteLink} size={160} />
            </div>

            <div className="w-full space-y-2">
              <p className="text-xs text-zinc-400 text-center">Escanea el código QR o comparte el enlace de invitación.</p>
              
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleCopy}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border border-zinc-700"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </button>
              </div>
            </div>
          </div>
        )}
      </BaseBottomSheet>

      {/* Join Group Modal using BaseBottomSheet */}
      <BaseBottomSheet
        isOpen={isJoinModalOpen}
        onClose={() => {
          setIsJoinModalOpen(false);
          setShowScanner(false);
        }}
        title="Unirse a un Grupo"
      >
        <div className="space-y-4 pb-6">
          <p className="text-xs text-zinc-400 text-center">
            Escribe el código de invitación o escanea un QR para entrar al grupo.
          </p>
          
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="CÓDIGO (EJ. ABCDEF)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-3 text-center text-lg font-black text-white tracking-[0.3em] placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors uppercase"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl px-4 flex items-center justify-center transition-colors border border-zinc-700/80"
              title="Escanear Código QR"
            >
              <Scan className="w-5 h-5" />
            </button>
          </div>

          <QuickQRScannerModal
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
            onScan={(code) => setJoinCode(code)}
            title="Escanear Invitación"
          />

          {joinError && <p className="text-[10px] font-bold text-red-400 text-center uppercase">{joinError}</p>}
          
          <button
            onClick={handleJoin}
            disabled={joining || joinCode.length < 5}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2"
          >
            {joining ? 'Uniendo...' : 'Entrar al Grupo'}
          </button>
        </div>
      </BaseBottomSheet>
    </div>
  );
}
