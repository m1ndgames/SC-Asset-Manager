import { assets, trades, migrationPending, migrationBackend } from './stores';
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

// Last known remote state, by id. Used to write only the documents that actually
// changed instead of rewriting the whole collection on every store change, which
// would clobber concurrent writes from another client or an external writer
// (see INTEGRATIONS.md). Refreshed on BOTH paths — after a local change, and on
// the echo-skip path when a remote snapshot arrives — so the delete diff below
// always reflects what the server really holds.
let prevAssets = new Map<string, Asset>();
let prevTrades = new Map<string, Trade>();

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
    migrationBackend.set('firebase');
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
  prevAssets = new Map(get(assets).map((a) => [a.id, a]));
  unsubStoreAssets = assets.subscribe((current) => {
    if (current === fsAssets) {
      // Firestore-originated: no write, but the remote state we diff against
      // has just moved, so adopt it.
      prevAssets = new Map(current.map((a) => [a.id, a]));
      return;
    }
    const db = getDb();
    if (!db) return;

    const currentMap = new Map(current.map((a) => [a.id, a]));

    for (const [id, asset] of currentMap) {
      const prev = prevAssets.get(id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(asset)) {
        setDoc(doc(db, 'assets', id), asset);
      }
    }
    for (const id of prevAssets.keys()) {
      if (!currentMap.has(id)) deleteDoc(doc(db, 'assets', id));
    }
    prevAssets = currentMap;
  });

  prevTrades = new Map(get(trades).map((t) => [t.id, t]));
  unsubStoreTrades = trades.subscribe((current) => {
    if (current === fsTrades) {
      prevTrades = new Map(current.map((t) => [t.id, t]));
      return;
    }
    const db = getDb();
    if (!db) return;

    const currentMap = new Map(current.map((t) => [t.id, t]));

    for (const [id, trade] of currentMap) {
      const prev = prevTrades.get(id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(trade)) {
        setDoc(doc(db, 'trades', id), trade);
      }
    }
    for (const id of prevTrades.keys()) {
      if (!currentMap.has(id)) deleteDoc(doc(db, 'trades', id));
    }
    prevTrades = currentMap;
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
  prevAssets = new Map();
  prevTrades = new Map();
}
