# 🪐 PROJECT HORIZON: THE MASTER REQS LIST

This is an ongoing list of requirements derived from the **Project Horizon Architecture Review**, the **ACR Phone Webhook Technical Ingestion**, and the **v2.0 Roadmap**.

## Status Summary
- `[To do]` - Not started.
- `[In progress]` - Currently being addressed.
- `[Complete]` - Verified and pushed to production.
- `[Needs attention]` - Blocked or requires architectural review.

---

### Stage 1: Backend Foundation (45 items)
1. `[In progress]` Setup FastAPI project structure in `mcp-backend/`.
2. `[To do]` Implement Pydantic models for ACR Phone Webhook inbound payload.
3. `[To do]` Configure `CORSMiddleware` for `capacitor://localhost` and `http://localhost`.
4. `[To do]` Implement `POST /v1/audio/transcriptions` endpoint mimicking OpenAI Whisper API.
5. `[To do]` Setup `.env` secret validation for `ACR_WEBHOOK_SECRET` "handshake".
6. `[To do]` Implement background task queue for asynchronous audio processing.
7. `[To do]` Configure `anyio` for non-blocking IO during concurrent call ingestion.
8. `[To do]` Implement `Singleton` pattern for Whisper and NeMo model loaders.
9. `[To do]` Setup Dockerfile for local development environment.
10. `[To do]` Configure FastAPI to bind to `0.0.0.0` for Tailscale visibility.
11. `[To do]` Implement `multipart/form-data` handling for `.mp4`/`.m4a` audio blobs.
12. `[To do]` Build temporary storage rotation for un-transcribed audio files.
13. `[To do]` Setup Supabase Python Client integration.
14. `[To do]` Implement database connection pooling for high-frequency webhooks.
15. `[To do]` Create GCP Cloud Run deployment YAML for the backend service.
16. `[To do]` Configure environment secrets injection at deployment time.
17. `[To do]` Implement central logging to Cloud Logging (Stackdriver).
18. `[To do]` Implement health check endpoint `/health`.
19. `[To do]` Migrate `Code.gs` core logic for `processQueue()` to Python.
20. `[To do]` Implement `Utilities.formatDate()` equivalents in Python backend.
21. `[To do]` Setup `Intl` object direct usage for localization in Python.
22. `[To do]` Implement "Secret Handshake" validation logic as a FastAPI Dependency.
23. `[To do]` Configure request body limits to handle large audio files (2GB+).
24. `[To do]` Implement file streaming from FastAPI to temporary disk.
25. `[To do]` Build retry logic for failed audio processing jobs.
26. `[To do]` Implement "Silent Fail" protection—do not block phone handoff on AI error.
27. `[To do]` Setup local testing script mimicking ACR Phone app upload.
28. `[To do]` Integrate `python-dotenv` for local environment management.
29. `[To do]` Configure `uvicorn` for production execution.
30. `[To do]` Implement "Job ID" tracking for all incoming webhooks.
31. `[To do]` Build metadata persistence—storing duration, direction, and timestamp first.
32. `[To do]` Implement "Catcher" log rotation for debugging handshakes.
33. `[To do]` Configure `Secret` field mirroring in `.env` based on `magicalbluetuba`.
34. `[To do]` Implement `FastAPI.BackgroundTasks` for transcription firing.
35. `[To do]` Build "Wait-and-Verify" test script for the handshake.
36. `[To do]` Finalize Stage 1 documentation (Postman/cURL examples).
37. `[To do]` Setup `Authentication` middleware for external webhooks.
38. `[To do]` Build `RateLimiting` for enrichment API consumption.
39. `[To do]` Create `OAuth2` flow for LinkedIn/X integrations.
40. `[To do]` Implement `RLS (Row Level Security)` policies in Supabase.
41. `[To do]` Setup `Supabase Broadcast` for real-time dashboard updates.
42. `[To do]` Build `JobComplete` signal endpoint for frontend refresh.
43. `[To do]` Implement `DataPurge` logic for temporary records.
44. `[To do]` Create `SecurityHardening` deployment guide.
45. `[To do]` Setup local development environment with proper tools and dependencies.

---

