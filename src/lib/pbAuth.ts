import { getPb } from './pocketbase';
import { pbUser, userRole } from './stores';
import type { Role } from './types';

let authUnsubscribe: (() => void) | null = null;

export async function pbSignIn(email: string, password: string): Promise<void> {
  const pb = getPb();
  if (!pb) throw new Error('PocketBase not initialized');
  await pb.collection('users').authWithPassword(email, password);
}

export function pbSignOut(): void {
  const pb = getPb();
  if (!pb) return;
  pb.authStore.clear();
  pbUser.set(null);
  userRole.set(null);
}

export async function initPbAuthListener(
  onSignIn: (userId: string) => Promise<void>,
  onSignOut: () => void
): Promise<void> {
  const pb = getPb();
  if (!pb) return;

  // Handle already-authenticated state (auth restored from localStorage by PocketBase SDK)
  if (pb.authStore.isValid && pb.authStore.model) {
    await _handleSignIn(pb.authStore.model.id, onSignIn);
  }

  authUnsubscribe?.();
  authUnsubscribe = pb.authStore.onChange(async (_token, model) => {
    if (model) {
      await _handleSignIn(model.id, onSignIn);
    } else {
      pbUser.set(null);
      userRole.set(null);
      onSignOut();
    }
  });
}

async function _handleSignIn(
  userId: string,
  onSignIn: (id: string) => Promise<void>
): Promise<void> {
  const pb = getPb();
  if (!pb) return;

  pbUser.set(pb.authStore.model);

  // Fetch role from the roles collection
  try {
    const { getPbUserRole } = await import('./pbRoleManager');
    const role = await getPbUserRole(userId);
    userRole.set(role);
  } catch {
    userRole.set('user');
  }

  // Write profile so admins can identify users by email
  try {
    const { upsertPbProfile } = await import('./pbRoleManager');
    await upsertPbProfile(userId, pb.authStore.model?.email ?? '');
  } catch {
    // Non-critical
  }

  await onSignIn(userId);
}

export function destroyPbAuthListener(): void {
  authUnsubscribe?.();
  authUnsubscribe = null;
}
