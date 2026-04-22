import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/apiClient";
import { Contact, CallRecord, Nudge, DashboardStats } from "../types";

// REQ-022: Unified Query Keys
export const queryKeys = {
  contacts: {
    all: ["contacts"] as const,
    list: () => [...queryKeys.contacts.all, "list"] as const,
    detail: (id: string) => [...queryKeys.contacts.all, "detail", id] as const,
  },
  calls: {
    all: ["calls"] as const,
    list: () => [...queryKeys.calls.all, "list"] as const,
  },
  nudges: {
    all: ["nudges"] as const,
  },
  stats: {
    all: ["stats"] as const,
  },
  health: {
    check: ["health"] as const,
  },
  enrichments: {
    all: ["enrichments"] as const,
    byContact: (id: string) => [...queryKeys.enrichments.all, id] as const,
  }
};

// --- QUERIES ---

export const useCheckHealth = () => {
  return useQuery({
    queryKey: queryKeys.health.check,
    queryFn: () => api.checkHealth(),
    refetchInterval: 30000,
  });
};

export const useHealth = useCheckHealth;

export const useContacts = () => {
  return useQuery<Contact[]>({
    queryKey: queryKeys.contacts.list(),
    queryFn: () => api.getAllContacts(), // Auto-paginates all pages to load full 1822+ contacts
    staleTime: 1000 * 60 * 10, // Contacts change infrequently — 10 min cache
  });
};

export const useToggleFavorite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => api.toggleFavorite(contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.contacts.list() }),
  });
};

export const useCalls = () => {
  return useQuery<CallRecord[]>({
    queryKey: queryKeys.calls.list(),
    queryFn: () => api.getCalls().catch(() => []),
  });
};

export const useNudges = () => {
  return useQuery<Nudge[]>({
    queryKey: queryKeys.nudges.all,
    queryFn: () => api.getNudges().catch(() => []),
  });
};

export const useStats = () => {
  return useQuery<DashboardStats>({
    queryKey: queryKeys.stats.all,
    queryFn: () => api.getStats(),
  });
};

export const useEnrichments = (contactId: string) => {
  return useQuery({
    queryKey: queryKeys.enrichments.byContact(contactId),
    queryFn: () => api.getEnrichmentJobs(contactId),
    enabled: !!contactId,
  });
};

// --- MUTATIONS ---

export const useRefreshHealth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => api.refreshHealth(id),
    onSuccess: () => {
      // Invalidate all relationship data
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.nudges.all });
    },
  });
};

export const useIngestCall = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.ingestCall(payload),
    onSuccess: () => {
      // REQ-035: Invalidate logs to show new brief
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.nudges.all });
    },
  });
};

export const useTriggerEnrichment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => api.triggerEnrichment(contactId),
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrichments.byContact(contactId) });
    },
  });
};

export const useTasks = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks().catch(() => []),
    staleTime: 1000 * 60 * 2,
  });
};

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects().catch(() => []),
    staleTime: 1000 * 60 * 2,
  });
};

export const useGoogleAuth = () => {
  return useMutation({
    mutationFn: (data: { code: string; userId: string; redirectUri: string }) =>
      api.exchangeGoogleCode(data.code, data.userId, data.redirectUri),
  });
};

export const useSyncGoogleContacts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; accessToken: string }) =>
      api.syncGoogleContacts(data.userId, data.accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
    },
  });
};
