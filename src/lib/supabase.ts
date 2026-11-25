import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
} from './supabaseConfig';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  DEFAULT_SUPABASE_URL;

const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const MEDIA_BUCKET = 'media';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const MEMBER_BADGE_OPTIONS = [
  'Fundador',
  'Autor Verificado',
  'Moderador',
] as const;

export type MemberBadge = (typeof MEMBER_BADGE_OPTIONS)[number];

export type ThemeMode = 'dark' | 'light';
export type AccentColor = 'blue' | 'violet';
export type FontSizeOption = 'normal' | 'large' | 'xl';

export interface UserProfile {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: string | null;
  badge: string | null;
  theme_mode?: ThemeMode | null;
  accent_color?: AccentColor | null;
  font_size?: FontSizeOption | null;
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return (role ?? '').trim().toLowerCase() === 'owner';
}

export function isModeratorRole(role: string | null | undefined): boolean {
  return (role ?? '').trim().toLowerCase() === 'moderator';
}

export function canVerifyEditorialRole(role: string | null | undefined): boolean {
  return isOwnerRole(role) || isModeratorRole(role);
}

export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isStrictHttpsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed.toLowerCase().startsWith('https://')) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}
