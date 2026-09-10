import React, { useState, useEffect, useRef } from 'react';
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
  MessageCircle,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { PredictionsTab } from '../pages/PredictionsTab';
import { StandingsTab } from '../pages/StandingsTab';
import { RankingTab } from '../pages/RankingTab';
import { AdminTab } from '../pages/AdminTab';
import { SettingsTab } from '../pages/SettingsTab';
import { ProfileTab } from '../pages/ProfileTab';
import { BottomNav } from './BottomNav';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from './AuthProvider';
import { useGroups } from './GroupsProvider';
import { useSettings } from './SettingsProvider';
import { useGroupScores } from '../hooks/useGroupScores';
import { useUnpredictedCount } from '../hooks/useUnpredictedCount';
import { QRCodeSVG } from 'qrcode.react';
import { QuickQRScannerModal } from './QuickQRScannerModal';
import { setupForegroundNotificationListener } from '../lib/notifications';
import { doc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BaseBottomSheet } from './BaseBottomSheet';
import { GroupChat } from './GroupChat';
import { startInteractiveTutorial, destroyActiveTutorial, startPlayersUpdateTutorial } from '../lib/driver';
import { getGroupPodium, findAnyUserPodium } from '../lib/podium';
import { hasUserCustomPlayer } from '../data/players';
import { User as UserIcon } from 'lucide-react';
import { Match } from '../types';
import { checkAndAutoSyncFinishedMatches } from '../lib/serpapiSync';

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
  const { settings } = useSettings();
  const { currentUserPoints } = useGroupScores(activeGroupId, user?.uid, settings?.pointsExactMatch || 3);
  
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const inviteLink = `${window.location.origin}?invite=${activeGroup?.code || ''}`;

  // Reloj Interno: Auto-sincronización en vivo cada 60 segundos con batching de Gemini
  const matchesRef = useRef<Match[]>([]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const isSyncingCronRef = useRef(false);

  // Banner / Toast de Rate Limit (HTTP 429)
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleRateLimit = (e: any) => {
      const msg = e.detail?.message || "Límite de la IA alcanzado. Reintentando en el próximo ciclo.";
      setRateLimitNotice(msg);
      setTimeout(() => {
        setRateLimitNotice(prev => (prev === msg ? null : prev));
      }, 8000);
    };
    window.addEventListener('gemini-rate-limit', handleRateLimit);
    return () => window.removeEventListener('gemini-rate-limit', handleRateLimit);
  }, []);

  useEffect(() => {
    // 1. Escucha en tiempo real de todos los partidos en Firestore (actualiza ref en memoria sin ciclos)
    const unsubMatches = onSnapshot(collection(db, 'matches'), (snap) => {
      matchesRef.current = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
    }, (err) => {
      console.warn("[Reloj Interno] Error en snapshot de matches:", err);
    });

    // 2. Cronómetro interno con setInterval cada 60 segundos y candado estricto
    const runCronTick = async () => {
      if (isSyncingCronRef.current) {
        console.log("[Reloj Interno Tick] Sincronización previa aún en curso. Omitiendo tick.");
        return;
      }
      if (matchesRef.current.length > 0) {
        isSyncingCronRef.current = true;
        try {
          await checkAndAutoSyncFinishedMatches(matchesRef.current, settingsRef.current);
        } catch (err) {
          console.warn("[Reloj Interno Tick] Error en auto-sync:", err);
        } finally {
          isSyncingCronRef.current = false;
        }
      }
    };

    // 2. Cronómetro interno (PAUSADO TEMPORALMENTE por inestabilidad de SerpAPI)
    // Se reactivará cuando la API externa se estabilice. La sincronización manual sigue disponible en AdminTab.
    /*
    const initialTimer = setTimeout(runCronTick, 2500);
    const interval = setInterval(runCronTick, 60 * 1000);
    */

    return () => {
      unsubMatches();
    };
  }, []);

  useEffect(() => {
    const unsub = setupForegroundNotificationListener((payload) => {
      console.log('[Layout] Notificación en primer plano recibida:', payload);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const title = payload.notification?.title || payload.data?.title || 'La Cabra Gol ⚽';
        const body = payload.notification?.body || payload.data?.body || '';
        const icon = payload.notification?.icon || '/pwa-192x192.png';
        new Notification(title, { body, icon });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeGroupId) {
      setUnreadChatCount(0);
      return;
    }
    // Read or initialize last read timestamp
    let stored = localStorage.getItem(`last_read_chat_${activeGroupId}`);
    if (!stored) {
      stored = Date.now().toString();
      localStorage.setItem(`last_read_chat_${activeGroupId}`, stored);
    }
    const lastRead = Number(stored);

    const q = query(
      collection(db, 'messages'),
      where('groupId', '==', activeGroupId),
      where('createdAt', '>', lastRead)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (isChatOpen) {
        setUnreadChatCount(0);
        return;
      }
      const count = snap.docs.filter(d => d.data().userId !== user?.uid).length;
      setUnreadChatCount(count);
    }, (err) => {
      console.warn("Unread chat listener:", err);
    });
    return () => unsub();
  }, [activeGroupId, user?.uid, isChatOpen]);

  const openChat = () => {
    setIsChatOpen(true);
    if (activeGroupId) {
      localStorage.setItem(`last_read_chat_${activeGroupId}`, Date.now().toString());
    }
    setUnreadChatCount(0);
  };
  
  const runTutorial = () => {
    destroyActiveTutorial();
    setActiveTab('predictions');
    setIsTutorialActive(true);
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'auto' });
    }
    window.scrollTo(0, 0);
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

  // Auto-launch Player Update notice for users who previously chose a custom player
  useEffect(() => {
    if (!user || !activeGroupId || isTutorialActive) return;

    // Wait until main onboarding tutorial is done
    const mainSeenLocal = localStorage.getItem(`hasSeenTutorial_${user.uid}`) === 'true';
    const mainSeenFirestore = (profile as any)?.hasSeenTutorial === true;
    if (!mainSeenLocal && !mainSeenFirestore) return;

    // Check if already seen players update notice
    const updateKey = `hasSeenPlayersUpdate_${user.uid}`;
    const seenUpdateLocal = localStorage.getItem(updateKey) === 'true';
    const seenUpdateFirestore = (profile as any)?.hasSeenPlayersUpdateTutorial === true;
    if (seenUpdateLocal || seenUpdateFirestore) return;

    const checkCustomPodium = async () => {
      try {
        let userPodium = await getGroupPodium(activeGroupId, user.uid);
        if (!userPodium) {
          userPodium = await findAnyUserPodium(user.uid);
        }

        if (userPodium && hasUserCustomPlayer(userPodium)) {
          const timer = setTimeout(() => {
            startPlayersUpdateTutorial({
              onGoToProfile: () => setActiveTab('profile'),
              onComplete: () => {
                localStorage.setItem(updateKey, 'true');
                try {
                  updateDoc(doc(db, 'users', user.uid), {
                    hasSeenPlayersUpdateTutorial: true,
                    updatedAt: Date.now()
                  }).catch(() => {});
                } catch (e) {
                  console.warn("Could not save hasSeenPlayersUpdateTutorial:", e);
                }
              }
            });
          }, 800);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.warn("Error checking custom podium for tutorial:", err);
      }
    };

    checkCustomPodium();
  }, [user, activeGroupId, profile, isTutorialActive]);

  useEffect(() => {
    let restartTimer: NodeJS.Timeout | null = null;
    const handleRestart = () => {
      destroyActiveTutorial();
      if (restartTimer) clearTimeout(restartTimer);
      setActiveTab('predictions');
      restartTimer = setTimeout(() => {
        runTutorial();
      }, 250);
    };
    window.addEventListener('restart-tutorial', handleRestart);
    return () => {
      if (restartTimer) clearTimeout(restartTimer);
      window.removeEventListener('restart-tutorial', handleRestart);
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

  return (
    <div className={`flex flex-col ${activeTab === 'standings' ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'} w-full bg-[#09090b] text-[#e4e4e7] font-sans relative`}>
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
                  {currentUserPoints || 0} <span className="font-bold opacity-80">puntos</span>
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

      {/* Floating Toast: Límite de Cuota IA (HTTP 429) */}
      {rateLimitNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[999] w-[92%] max-w-md bg-amber-950/95 border border-amber-500/70 backdrop-blur-md rounded-xl p-3 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-200">Aviso de Cuota IA (Gemini 429)</p>
            <p className="text-[11px] text-amber-300/90 leading-snug">{rateLimitNotice}</p>
          </div>
          <button
            onClick={() => setRateLimitNotice(null)}
            className="text-amber-400/80 hover:text-amber-300 p-1"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 min-h-0 w-full flex flex-col ${activeTab === 'standings' ? 'overflow-hidden pb-[calc(56px+env(safe-area-inset-bottom,0px))]' : 'pb-28 sm:pb-32'}`}>
        <div className={`w-full max-w-4xl mx-auto relative ${activeTab === 'standings' ? 'flex-1 flex flex-col min-h-0 overflow-hidden h-full' : 'min-h-full pb-8'}`}>
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
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] right-5 z-[998] w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full shadow-2xl flex items-center justify-center text-white transition-transform active:scale-90 border border-blue-400/30"
          title="Chat del Grupo"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-[#09090b] rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg animate-bounce">
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

      {/* Standalone Bottom Navigation Bar */}
      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        unpredictedCount={unpredictedCount} 
      />

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
