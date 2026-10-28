import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseDatabaseUrl =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  'https://ashok-leyland-telemetry-default-rtdb.firebaseio.com';

export const FIREBASE_CONFIG = {
  databaseURL: firebaseDatabaseUrl,
};

// Initialize Firebase safely
export const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();
export const db = getDatabase(app);

export const TECH_PASSWORD = import.meta.env.VITE_TECH_PASSWORD || 'ashok123';
