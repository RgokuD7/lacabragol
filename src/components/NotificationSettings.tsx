import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, CheckCircle2, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  testLocalNotification,
  isPushNotificationSupported 
} from '../lib/notifications';
import { vibrateSuccess, vibrateError, vibrateTap } from '../lib/haptics';
import { isCabraSuprema } from '../lib/utils';

// UID de administrador personalizable (reemplazar por tu UID de Firebase si se desea)
const ADMIN_UID = 'YOUR_FIREBASE_UID';

export function NotificationSettings() {
  const { user, profile } = useAuth();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Verificación de rol de administrador (isAdmin en Firestore, rol o UID específico)
  const isAdmin = Boolean(
    profile?.isAdmin ||
    profile?.role === 'admin' ||
    isCabraSuprema(profile, user?.email) ||
    (user?.uid && user.uid === ADMIN_UID)
  );

  useEffect(() => {
    isPushNotificationSupported().then((supported) => {
      if (!supported) {
        setPermission('unsupported');
      } else {
        setPermission(getNotificationPermission());
      }
    });
  }, []);

  const handleEnableNotifications = async () => {
    if (!user) return;
    vibrateTap();
    setLoading(true);
    setStatusMessage(null);

    const result = await requestNotificationPermission(user.uid);
    setLoading(false);

    if (result.success) {
      vibrateSuccess();
      setPermission('granted');
      setStatusMessage({
        type: 'success',
        text: '¡Notificaciones activadas con éxito! Tu dispositivo está registrado.'
      });
    } else {
      vibrateError();
      setPermission(getNotificationPermission());
      setStatusMessage({
        type: 'error',
        text: result.error || 'No se pudieron activar las notificaciones.'
      });
    }
  };

  const handleTestNotification = async () => {
    vibrateTap();
    setTesting(true);
    const ok = await testLocalNotification();
    setTesting(false);

    if (ok) {
      vibrateSuccess();
      setStatusMessage({
        type: 'success',
        text: '¡Notificación de prueba enviada a tu pantalla!'
      });
    } else {
      vibrateError();
      setStatusMessage({
        type: 'error',
        text: 'No se pudo mostrar la notificación. Verifica los permisos de tu sistema operativo.'
      });
    }
  };

  if (permission === 'unsupported') {
    return (
      <div className="bg-[#121215] border border-zinc-800/50 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-zinc-400">
          <BellOff className="w-5 h-5 text-zinc-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Notificaciones Push</h3>
        </div>
        <p className="text-xs text-zinc-500">
          Este navegador o dispositivo no soporta notificaciones push en segundo plano. Si estás en iOS, instala la app en tu pantalla de inicio (PWA).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#121215] border border-zinc-800/50 rounded-xl p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            permission === 'granted' 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : permission === 'denied'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>
            {permission === 'granted' ? <Bell className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Notificaciones Push Web</h3>
            <span className="text-[10px] text-zinc-400">Alertas de chat y cambios en el ranking en vivo</span>
          </div>
        </div>

        {/* Status Badge */}
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
          permission === 'granted'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : permission === 'denied'
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
        }`}>
          {permission === 'granted' ? 'Activas' : permission === 'denied' ? 'Bloqueadas' : 'Inactivas'}
        </span>
      </div>

      {/* Description & Status */}
      <div className="text-xs text-zinc-400 leading-relaxed">
        {permission === 'granted' ? (
          <p className="text-emerald-400/90 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Recibirás alertas instantáneas cuando envíen mensajes al chat o se actualice el ranking tras un partido.</span>
          </p>
        ) : permission === 'denied' ? (
          <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg text-rose-300 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Notificaciones bloqueadas en el navegador</span>
            </p>
            <p className="text-[11px] text-zinc-400">
              Para habilitarlas, haz clic en el icono del candado en la barra de direcciones de tu navegador, selecciona "Permitir" en Notificaciones y recarga la página.
            </p>
          </div>
        ) : (
          <p className="text-zinc-400">
            Mantente al tanto de la competencia activando las notificaciones en tu celular o computadora.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {permission !== 'granted' && permission !== 'denied' && (
          <button
            type="button"
            disabled={loading}
            onClick={handleEnableNotifications}
            className="flex-1 min-w-[200px] py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
            <span>{loading ? 'Activando...' : 'Activar Notificaciones'}</span>
          </button>
        )}

        {/* Diagnostic controls exclusively for admins */}
        {isAdmin && permission === 'granted' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 mt-1 border-t border-zinc-800/60 w-full">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider w-full">
              Herramientas de Diagnóstico (Solo Admin):
            </span>
            <button
              type="button"
              disabled={testing}
              onClick={handleTestNotification}
              className="py-2 px-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Probar notificación local"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Probar Notificación</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleEnableNotifications}
              className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs rounded-xl border border-zinc-800 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Volver a sincronizar el token FCM de este dispositivo"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Re-sincronizar Token</span>}
            </button>
          </div>
        )}
      </div>

      {/* Status feedback message */}
      {statusMessage && (
        <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
          statusMessage.type === 'success'
            ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-400'
            : 'bg-rose-950/40 border border-rose-500/40 text-rose-400'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
