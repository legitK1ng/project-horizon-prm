# Horizon AI Chat & Service Stabilization Design

## 1. Goal
Stabilize the Horizon PRM by consolidating the frontend service layer and implementing a production-grade, contextual AI chat system.

## 2. Proposed Approaches (AI Chat)

### Option A: Contextual Assistant (Recommended)
- **Mechanism**: The `/api/v1/ai/chat` endpoint accepts a `message` and an optional `context_id` (contact or call ID).
- **Backend Logic**: If `context_id` is provided, the backend fetches the relevant `executive_brief` or `interaction_history` and injects it into Gemini's system prompt.
- **Pros**: Highly relevant responses; fits the "Relationship Intelligence" mission.
- **Cons**: Slightly higher latency due to DB lookup.

### Option B: Unified Proxy
- **Mechanism**: A stateless proxy to Gemini.
- **Pros**: Simplest to implement; lowest latency.
- **Cons**: AI has no context of the specific contact the user is looking at.

## 3. Service Consolidation Design
- **Single Source of Truth**: All components currently importing from `apiService.ts` will be refactored to use `apiClient.ts` (the Zod-validated client).
- **Purge**: Delete `apiService.ts` and `AssistantChat.tsx` once the migration is complete.
- **Endpoint Harmonization**: Rename `/api/v1/enrichment` (backend) to `/api/v1/enrichments` (or vice versa) across the entire stack for consistency.

## 4. Verification Plan
- **Backend**: New unit test `tests/test_ai_chat.py`.
- **Frontend**: Manual test of the `FloatingChat` component.
- **E2E**: Fix existing Playwright regressions caused by label mismatches.
