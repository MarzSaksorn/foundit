import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const PHICHAI_SCHOOL = 'Phichai School';

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
    },
  });
}

export async function validateSchoolUser(user: User | null) {
  if (!user) return { allowed: false, user: null };
  if (!supabase) return { allowed: false, user: null };
  const { data: profile, error } = await supabase.from('profiles').select('id, school_id').eq('id', user.id).maybeSingle();
  if (!error && profile?.id === user.id && typeof profile.school_id === 'string' && profile.school_id.length > 0) return { allowed: true, user };
  await supabase.auth.signOut({ scope: 'local' });
  return { allowed: false, user: null };
}
