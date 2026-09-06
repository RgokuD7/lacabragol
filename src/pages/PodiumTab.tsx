import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Podium } from '../types';
import { useAuth } from '../components/AuthProvider';
import { vibrateSuccess, vibrateError, vibratePop } from '../lib/haptics';
import { Trophy, Save, Crown, AlertTriangle } from 'lucide-react';
import { BaseBottomSheet } from '../components/BaseBottomSheet';

const CLUBS = [
  "Real Madrid", "Manchester City", "Bayern Munich", "PSG", "Barcelona", 
  "Arsenal", "Liverpool", "Juventus", "Inter Milan", "Atletico Madrid", 
  "AC Milan", "Bayer Leverkusen", "Dortmund", "Aston Villa", "RB Leipzig"
].sort();

export function PodiumSection() {
  const { user } = useAuth();
  const [podium, setPodium] = useState<Podium>({ userId: '', updatedAt: 0 });
  const [saving, setSaving] = useState(false);
  const [localData, setLocalData] = useState<Partial<Podium>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Sep 7, 2026, 23:59:59 UTC
  const DEADLINE_TIMESTAMP = new Date('2026-09-07T23:59:59Z').getTime();
  const isLocked = Date.now() > DEADLINE_TIMESTAMP;

  useEffect(() => {
    if(!user) return;
    const unsub = onSnapshot(doc(db, 'podiums', user.uid), (snap) => {
      if(snap.exists()) {
        const data = snap.data() as Podium;
        setPodium(data);
        setLocalData({ champion: data.champion, runnerUp: data.runnerUp });
      } else {
        setLocalData({});
      }
    });
    return () => unsub();
  }, [user]);

  const handleSave = async () => {
    if(!user || isLocked) return;
    setSaving(true);
    
    try {
      const batch = writeBatch(db);
      const data: Podium = {
        userId: user.uid,
        champion: localData.champion,
        runnerUp: localData.runnerUp,
        updatedAt: Date.now()
      };
      
      batch.set(doc(db, 'podiums', user.uid), data);
      await batch.commit();
      vibrateSuccess();
      setIsModalOpen(false);
    } catch(e) {
      console.error(e);
      vibrateError();
      alert('Error al guardar podio');
    }
    setSaving(false);
  };

  const hasSelections = podium.champion || podium.runnerUp;

  return (
    <div className="w-full px-4 pt-4 pb-2 mb-2 border-b border-zinc-800/80">
      
      {!hasSelections ? (
        <div 
          onClick={() => {
            if (!isLocked) {
              vibratePop();
              setIsModalOpen(true);
            }
          }}
          className={`w-full bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(245,158,11,0.15)] ${!isLocked ? 'cursor-pointer hover:bg-amber-500/30 transition-colors' : 'opacity-75'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-amber-400 uppercase tracking-widest">¡Elige tu Podio!</span>
              <span className="text-[10px] text-zinc-400 font-bold">Para la temporada</span>
            </div>
          </div>
          {!isLocked && <span className="text-xs font-black text-white bg-black/50 px-3 py-1.5 rounded-lg">ABRIR</span>}
        </div>
      ) : (
        <div 
          className={`w-full flex flex-col items-center gap-3 relative ${!isLocked ? 'cursor-pointer group' : ''}`}
          onClick={() => {
            if (!isLocked) {
              vibratePop();
              setIsModalOpen(true);
            }
          }}
        >
          <div className="absolute top-0 right-0">
            {isLocked ? (
              <span className="text-[9px] font-black text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded uppercase tracking-widest border border-zinc-800">Bloqueado</span>
            ) : (
              <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-widest border border-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity">Editar</span>
            )}
          </div>
          
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Trophy className="w-3.5 h-3.5" />
            Tu Podio
          </h2>
          
          <div className="flex items-end justify-center h-32 gap-3 w-full max-w-sm mx-auto">
            {/* Runner Up */}
            <div className="w-24 bg-gradient-to-t from-zinc-800 to-zinc-700/50 rounded-t-xl h-[70%] flex flex-col items-center justify-start p-2 border-t-2 border-l-2 border-r-2 border-zinc-600/50 shadow-lg relative">
              <div className="w-6 h-6 rounded-full bg-zinc-400/20 flex items-center justify-center mb-1 border border-zinc-400/30">
                <span className="text-xs font-black text-zinc-300">2</span>
              </div>
              <span className="text-[10px] font-bold text-white text-center leading-tight">
                {podium.runnerUp || '-'}
              </span>
            </div>
            
            {/* Champion */}
            <div className="w-28 bg-gradient-to-t from-amber-600/80 to-yellow-500/50 rounded-t-xl h-full flex flex-col items-center justify-start p-2 border-t-2 border-l-2 border-r-2 border-yellow-400/50 shadow-[0_-5px_20px_rgba(245,158,11,0.2)] relative z-10">
              <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center mb-1 border border-yellow-400/50">
                <Crown className="w-4 h-4 text-yellow-300 drop-shadow-md" />
              </div>
              <span className="text-[11px] font-black text-white text-center leading-tight drop-shadow-md uppercase">
                {podium.champion || '-'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <BaseBottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Editar Podio"
      >
        <div className="space-y-4 pb-8 px-2">
          {isLocked ? (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-200">El tiempo límite para editar el podio ha finalizado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  Campeón
                </label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-yellow-500 transition-colors"
                  value={localData.champion || ''}
                  onChange={(e) => setLocalData({ ...localData, champion: e.target.value })}
                >
                  <option value="">Selecciona un equipo...</option>
                  {CLUBS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-zinc-400 flex items-center justify-center text-[#111] text-[8px]">2</span>
                  Subcampeón
                </label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-zinc-500 transition-colors"
                  value={localData.runnerUp || ''}
                  onChange={(e) => setLocalData({ ...localData, runnerUp: e.target.value })}
                >
                  <option value="">Selecciona un equipo...</option>
                  {CLUBS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <button
                disabled={saving || !localData.champion || !localData.runnerUp}
                onClick={handleSave}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2"
              >
                {saving ? 'Guardando...' : 'Guardar Podio'}
                {!saving && <Save className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </BaseBottomSheet>
    </div>
  );
}