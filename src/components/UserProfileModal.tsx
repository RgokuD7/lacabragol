import React, { useState, useEffect } from 'react';
import { BaseBottomSheet } from './BaseBottomSheet';
import { UserAvatar } from './UserAvatar';
import { PodiumDisplay } from './PodiumDisplay';
import { Hash, Mail } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Podium } from '../types';
import { getGroupPodium } from '../lib/podium';

interface UserProfileModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  groupId?: string | null;
}

export function UserProfileModal({ user, isOpen, onClose, groupId }: UserProfileModalProps) {
  const [podium, setPodium] = useState<Podium | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchPodium = async () => {
      setLoading(true);
      try {
        const p = await getGroupPodium(groupId, user.uid);
        setPodium(p);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchPodium();
  }, [user, groupId]);

  if (!user) return null;

  const max_normal = user.max_streak_normal || 0;
  const max_pleno = user.max_streak_pleno || 0;
  const max_falla = user.max_streak_falla || 0;
  const max_ausente = user.max_streak_ausente || 0;
  const medallas = user.medallas || [];

  return (
    <BaseBottomSheet isOpen={isOpen} onClose={onClose} title="Salón de la Fama">
      <div className="space-y-6 pb-6">
        {/* Header Profiling */}
        <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 shadow-sm">
          <UserAvatar src={user.photoURL} name={user.nickname || user.displayName || ''} size="xl" />
          <div className="flex flex-col min-w-0">
            <h3 className="text-lg font-black text-white truncate">{user.nickname || user.displayName}</h3>
            <div className="flex flex-col gap-1 mt-1">
              {user.displayName && user.nickname && user.nickname !== user.displayName && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="truncate">Google: {user.displayName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-full">{user.email || 'Oculto'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Podium */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-xs text-zinc-500 text-center py-4">Cargando podio...</p>
          ) : (
            <PodiumDisplay
              podium={podium}
              canEdit={false}
              title={`Podio de ${user.nickname || user.displayName || 'este jugador'}`}
            />
          )}
        </div>

        {/* Récords Históricos */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-black uppercase text-zinc-400 tracking-widest px-1 border-b border-zinc-800 pb-2">Récords Históricos</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-orange-500 font-mono">🔥 {max_normal}</span>
              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mt-1">Racha de Aciertos</span>
            </div>
            <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-amber-500 font-mono">🐐🔥 {max_pleno}</span>
              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mt-1">Racha de Plenos</span>
            </div>
            <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-blue-400 font-mono">🥶 {max_falla}</span>
              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mt-1">Racha de Mufa</span>
            </div>
            <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-zinc-500 font-mono">👻 {max_ausente}</span>
              <span className="text-[9px] uppercase font-bold text-zinc-600 tracking-wider mt-1">Racha de Ausencias</span>
            </div>
          </div>
        </div>

        {/* Medallas Obtenidas */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-black uppercase text-zinc-400 tracking-widest px-1 border-b border-zinc-800 pb-2">Medallas Obtenidas</h4>
          {medallas.length === 0 ? (
            <div className="bg-zinc-900/30 rounded-xl p-6 text-center border border-zinc-800/30 border-dashed">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Aún no tiene medallas</p>
            </div>
          ) : (
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 shadow-inner flex flex-wrap gap-2 justify-center">
              {medallas.map((medalla, i) => (
                <div key={i} className="bg-[#111114] border border-zinc-700/50 px-2.5 py-1.5 rounded-lg shadow-sm">
                  <span className="text-xs font-bold text-zinc-300">{medalla}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseBottomSheet>
  );
}
