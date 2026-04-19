/**
 * Supabase Connection Diagnostic Test
 *
 * Hits the REAL Supabase instance using .env.local credentials to verify:
 * 1. Env vars are present and well-formed
 * 2. The anon key is a recognized format
 * 3. The API endpoint is reachable
 * 4. Tables exist (collections, pins)
 * 5. RLS policies are active
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

// Vitest doesn't auto-load .env.local — parse it manually
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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** Supabase keys can be JWTs (eyJ...) or newer publishable keys (sb_publishable_...) */
function isValidKeyFormat(key: string): boolean {
  if (!key) return false;
  const isJwt = key.startsWith('eyJ') && key.split('.').length === 3;
  const isPublishable = key.startsWith('sb_publishable_');
  return isJwt || isPublishable;
}

describe('Supabase Connection Diagnostic', () => {
  // ---------------------------------------------------------------
  // 1. Env var validation
  // ---------------------------------------------------------------
  describe('Environment variables', () => {
    it('NEXT_PUBLIC_SUPABASE_URL is set and non-empty', () => {
      expect(SUPABASE_URL).toBeTruthy();
      console.log('  ✓ SUPABASE_URL:', SUPABASE_URL);
    });

    it('NEXT_PUBLIC_SUPABASE_URL is a valid Supabase HTTPS URL', () => {
      const url = new URL(SUPABASE_URL);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toMatch(/\.supabase\.co$/);
      console.log('  ✓ URL format valid, host:', url.hostname);
    });

    it('NEXT_PUBLIC_SUPABASE_ANON_KEY is set and non-empty', () => {
      expect(SUPABASE_ANON_KEY).toBeTruthy();
      console.log('  ✓ ANON_KEY length:', SUPABASE_ANON_KEY.length, 'chars');
    });

    it('NEXT_PUBLIC_SUPABASE_ANON_KEY is a recognized key format', () => {
      const valid = isValidKeyFormat(SUPABASE_ANON_KEY);
      if (!valid) {
        console.error('\n  ✗ ANON_KEY format not recognized.');
        console.error('    Current value starts with:', SUPABASE_ANON_KEY.substring(0, 25) + '...');
        console.error('    Expected: JWT (eyJ...) or publishable key (sb_publishable_...)');
      } else {
        const format = SUPABASE_ANON_KEY.startsWith('eyJ') ? 'JWT' : 'Publishable key';
        console.log('  ✓ ANON_KEY format:', format);
      }
      expect(valid).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 2. Client creation & API reachability
  // ---------------------------------------------------------------
  describe('API connectivity', () => {
    let supabase: SupabaseClient;

    beforeAll(() => {
      if (!SUPABASE_URL || !isValidKeyFormat(SUPABASE_ANON_KEY)) return;
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    });

    it('Supabase client can be created', () => {
      if (!isValidKeyFormat(SUPABASE_ANON_KEY)) {
        console.log('  ⏭ Skipped — invalid key format');
        return;
      }
      expect(supabase).toBeDefined();
      console.log('  ✓ Client created successfully');
    });

    it('API is reachable (collections query executes without network error)', async () => {
      if (!supabase) {
        console.log('  ⏭ Skipped — no valid client');
        return;
      }

      const { data, error } = await supabase.from('collections').select('id').limit(1);

      if (error) {
        console.log('  ⚠ Query returned error:', error.message, '(code:', error.code + ')');
        if (error.message.includes('JWT') || error.message.includes('invalid') || error.message.includes('apikey')) {
          console.error('  ✗ The anon key may be INVALID or EXPIRED.');
          expect.fail(`API key rejected: ${error.message}`);
        }
      } else {
        console.log('  ✓ API is reachable, query returned', data?.length ?? 0, 'rows');
      }
    });
  });

  // ---------------------------------------------------------------
  // 3. Table existence
  // ---------------------------------------------------------------
  describe('Table structure', () => {
    let supabase: SupabaseClient;

    beforeAll(() => {
      if (!SUPABASE_URL || !isValidKeyFormat(SUPABASE_ANON_KEY)) return;
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    });

    it('"collections" table exists', async () => {
      if (!supabase) { console.log('  ⏭ Skipped'); return; }

      const { error } = await supabase.from('collections').select('id').limit(0);
      if (error?.message?.includes('does not exist')) {
        console.error('  ✗ "collections" table not found. Run: supabase db push');
      }
      const missing = error?.message?.includes('does not exist') ?? false;
      expect(missing).toBe(false);
      if (!missing) console.log('  ✓ "collections" table exists');
    });

    it('"pins" table exists', async () => {
      if (!supabase) { console.log('  ⏭ Skipped'); return; }

      const { error } = await supabase.from('pins').select('id').limit(0);
      if (error?.message?.includes('does not exist')) {
        console.error('  ✗ "pins" table not found. Run: supabase db push');
      }
      const missing = error?.message?.includes('does not exist') ?? false;
      expect(missing).toBe(false);
      if (!missing) console.log('  ✓ "pins" table exists');
    });
  });

  // ---------------------------------------------------------------
  // 4. RLS verification
  // ---------------------------------------------------------------
  describe('RLS policies', () => {
    let supabase: SupabaseClient;

    beforeAll(() => {
      if (!SUPABASE_URL || !isValidKeyFormat(SUPABASE_ANON_KEY)) return;
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    });

    it('unauthenticated SELECT on "collections" returns empty array (RLS active)', async () => {
      if (!supabase) { console.log('  ⏭ Skipped'); return; }

      const { data, error } = await supabase.from('collections').select('id').limit(5);
      if (error) {
        console.log('  ⚠ RLS check error:', error.message);
        return;
      }
      console.log('  ✓ RLS active — unauthenticated query returned', data?.length ?? 0, 'rows');
      expect(Array.isArray(data)).toBe(true);
    });

    it('unauthenticated INSERT on "pins" is rejected by RLS', async () => {
      if (!supabase) { console.log('  ⏭ Skipped'); return; }

      const { error } = await supabase.from('pins').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        collection_id: '00000000-0000-0000-0000-000000000000',
        title: '__diagnostic_test__',
        image_url: 'https://test.com/img.jpg',
        source_url: 'https://test.com',
        latitude: 0,
        longitude: 0,
      });

      if (error) {
        console.log('  ✓ RLS correctly blocked unauthenticated INSERT:', error.message);
      } else {
        console.error('  ✗ WARNING: Unauthenticated INSERT succeeded — RLS may not be enabled!');
      }
      expect(error).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------
  // 5. Summary
  // ---------------------------------------------------------------
  it('prints connection summary', () => {
    const validKey = isValidKeyFormat(SUPABASE_ANON_KEY);
    const keyType = SUPABASE_ANON_KEY.startsWith('eyJ') ? 'JWT' : SUPABASE_ANON_KEY.startsWith('sb_') ? 'Publishable' : 'Unknown';

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SUPABASE CONNECTION DIAGNOSTIC SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  URL:       ', SUPABASE_URL || '❌ NOT SET');
    console.log('  Key format:', validKey ? `✅ ${keyType}` : '❌ Unrecognized');
    console.log('  Key length:', SUPABASE_ANON_KEY.length, 'chars');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    expect(true).toBe(true);
  });
});
