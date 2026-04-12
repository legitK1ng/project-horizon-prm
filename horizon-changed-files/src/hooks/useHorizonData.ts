/**
 * TanStack Query Hooks — REQ-024
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi, callsApi, enrichmentsApi, digestApi, healthApi, syncApi, nudgesApi, authApi } from '../services/apiClient';

export const queryKeys = {
  contacts: {
    all: ['contacts'] as const,
    detail: (id: string) => ['contacts', id] as const,
  },
  calls: {
    all: ['calls'] as const,
    list: (limit: number, offset: number) => ['calls', limit, offset] as const,
  },
  enrichments: {
    forContact: (contactId: string) => ['enrichments', contactId] as const,
  },
  digest: {
    weekly: ['digest', 'weekly'] as const,
  },
  health: {
    nudges: ['health', 'nudges'] as const,
    score: (contactId: string) => ['health', 'score', contactId] as const,
  },
  nudges: {
    active: ['nudges', 'active'] as const,
  },
};

// ─── Contacts ──────────────────────────────────────────────────────

export function useContacts() {
  return useQuery({
    queryKey: queryKeys.contacts.all,
    queryFn: () => contactsApi.list().catch(() => []),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    retry: 2,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: queryKeys.contacts.detail(id),
    queryFn: () => contactsApi.get(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contactsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
    },
  });
}

export function useSyncGoogleContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accessToken }: { userId: string; accessToken?: string }) =>
      syncApi.triggerGoogle(userId, accessToken || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.health.nudges });
      queryClient.invalidateQueries({ queryKey: queryKeys.nudges.active });
      queryClient.invalidateQueries({ queryKey: queryKeys.digest.weekly });
    },
  });
}

// ─── Auth ──────────────────────────────────────────────────────────

export function useGoogleAuth() {
  return useMutation({
    mutationFn: ({ code, userId, redirectUri }: { code: string; userId: string; redirectUri?: string }) =>
      authApi.googleCallback(code, userId, redirectUri),
  });
}

// ─── Calls ─────────────────────────────────────────────────────────

export function useCalls(limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.calls.list(limit, offset),
    queryFn: () => callsApi.list(limit, offset).catch(() => []),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    retry: 2,
  });
}

export function useIngestCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: callsApi.create,
    onSuccess: () => {
      // FIX: invalidate by prefix ['calls'] to catch all list variants
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
    },
  });
}

// ─── Enrichments ───────────────────────────────────────────────────

export function useEnrichments(contactId: string) {
  return useQuery({
    queryKey: queryKeys.enrichments.forContact(contactId),
    queryFn: () => enrichmentsApi.listForContact(contactId),
    enabled: !!contactId,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

export function useTriggerEnrichment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => enrichmentsApi.trigger(contactId),
    onSuccess: (_data, contactId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrichments.forContact(contactId) });
    },
  });
}

// ─── Weekly Digest ─────────────────────────────────────────────────

export function useWeeklyDigest() {
  return useQuery({
    queryKey: queryKeys.digest.weekly,
    queryFn: () => digestApi.getWeeklyDigest().catch(() => ({ status: 'offline', digest: '', calls_analyzed: 0 })),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 120,
    retry: 1,
  });
}

// ─── Health & Nudges ───────────────────────────────────────────────

export function useNudges() {
  return useQuery({
    queryKey: queryKeys.nudges.active,
    queryFn: () => nudgesApi.getActive().then(r => r.data).catch(() => []),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function useRefreshHealth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => nudgesApi.refresh(contactId),
    onSuccess: (_data, contactId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.health.score(contactId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.nudges.active });
    },
  });
}

export function useHealth(contactId: string) {
  return useQuery({
    queryKey: queryKeys.health.score(contactId),
    queryFn: () => healthApi.getContactHealth(contactId),
    enabled: !!contactId,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}
