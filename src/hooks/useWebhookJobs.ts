/**
 * useWebhookJobs.ts
 * ──────────────────
 * TanStack Query hooks for polling the ACR Transcription Gateway.
 *
 * - `useWebhookJobs`      → polls job list every 5 s
 * - `useWebhookTranscript`→ lazy-fetch a single transcript on demand
 * - `useWebhookHealth`    → one-shot preflight check
 */

import { useQuery } from "@tanstack/react-query";
import {
  getJobStatus,
  getTranscript,
  getWebhookHealth,
  listTranscripts,
} from "@/services/webhookService";

// ── Job list (auto-polling) ────────────────────────────────────────────────────

export function useWebhookJobs(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["webhookJobs", limit, offset],
    queryFn: () => listTranscripts(limit, offset),
    refetchInterval: 5_000,          // poll every 5 seconds
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 2,
    staleTime: 4_000,
  });
}

// ── Single transcript (on-demand) ─────────────────────────────────────────────

export function useWebhookTranscript(callId: string | null) {
  return useQuery({
    queryKey: ["webhookTranscript", callId],
    queryFn: () => getTranscript(callId!),
    enabled: Boolean(callId),
    staleTime: 30_000,               // transcripts don't change once complete
    retry: 1,
  });
}

// ── Single job status (fast refresh for in-progress jobs) ─────────────────────

export function useJobStatus(callId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["webhookJobStatus", callId],
    queryFn: () => getJobStatus(callId!),
    enabled: enabled && Boolean(callId),
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      // Only keep polling while the job is active
      return status === "QUEUED" || status === "PROCESSING" ? 3_000 : false;
    },
    retry: 1,
  });
}

// ── Gateway health check ──────────────────────────────────────────────────────

export function useWebhookHealth() {
  return useQuery({
    queryKey: ["webhookHealth"],
    queryFn: getWebhookHealth,
    staleTime: 60_000,
    retry: 1,
  });
}
