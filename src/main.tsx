import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initViewportFixes } from './lib/viewport';

// Auto-register service worker for offline support and PWA caching
registerSW({ immediate: true });

// Prevent mobile virtual keyboard from displacing window and leaving black space
initViewportFixes();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
