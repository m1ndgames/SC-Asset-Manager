import { getPb } from './pocketbase';
import type { Role } from './types';

export async function getPbUserRole(userId: string): Promise<Role> {
  const pb = getPb();
  if (!pb) return 'user';
  try {
    const record = await pb.collection('roles').getFirstListItem(`userId = "${userId}"`);
    return (record.role as Role) ?? 'user';
  } catch {
    return 'user';
  }
}

export async function setPbUserRole(userId: string, role: Role): Promise<void> {
  const pb = getPb();
  if (!pb) throw new Error('PocketBase not initialized');

  // Upsert: update if a record exists, create otherwise
  try {
    const existing = await pb.collection('roles').getFirstListItem(`userId = "${userId}"`);
    await pb.collection('roles').update(existing.id, { role });
  } catch {
    await pb.collection('roles').create({ userId, role });
  }
}

export async function getAllPbRoles(): Promise<Map<string, Role>> {
  const pb = getPb();
  if (!pb) throw new Error('PocketBase not initialized');
  const records = await pb.collection('roles').getFullList();
  const map = new Map<string, Role>();
  for (const r of records) map.set(r.userId as string, r.role as Role);
  return map;
}

export async function getAllPbProfiles(): Promise<Map<string, string>> {
  const pb = getPb();
  if (!pb) throw new Error('PocketBase not initialized');
  const records = await pb.collection('profiles').getFullList();
  const map = new Map<string, string>();
  for (const r of records) {
    if (r.email) map.set(r.userId as string, r.email as string);
  }
  return map;
}

export async function upsertPbProfile(userId: string, email: string): Promise<void> {
  const pb = getPb();
  if (!pb) return;
  try {
    const existing = await pb.collection('profiles').getFirstListItem(`userId = "${userId}"`);
    await pb.collection('profiles').update(existing.id, { email });
  } catch {
    await pb.collection('profiles').create({ userId, email });
  }
}
