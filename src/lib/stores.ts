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

// PocketBase — URL persisted; user model not persisted
export const pbUrl = localStore<string>('sc_pb_url', '');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pbUser = writable<Record<string, any> | null>(null);

// Pulsed to true by the nav bar "Add Asset" button; assets page listens and opens the modal
export const triggerAddAsset = writable<boolean>(false);

// Set to true when user first signs in with local data but the remote backend is empty
export const migrationPending = writable<boolean>(false);
// Which backend triggered the migration prompt
export const migrationBackend = writable<'firebase' | 'pocketbase' | null>(null);
