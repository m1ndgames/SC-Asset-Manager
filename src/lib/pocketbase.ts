import PocketBase from 'pocketbase';

let pb: PocketBase | null = null;

export function readStoredPbUrl(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('sc_pb_url');
  if (!raw) return null;
  try {
    // localStore serialises values as JSON, so the stored value may be '"http://..."'
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' && parsed.trim() ? parsed : null;
  } catch {
    return raw.trim() || null;
  }
}

export function initPocketBase(url: string): PocketBase {
  pb = new PocketBase(url);
  return pb;
}

export function getPb(): PocketBase | null {
  return pb;
}

export function isPocketBaseReady(): boolean {
  return pb !== null;
}

/**
 * Convert a crypto.randomUUID() value to a valid PocketBase record ID.
 * PocketBase requires: 15-255 chars, alphanumeric + underscore, starts with a letter.
 * UUIDs become 32-char hex strings; we prefix with 'r' when the first char is a digit.
 */
export function toPbId(uuid: string): string {
  const clean = uuid.replace(/-/g, '');
  return /^[a-zA-Z]/.test(clean) ? clean : `r${clean}`;
}
