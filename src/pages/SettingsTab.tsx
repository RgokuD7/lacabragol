import { AdminTab } from './AdminTab';
import { PodiumSection } from './PodiumTab';
import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useGroups } from '../components/GroupsProvider';
import { useSettings } from '../components/SettingsProvider';
import { db } from '../lib/firebase';
import { doc, updateDoc, setDoc, arrayRemove, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { User, Group, Setting } from '../types';
import { Award, CheckCircle2, User as UserIcon, LogOut, Plus, LogIn, Share2, Save, Users, AlertCircle, Copy, Hash, Edit3, X, Trash2 } from 'lucide-react';
import { BaseBottomSheet } from '../components/BaseBottomSheet';
import { GroupMembersList } from '../components/GroupMembersList';
import { isCabraSuprema } from '../lib/utils';
import { vibrateSuccess, vibrateError } from '../lib/haptics';
import { deleteGroupPodium } from '../lib/podium';
import { FooterVersion } from '../components/FooterVersion';


function ReadOnlyRules({ settings }: { settings: any }) {
  return (
    <div className="space-y-6 mt-4">
      {settings?.rulesText && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-2">Reglas Especiales del Grupo</h3>
          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{settings.rulesText}</p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 border-b border-zinc-800 pb-2">Sistema de Puntuación (Partidos)</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-zinc-900 to-[#121215] border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">🎯</div>
              <div>
                <span className="block text-xs font-black text-white">Pleno / Exacto</span>
                <span className="block text-[10px] text-zinc-500">Aciertas el resultado exacto</span>
              </div>
            </div>
            <span className="text-lg font-black text-emerald-400">+{settings?.pointsExactMatch ?? 3}</span>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-[#121215] border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg">⚽</div>
              <div>
                <span className="block text-xs font-black text-white">Ganador / Empate</span>
                <span className="block text-[10px] text-zinc-500">Aciertas la tendencia</span>
              </div>
            </div>
            <span className="text-lg font-black text-blue-400">+{settings?.pointsWinnerTie ?? 1}</span>
          </div>

          {(settings?.pointsTeamGoals > 0) && (
            <div className="bg-gradient-to-br from-zinc-900 to-[#121215] border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg">🥅</div>
                <div>
                  <span className="block text-xs font-black text-white">Goles 1 Equipo</span>
                  <span className="block text-[10px] text-zinc-500">Aciertas goles de local o visita</span>
                </div>
              </div>
              <span className="text-lg font-black text-zinc-300">+{settings?.pointsTeamGoals}</span>
            </div>
          )}

          {(settings?.pointsGoalDiff > 0) && (
            <div className="bg-gradient-to-br from-zinc-900 to-[#121215] border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg">⚖️</div>
                <div>
                  <span className="block text-xs font-black text-white">Diferencia de Gol</span>
                  <span className="block text-[10px] text-zinc-500">Aciertas la diferencia correcta</span>
                </div>
              </div>
              <span className="text-lg font-black text-zinc-300">+{settings?.pointsGoalDiff}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400 border-b border-zinc-800 pb-2">Premios a Largo Plazo</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-amber-500/10 to-[#121215] border border-amber-500/20 rounded-lg p-3 flex flex-col items-center text-center gap-2">
            <div className="text-2xl">🏆</div>
            <div>
              <span className="block text-[11px] font-black text-amber-400">Campeón</span>
              <span className="block text-[9px] text-amber-500/70">Acertar al ganador del torneo</span>
            </div>
            <span className="text-xl font-black text-amber-400 mt-1">+{settings?.pointsChampion ?? 10}</span>
          </div>

          <div className="bg-gradient-to-br from-zinc-500/10 to-[#121215] border border-zinc-500/30 rounded-lg p-3 flex flex-col items-center text-center gap-2">
            <div className="text-2xl">🥈</div>
            <div>
              <span className="block text-[11px] font-black text-zinc-300">Subcampeón</span>
              <span className="block text-[9px] text-zinc-500">Acertar al 2do lugar</span>
            </div>
            <span className="text-xl font-black text-zinc-300 mt-1">+{settings?.pointsRunnerUp ?? 5}</span>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-[#121215] border border-purple-500/20 rounded-lg p-3 flex flex-col items-center text-center gap-2">
            <div className="text-2xl">🌟</div>
            <div>
              <span className="block text-[11px] font-black text-purple-400">Especiales</span>
              <span className="block text-[9px] text-purple-500/70">Goleador, Mejor Jugador, etc.</span>
            </div>
            <span className="text-xl font-black text-purple-400 mt-1">+{settings?.pointsSpecial ?? 3}</span>
          </div>
        </div>
      </div>
      
      <div className="bg-[#121215] border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
         <div className="flex items-center gap-2">
           <span className="text-lg">⏳</span>
           <span className="text-[11px] font-bold text-zinc-400">Cierre de Pronósticos</span>
         </div>
         <span className="text-xs font-black text-white">{settings?.blockMinutesBeforeMatch ?? 15} minutos antes</span>
      </div>
    </div>
  );
}

export function SettingsTab() {
  const { user, profile, logout } = useAuth();
  const { groups, activeGroupId, setActiveGroupId } = useGroups();
  
  const [nickname, setNickname] = useState(profile?.nickname || profile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const { settings } = useSettings();
  const [localSettings, setLocalSettings] = useState<Partial<Setting>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [isEditingRules, setIsEditingRules] = useState(false);

  // State for editing group name
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editGroupNameValue, setEditGroupNameValue] = useState('');
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [groupNameSuccess, setGroupNameSuccess] = useState(false);
  const [groupNameError, setGroupNameError] = useState('');

  const canEditRules = Boolean(
    user && activeGroup && (
      activeGroup.adminId === user.uid ||
      activeGroup.ownerId === user.uid ||
      activeGroup.coAdmins?.includes(user.uid) ||
      profile?.isAdmin ||
      profile?.role === 'admin' ||
      isCabraSuprema(profile, user?.email)
    )
  );

  const canEditGroupName = Boolean(
    user && activeGroup && (
      activeGroup.adminId === user.uid ||
      activeGroup.ownerId === user.uid ||
      activeGroup.coAdmins?.includes(user.uid) ||
      profile?.isAdmin ||
      profile?.role === 'admin' ||
      isCabraSuprema(profile, user?.email) ||
      !activeGroup.adminId
    )
  );

  React.useEffect(() => {
    setIsEditingRules(false);
    setIsEditingGroupName(false);
    setGroupNameError('');
  }, [activeGroupId]);

  const startEditingGroupName = (initialName?: string) => {
    if (!activeGroup) return;
    setEditGroupNameValue(initialName || activeGroup.name);
    setGroupNameError('');
    setIsEditingGroupName(true);
  };

  const handleSaveGroupName = async () => {
    if (!activeGroup || !user) return;
    const trimmed = editGroupNameValue.trim();
    if (!trimmed) {
      setGroupNameError('El nombre no puede estar vacío');
      vibrateError();
      return;
    }
    if (trimmed.length > 60) {
      setGroupNameError('Máximo 60 caracteres');
      vibrateError();
      return;
    }
    setSavingGroupName(true);
    setGroupNameError('');
    try {
      await updateDoc(doc(db, 'groups', activeGroup.id), {
        name: trimmed
      });
      await updateDoc(doc(db, 'settings', activeGroup.id), {
        groupName: trimmed,
        updatedAt: Date.now()
      }).catch(() => {});

      vibrateSuccess();
      setGroupNameSuccess(true);
      setTimeout(() => setGroupNameSuccess(false), 3000);
      setIsEditingGroupName(false);
    } catch (err: any) {
      console.error("Error al actualizar nombre del grupo:", err);
      setGroupNameError(err.message || 'Error al guardar el nuevo nombre');
      vibrateError();
    } finally {
      setSavingGroupName(false);
    }
  };

  React.useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSettingChange = (field: keyof Setting, value: string | number) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: typeof value === 'string' && value !== '' && !isNaN(Number(value)) && field !== 'groupName' && field !== 'rulesText' ? Number(value) : value
    }));
  };

  const saveSettings = async () => {
    if (!activeGroupId || !user) return;
    setSavingSettings(true);
    setSettingsSuccess(false);
    try {
      const payload: Setting = {
        groupName: activeGroup?.name || localSettings.groupName || 'Grupo',
        adminId: activeGroup?.adminId || user.uid,
        rulesText: localSettings.rulesText || '',
        blockMinutesBeforeMatch: Number(localSettings.blockMinutesBeforeMatch ?? 15),
        pointsExactMatch: Number(localSettings.pointsExactMatch ?? 3),
        pointsWinnerTie: Number(localSettings.pointsWinnerTie ?? 1),
        pointsTeamGoals: Number(localSettings.pointsTeamGoals ?? 0),
        pointsGoalDiff: Number(localSettings.pointsGoalDiff ?? 0),
        pointsChampion: Number(localSettings.pointsChampion ?? 10),
        pointsRunnerUp: Number(localSettings.pointsRunnerUp ?? 5),
        pointsThirdPlace: Number(localSettings.pointsThirdPlace ?? 0),
        pointsSpecial: Number(localSettings.pointsSpecial ?? 3),
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'settings', activeGroupId), payload, { merge: true });
      (document.activeElement as HTMLElement)?.blur();
      vibrateSuccess();
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
      setIsEditingRules(false);
    } catch (e) {
      console.error(e);
      vibrateError();
      alert('Error al guardar la configuración');
    } finally {
      setSavingSettings(false);
    }
  };


  const handleSaveNickname = async () => {
    if (!user || !nickname.trim()) return;
    setSaving(true);
    setSavedMsg('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        nickname: nickname.trim(),
        updatedAt: Date.now()
      });
      setSavedMsg('Guardado');
      setTimeout(() => setSavedMsg(''), 2000);
      window.location.reload(); 
    } catch(e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim() || !isCabraSuprema(profile, user.email)) return;
    setCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newGroup = {
        name: newGroupName.trim(),
        code,
        adminId: user.uid,
        members: [user.uid],
        createdAt: Date.now()
      };
      const docRef = await addDoc(collection(db, 'groups'), newGroup);
      setActiveGroupId(docRef.id);
      setNewGroupName('');
      setShowCreate(false);
    } catch(e) {
      console.error(e);
    }
    setCreating(false);
  };

  const handleLeaveGroup = async (g: Group) => {
    if (!user) return;
    if (g.adminId === user.uid) {
      alert("Eres el administrador, no puedes salir. Pide a alguien más que administre o elimina el grupo.");
      return;
    }
    if (confirm(`¿Seguro que quieres salir de ${g.name}?`)) {
      try {
        await updateDoc(doc(db, 'groups', g.id), {
          members: arrayRemove(user.uid)
        });
        await deleteGroupPodium(g.id, user.uid);
        if (g.id === activeGroupId) {
          const other = groups.find(x => x.id !== g.id);
          if (other) setActiveGroupId(other.id);
        }
      } catch(e) {
        console.error(e);
      }
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Código copiado al portapapeles');
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const handleDeleteGroup = async () => {
    if (!activeGroup || !user) return;
    setDeletingGroup(true);
    try {
      await deleteDoc(doc(db, 'groups', activeGroup.id));
      await deleteGroupPodium(activeGroup.id, user.uid);
      const remaining = groups.filter(g => g.id !== activeGroup.id);
      if (remaining.length > 0) {
        setActiveGroupId(remaining[0].id);
      } else {
        setActiveGroupId('');
      }
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Error deleting group:", err);
      alert("Error al eliminar el grupo. Verifica tus permisos.");
    } finally {
      setDeletingGroup(false);
    }
  };

  return (
    <div className="p-2 sm:p-3 max-w-4xl mx-auto pb-[120px] font-sans space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Mi Grupo</h1>
          <p className="text-xs text-zinc-400 mt-1">Información de los participantes y reglas del juego.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Left Column: Profile & Group Selection & Internal Navigation */}
        <div className="space-y-4">
          {/* Group Management */}
          <div className="bg-[#121215] border border-zinc-800/50 rounded-lg p-3 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Mis Grupos</h2>
              </div>
              {isCabraSuprema(profile, user?.email) && (
                <button 
                  onClick={() => setShowCreate(!showCreate)}
                  className="text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors border border-amber-500/20"
                  title="Crear Grupo (Cabra Suprema)"
                >
                  <Plus className="w-3 h-3" /> Crear
                </button>
              )}
            </div>

            {isCabraSuprema(profile, user?.email) && showCreate && (
              <div className="bg-zinc-900 border border-amber-500/30 rounded-xl p-3 flex gap-2 animate-in slide-in-from-top-1">
                <input
                  type="text"
                  placeholder="Nombre del grupo..."
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="flex-1 bg-black border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleCreateGroup}
                  disabled={creating || !newGroupName.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black px-3 rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                >
                  Crear
                </button>
              </div>
            )}

            <div className="space-y-2">
              {groups.map(g => {
                const canEditThisGroup = Boolean(
                  user && (
                    g.adminId === user.uid ||
                    (g as any).ownerId === user.uid ||
                    g.coAdmins?.includes(user.uid) ||
                    profile?.isAdmin ||
                    profile?.role === 'admin' ||
                    isCabraSuprema(profile, user?.email) ||
                    !g.adminId
                  )
                );
                return (
                  <div key={g.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-white">{g.name}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Hash className="w-3 h-3 text-zinc-500" />
                        <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-mono">{g.code}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditThisGroup && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveGroupId(g.id);
                            startEditingGroupName(g.name);
                          }}
                          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-blue-400 rounded-md transition-colors cursor-pointer"
                          title={`Cambiar nombre de ${g.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {g.id !== activeGroupId ? (
                        <button
                          onClick={() => setActiveGroupId(g.id)}
                          className="text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          Activar
                        </button>
                      ) : (
                        <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 uppercase">
                          Activo
                        </span>
                      )}
                      {g.adminId !== user?.uid && (
                        <button onClick={() => handleLeaveGroup(g)} className="text-red-400 hover:text-red-300 p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors cursor-pointer">
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Active Group Info & Rules */}
        <div className="space-y-4">
          
          {activeGroup ? (
            <div className="bg-[#121215] border border-blue-500/30 rounded-lg p-3 shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-blue-500 pointer-events-none">
                <Users className="w-24 h-24" />
              </div>
              <div className="relative z-10 border-b border-zinc-800/50 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    Grupo Activo
                  </h2>
                  {canEditGroupName && !isEditingGroupName && (
                    <button
                      type="button"
                      onClick={() => startEditingGroupName(activeGroup.name)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors shadow-sm cursor-pointer"
                      title="Cambiar nombre del grupo"
                    >
                      <Edit3 className="w-3 h-3 text-blue-400" />
                      <span>Cambiar Nombre</span>
                    </button>
                  )}
                </div>

                {isEditingGroupName ? (
                  <div className="mt-2 space-y-2 animate-in fade-in duration-200">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editGroupNameValue}
                        onChange={e => setEditGroupNameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveGroupName();
                          } else if (e.key === 'Escape') {
                            setIsEditingGroupName(false);
                          }
                        }}
                        placeholder="Nuevo nombre del grupo..."
                        maxLength={60}
                        autoFocus
                        className="flex-1 bg-black border-2 border-blue-500/60 rounded-xl px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-blue-400 shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={handleSaveGroupName}
                        disabled={savingGroupName || !editGroupNameValue.trim()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{savingGroupName ? '...' : 'Guardar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingGroupName(false)}
                        disabled={savingGroupName}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {groupNameError && (
                      <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {groupNameError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-lg font-black text-white tracking-tight">{activeGroup.name}</p>
                    {groupNameSuccess && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 animate-in fade-in">
                        <CheckCircle2 className="w-3 h-3" /> ¡Actualizado!
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Código de Invitación</span>
                  <div className="flex items-center gap-2 bg-black px-2 py-1 rounded-lg border border-zinc-800">
                    <span className="text-sm font-black font-mono text-white tracking-widest">{activeGroup.code}</span>
                    <button onClick={() => copyCode(activeGroup.code)} className="text-zinc-400 hover:text-white transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Participantes</span>
                  <span className="text-lg font-black text-white">{activeGroup.members?.length || 0}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-center">
              <p className="text-xs text-zinc-500">No has seleccionado ningún grupo activo.</p>
            </div>
          )}

          {activeGroup && <GroupMembersList group={activeGroup} />}

          {/* Admin Delete Group Button (2-Step Confirmation) */}
          {activeGroup && (activeGroup.adminId === user?.uid || profile?.role === 'admin' || profile?.isAdmin) && (
            <div className="bg-[#121215] border border-rose-500/20 rounded-lg p-3 shadow-sm">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2.5 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Grupo</span>
                </button>
              ) : (
                <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-3.5 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>¿Confirmas que deseas eliminar permanentemente el grupo "{activeGroup.name}"?</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Esta acción eliminará el grupo para todos los participantes y no se puede deshacer.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={deletingGroup}
                      onClick={handleDeleteGroup}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-2 rounded-lg text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deletingGroup ? 'Eliminando...' : 'Confirmar Eliminación'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={deletingGroup}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rules Section */}
          <div className="bg-[#121215] border border-zinc-800/50 rounded-lg p-3 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Reglas del Juego</h2>
              </div>
              {canEditRules && !isEditingRules && (
                <button
                  type="button"
                  onClick={() => {
                    if (settings) setLocalSettings(settings);
                    setIsEditingRules(true);
                  }}
                  className="text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar Reglas</span>
                </button>
              )}
              {canEditRules && isEditingRules && (
                <button
                  type="button"
                  onClick={() => {
                    if (settings) setLocalSettings(settings);
                    setIsEditingRules(false);
                  }}
                  className="text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>
            
            {isEditingRules && canEditRules ? (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* General Config Card */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1.5 tracking-wider">Nombre del Grupo</label>
                        <input
                          type="text"
                          value={localSettings.groupName || ''}
                          onChange={e => handleSettingChange('groupName', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                          placeholder="Ej: Champions League 2026/27"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1.5 tracking-wider">Minutos de Bloqueo previo</label>
                        <input
                          type="number"
                          value={localSettings.blockMinutesBeforeMatch ?? 15}
                          onChange={e => handleSettingChange('blockMinutesBeforeMatch', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                          placeholder="15"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase font-bold text-zinc-400 mb-1.5 tracking-wider">Reglas Adicionales (Texto descriptivo)</label>
                      <textarea
                        rows={3}
                        value={localSettings.rulesText || ''}
                        onChange={e => handleSettingChange('rulesText', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none"
                        placeholder="Especifica detalles de pagos, premios y normas internas del grupo..."
                      />
                    </div>
                  </div>

                  {/* Points Rules Engine Card */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-3 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <span>Motor de Puntos por Pronóstico</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                        <label className="block text-[10px] uppercase font-bold text-emerald-400 mb-1">Marcador Exacto</label>
                        <input
                          type="number"
                          value={localSettings.pointsExactMatch ?? 3}
                          onChange={e => handleSettingChange('pointsExactMatch', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-black text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                        <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">Ganador / Empate</label>
                        <input
                          type="number"
                          value={localSettings.pointsWinnerTie ?? 1}
                          onChange={e => handleSettingChange('pointsWinnerTie', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-black text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                        <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Goles de 1 equipo</label>
                        <input
                          type="number"
                          value={localSettings.pointsTeamGoals ?? 0}
                          onChange={e => handleSettingChange('pointsTeamGoals', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-black text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                        <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Diferencia de Gol</label>
                        <input
                          type="number"
                          value={localSettings.pointsGoalDiff ?? 0}
                          onChange={e => handleSettingChange('pointsGoalDiff', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-black text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                      <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                        <label className="block text-[10px] uppercase font-bold text-amber-400 mb-1">Podio Campeón</label>
                        <input
                          type="number"
                          value={localSettings.pointsChampion ?? 10}
                          onChange={e => handleSettingChange('pointsChampion', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-black text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                        <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Podio Subcampeón</label>
                        <input
                          type="number"
                          value={localSettings.pointsRunnerUp ?? 5}
                          onChange={e => handleSettingChange('pointsRunnerUp', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-black text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                        <label className="block text-[10px] uppercase font-bold text-purple-400 mb-1">Premios Individuales</label>
                        <input
                          type="number"
                          value={localSettings.pointsSpecial ?? 3}
                          onChange={e => handleSettingChange('pointsSpecial', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-black text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save and Cancel Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={saveSettings}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingSettings ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={() => {
                        if (settings) setLocalSettings(settings);
                        setIsEditingRules(false);
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3.5 px-5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  {settingsSuccess && (
                    <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/50 text-emerald-400 text-xs rounded-xl font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>¡Guardado exitosamente!</span>
                    </div>
                  )}
                </div>
            ) : (
                <ReadOnlyRules settings={settings || localSettings} />
            )}
          </div>
        </div>
      </div>
      
      {/* Admin Button */}
      {(profile?.role === 'admin' || profile?.isAdmin || user?.uid === activeGroup?.ownerId) && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <AdminTab inline={true} />
        </div>
      )}

      {/* Cerrar Sesión Button */}
      <div className="mt-6 pt-4 border-t border-zinc-800/80">
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl font-black uppercase tracking-widest text-xs transition-colors border border-red-500/30 shadow-sm"
        >
          <LogOut className="w-4 h-4" /> Cerrar Sesión
        </button>
      </div>

      {/* Watermark version footer */}
      <FooterVersion className="mt-2 pb-6" />
    </div>
  );
}