### Stage 2: UI/UX Design (42 items)
46. `[In progress]` Establish CSS Custom Properties for `The Look` design system.
47. `[To do]` Implement TanStack Query (React Query) for all data fetching.
48. `[To do]` Integrate `shadcn/ui` for high-fidelity component library.
49. `[To do]` Build `GlassCard` component for intelligence surface consistency.
50. `[To do]` Implement `useTheme` hook with system-wide dark/light mode sync.
51. `[To do]` Refactor `useData` hook into granular query hooks (e.g., `useContacts`).
52. `[To do]` Create `DesignTokens.css` for spacing, typography, and elevation.
53. `[To do]` Implement Zod schema validation at all API boundaries.
54. `[To do]` Refactor `ContactDrawer` into tabbed `PerspectivePanel`.
55. `[To do]` Build `TimelineFeed` (Notion-style) for interaction history.
56. `[To do]` Implement `RelationshipHealthScore` visual indicator (Sparks/Gauges).
57. `[To do]` Create `Needs Attention` dashboard module for inactive contacts.
58. `[To do]` Integrate `framer-motion` for smooth micro-animations.
59. `[To do]` Implement `CommandPalette` semantic search extension.
60. `[To do]` Build `RelationshipGraph` (Force-directed) visualization component.
61. `[To do]` Create `EnrichmentTab` for displaying OSINT-derived cards.
62. `[To do]` Implement `Async Everything` UI patterns (Skeleton states).
63. `[To do]` Build `ActionItems` checklist on Contact detail view.
64. `[To do]` Refactor `EditModal` for multi-stage entity creation.
65. `[To do]` Implement `HoverCard` for quick entity preview.
66. `[To do]` Build `WeeklySummary` dashboard header widget.
67. `[To do]` Integrate `Google Fonts (Outfit)` into Tailwind configuration.
68. `[To do]` Implement optimistic updates for status changes.
69. `[To do]` Build `ProcessingStatus` indicator for ongoing transcription.
70. `[To do]` Create `DataStaleness` badge system for enrichment data.
71. `[To do]` Implement `PushNotification` UI for transcription alerts.
72. `[To do]` Build `ConfidenceScore` threshold UI for manual review.
73. `[To do]` Create `HistoryContext` to persist command palette history.
74. `[To do]` Implement `RelationshipCategory` (Professional/Project/Family) tags.
75. `[To do]` Build `EntitySummary` narrative block (Gemini-generated).
76. `[To do]` Create `Sparkline` charts for activity trends.
77. `[To do]` Implement `LinearActivity` feed with media (audio) attachments.
78. `[To do]` Build `RelationshipStrength` gauge on contact cards.
79. `[To do]` Implement `QuickActions` (<3 keystrokes) in command palette.
80. `[To do]` Create `ServiceStatus` dashboard footer.
81. `[To do]` Implement `CORS` fallback for mobile Capacitor builds.
82. `[To do]` Build `EnrichmentConfidence` badge (High/Medium/Low).
83. `[To do]` Create `ContactDetailDrawer` consolidation UI.
84. `[To do]` Implement `IntelligenceSurface` dashboard layer.
85. `[To do]` Finalize Phase 2 documentation (Design System Guidelines).
86. `[To do]` Build `LocationCard` (Timezone/Map/Thumbnail) enrichment UI.
87. `[To do]` Build `PhoneCard` (Carrier/SpamScore) enrichment card UI.
88. `[To do]` Build `OrganizationCard` (headcount/industry) enrichment card UI.
89. `[To do]` Build `SecuritySeal` visual indicators for encrypted fields.
90. `[To do]` Finalize Stage 2 UI/UX validation.

---

