import { getDb } from './firebase';
import type { Role } from './types';

export async function setUserRole(uid: string, role: Role): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase not initialized');
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'roles', uid), { role });
}

export async function getAllRoles(): Promise<Map<string, Role>> {
  const db = getDb();
  if (!db) throw new Error('Firebase not initialized');
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, 'roles'));
  const map = new Map<string, Role>();
  snap.forEach((d) => map.set(d.id, d.data().role as Role));
  return map;
}

export async function getAllProfiles(): Promise<Map<string, string>> {
  const db = getDb();
  if (!db) throw new Error('Firebase not initialized');
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, 'profiles'));
  const map = new Map<string, string>(); // uid → email
  snap.forEach((d) => { if (d.data().email) map.set(d.id, d.data().email); });
  return map;
}
