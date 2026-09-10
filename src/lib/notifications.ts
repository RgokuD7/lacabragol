import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { app, db } from './firebase';

export const VAPID_KEY = 'BFr5nC2ag_S6CW3ZjMD73n3yPuReepLnwn0-RJnpTNWwFjsxcqt-rz51mWCArZatISAnotzmNq81L6p8lObwIb8';

let messagingInstance: Messaging | null = null;

/**
 * Checks if Firebase Cloud Messaging is supported in the current environment.
 */
export async function isPushNotificationSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    return await isSupported();
  } catch (err) {
    console.warn('[Notifications] Error comprobando soporte de FCM:', err);
    return false;
  }
}

/**
 * Returns current browser notification permission state.
 */
export function getNotificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Gets or initializes the Firebase Messaging instance safely.
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  const supported = await isPushNotificationSupported();
  if (!supported) return null;

  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (error) {
    console.warn('[Notifications] No se pudo inicializar Firebase Messaging:', error);
    return null;
  }
}

/**
 * Requests notification permission, retrieves the FCM token, and saves it in the user's Firestore document.
 */
export async function requestNotificationPermission(userId?: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { success: false, error: 'Este navegador o dispositivo no soporta notificaciones push.' };
    }

    // 1. Request native browser permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { 
        success: false, 
        error: permission === 'denied' 
          ? 'Permiso denegado. Habilita las notificaciones en los ajustes de tu navegador.' 
          : 'Permiso de notificaciones no otorgado.' 
      };
    }

    // 2. Register Firebase Messaging Service Worker
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      await navigator.serviceWorker.ready;
    } catch (swError) {
      console.error('[Notifications] Error registrando service worker:', swError);
      return { success: false, error: 'Error registrando el service worker de notificaciones.' };
    }

    // 3. Initialize FCM and obtain token
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { success: false, error: 'Firebase Messaging no está disponible en este entorno.' };
    }

    // Read VAPID Public Key from environment with official generated fallback
    const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || VAPID_KEY;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      return { success: false, error: 'No se pudo generar el token de notificación de FCM.' };
    }

    // 4. Save token to Firestore user document (fcmTokens array)
    if (userId) {
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token),
          updatedAt: Date.now()
        });
        localStorage.setItem(`fcm_token_${userId}`, token);
        console.log('[Notifications] Token FCM guardado con éxito en Firestore');
      } catch (dbError) {
        console.error('[Notifications] Error guardando token en Firestore:', dbError);
        // We still return success with token even if DB write had an issue, but log it
      }
    }

    return { success: true, token };
  } catch (error: any) {
    console.error('[Notifications] Error al solicitar permisos de notificación:', error);
    return { success: false, error: error?.message || 'Error desconocido al solicitar notificaciones.' };
  }
}

/**
 * Removes the FCM token from the user's Firestore document.
 */
export async function unregisterNotificationToken(userId: string): Promise<boolean> {
  try {
    const token = localStorage.getItem(`fcm_token_${userId}`);
    if (!token) return true;

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      fcmTokens: arrayRemove(token),
      updatedAt: Date.now()
    });
    localStorage.removeItem(`fcm_token_${userId}`);
    return true;
  } catch (e) {
    console.error('[Notifications] Error desregistrando token FCM:', e);
    return false;
  }
}

/**
 * Listens for incoming messages when the app is active in the foreground.
 */
export function setupForegroundNotificationListener(
  onNotification?: (payload: any) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  getMessagingInstance().then((messaging) => {
    if (!messaging) return;

    try {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[Notifications] Notificación recibida en primer plano:', payload);

        if (onNotification) {
          onNotification(payload);
        } else {
          // Default fallback: show native Notification if permitted
          if (Notification.permission === 'granted') {
            const title = payload.notification?.title || payload.data?.title || 'La Cabra Gol';
            const body = payload.notification?.body || payload.data?.body || '';
            const icon = payload.notification?.icon || '/pwa-192x192.png';
            new Notification(title, { body, icon });
          }
        }
      });
    } catch (err) {
      console.warn('[Notifications] Error configurando onMessage:', err);
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

/**
 * Tests showing a local notification to verify browser permissions and styling.
 */
export async function testLocalNotification(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  if (Notification.permission !== 'granted') {
    const res = await requestNotificationPermission();
    if (!res.success) return false;
  }

  try {
    new Notification('¡Notificación de Prueba! 🐐⚽', {
      body: 'Las notificaciones push de La Cabra Gol están configuradas correctamente.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png'
    });
    return true;
  } catch (err) {
    console.error('[Notifications] Error mostrando notificación de prueba:', err);
    return false;
  }
}
