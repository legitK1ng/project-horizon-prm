/**
 * Project Horizon — Supabase Data Hooks
 *
 * All hooks in this file read directly from Supabase, bypassing FastAPI.
 * FastAPI is still used for: AI enrichment triggers, nudge scoring, transcription.
 *
 * Table contract (self-hosted Supabase):
 *   contacts          → Contact type
 *   call_records      → CallRecord type (includes transcript, executive_brief JSONB)
 *   enriched_entities → EnrichmentJob type (OSINT logs)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Contact, CallRecord, EnrichmentJob } from '../types';

// ── Query Keys ─────────────────────────────────────────────────────────────
export const sbQueryKeys = {
  contacts: {
    all: ['sb', 'contacts'] as const,
    list: () => [...sbQueryKeys.contacts.all, 'list'] as const,
    detail: (id: string) => [...sbQueryKeys.contacts.all, 'detail', id] as const,
  },
  calls: {
    all: ['sb', 'calls'] as const,
    list: () => [...sbQueryKeys.calls.all, 'list'] as const,
    byContact: (id: string) => [...sbQueryKeys.calls.all, 'contact', id] as const,
  },
  enrichments: {
    all: ['sb', 'enrichments'] as const,
    byContact: (id: string) => [...sbQueryKeys.enrichments.all, id] as const,
  },
  osint: {
    all: ['sb', 'osint'] as const,
    byContact: (id: string) => [...sbQueryKeys.osint.all, id] as const,
  },
};

// ── Contacts ───────────────────────────────────────────────────────────────

/**
 * Fetches all contacts directly from Supabase.
 * Supabase auto-paginates at 1000 rows; we loop to get everything.
 */
export function useSupabaseContacts() {
  return useQuery<Contact[]>({
    queryKey: sbQueryKeys.contacts.list(),
    staleTime: 1000 * 60 * 10, // 10 min — contacts change infrequently
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let all: Contact[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .order('last_contact_at', { ascending: false, nullsFirst: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw new Error(`[Supabase] contacts: ${error.message}`);
        if (!data?.length) break;
        all = [...all, ...data];
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return all;
    },
  });
}

export function useSupabaseContact(id: string) {
  return useQuery<Contact>({
    queryKey: sbQueryKeys.contacts.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(`[Supabase] contact ${id}: ${error.message}`);
      return data as Contact;
    },
  });
}

// ── Call Records (Enriched Transcripts) ───────────────────────────────────

/**
 * Fetches all call records with transcripts and executive_brief.
 * executive_brief is a JSONB column — Supabase returns it as a parsed object.
 */
export function useSupabaseCalls() {
  return useQuery<CallRecord[]>({
    queryKey: sbQueryKeys.calls.list(),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_records')
        .select(`
          id,
          contact_id,
          contact_name,
          phone_number,
          duration,
          transcript,
          raw_transcript,
          executive_brief,
          status,
          sentiment,
          tags,
          recommended_followup_date,
          draft_followup_message,
          timestamp,
          created_at
        `)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw new Error(`[Supabase] call_records: ${error.message}`);
      // Normalize: use transcript, fall back to raw_transcript
      const normalized = (data ?? []).map((row: any) => ({
        ...row,
        transcript: row.transcript || row.raw_transcript || '',
      }));
      return normalized as CallRecord[];
    },
  });
}

/**
 * Fetches all call records for a specific contact.
 * Used inside ContactDetailDrawer / UnifiedContactDrawer.
 */
export function useSupabaseCallsByContact(contactId: string) {
  return useQuery<CallRecord[]>({
    queryKey: sbQueryKeys.calls.byContact(contactId),
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_records')
        .select('*')
        .eq('contact_id', contactId)
        .order('timestamp', { ascending: false })
        .limit(200);

      if (error)
        throw new Error(
          `[Supabase] call_records for ${contactId}: ${error.message}`
        );
      return (data ?? []) as CallRecord[];
    },
  });
}

// ── OSINT / Enrichment Logs ────────────────────────────────────────────────

/**
 * Fetches enrichment job logs for a contact from the enriched_entities table.
 * These are the OSINT pipeline results — phone, email, org, social signals.
 */
export function useSupabaseEnrichments(contactId: string) {
  return useQuery<EnrichmentJob[]>({
    queryKey: sbQueryKeys.enrichments.byContact(contactId),
    enabled: !!contactId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enriched_entities')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error)
        throw new Error(`[Supabase] enrichments for ${contactId}: ${error.message}`);
      return (data ?? []) as EnrichmentJob[];
    },
  });
}

// ── Google Contact Matches ─────────────────────────────────────────────────

/**
 * Returns a contact's raw_data field which contains the full
 * Google People API Person object stored during sync.
 */
export function useGoogleContactMatch(contactId: string) {
  return useQuery({
    queryKey: ['sb', 'google-match', contactId],
    enabled: !!contactId,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('raw_data, google_resource_name, last_synced, photo_url')
        .eq('id', contactId)
        .single();

      if (error) throw new Error(`[Supabase] google match ${contactId}: ${error.message}`);
      return data;
    },
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** Toggle favorite status directly in Supabase (no FastAPI round-trip needed) */
export function useSupabaseToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ is_favorite: !current })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return !current;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sbQueryKeys.contacts.all });
    },
  });
}

/** Update contact fields directly in Supabase */
export function useSupabaseUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Contact> }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Contact;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: sbQueryKeys.contacts.list() });
      qc.invalidateQueries({ queryKey: sbQueryKeys.contacts.detail(id) });
    },
  });
}
