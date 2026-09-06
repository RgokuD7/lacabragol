import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Trophy, Sparkles, ShieldCheck } from 'lucide-react';
import { FooterVersion } from '../components/FooterVersion';

export function Login() {
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  
  const handleGoogle = async () => {
    try {
      setSigningIn(true);
      setError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      setError(e.message || 'Error con Google Auth');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] p-4 text-[#e4e4e7] font-sans relative overflow-hidden">
      {/* Subtle background ambient glow */}
      <div className="absolute w-[350px] h-[350px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none top-1/4 left-1/2 -translate-x-1/2" />

      <div className="w-full max-w-sm bg-[#121215]/90 backdrop-blur-xl rounded-3xl shadow-2xl p-7 sm:p-8 border border-zinc-800/80 relative z-10 space-y-6">
        {/* Brand Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img src="/logo.png" alt="La Cabra Gol Logo" className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          
          <div>
            <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-blue-400 mb-2">
              <Sparkles className="w-3 h-3" />
              <span>Champions League 2026/27</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              LaCabraGol
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Pronostica resultados, compite con amigos y sube a la cima del ranking.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-400 text-xs rounded-xl font-medium leading-relaxed">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            disabled={signingIn}
            onClick={handleGoogle}
            className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-black rounded-2xl px-4 py-3.5 transition-all flex items-center justify-center gap-3 text-xs tracking-wider uppercase shadow-md shadow-white/10 active:scale-98 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>{signingIn ? 'Iniciando sesión...' : 'Ingresar con Google'}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Autenticación segura con Google Firebase</span>
        </div>
      </div>

      <FooterVersion className="absolute bottom-3 left-0 right-0 pointer-events-none" />
    </div>
  );
}
