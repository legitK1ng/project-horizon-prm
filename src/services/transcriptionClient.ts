/**
 * Horizon Transcription Client
 * ─────────────────────────────────────────────────────────────────
 * Routes audio files to the Whisper-compatible transcription endpoint
 * running on the Debian workstation, exposed via Tailscale Funnel.
 *
 * Endpoint: POST https://hp-z2g3-mini-workstation.tailb79f25.ts.net/v1/audio/transcriptions
 * Auth:     Bearer token from VITE_HZN_API_KEY
 *
 * Compatible with OpenAI Whisper API multipart/form-data contract.
 */

import { Capacitor } from '@capacitor/core';

// ── Environment resolution ─────────────────────────────────────────
// In native builds, Capacitor can't reach localhost — use Funnel URL.
const FUNNEL_BASE = 'https://hp-z2g3-mini-workstation.tailb79f25.ts.net';
const LOCAL_BASE  = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

function getTranscriptionBase(): string {
  return Capacitor.isNativePlatform() ? FUNNEL_BASE : LOCAL_BASE;
}

function getApiKey(): string {
  const key = import.meta.env.VITE_HZN_API_KEY;
  if (!key) {
    console.warn('[transcriptionClient] VITE_HZN_API_KEY is not set — requests will be unauthenticated.');
  }
  return key ?? '';
}

// ── Types ─────────────────────────────────────────────────────────
export interface TranscriptionResult {
  text: string;
  duration_seconds?: number;
  language?: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

export interface TranscriptionOptions {
  /** ISO-639-1 language hint, e.g. 'en'. Omit to auto-detect. */
  language?: string;
  /** Whisper model override. Defaults to server config. */
  model?: string;
  /** Response format: 'json' | 'text' | 'verbose_json' */
  responseFormat?: 'json' | 'text' | 'verbose_json';
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

// ── Core function ─────────────────────────────────────────────────

/**
 * Transcribe an audio Blob/File via the Horizon Whisper endpoint.
 *
 * @example
 * const result = await transcribeAudio(audioBlob, { language: 'en' });
 * console.log(result.text);
 */
export async function transcribeAudio(
  file: File | Blob,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const base   = getTranscriptionBase();
  const apiKey = getApiKey();
  const url    = `${base}/v1/audio/transcriptions`;

  const form = new FormData();
  form.append('file', file instanceof File ? file : new File([file], 'audio.m4a', { type: file.type }));

  if (options.model)          form.append('model',           options.model);
  if (options.language)       form.append('language',        options.language);
  if (options.responseFormat) form.append('response_format', options.responseFormat);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: form,
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`Transcription failed (${response.status}): ${detail}`);
  }

  if (options.responseFormat === 'text') {
    const text = await response.text();
    return { text };
  }

  return response.json() as Promise<TranscriptionResult>;
}

// ── React hook ────────────────────────────────────────────────────
import { useState, useCallback } from 'react';

export interface UseTranscriptionReturn {
  transcribe: (file: File | Blob, opts?: TranscriptionOptions) => Promise<TranscriptionResult | null>;
  isLoading: boolean;
  error: string | null;
  result: TranscriptionResult | null;
  reset: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<TranscriptionResult | null>(null);

  const transcribe = useCallback(async (
    file: File | Blob,
    opts?: TranscriptionOptions
  ): Promise<TranscriptionResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await transcribeAudio(file, opts);
      setResult(res);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { transcribe, isLoading, error, result, reset };
}
