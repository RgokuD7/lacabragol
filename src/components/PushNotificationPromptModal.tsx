import React, { useState, useEffect } from 'react';
import { BellRing, CheckCircle2, MessageSquare, Trophy, X, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  isPushNotificationSupported 
} from '../lib/notifications';
import { vibrateSuccess, vibrateTap } from '../lib/haptics';

interface PushNotificationPromptModalProps {
  isTutorialActive?: boolean;
}

export function PushNotificationPromptModal({ isTutorialActive = false }: PushNotificationPromptModalProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Do not show during tutorials or if user is not logged in
    if (!user || isTutorialActive) return;

    // Check if dismissed previously in localStorage (3 days window or boolean true)
    const dismissedValue = localStorage.getItem('hasDismissedPushPrompt');
    if (dismissedValue) {
      const until = Number(dismissedValue);
      if (!isNaN(until) && Date.now() < until) return;
      if (dismissedValue === 'true') return;
    }

    // Check if notifications are supported and permission is 'default'
    isPushNotificationSupported().then((supported) => {
      if (!supported) return;
      const perm = getNotificationPermission();
      // ONLY show if browser hasn't been asked yet ('default')
      if (perm === 'default') {
        // Delay slightly for smooth page entrance
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    });
  }, [user, isTutorialActive]);

  const handleAccept = async () => {
    if (!user) return;
    vibrateTap();
    setLoading(true);

    const result = await requestNotificationPermission(user.uid);
    setLoading(false);

    if (result.success) {
      vibrateSuccess();
      setSuccess(true);
      // Clean dismiss flag
      localStorage.removeItem('hasDismissedPushPrompt');
      setTimeout(() => {
        setIsOpen(false);
      }, 1200);
    } else {
      // If user denied or closed browser dialog, close modal
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    vibrateTap();
    // Dismiss for 3 days to avoid nagging the user
    const expireAt = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem('hasDismissedPushPrompt', expireAt.toString());
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-[#121215] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative animate-in slide-in-from-bottom-4 duration-300 flex flex-col items-center text-center space-y-4"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Icon Header */}
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600/30 to-emerald-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-[0_0_24px_rgba(37,99,235,0.25)]">
            <BellRing className="w-8 h-8 animate-bounce text-blue-400" />
          </div>
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[9px] font-black uppercase text-black tracking-widest shadow-md">
            Nuevo
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5 px-2">
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
            ¡No te pierdas de nada! ⚽🔔
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Activa las notificaciones para saber de inmediato cuando alguien escriba en el chat o el ranking se actualice.
          </p>
        </div>

        {/* Value Highlights */}
        <div className="w-full bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3 space-y-2 text-left text-xs">
          <div className="flex items-center gap-2.5 text-zinc-300">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span>Mensajes nuevos de tu grupo en tiempo real</span>
          </div>
          <div className="flex items-center gap-2.5 text-zinc-300">
            <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span>Cambios en el ranking tras finalizar cada partido</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2 pt-1">
          {success ? (
            <div className="w-full py-3.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 animate-in zoom-in-95 duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>¡Notificaciones activadas!</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleAccept}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                <span>{loading ? 'Activando...' : 'Activar Notificaciones'}</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleDismiss}
                className="w-full py-2.5 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Quizás más tarde
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
