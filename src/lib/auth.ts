import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const PHICHAI_SCHOOL = 'Phichai School';
export const PHICHAI_DOMAIN = 'phichai.ac.th';

export function isAllowedSchoolEmail(email: string | undefined | null) {
  return Boolean(email && email.trim().toLowerCase().endsWith(`@${PHICHAI_DOMAIN}`));
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { hd: PHICHAI_DOMAIN, prompt: 'select_account' },
    },
  });
}

export async function validateSchoolUser(user: User | null) {
  if (!user) return { allowed: false, user: null };
  if (isAllowedSchoolEmail(user.email)) return { allowed: true, user };
  if (supabase) await supabase.auth.signOut();
  return { allowed: false, user: null };
}
