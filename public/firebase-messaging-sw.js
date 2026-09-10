// Firebase Cloud Messaging Service Worker for Background Push Notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDDO9xR7qJlKETag8kpXUHwdYMArEIsAhY",
  authDomain: "lacabragol.firebaseapp.com",
  projectId: "lacabragol",
  storageBucket: "lacabragol.firebasestorage.app",
  messagingSenderId: "908751231296",
  appId: "1:908751231296:web:f8675b529f084292ce82a5"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handler for background push notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano:', payload);

  const title = payload.notification?.title || payload.data?.title || 'La Cabra Gol ⚽';
  const body = payload.notification?.body || payload.data?.body || 'Nueva actualización en La Cabra Gol';
  const icon = payload.notification?.icon || payload.data?.icon || '/pwa-192x192.png';
  const tag = payload.data?.tag || payload.data?.type || 'lacabragol-notification';
  const url = payload.data?.url || payload.fcmOptions?.link || '/';

  const notificationOptions = {
    body,
    icon,
    badge: '/pwa-192x192.png',
    tag,
    data: {
      url,
      ...payload.data
    },
    vibrate: [200, 100, 200],
    renotify: true
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Focus or open application on notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with this app
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
