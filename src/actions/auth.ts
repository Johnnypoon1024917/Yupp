'use server';

import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function requireRegisteredUser(
  supabase: SupabaseClient
): Promise<User> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Unauthorized: No user session found');
  }
  if (user.is_anonymous) {
    throw new Error('Unauthorized: Anonymous users cannot perform this action');
  }
  return user;
}
