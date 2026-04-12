import { writable } from 'svelte/store';
import type { Asset, Trade, Role, ScItem } from './types';
import type { User } from 'firebase/auth';

function localStore<T>(key: string, initial: T) {
  let initial_value = initial;
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        initial_value = JSON.parse(raw);
      } catch {
        // corrupted — fall back to initial
      }
    }
  }
  const store = writable<T>(initial_value);
  store.subscribe((value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });
  return store;
}

export const assets = localStore<Asset[]>('sc_assets', []);
export const trades = localStore<Trade[]>('sc_trades', []);
export const nickname = localStore<string>('sc_nickname', '');
export const uexApiKey = localStore<string>('sc_uex_api_key', '');
export const uexSecretKey = localStore<string>('sc_uex_secret_key', '');
// IDs (asset or trade) that have been successfully pushed to UEX trade log
export const uexLoggedIds = localStore<string[]>('sc_uex_logged_ids', []);

// Items fetched from /items.json at startup — not persisted to localStorage
export const scItems = writable<ScItem[]>([]);

// Trading location names fetched from /locations.json at startup
export const scLocations = writable<string[]>([]);

// Firebase — not persisted, set at runtime
export const firebaseUser = writable<User | null>(null);
export const userRole = writable<Role | null>(null);

// Set to true when user first signs in with local data but empty Firestore
export const migrationPending = writable<boolean>(false);