### Stage 3: Relational Schema & Workflows (60 items)
91. `[To do]` Finalize `profiles` table schema in Supabase.
92. `[To do]` Finalize `contacts` (Entities) master table schema.
93. `[To do]` Implement `call_records` (Touchpoints) table schema.
94. `[To do]` Create `enriched_entities` JSONB column for OSINT storage.
95. `[To do]` Establish UUID-based relational links across all tables.
96. `[To do]` Build `IdentityResolver` logic for Phone -> Contact mapping.
97. `[To do]` Integrate `Google People API` for contact sync.
98. `[To do]` Implement `Local Cache Check` before People API fetch.
99. `[To do]` Build "Lookup-then-Create" entity resolution pipeline.
100. `[To do]` Map `resourceName` from Google Contacts to Horizon Entities.
101. `[To do]` Implement `OrphanHandling`—automating 'New Lead' creation.
102. `[To do]` Build `RelationshipGraph` junction model (Typed links).
103. `[To do]` Promote `Organization` to a first-class table entity.
104. `[To do]` Implement `Touchpoint` normalization (Calls/Emails/Calendar).
105. `[To do]` Create `Tasks` table with direct `Touchpoint` referencing.
106. `[To do]` Build `Summary` field mapping (FastAPI -> Supabase).
107. `[To do]` Implement `Metadata` JSONB storage for raw duration/direction.
108. `[To do]` Create `DialogueJSON` schema for diarized transcripts.
109. `[To do]` Implement `Stage` field for customer journey tracking.
110. `[To do]` Implement `Bi-directional Sync` logic (Google -> Horizon).
111. `[To do]` Build manual override logic for enriched fields.
112. `[To do]` Implement `EntityAffiliation` model for organization members.
113. `[To do]` Create `Note` field mapping for ACR app feedback.
114. `[To do]` Build `StalenessIndices` for enrichment data refresh.
115. `[To do]` Setup `Full-text search` on transcripts in PostgreSQL.
116. `[To do]` Create `RelationshipWeight` aggregation views.
117. `[To do]` Implement `TagFrequency` tracking procedures.
118. `[To do]` Create `interaction_frequency` analytics view.
119. `[To do]` Implement `FollowUpBoss` logic mirror for stage mapping.
120. `[To do]` Build `EnrichmentJob` tracking table.
121. `[To do]` Build `TouchpointCategory` enum (Professional/Project/Family).
122. `[To do]` Implement `SyncLog` audit table for People API operations.
123. `[To do]` Build `OSINT Enrichment Pipeline` (6-stage architecture).
124. `[To do]` Implement `Reverse Phone Lookup` (NumVerify/Abstract).
125. `[To do]` Build `Email Enrichment` (Hunter.io/Apollo.io) service.
126. `[To do]` Implement `Organization Discovery` (Clearbit/LinkedIn Org).
127. `[To do]` Build `Social Discovery` (Cross-ref email/name to handles).
128. `[To do]` Implement `LinkedIn Profile Monitor` (Professional signals).
129. `[To do]` Build `X (Twitter) Bio Monitoring` and signal capture.
130. `[To do]` Build `SocialSignalFeed` component logic.
131. `[To do]` Create `EnrichmentJob` record schema in Supabase.
132. `[To do]` Build `DataStaleness` refresh logic (Dynamic intervals).
133. `[To do]` Build `EmployeeList` (LinkedIn-derived) organization view.
134. `[To do]` Implement `SocialSync` frequency monitoring.
135. `[To do]` Build `ConfidenceWeighted` field display logic.
136. `[To do]` Implement `DataAttribution` (Source tag for every field).
137. `[To do]` Build `OSINT Staleness` background job.
138. `[To do]` Build `EntityMerged` audit trail.
139. `[To do]` Build `SignalNormalization` layer for disparate social sources.
140. `[To do]` Implement `EntityRefiner` (Updating contact job/title from AI).
141. `[To do]` Create `IntelligenceSignals` extraction schema mapping.
142. `[To do]` Implement `CallCategory` classification schema.
143. `[To do]` Implement `Stage` automation based on touchpoint frequency.
144. `[To do]` Build `ContactHealth` weighting matrix.
145. `[To do]` Implement `LeadScoring` logic based on enrichment signals.
146. `[To do]` Build `OrganizationHierarchy` data model.
147. `[To do]` Implement `AttachmentManager` for call recording blobs.
148. `[To do]` Build `SyncFrequency` optimizer.
149. `[To do]` Finalize Stage 3 documentation (Relational Workflows).
150. `[To do]` Verification of Stage 3: End-to-end entity data flow.

---

