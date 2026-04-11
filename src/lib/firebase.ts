import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { FirebaseConfig } from './types';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let authInstance: Auth | null = null;

export function readStoredConfig(): FirebaseConfig | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('sc_firebase_config');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function validateConfig(config: unknown): config is FirebaseConfig {
  if (!config || typeof config !== 'object') return false;
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  return required.every((k) => k in (config as Record<string, unknown>));
}

export async function initFirebase(config: FirebaseConfig): Promise<void> {
  const { initializeApp, getApps, getApp } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  const { getAuth } = await import('firebase/auth');

  if (getApps().length === 0) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }

  db = getFirestore(app);
  authInstance = getAuth(app);
}

export function getDb(): Firestore | null {
  return db;
}

export function getFirebaseAuth(): Auth | null {
  return authInstance;
}

export function isFirebaseReady(): boolean {
  return db !== null && authInstance !== null;
}
