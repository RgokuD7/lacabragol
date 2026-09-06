import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { UserAvatar } from '../components/UserAvatar';
import { PodiumDisplay } from '../components/PodiumDisplay';
import { User as UserIcon, LogOut, Award, Hash, Mail, Check, AlertCircle, Trophy, Flame, HelpCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Podium } from '../types';
import { getTeamLogoByName } from '../data/fixtures';
import { vibrateSuccess, vibrateError } from '../lib/haptics';
import { FooterVersion } from '../components/FooterVersion';

export function ProfileTab() {
  const { user, profile, logout } = useAuth();
  const [nickname, setNickname] = useState(profile?.nickname || profile?.displayName || '');
  const [savingNickname, setSavingNickname] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [podium, setPodium] = useState<Podium | null>(null);
  const [savingPodium, setSavingPodium] = useState(false);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname || profile.displayName || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'podiums', user.uid), (snap) => {
      if (snap.exists()) {
        setPodium(snap.data() as Podium);
      } else {
        setPodium(null);
      }
    });
    return () => unsub();
  }, [user]);

  const handleSaveNickname = async () => {
    if (!user || !nickname.trim()) return;
    setSavingNickname(true);
    setSavedMsg('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        nickname: nickname.trim(),
        updatedAt: Date.now(),
      });
      vibrateSuccess();
      setSavedMsg('¡Guardado!');
      setTimeout(() => setSavedMsg(''), 2500);
    } catch (e) {
      console.error(e);
      vibrateError();
    }
    setSavingNickname(false);
  };

  const handleSavePodium = async (data: Partial<Podium>) => {
    if (!user) return;
    setSavingPodium(true);
    try {
      const payload: Podium = {
        userId: user.uid,
        champion: data.champion || '',
        championLogo: data.championLogo || getTeamLogoByName(data.champion),
        runnerUp: data.runnerUp || '',
        runnerUpLogo: data.runnerUpLogo || getTeamLogoByName(data.runnerUp),
        topScorer: data.topScorer || '',
        mostAssists: data.mostAssists || '',
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'podiums', user.uid), payload);
    } finally {
      setSavingPodium(false);
    }
  };

  if (!user) return null;

  const max_normal = profile?.max_streak_normal || 0;
  const max_pleno = profile?.max_streak_pleno || 0;
  const max_falla = profile?.max_streak_falla || 0;
  const max_ausente = profile?.max_streak_ausente || 0;
  const medallas = profile?.medallas || [];

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4 font-sans text-[#e4e4e7] max-w-4xl mx-auto pb-[150px]">
      {/* Header Denso */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div>
          <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
            Mi Perfil
          </h1>
          <p className="text-[10px] sm:text-xs text-zinc-400">
            Gestiona tus datos, tu podio oficial y revisa tus estadísticas
          </p>
        </div>
      </div>

      {/* User Information & Nickname Section */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-800/60">
          <UserAvatar src={profile?.photoURL} name={profile?.displayName || 'Usuario'} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white truncate">{profile?.displayName || 'Usuario'}</h2>
              {profile?.isAdmin && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5 truncate">
              <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              {profile?.email}
            </p>
          </div>
        </div>

        {/* Alias / Apodo en el Ranking */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-blue-400" />
            Apodo en el Ranking
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Escribe tu apodo o nombre para el ranking..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleSaveNickname}
              disabled={savingNickname || !nickname.trim() || nickname === (profile?.nickname || profile?.displayName)}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center min-w-[90px] shadow-sm"
            >
              {savingNickname ? '...' : savedMsg ? (
                <span className="flex items-center gap-1 text-emerald-300">
                  <Check className="w-3.5 h-3.5" /> {savedMsg}
                </span>
              ) : 'Guardar'}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">
            Este nombre se mostrará en la tabla de posiciones y en el chat del grupo.
          </p>
        </div>
      </div>

      {/* Podio de la Temporada (Campeón, Subcampeón, Goleador y Asistidor) */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <PodiumDisplay
          podium={podium}
          canEdit={true}
          onSave={handleSavePodium}
          title="Mi Podio de la Temporada"
          isSaving={savingPodium}
        />
      </div>

      {/* Récords Históricos & Rachas */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 pb-1 border-b border-zinc-800/80">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          Récords y Rachas Históricas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-black text-orange-500 font-mono">🔥 {max_normal}</span>
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mt-1">Racha de Aciertos</span>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-black text-amber-500 font-mono">🐐🔥 {max_pleno}</span>
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mt-1">Racha de Plenos</span>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-black text-blue-400 font-mono">🥶 {max_falla}</span>
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mt-1">Racha de Mufa</span>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-black text-zinc-500 font-mono">👻 {max_ausente}</span>
            <span className="text-[9px] uppercase font-bold text-zinc-600 tracking-wider mt-1">Racha de Ausencias</span>
          </div>
        </div>
      </div>

      {/* Medallas Obtenidas */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 pb-1 border-b border-zinc-800/80">
          <Award className="w-3.5 h-3.5 text-amber-400" />
          Medallas Obtenidas
        </h3>
        {medallas.length === 0 ? (
          <div className="bg-zinc-900/40 rounded-xl p-5 text-center border border-zinc-800/40 border-dashed">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Aún no has obtenido medallas</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {medallas.map((medalla, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-700/60 px-3 py-1.5 rounded-xl shadow-sm">
                <span className="text-xs font-bold text-zinc-200">{medalla}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tutorial Interactivo Button */}
      <button 
        onClick={() => {
          if (user) {
            localStorage.removeItem(`hasSeenTutorial_${user.uid}`);
          }
          window.dispatchEvent(new CustomEvent('restart-tutorial'));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('start-lacabragol-tutorial'));
          }, 250);
        }}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-2xl font-black uppercase tracking-widest text-xs transition-colors border border-blue-500/30 shadow-sm"
      >
        <HelpCircle className="w-4 h-4" /> Ver Tutorial de la App
      </button>

      {/* Cerrar Sesión Button */}
      <button 
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl font-black uppercase tracking-widest text-xs transition-colors border border-red-500/30 shadow-sm"
      >
        <LogOut className="w-4 h-4" /> Cerrar Sesión
      </button>

      {/* Watermark version footer */}
      <FooterVersion className="mt-2 pb-6" />
    </div>
  );
}
