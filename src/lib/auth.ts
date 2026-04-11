import { getFirebaseAuth } from './firebase';
import { firebaseUser, userRole } from './stores';
import type { Role } from './types';

let unsubAuthListener: (() => void) | null = null;

export async function signIn(email: string, password: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not initialized');
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  const { signOut: fbSignOut } = await import('firebase/auth');
  await fbSignOut(auth);
  firebaseUser.set(null);
  userRole.set(null);
}

export async function initAuthListener(
  onSignIn: (uid: string) => void,
  onSignOut: () => void
): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;

  const { onAuthStateChanged } = await import('firebase/auth');
  const { getFirestore, doc, getDoc } = await import('firebase/firestore');
  const { getDb } = await import('./firebase');

  unsubAuthListener?.();

  unsubAuthListener = onAuthStateChanged(auth, async (user) => {
    if (user) {
      firebaseUser.set(user);

      const db = getDb();
      if (db) {
        // Fetch role from /roles/{uid}
        try {
          const roleDoc = await getDoc(doc(db, 'roles', user.uid));
          userRole.set(roleDoc.exists() ? (roleDoc.data().role as Role) : 'user');
        } catch (err) {
          console.error('[SC] Failed to fetch role for', user.uid, err);
          userRole.set('user');
        }

        // Write email to /profiles/{uid} so admins can identify users
        const { setDoc } = await import('firebase/firestore');
        try {
          await setDoc(doc(db, 'profiles', user.uid), { email: user.email }, { merge: true });
        } catch (err) {
          console.warn('[SC] Failed to write profile', err);
        }
      } else {
        console.warn('[SC] getDb() returned null when fetching role');
      }

      onSignIn(user.uid);
    } else {
      firebaseUser.set(null);
      userRole.set(null);
      onSignOut();
    }
  });
}

export function destroyAuthListener(): void {
  unsubAuthListener?.();
  unsubAuthListener = null;
}
