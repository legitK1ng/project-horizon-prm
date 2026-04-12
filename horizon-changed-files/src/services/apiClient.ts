/**
 * Typed API Client — AGENT-3b | REQ-024, REQ-025, REQ-027
 */
import { z } from 'zod';

const NudgeSchema = z.object({
  contact_id: z.string(),
  name: z.string(),
  score: z.number().nullable().optional(),
  reason: z.string(),
  suggested_action: z.string(),
  nudge_type: z.string().optional(),
  priority_score: z.number().optional(),
  health_score: z.number().optional(),
});

const SyncResponseSchema = z.object({
  status: z.string(),
  stats: z.object({
    created: z.number(),
    updated: z.number(),
    errors: z.number(),
  }).optional(),
  total_found: z.number().optional(),
  message: z.string().optional(),
});

import {
  CallRecordSchema,
  ContactSchema,
  DigestResponseSchema,
  EnrichmentJobSchema,
  ApiListResponseSchema,
} from '../schemas/api';
import type { Contact } from '../schemas/api';

const BASE_URL = import.meta.env.VITE_API_URL || '';
const API_V1 = `${BASE_URL}/api/v1`;

async function apiFetch<T>(schema: z.ZodType<T>, path: string, options?: RequestInit): Promise<T> {
  const url = `${API_V1}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error((error as { detail?: string }).detail || `HTTP ${response.status}`);
    }

    const json = await response.json();
    return schema.parse(json);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ─── Contacts ──────────────────────────────────────────────────────

export const contactsApi = {
  list: () =>
    apiFetch(ApiListResponseSchema(ContactSchema), '/contacts/').then(r => r.data),

  get: (id: string) =>
    apiFetch(ContactSchema, `/contacts/${id}`),

  create: (contact: Partial<Contact>) =>
    apiFetch(ContactSchema, '/contacts/', {
      method: 'POST',
      body: JSON.stringify(contact),
    }),

  update: (id: string, updates: Partial<Contact>) =>
    apiFetch(ContactSchema, `/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
};

// ─── Calls ─────────────────────────────────────────────────────────

export const callsApi = {
  list: (limit = 50, offset = 0) =>
    apiFetch(ApiListResponseSchema(CallRecordSchema), `/calls/?limit=${limit}&offset=${offset}`).then(r => r.data),

  create: (payload: {
    contact_name: string;
    phone_number: string;
    note: string;
    duration?: string | number;
    external_id?: string;
  }) =>
    apiFetch(
      z.object({ status: z.string(), call_id: z.string(), brief: z.record(z.string(), z.unknown()) }),
      '/calls/',
      { method: 'POST', body: JSON.stringify(payload) }
    ),
};

// ─── Enrichments ───────────────────────────────────────────────────

export const enrichmentsApi = {
  trigger: (contactId: string) =>
    apiFetch(z.object({ status: z.string(), message: z.string() }), '/enrichments/', {
      method: 'POST',
      body: JSON.stringify({ contact_id: contactId }),
    }),

  listForContact: (contactId: string) =>
    apiFetch(
      z.object({ status: z.string(), data: z.array(EnrichmentJobSchema), count: z.number() }),
      `/enrichments?contact_id=${contactId}`
    ).then(r => r.data),

  override: (entityId: string, value: string) =>
    apiFetch(z.object({ status: z.string() }), '/enrichments/override', {
      method: 'PATCH',
      body: JSON.stringify({ entity_id: entityId, value }),
    }),
};

// ─── Digest ────────────────────────────────────────────────────────

export const digestApi = {
  getWeeklyDigest: () => apiFetch(DigestResponseSchema, '/digest'),
};

// ─── Sync ──────────────────────────────────────────────────────────

export const syncApi = {
  triggerGoogle: (userId: string, accessToken: string) =>
    apiFetch(SyncResponseSchema, '/sync/google', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, access_token: accessToken }),
    }),

  getStatus: () =>
    apiFetch(z.object({ status: z.string(), last_sync_at: z.string().nullable() }), '/sync/status'),
};

// ─── Auth ──────────────────────────────────────────────────────────

export const authApi = {
  googleCallback: (code: string, userId: string, redirectUri?: string) =>
    apiFetch(
      z.object({
        status: z.string(),
        access_token: z.string(),
        refresh_token: z.string().optional(),
        expires_in: z.number().optional(),
      }),
      '/auth/google/callback',
      { method: 'POST', body: JSON.stringify({ code, user_id: userId, redirect_uri: redirectUri }) }
    ),
};

// ─── Nudges ────────────────────────────────────────────────────────

export const nudgesApi = {
  getActive: () =>
    apiFetch(z.object({
      status: z.string(),
      data: z.array(NudgeSchema),
      count: z.number(),
    }), '/nudges'),

  refresh: (contactId: string) =>
    apiFetch(z.object({
      status: z.string(),
      new_score: z.number(),
    }), `/nudges/refresh/${contactId}`, { method: 'POST' }),
};

// ─── Health ────────────────────────────────────────────────────────

// FIX: Accept any status string — backend may return 'ok', 'healthy', or 'online'
const HealthCheckSchema = z.object({
  status: z.string(),
  version: z.string().optional(),
  db_connected: z.boolean().optional(),
}).passthrough();

const HealthNudgesSchema = z.object({
  status: z.string(),
  data: z.object({
    nudges: z.array(z.object({
      contact_id: z.string(),
      contact_name: z.string(),
      nudge_text: z.string(),
      health_score: z.number().optional(),
      type: z.string(),
    })),
    alerts: z.array(z.any()),
  }),
}).or(z.object({ status: z.string(), data: z.array(z.any()) }));

const HealthScoreSchema = z.object({
  status: z.string(),
  contact_id: z.string(),
  health_score: z.number(),
});

export const healthApi = {
  check: () => apiFetch(HealthCheckSchema, '/health'),
  getNudges: () => apiFetch(HealthNudgesSchema, '/health/nudges'),
  getContactHealth: (id: string) => apiFetch(HealthScoreSchema, `/health/${id}`),
  refreshAll: () => apiFetch(z.any(), '/health/refresh', { method: 'POST' }),
};
