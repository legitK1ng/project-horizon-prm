/**
 * Zod API Schemas — AGENT-3b | REQ-025
 * Runtime type validation at all API response boundaries.
 */
import { z } from 'zod';

// ─── Core Schemas ───────────────────────────────────────────────────

export const ExecutiveBriefSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  sentiment: z.enum(['Positive', 'Negative', 'Neutral']).optional(),
  tags: z.array(z.string()).optional().default([]),
  // Backend always sends snake_case; transform camelCase aliases on ingest for legacy compat
  action_items: z.array(z.string()).optional().default([]),
  recommended_followup_date: z.string().optional().nullable(),
  draft_followup_message: z.string().optional().nullable(),
  open_commitments: z.array(z.object({
    commitment: z.string(),
    deadline: z.string().nullable().optional(),
    owner: z.enum(['user', 'contact']).optional()
  })).optional().default([]),
  commitment_deadline_alerts: z.array(z.string()).optional().default([]),
}).passthrough()
  .transform((val) => ({
    ...val,
    // Normalize: if only camelCase exists (old records), back-fill snake_case
    action_items: val.action_items?.length
      ? val.action_items
      : (val as any).actionItems ?? [],
  }));

export const CallRecordSchema = z.object({
  id: z.string().uuid(),
  contact_name: z.string(),
  contact_id: z.string().uuid().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  duration: z.union([z.string(), z.number()]).optional().nullable(),
  transcript: z.string().optional().nullable(),
  executive_brief: ExecutiveBriefSchema.optional().nullable(),
  status: z.string().optional().nullable(),
  sentiment: z.enum(['Positive', 'Negative', 'Neutral']).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  recommended_followup_date: z.string().optional().nullable(),
  draft_followup_message: z.string().optional().nullable(),
  timestamp: z.string(),
  created_at: z.string().optional(),
}).passthrough(); // passthrough ensures any extra fields survive

export const ContactSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().min(1),
  last_name: z.string().optional().nullable(),
  birthdate: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  organization_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  health_score: z.number().min(0).max(100).optional().nullable(),
  is_favorite: z.boolean().optional().default(false),
  last_contact_at: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  total_calls: z.number().optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough();

export const EnrichmentJobSchema = z.object({
  id: z.string().uuid(),
  contact_id: z.string().uuid(),
  stage: z.number().int().min(1).max(6),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETE', 'FAILED', 'DEAD_LETTER']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().nullable(),
  result_json: z.record(z.string(), z.unknown()).optional().nullable(),
  source_name: z.string().optional().nullable(),
  fetched_at: z.string().optional().nullable(),
});

export const DigestResponseSchema = z.object({
  status: z.string(),
  digest: z.string().optional().default(''),
  calls_analyzed: z.number().int().optional().default(0),
});

export function ApiListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    status: z.string().optional(),
    data: z.array(itemSchema),
    count: z.number().int().optional(),
    total_count: z.number().int().optional(),
  });
}

// ─── Inferred Types ─────────────────────────────────────────────────

export type CallRecord = z.infer<typeof CallRecordSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type EnrichmentJob = z.infer<typeof EnrichmentJobSchema>;
export type DigestResponse = z.infer<typeof DigestResponseSchema>;
