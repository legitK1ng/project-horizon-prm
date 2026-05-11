/**
 * Project Horizon — Supabase Direct Client (Native-Safe)
 *
 * This is the single source-of-truth Supabase client.
 * It uses @capacitor/preferences as the storage adapter so sessions
 * survive in native iOS/Android WebViews (localStorage is wiped on app
 * backgrounding on some devices; Preferences is not).
 *
 * ARCHITECTURE NOTE:
 *   - CRUD reads (contacts, calls, enrichments) → this client (direct Supabase)
 *   - Heavy AI work (transcription, enrichment jobs, nudge engine) → FastAPI
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase';
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// ── Environment ────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Horizon] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local — Supabase client disabled'
  );
}

// ── Capacitor-aware Storage Adapter ───────────────────────────────────────
//
// On native (iOS/Android) we use @capacitor/preferences (backed by
// NSUserDefaults / SharedPreferences). On web we fall back to localStorage.
// The supabase-js client accepts any object implementing getItem/setItem/removeItem.

const nativeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },
  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  },
};

const storageAdapter = Capacitor.isNativePlatform()
  ? nativeStorageAdapter
  : undefined; // undefined → supabase-js uses its built-in localStorage adapter

// ── Client Singleton ───────────────────────────────────────────────────────
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: storageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: !Capacitor.isNativePlatform(), // only on web
    },
    global: {
      headers: {
        'x-horizon-client': 'horizon-prm-react',
      },
    },
  });

  return _client;
}

/**
 * Pre-built singleton — import this everywhere.
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
 * Cast is safe when env vars are present; getSupabase() guards the null case.
 */
export const supabase = getSupabase() as SupabaseClient;
