import { writable } from 'svelte/store';
import type { Asset, Trade } from './types';

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

// Item names fetched from /items.json at startup — not persisted to localStorage
export const scItems = writable<string[]>([]);

// Trading location names fetched from /locations.json at startup
export const scLocations = writable<string[]>([]);
