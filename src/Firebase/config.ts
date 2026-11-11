
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
} from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDncWTa7mSAofRVbeMdgg6gZy2bsQv--qo',
  authDomain: 'grand-access.firebaseapp.com',
  projectId: 'grand-access',
  storageBucket: 'grand-access.firebasestorage.app',
  messagingSenderId: '613178175417',
  appId: '1:613178175417:web:6ed6c83c8f9f3be538d068',
  measurementId: 'G-YRX60CDM6S',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
export const auth = getAuth(app);

// Cloud Firestore
// Long polling workaround for unstable WebChannel / QUIC connections.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Firebase Analytics (optional)
export const analyticsReady = isSupported().then((supported) => {
  return supported ? getAnalytics(app) : null;
}).catch(() => null);

export default app;
