import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initViewportFixes } from './lib/viewport';

// Auto-reload active client tab as soon as a new service worker takes control
let refreshing = false;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Auto-register service worker and automatically reload on update
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swUrl, r) {
    if (r) {
      // Periodically check for new releases every 30 seconds
      setInterval(() => {
        r.update();
      }, 30 * 1000);
    }
  },
});

// Prevent mobile virtual keyboard from displacing window and leaving black space
initViewportFixes();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
