import { assets, trades, migrationPending } from './stores';
import { getDb } from './firebase';
import type { Asset, Trade } from './types';
import { get } from 'svelte/store';

let unsubFsAssets: (() => void) | null = null;
let unsubFsTrades: (() => void) | null = null;
let unsubStoreAssets: (() => void) | null = null;
let unsubStoreTrades: (() => void) | null = null;

// Reference arrays to detect Firestore-originated updates and avoid echo writes
let fsAssets: Asset[] = [];
let fsTrades: Trade[] = [];

export async function startSync(uid: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const { collection, doc, onSnapshot, setDoc, deleteDoc, getDocs } = await import('firebase/firestore');

  // Check if migration is needed: local data exists but Firestore is empty
  const [fsAssetsSnap, fsTradesSnap] = await Promise.all([
    getDocs(collection(db, 'assets')),
    getDocs(collection(db, 'trades'))
  ]);

  const hasFirestoreData = !fsAssetsSnap.empty || !fsTradesSnap.empty;
  const localAssets = get(assets);
  const localTrades = get(trades);
  const hasLocalData = localAssets.length > 0 || localTrades.length > 0;

  if (!hasFirestoreData && hasLocalData) {
    migrationPending.set(true);
    // Don't start real-time sync yet — wait for user to decide
    return;
  }

  _attachListeners(uid);
}

export async function migrateLocalToFirestore(uid: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const { collection, doc, setDoc } = await import('firebase/firestore');

  const localAssets = get(assets);
  const localTrades = get(trades);

  await Promise.all([
    ...localAssets.map((a) => setDoc(doc(db, 'assets', a.id), a)),
    ...localTrades.map((t) => setDoc(doc(db, 'trades', t.id), t))
  ]);

  migrationPending.set(false);
  _attachListeners(uid);
}

export function skipMigration(uid: string): void {
  migrationPending.set(false);
  _attachListeners(uid);
}

async function _attachListeners(uid: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const { collection, doc, onSnapshot, setDoc, deleteDoc } = await import('firebase/firestore');

  // Firestore → Store
  unsubFsAssets = onSnapshot(collection(db, 'assets'), (snap) => {
    fsAssets = snap.docs.map((d) => d.data() as Asset);
    assets.set(fsAssets);
  });

  unsubFsTrades = onSnapshot(collection(db, 'trades'), (snap) => {
    fsTrades = snap.docs.map((d) => d.data() as Trade);
    trades.set(fsTrades);
  });

  // Store → Firestore
  let prevAssetIds = new Set(get(assets).map((a) => a.id));
  unsubStoreAssets = assets.subscribe((current) => {
    if (current === fsAssets) return; // Firestore-originated, skip
    const db = getDb();
    if (!db) return;

    const currentIds = new Set(current.map((a) => a.id));

    for (const asset of current) {
      setDoc(doc(db, 'assets', asset.id), asset);
    }
    for (const id of prevAssetIds) {
      if (!currentIds.has(id)) deleteDoc(doc(db, 'assets', id));
    }
    prevAssetIds = currentIds;
  });

  let prevTradeIds = new Set(get(trades).map((t) => t.id));
  unsubStoreTrades = trades.subscribe((current) => {
    if (current === fsTrades) return; // Firestore-originated, skip
    const db = getDb();
    if (!db) return;

    const currentIds = new Set(current.map((t) => t.id));

    for (const trade of current) {
      setDoc(doc(db, 'trades', trade.id), trade);
    }
    for (const id of prevTradeIds) {
      if (!currentIds.has(id)) deleteDoc(doc(db, 'trades', id));
    }
    prevTradeIds = currentIds;
  });
}

export function stopSync(): void {
  unsubFsAssets?.();
  unsubFsTrades?.();
  unsubStoreAssets?.();
  unsubStoreTrades?.();
  unsubFsAssets = null;
  unsubFsTrades = null;
  unsubStoreAssets = null;
  unsubStoreTrades = null;
  fsAssets = [];
  fsTrades = [];
}
