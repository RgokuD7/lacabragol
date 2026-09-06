import React, { useState, useEffect } from 'react';
import { useGroups } from '../components/GroupsProvider';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Trophy, Crown, Medal, Flame, Zap, UserCheck, ArrowRight, Save, LogOut, Scan, X, Search, CheckCircle2, Sparkles, CopyCheck } from 'lucide-react';
import { handleFirestoreError, OperationType, cn, isCabraSuprema } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { Podium } from '../types';
import { QuickQRScannerModal } from '../components/QuickQRScannerModal';
import { FooterVersion } from '../components/FooterVersion';
import { UCL_36_TEAMS, getTeamLogoByName } from '../data/fixtures';
import { getGroupPodium, saveGroupPodium, findAnyUserPodium } from '../lib/podium';

import { TeamBadge } from '../components/TeamBadge';
import { vibrateSuccess, vibrateError } from '../lib/haptics';
import { usePlayers } from '../hooks/usePlayers';
import { formatNationality } from '../data/players';

interface Props {
  forcePodiumStep?: boolean;
  onPodiumSaved?: () => void;
  targetGroupId?: string;
}

export function GroupOnboarding({ forcePodiumStep = false, onPodiumSaved, targetGroupId }: Props = {}) {
  const { groups, loadingGroups, activeGroupId, setActiveGroupId } = useGroups();
  const { user, profile, logout } = useAuth();
  const { players: dynamicPlayers } = usePlayers();

  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const effectiveGroupId = createdGroupId || targetGroupId || activeGroupId || (groups.length > 0 ? groups[0].id : null);
  const targetGroup = groups.find(g => g.id === effectiveGroupId);
  
  // 0: Welcome, 1: Join Group, 2: Predictions Wizard
  const [step, setStep] = useState<0 | 1 | 2>(forcePodiumStep ? 0 : 1);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Join Group State
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('invite');
    if (codeFromUrl) {
      setInviteCode(codeFromUrl.toUpperCase());
    }
  }, []);

  // Create Group State (Cabra Suprema / Super Admin only)
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  // Predictions State
  const [podium, setPodium] = useState<Partial<Podium>>({});
  const [savingPodium, setSavingPodium] = useState(false);
  const [hasPodium, setHasPodium] = useState(false);
  const [existingPodium, setExistingPodium] = useState<Podium | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkPodium = async () => {
      try {
        if (effectiveGroupId) {
          const p = await getGroupPodium(effectiveGroupId, user.uid);
          if (p && (p.champion || p.runnerUp)) {
            setHasPodium(true);
            return;
          }
        }
        // Check if user has any existing podium in another group to offer 1-click copy
        const anyPodium = await findAnyUserPodium(user.uid);
        if (anyPodium && (anyPodium.champion || anyPodium.runnerUp)) {
          setExistingPodium(anyPodium);
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkPodium();
  }, [user, effectiveGroupId]);

  // If they have groups, but no podium, jump to step 0
  useEffect(() => {
    if ((groups.length > 0 || createdGroupId) && !hasPodium) {
      setStep(0);
    }
  }, [groups.length, createdGroupId, hasPodium]);

  const handleJoin = async () => {
    if (!inviteCode || !user) return;
    setJoining(true);
    setErrorMsg('');
    try {
      const q = query(collection(db, 'groups'), where('code', '==', inviteCode.toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setErrorMsg('Código no válido');
        setJoining(false);
        return;
      }
      
      const groupDoc = snap.docs[0];
      await updateDoc(groupDoc.ref, {
        members: arrayUnion(user.uid)
      });
      setCreatedGroupId(groupDoc.id);
      setActiveGroupId(groupDoc.id);
      setStep(0);
    } catch (e: any) {
      setErrorMsg(e.message);
      setJoining(false);
    }
  };

  const handleCreate = async () => {
    if (!newGroupName || !user || !isCabraSuprema(profile, user?.email)) return;
    setCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newRef = doc(collection(db, 'groups'));
      await setDoc(newRef, {
        name: newGroupName,
        code,
        adminId: user.uid,
        members: [user.uid],
        createdAt: Date.now()
      });
      setCreatedGroupId(newRef.id);
      setActiveGroupId(newRef.id);
      setStep(0);
    } catch (e: any) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleCopyExistingPodium = async () => {
    const resolvedGroupId = effectiveGroupId || activeGroupId || (groups.length > 0 ? groups[0]?.id : null);
    if (!user || !existingPodium) return;
    if (!resolvedGroupId) {
      alert("No se encontró el grupo activo para guardar tus candidatos. Selecciona un grupo e inténtalo de nuevo.");
      return;
    }
    setSavingPodium(true);
    try {
      await saveGroupPodium(resolvedGroupId, user.uid, existingPodium);
      vibrateSuccess();
      if (onPodiumSaved) {
        onPodiumSaved();
      } else {
        window.location.reload();
      }
    } catch (e: any) {
      console.error("Error copying podium:", e);
      vibrateError();
      alert("Error al copiar candidatos: " + (e?.message || "Error desconocido"));
      setSavingPodium(false);
    }
  };

  const savePredictions = async () => {
    const resolvedGroupId = effectiveGroupId || activeGroupId || (groups.length > 0 ? groups[0]?.id : null);
    if (!user) {
      alert("Debes iniciar sesión para guardar tus candidatos.");
      return;
    }
    if (!resolvedGroupId) {
      alert("No se encontró el grupo activo para guardar tus candidatos. Selecciona un grupo e inténtalo de nuevo.");
      return;
    }
    setSavingPodium(true);
    try {
      await saveGroupPodium(resolvedGroupId, user.uid, podium);
      vibrateSuccess();
      if (onPodiumSaved) {
        onPodiumSaved();
      } else {
        window.location.reload();
      }
    } catch (e: any) {
      console.error("Error saving podium:", e);
      vibrateError();
      alert("Error al guardar candidatos: " + (e?.message || "Error desconocido"));
      setSavingPodium(false);
    }
  };

  if (loadingGroups) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-white">Cargando...</div>;
  }

  const filteredTeams = UCL_36_TEAMS.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.country.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredPlayers = dynamicPlayers.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.team && p.team.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.nationality && p.nationality.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.position && p.position.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const showCustomPlayer = searchTerm.trim().length > 0 && !dynamicPlayers.some(p => p.name.toLowerCase() === searchTerm.toLowerCase());

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-[#0a0a0b] font-sans text-zinc-200">
      
      {/* STEP 0: WELCOME */}
      {step === 0 && (
        <div 
          className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto w-full"
          style={{ 
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 20px), 24px)', 
            paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 20px), 24px)' 
          }}
        >
          <img src="/logo.png" alt="La Cabra Gol Logo" className="w-24 h-24 sm:w-28 sm:h-28 object-contain mb-4 drop-shadow-[0_0_25px_rgba(59,130,246,0.2)]" />
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
            {targetGroup ? `¡Candidatos para ${targetGroup.name}!` : '¡Bienvenido!'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">
            Elige a tus candidatos para ganar el torneo en este grupo. Esto te dará puntos extra al final de la temporada.
          </p>

          {existingPodium && (
            <div className="w-full bg-gradient-to-r from-blue-950/40 via-[#121215] to-indigo-950/40 border border-blue-500/30 rounded-2xl p-4 mb-4 text-left shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-blue-400 font-black text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>¿Usar tus candidatos anteriores?</span>
                </div>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">RÁPIDO</span>
              </div>
              <p className="text-xs text-zinc-300 mb-3">
                Ya elegiste a <strong className="text-white">{existingPodium.champion}</strong> (Campeón) y <strong className="text-white">{existingPodium.runnerUp}</strong> (Subcampeón).
              </p>
              <button
                onClick={handleCopyExistingPodium}
                disabled={savingPodium}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
              >
                <CopyCheck className="w-4 h-4" />
                <span>{savingPodium ? 'Copiando...' : 'Copiar Candidatos a este Grupo'}</span>
              </button>
            </div>
          )}

          <button 
            onClick={() => {
              setStep(2);
              setSearchTerm('');
            }} 
            className="w-full bg-[#18181b] hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl border border-zinc-700 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {existingPodium ? 'Personalizar Nuevos Candidatos' : 'Elegir Candidatos'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 1: JOIN GROUP */}
      {step === 1 && groups.length === 0 && (
        <div 
          className="flex-1 flex flex-col items-center justify-center p-4"
          style={{ 
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 20px), 24px)', 
            paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 20px), 24px)' 
          }}
        >
          <div className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <img src="/logo.png" alt="La Cabra Gol Logo" className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
                <h1 className="text-2xl font-black text-white tracking-tight">Únete a un Grupo</h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Para participar, necesitas un código de invitación. Pídeselo al administrador de tu liga o escanea el QR.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="CÓDIGO DE 6 LETRAS"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
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
                
                {/* Modal de Escáner Instantáneo sin UI innecesaria */}
                <QuickQRScannerModal
                  isOpen={showScanner}
                  onClose={() => setShowScanner(false)}
                  onScan={(scannedCode) => setInviteCode(scannedCode)}
                  title="Escanear Invitación"
                />

                {errorMsg && <p className="text-[10px] font-bold text-red-400 text-center uppercase">{errorMsg}</p>}
                
                <button
                  onClick={handleJoin}
                  disabled={joining || inviteCode.length < 5}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2"
                >
                  {joining ? 'Buscando...' : 'Entrar al Grupo'}
                  {!joining && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>

              {/* Crear Grupo SOLO para Cabra Suprema (Super Admin) */}
              {isCabraSuprema(profile, user?.email) && (
                <div className="pt-6 border-t border-zinc-800 space-y-3">
                  <p className="text-[10px] font-bold text-amber-400 text-center uppercase tracking-wider">Cabra Suprema (Crear Grupo)</p>
                  <input
                    type="text"
                    placeholder="Nombre del nuevo grupo"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newGroupName}
                    className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/50 font-bold text-xs py-2 rounded-lg transition-colors"
                  >
                    {creating ? 'Creando...' : 'Crear Nuevo Grupo'}
                  </button>
                </div>
              )}

              <button onClick={logout} className="absolute top-4 right-4 text-zinc-500 hover:text-red-400 transition-colors" title="Cerrar Sesión">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Watermark version footer */}
          <FooterVersion className="mt-4" />
        </div>
      )}

      {/* STEP 2: PREDICTIONS WIZARD */}
      {step === 2 && (
        <div 
          className="flex-1 flex flex-col min-h-0 w-full max-w-2xl mx-auto px-4 md:px-6 pb-4 md:pb-6 animate-in slide-in-from-right-8 duration-300"
          style={{ 
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 20px), 28px)' 
          }}
        >
          
          {/* Header */}
          <div className="flex-none pb-4">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 mb-4">
              <span className="uppercase tracking-widest">Tus Candidatos</span>
              <span>Paso {wizardStep} de 5</span>
            </div>
            
            <div className="w-full bg-zinc-900 rounded-full h-1.5 mb-8">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${(wizardStep / 5) * 100}%` }}
              ></div>
            </div>

            <div className="text-center space-y-3 mb-6">
              {wizardStep === 1 && <Crown className="w-14 h-14 text-amber-400 mx-auto drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />}
              {wizardStep === 2 && <Medal className="w-14 h-14 text-zinc-300 mx-auto drop-shadow-[0_0_15px_rgba(212,212,216,0.2)]" />}
              {wizardStep === 3 && <Flame className="w-14 h-14 text-emerald-400 mx-auto drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />}
              {wizardStep === 4 && <Zap className="w-14 h-14 text-blue-400 mx-auto drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />}
              {wizardStep === 5 && <UserCheck className="w-14 h-14 text-indigo-400 mx-auto drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]" />}
              
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {wizardStep === 1 && '¿Quién crees que será campeón?'}
                {wizardStep === 2 && '¿Quién será el Subcampeón?'}
                {wizardStep === 3 && '¿Quién será el Máximo Goleador?'}
                {wizardStep === 4 && '¿Quién dará Más Asistencias?'}
                {wizardStep === 5 && '¿Quién será el MVP del Torneo?'}
              </h2>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={wizardStep <= 2 ? "Buscar equipo (Ej: Real Madrid)..." : "Buscar o escribir jugador..."}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-sm font-semibold text-white placeholder:text-zinc-500 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pb-4">
            <div className="space-y-2">
              {wizardStep <= 2 ? (
                filteredTeams.map(team => {
                  const isSelected = wizardStep === 1 ? podium.champion === team.name : podium.runnerUp === team.name;
                  return (
                    <button
                      key={team.id}
                      onClick={() => setPodium(p => wizardStep === 1 ? { ...p, champion: team.name } : { ...p, runnerUp: team.name })}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left",
                        isSelected 
                          ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                          : "bg-[#121215] border-zinc-800/50 hover:bg-zinc-900/80 hover:border-zinc-700"
                      )}
                    >
                      <TeamBadge src={`https://img.sofascore.com/api/v1/team/${team.id}/image`} teamName={team.name} size="md" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className={cn("text-base font-bold truncate", isSelected ? "text-blue-400" : "text-white")}>{team.name}</span>
                        <span className="text-xs text-zinc-400 font-medium">{formatNationality(team.country)}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <>
                  {filteredPlayers.map(player => {
                    const isSelected = (wizardStep === 3 && podium.topScorer === player.name) || (wizardStep === 4 && podium.mostAssists === player.name) || (wizardStep === 5 && podium.mvp === player.name);
                    return (
                      <button
                        key={player.id}
                        onClick={() => setPodium(p => {
                          if (wizardStep === 3) return { ...p, topScorer: player.name };
                          if (wizardStep === 4) return { ...p, mostAssists: player.name };
                          return { ...p, mvp: player.name };
                        })}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left",
                          isSelected 
                            ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                            : "bg-[#121215] border-zinc-800/50 hover:bg-zinc-900/80 hover:border-zinc-700"
                        )}
                      >
                        <img 
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=27272a&color=fff&size=128&bold=true`} 
                          alt={player.name} 
                          className="w-12 h-12 rounded-full object-cover shrink-0 border border-zinc-700/50" 
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={cn("text-base font-bold truncate", isSelected ? "text-blue-400" : "text-white")}>{player.name}</span>
                          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium truncate mt-0.5">
                            {player.team && <span>{player.team}</span>}
                            {player.nationality && (
                              <span className="text-zinc-300 font-semibold bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/50">
                                {formatNationality(player.nationality)}
                              </span>
                            )}
                            {player.position && <span className="text-zinc-500">({player.position})</span>}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                  {showCustomPlayer && (
                    <button
                      onClick={() => setPodium(p => {
                        const val = searchTerm.trim();
                        if (wizardStep === 3) return { ...p, topScorer: val, hasCustomPlayer: true };
                        if (wizardStep === 4) return { ...p, mostAssists: val, hasCustomPlayer: true };
                        return { ...p, mvp: val, hasCustomPlayer: true };
                      })}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left bg-zinc-900 border-zinc-700 hover:border-blue-500/50"
                      )}
                    >
                      <img 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(searchTerm.trim())}&background=27272a&color=3b82f6&size=128&bold=true`} 
                        alt="Custom" 
                        className="w-12 h-12 rounded-full object-cover shrink-0 border border-blue-500/30" 
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-base font-bold text-white">{searchTerm.trim()}</span>
                        <span className="text-xs text-blue-400 font-medium uppercase tracking-wider">Usar este nombre personalizado</span>
                      </div>
                    </button>
                  )}
                </>
              )}
              
              {(wizardStep <= 2 ? filteredTeams.length === 0 : (filteredPlayers.length === 0 && !showCustomPlayer)) && (
                <div className="text-center py-10">
                  <p className="text-sm text-zinc-500 font-medium">No se encontraron resultados para "{searchTerm}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Controls */}
          <div 
            className="flex-none pt-4 bg-[#0a0a0b] border-t border-zinc-800"
            style={{ 
              paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 12px), 16px)' 
            }}
          >
            <div className="flex gap-3">
              {wizardStep > 1 && (
                <button 
                  onClick={() => {
                    setWizardStep(w => w - 1);
                    setSearchTerm('');
                  }} 
                  className="px-6 py-4 bg-[#121215] text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-2xl hover:bg-zinc-900 border border-zinc-800 transition-colors"
                >
                  Atrás
                </button>
              )}
              <button 
                onClick={() => {
                  if (wizardStep < 5) {
                    setWizardStep(w => w + 1);
                    setSearchTerm('');
                  } else {
                    savePredictions();
                  }
                }} 
                disabled={savingPodium || (wizardStep === 1 && !podium.champion) || (wizardStep === 2 && !podium.runnerUp) || (wizardStep === 3 && !podium.topScorer) || (wizardStep === 4 && !podium.mostAssists) || (wizardStep === 5 && !podium.mvp)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2"
              >
                {wizardStep < 5 ? 'Siguiente' : (savingPodium ? 'Guardando...' : 'Finalizar')}
                {wizardStep < 5 ? <ArrowRight className="w-5 h-5" /> : (!savingPodium && <Save className="w-5 h-5" />)}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