### Stage 4: Testing, Proactive AI, Pre-production Checklists (71 items)
151. `[To do]` Implement `Faster-Whisper` transcription service.
152. `[To do]` Configure `tiny.en` model for local inference latency.
153. `[To do]` Implement `NeMo (TitaNet)` diarization service.
154. `[To do]` Build `Serial Task Queue` for VRAM-constrained hardware (M620).
155. `[To do]` Implement `FFmpeg` normalization pipeline (16kHz mono).
156. `[To do]` Build `Alignment Engine` (Whisper words + NeMo segments).
157. `[To do]` Integrate `Gemini (Zone 2)` for executive summarization.
158. `[To do]` Implement "Proactive Nudge" engine for follow-ups.
159. `[To do]` Build `CommitmentExtraction` prompt for action items.
160. `[To do]` Implement `ExecutiveBrief` generation (1-sentence).
161. `[To do]` Build `WeeklySummary` generation procedure.
162. `[To do]` Implement `SentimentAnalysis` scoring per call segment.
163. `[To do]` Build `RelationshipHealth` scoring algorithm.
164. `[To do]` Implement `StrategicConsultant` persona for call briefing.
165. `[To do]` Implement `FinancialAnalyst` persona for commercial calls.
166. `[To do]` Implement `MobileMech` persona for technical triage.
167. `[To do]` Configure `beam_size=5` for Whisper accuracy balance.
168. `[To do]` Implement `VAD (Voice Activity Detection)` parameter tuning.
169. `[To do]` Build `SpeakerAssignment` logic based on call direction.
170. `[To do]` Build "Ums/Ahs" cleanup post-processor (Gemini).
171. `[To do]` Implement `IdentityResolver` service wrapper.
172. `[To do]` Build prompt testing playground for relationship scoring.
173. `[To do]` Implement `DiarizationConfidence` thresholding.
174. `[To do]` Build `TranscriptionRetry` strategy for low-confidence files.
175. `[To do]` Implement `ActionItem` auto-scheduling logic.
176. `[To do]` Build `SummarizedParagraph` aggregation for activity.
177. `[To do]` Implement `RelationshipTrend` analyzer.
178. `[To do]` Build `ExecutiveBriefing` notification payload.
179. `[To do]` Implement `ComputeOffloading` (GPU -> CPU) for OOM protection.
180. `[To do]` Implement `TranscriptCasing` corrector (Gemini).
181. `[To do]` Implement `HealthScore` history tracking.
182. `[To do]` Build `ProactiveFollowUp` message drafter.
183. `[To do]` Create `ProcessingLab` persona definitions.
184. `[To do]` Implement `Field-level Encryption` for sensitive transcripts.
185. `[To do]` Setup `User-managed Keys` for relationship intelligence.
186. `[To do]` Implement `SignalClassification` (Role change/Product launch).
187. `[To do]` Implement `ReplyWithContext` (Gemini-suggested responses).
188. `[To do]` Implement `PrivacyGuard`—filtering sensitive PII from AI prompts.
189. `[To do]` Build `AuditLog` for encryption key usage.
190. `[To do]` Implement `SignalRelevance` classification (Gemini).
191. `[To do]` Build `ComplianceAudit` dashboard for encryption.
192. `[To do]` Implement `EncryptedSearch` procedure (Blind indexing).
193. `[To do]` Build `SignalTrigger` logic for follow-up nudges.
194. `[To do]` Build `EncryptedStorage` adapter for local backups.
195. `[To do]` Implement `GDPR/DSGVO` data export/delete handlers.
196. `[To do]` Implement `Anonymization` logic for external enrichment APIs.
197. `[To do]` Implement `SpamScore` thresholding for call ingestion.
198. `[To do]` Setup `pytest` suite for API endpoint validation.
199. `[To do]` Setup `MSW (Mock Service Worker)` for frontend testing.
200. `[To do]` Implement `ConfidenceScore` audit logging for AI.
201. `[To do]` Implement `SentimentTrend` calculation logic.
202. `[To do]` Verification of Stage 1: Local server availability.
203. `[To do]` Verification of Stage 2: Design system coverage analysis.
204. `[To do]` Verification of Stage 3: Integration testing of mapping logic.
205. `[To do]` Verification of Stage 4: Diarization accuracy audit.
206. `[To do]` Execution of Security penetration test.
207. `[To do]` Final Project Handover checklist.
208. `[To do]` Pre-production checklist: Vault encryption verification.
209. `[To do]` Pre-production checklist: API Rate limit verification.
210. `[To do]` Pre-production checklist: Cloud Run autoscaling verification.
211. `[To do]` Pre-production checklist: Supabase RLS audit.
212. `[To do]` Post-deployment: Relationship Health Score calibration.
213. `[To do]` Post-deployment: OSINT Signal noise reduction.
214. `[To do]` Post-deployment: Whisper model size optimization (Medium vs Tiny).
215. `[To do]` Build `UnitTests` for Pydantic models.
216. `[To do]` Build `IntegrationTests` for Webhook -> Supabase pipeline.
217. `[To do]` Build `LoadTests` for concurrent audio ingestion.
218. `[To do]` Build `SecurityAudits` for secret key exposure.
219. `[To do]` Build `EndToEndTests` for full call-to-brief lifecycle.
220. `[To do]` Build `A/B Tests` for Gemini summarization personas.
221. `[To do]` Final verification of all 221 requirements.
