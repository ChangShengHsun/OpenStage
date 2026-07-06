import { PERFORMER_COLORS } from '@openstage/shared-types';

/**
 * Local user identity — display name + color for comments and collaboration
 * presence. No account system yet; persisted in localStorage so the name
 * survives reloads.
 */

export interface LocalUser {
  name: string;
  color: string;
}

const STORAGE_KEY = 'openstage-user';

let cached: LocalUser | null = null;

export function getLocalUser(): LocalUser {
  if (cached !== null) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<LocalUser>;
      if (typeof parsed.name === 'string' && typeof parsed.color === 'string') {
        cached = { name: parsed.name, color: parsed.color };
        return cached;
      }
    }
  } catch {
    // corrupted storage — fall through to a fresh identity
  }
  const color = PERFORMER_COLORS[Math.floor(Math.random() * PERFORMER_COLORS.length)] ?? '#e8a84c';
  cached = { name: `Guest-${Math.floor(1000 + Math.random() * 9000)}`, color };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  return cached;
}

export function setLocalUserName(name: string): LocalUser {
  const user = { ...getLocalUser(), name: name.trim() === '' ? getLocalUser().name : name.trim() };
  cached = user;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}
