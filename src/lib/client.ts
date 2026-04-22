/**
 * Legacy shim — kept for any code that imports from '@/lib/client'.
 * The real client (native-safe, Capacitor Preferences storage) lives in './supabase'.
 */
export { supabase as createClient, getSupabase } from './supabase';
