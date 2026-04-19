/**
 * Sync Pipeline Diagnostic
 *
 * Tests the actual Supabase insert/select flow with real credentials
 * to pinpoint exactly where the sync breaks down.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

function loadEnvLocal(): Record<string, string> {
  try {
    const content = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
    return env;
  } catch {
    return {};
  }
}

const envLocal = loadEnvLocal();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

describe('Sync Pipeline Diagnostic', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    if (!URL || !KEY) return;
    supabase = createClient(URL, KEY);
  });

  // Step 1: Check if there's an active auth session
  it('Step 1: Check auth session status', async () => {
    if (!supabase) { console.log('⏭ No client'); return; }

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('  ✗ Auth error:', error.message);
    }

    if (session?.user) {
      console.log('  ✓ Active session found');
      console.log('    User ID:', session.user.id);
      console.log('    Email:', session.user.email);
      console.log('    Provider:', session.user.app_metadata?.provider);
    } else {
      console.log('  ⚠ NO active session — this is likely why pins are not syncing!');
      console.log('    The sync only runs when a user is authenticated.');
      console.log('    Sign in via Google OAuth in the app first.');
    }

    // This test is informational — always passes
    expect(true).toBe(true);
  });

  // Step 2: Check if collections exist for any user
  it('Step 2: Query collections table (anon)', async () => {
    if (!supabase) { console.log('⏭ No client'); return; }

    const { data, error, count } = await supabase
      .from('collections')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('  ⚠ Collections query error:', error.message);
    } else {
      console.log('  ✓ Collections query succeeded');
      console.log('    Visible rows (with RLS):', count ?? 'unknown');
      console.log('    Note: 0 rows is expected for unauthenticated queries (RLS blocks)');
    }

    expect(true).toBe(true);
  });

  // Step 3: Query pins table
  it('Step 3: Query pins table (anon)', async () => {
    if (!supabase) { console.log('⏭ No client'); return; }

    const { data, error, count } = await supabase
      .from('pins')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('  ⚠ Pins query error:', error.message);
    } else {
      console.log('  ✓ Pins query succeeded');
      console.log('    Visible rows (with RLS):', count ?? 'unknown');
    }

    expect(true).toBe(true);
  });

  // Step 4: Try to insert a collection as anon (should fail with RLS)
  it('Step 4: Anon insert blocked by RLS', async () => {
    if (!supabase) { console.log('⏭ No client'); return; }

    const { error } = await supabase
      .from('collections')
      .insert({ user_id: '00000000-0000-0000-0000-000000000000', name: '__test__' });

    if (error) {
      console.log('  ✓ RLS correctly blocked anon insert:', error.code);
    } else {
      console.error('  ✗ Anon insert SUCCEEDED — RLS is not working!');
    }

    expect(error).toBeTruthy();
  });

  // Step 5: Check the Supabase client auth state from the browser client perspective
  it('Step 5: Diagnose the sync trigger conditions', async () => {
    if (!supabase) { console.log('⏭ No client'); return; }

    const { data: { session } } = await supabase.auth.getSession();

    console.log('\n  ━━━ SYNC DIAGNOSIS ━━━');

    if (!session) {
      console.log('  ❌ ROOT CAUSE: No authenticated session.');
      console.log('');
      console.log('  The cloud sync hook (useCloudSync) only pushes pins when:');
      console.log('    1. User signs in → onAuthStateChange fires → batch sync');
      console.log('    2. Page loads with existing session → catch-up sync');
      console.log('    3. New pin added while user is authenticated → live sync');
      console.log('');
      console.log('  Without an active session, ALL three paths are skipped.');
      console.log('  Pins are saved to localStorage only.');
      console.log('');
      console.log('  🔧 FIX: Sign in with Google in the app, then add a pin.');
      console.log('  ━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('  ✓ Session is active for user:', session.user.email);
      console.log('  If pins still aren\'t syncing, check the browser console for errors.');
      console.log('  ━━━━━━━━━━━━━━━━━━━━━');
    }

    expect(true).toBe(true);
  });
});
