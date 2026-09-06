import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Trophy, ArrowRight, Save, LogOut } from 'lucide-react';

export function NicknameOnboarding() {
  const { user, profile, logout } = useAuth();
  const [nickname, setNickname] = useState(profile?.nickname || profile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nickname.trim()) return;
    
    // Validations
    if (nickname.trim().length < 3) {
      setError('El apodo debe tener al menos 3 caracteres');
      return;
    }
    
    // Check if nickname is already taken? (Let's skip global uniqueness for now, or assume it's fine)
    
    try {
      setSaving(true);
      setError('');
      await updateDoc(doc(db, 'users', user.uid), {
        nickname: nickname.trim(),
        updatedAt: Date.now()
      });
      // Need to reload page or profile object will be updated by AuthProvider listener?
      // Wait, AuthProvider uses onAuthStateChanged, which doesn't trigger on firestore updates.
      // So we force a reload or manually update the profile context.
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError('Error al guardar el apodo. Intenta de nuevo.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0a0a0b] font-sans text-zinc-200">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          
          <button onClick={logout} className="absolute top-4 right-4 text-zinc-500 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
          
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <img src="/logo.png" alt="La Cabra Gol Logo" className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
              <h1 className="text-2xl font-black text-white tracking-tight">Elige tu Apodo</h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Este nombre será visible para todos en los grupos y tablas de posiciones.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Tu Apodo (Ej. El Mago)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-4 text-center text-lg font-bold text-white placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              {error && <p className="text-xs font-bold text-red-400 text-center">{error}</p>}
              
              <button
                type="submit"
                disabled={saving || nickname.trim().length < 3}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2"
              >
                {saving ? 'Guardando...' : 'Continuar'}
                {!saving && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
