
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from './Firebase/config';
import { startAutomaticUpdates } from './services/automaticUpdateService';

if (import.meta.env.DEV) {
  // Recover open Ionic pages even if their Vite WebSocket was disconnected.
  void fetch('/__grantaccess_dev_version', { cache: 'no-store' }).then(response => response.json()).then((data: { version: string }) => {
    startAutomaticUpdates({
      currentVersion: data.version,
      versionUrl: '/__grantaccess_dev_version',
      intervalMs: 2000,
      beforeReload: () => waitForPendingWrites(db),
    });
  }).catch(() => { /* Native Vite HMR remains available if the fallback is unavailable. */ });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(error => console.warn('App installation support unavailable:', error));
  });
}

if (import.meta.env.PROD) {
  startAutomaticUpdates({
    currentVersion: __APP_BUILD_ID__,
    versionUrl: `${import.meta.env.BASE_URL}version.json`,
    beforeReload: () => waitForPendingWrites(db),
  });
}

const container = document.getElementById('root')!;

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
