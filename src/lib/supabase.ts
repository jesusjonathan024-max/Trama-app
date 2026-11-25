import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://arsfmhqwobwtzvzoragn.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_eIwdF37A3KY0CxfXbz_pGw_jCatsnfy';

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

export interface UserProfile {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
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
