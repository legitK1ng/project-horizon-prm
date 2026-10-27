/**
 * webhookService.ts
 * ─────────────────
 * API client for the ACR Transcription Gateway backend.
 * All errors are caught and re-thrown with structured messages.
 */

const GATEWAY_BASE = import.meta.env.VITE_GATEWAY_URL ?? "https://100.101.99.29:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiarizedSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface WebhookJob {
  call_id: string;
  phone_number: string | null;
  source: string | null;
  call_date: number | null;
  duration_seconds: number | null;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "ERROR";
  received_at: string;
  processed_at: string | null;
  error?: string | null;
}

export interface WebhookTranscript extends WebhookJob {
  diarized_segments: DiarizedSegment[];
  full_text: string;
  note: string | null;
  raw_audio_path: string | null;
  transcript_path: string | null;
}

export interface WebhookListResponse {
  count: number;
  jobs: WebhookJob[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`[WebhookService] ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Preflight check — confirm the gateway is reachable. */
export async function getWebhookHealth(): Promise<{ status: string; service: string }> {
  return apiFetch("/webhook/health");
}

/**
 * Fetch paginated list of ACR jobs.
 * Falls back to in-memory registry if Supabase unavailable.
 */
export async function listTranscripts(
  limit = 50,
  offset = 0,
): Promise<WebhookListResponse> {
  return apiFetch(`/api/Recording/transcripts?limit=${limit}&offset=${offset}`);
}

/** Fetch the full diarized transcript for a single job. */
export async function getTranscript(callId: string): Promise<WebhookTranscript> {
  return apiFetch(`/api/Recording/transcript/${encodeURIComponent(callId)}`);
}

/** Get the live status of a specific job. */
export async function getJobStatus(
  callId: string,
): Promise<Pick<WebhookJob, "call_id" | "status" | "error">> {
  return apiFetch(`/api/Recording/status/${encodeURIComponent(callId)}`);
}
