import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { User as UserIcon, LogOut, Award } from 'lucide-react';
import { BaseBottomSheet } from './BaseBottomSheet';
import { PodiumSection } from '../pages/PodiumTab';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export function ProfileModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { user, profile, logout } = useAuth();
  const [nickname, setNickname] = useState(profile?.nickname || profile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

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

  if (!user) return null;

  return (
    <BaseBottomSheet isOpen={isOpen} onClose={onClose} title="Mi Perfil">
      <div className="p-4 space-y-4 pb-8 overflow-y-auto max-h-[85vh]">
        
        <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-800/50 pb-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <UserIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-white uppercase tracking-widest truncate">{profile?.displayName || 'Usuario'}</h2>
              <p className="text-xs text-zinc-400 truncate">{profile?.email}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Apodo en el Ranking</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-bold outline-none focus:border-blue-500 transition-colors"
                placeholder="Tu alias..."
              />
              <button
                onClick={handleSaveNickname}
                disabled={saving || nickname === (profile?.nickname || profile?.displayName)}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black px-4 rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center min-w-[80px]"
              >
                {saving ? '...' : (savedMsg || 'Guardar')}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-3">
            <Award className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Mi Podio</h2>
          </div>
          <div className="-mx-2">
             <PodiumSection />
          </div>
        </div>
        
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors border border-red-500/20 mt-4"
        >
          <LogOut className="w-4 h-4" /> Cerrar Sesión
        </button>
      </div>
    </BaseBottomSheet>
  );
}
