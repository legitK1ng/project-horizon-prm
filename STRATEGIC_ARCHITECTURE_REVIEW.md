# STRATEGIC ARCHITECTURE REVIEW

## Horizon PRM

*Relationship Intelligence Platform · Topology v1*

Prepared by: Senior Product Architect & UX Strategist

|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| **EXECUTIVE SUMMARY** Horizon PRM has a solid conceptual foundation: real-time call ingestion, AI-powered briefing, and a clean React frontend. However, the platform is currently constrained by an architecture that will not scale — Google Apps Script as a backend, Google Sheets as a database, and a frontend that lacks a unified design system. This review identifies the critical pivots and high-impact improvements needed to evolve Horizon PRM into a premium Relationship Intelligence Platform competitive with enterprise CRM tools. |

-----

## 01 · Current State Scorecard

| **Dimension**                     | **Score**  | **Key Observation**                                                                                |
| :-------------------------------: | :--------: | :------------------------------------------------------------------------------------------------: |
| **UX / Interface Design**         | **6 / 10** | Strong component structure; lacks premium visual layer and unified design system.                  |
| **System Architecture**           | **5 / 10** | Google Apps Script is functional but not scalable; Google Sheets as a DB is a critical bottleneck. |
| **Data Model Completeness**       | **5 / 10** | Core types are solid; missing enrichment, relationship graph, and multi-channel identity models.   |
| **AI Integration Depth**          | **6 / 10** | Gemini is used for call summarization; no proactive intelligence, scoring, or trend analysis.      |
| **Social Platform Readiness**     | **2 / 10** | No social integration architecture exists today.                                                   |
| **Scalability & Future-Proofing** | **4 / 10** | Tightly coupled to Google ecosystem; needs decoupling for long-term independence.                  |

## 02 · User Experience & Interface

The frontend module graph reveals a well-structured React application with lazy-loaded views, a command palette, and drawer-based contact interactions. These are strong foundations. However, several UX patterns must evolve to reach premium-tier experience.

### 2.1 · Unified Design System

Currently there is no evidence of a design token system or consistent visual language. A premium PRM needs a design system as its backbone.

  * Implement a **design token layer** (spacing, color, typography, radius, shadows) as a single source of truth — consumable by both Tailwind and component styles.
  * Introduce a **component library** (e.g., shadcn/ui or Radix) that enforces visual consistency across ContactDrawer, EditModal, HoverCard, and all views.
  * Establish a dark/light mode contract via CSS custom properties rather than hardcoded values — the existing `useTheme` hook is a good start but needs a systematic foundation.

### 2.2 · Dashboard Intelligence Layer

The Dashboard is currently a view, not an intelligence surface. It should become the user's 'relationship command center'.

  * Replace static card summaries with a dynamic Relationship Health Score per contact — derived from recency, frequency, and sentiment trend.
  * Introduce a 'Needs Attention' panel: contacts that haven't been reached in 14/30/60 days, surfaced proactively without the user searching.
  * Add an AI-generated 'Weekly Digest' — a single summarized paragraph of relationship activity across all contacts, powered by Gemini.
  * Include sparkline trend charts on the dashboard for call volume, sentiment trends, and tag frequency — small, dense data visualizations that communicate momentum at a glance.

### 2.3 · Contact Detail Experience

The ContactDrawer + ContactDetailDrawer architecture is sound but needs enrichment surface integration.

  * Consolidate ContactDrawer and ContactDetailDrawer into a single, tabbed full-panel view with tabs for: Overview, Timeline, Enrichment, Notes, and Actions.
  * The Timeline tab should render a scrollable, chronological feed of every interaction: calls, calendar events, and imported social signals — inspired by linear activity feeds in tools like Linear or Notion.
  * The Enrichment tab should display OSINT-derived data (see Section 04) in structured cards: professional profile, social handles, org intel, and location data — with clear data-source attribution and staleness indicators.

### 2.4 · Command Palette as Power Interface

The CommandPalette component already exists — this is an exceptional foundation that most PRM tools lack. It should be elevated to a core power-user feature.

  * Extend CommandPalette with semantic search: 'Find everyone at Acme Corp I spoke to last month', 'Show calls with negative sentiment'.
  * Add quick actions: 'Log a call', 'Tag contact', 'Schedule follow-up', 'Run enrichment on \[contact\]' — all accessible in \< 3 keystrokes.
  * Persist recent searches and command history using HistoryContext, giving power users the feel of a persistent workspace.

## 03 · System Architecture Pivots

The current architecture uses Google Apps Script (GAS) as a backend with Google Sheets as the primary database. This is the single most critical constraint on the platform's future. It limits throughput, concurrency, query capability, and integration surface area.

### 3.1 · Critical Pivot — Migrate Backend Off Google Apps Script

| **Current State**                                                                                                                                                                                                                                                             | **Target State**                                                                                                                                                                                                                                                      |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| \- Google Apps Script: 6-minute execution limit, no concurrency<br>\- Google Sheets as DB: no indexing, no relational queries, no joins<br>\- Single doGet/doPost endpoint: no RESTful resource design<br>\- Secrets in Secret Manager accessed per-call: unnecessary latency | \- Node.js / Python backend on Cloud Run or Railway<br>\- PostgreSQL (via Supabase or Neon) for relational contact + call data<br>\- RESTful API with resource-based routing: /contacts, /calls, /enrichments<br>\- Environment-based secret injection at deploy time |

This migration is not optional for a production-grade PRM. The Google Sheets database is a ceiling that will be hit within months of real usage. A PostgreSQL schema unlocks full-text search, relationship graphs, aggregation queries, and proper indexing — all of which feed directly into the AI and enrichment features described in this document.

### 3.2 · Data Model Expansion

The current type system is call-centric. The platform needs an Entity-centric data model that treats contacts, organizations, and relationships as first-class citizens.

  * Introduce an **Entity model**: a unified identity record that links a contact to their email addresses, phone numbers, social handles, and organization affiliations — with confidence scores per field.
  * Add a **Relationship Graph**: a junction model connecting entities through typed relationships (colleague, client, referral, family) with weight derived from interaction frequency.
  * Promote **Organization** to its own top-level model — currently buried as a string field on Contact. Organizations should have their own enrichment records, associated contacts, and timeline.
  * Add a Touchpoint model that normalizes interactions across channels: calls, emails, calendar events, social DMs — enabling cross-channel timeline views.

### 3.3 · Backend Service Decomposition

The single `Code.gs` file currently handles HTTP routing, Gemini calls, People API sync, and sheet operations. As the platform grows, this monolith will become unmaintainable.

  * Decompose into discrete services: Ingestion Service (ACR webhook), Enrichment Service (OSINT pipeline), AI Briefing Service (Gemini), Sync Service (Google People / Calendar), and a Query API (read layer for frontend).
  * Use a message queue (Cloud Tasks or Bull/BullMQ) for asynchronous enrichment jobs — replacing the current time-driven trigger with an event-driven architecture.
  * The `processQueue()` pattern is already an embryonic job queue — formalize it as a proper queue consumer with retry logic, dead-letter handling, and status tracking.

### 3.4 · Frontend Architecture Improvements

The React frontend is well-structured with lazy loading, context providers, and a service abstraction layer. These targeted improvements will scale it to production quality.

  * Replace the monolithic **`useData` hook** with React Query (TanStack Query): automatic caching, background refetching, optimistic updates, and cache invalidation — without manual state management.
  * Introduce an API client layer with Zod schema validation at the boundary — ensuring runtime type safety when consuming the backend, not just compile-time TypeScript checks.
  * Move `mockData` from a service into a dedicated test fixture layer (MSW / Mock Service Worker) to prevent mock bleed into production builds.
  * The `geminiService` currently lives in the frontend — this is a security risk (API keys) and an architectural concern. Gemini calls must route through the backend exclusively.

## 04 · OSINT Enrichment Pipeline

This is the most differentiating feature on the product roadmap. An automated enrichment engine transforms Horizon PRM from a call logger into a genuine intelligence platform. The following architecture is recommended.

### 4.1 · Enrichment Pipeline Architecture

| **Stage** | **Trigger / Source**                                                         | **Output**                                                                  |
| :-------: | :--------------------------------------------------------------------------: | :-------------------------------------------------------------------------: |
| **1**     | Entity Detection — new contact / phone / email / org triggers enrichment job | EnrichmentJob record created with status PENDING                            |
| **2**     | Phone enrichment — reverse phone lookup via NumVerify / abstract API         | Carrier, line type, geo region, validity                                    |
| **3**     | Email enrichment — Hunter.io / Clearbit / Apollo.io for professional profile | Name, title, employer, social handles, confidence score                     |
| **4**     | Organization enrichment — Clearbit Company / OpenCorporates / LinkedIn Org   | Industry, size, funding, website, key people                                |
| **5**     | Social discovery — cross-reference email/name to social profiles             | LinkedIn URL, X handle, photo, bio, location                                |
| **6**     | AI synthesis — Gemini summarizes all enrichment data into a contact brief    | 'Who is this person' narrative: background, interests, relationship context |

Each enrichment stage must run asynchronously, be individually retriable, and store results with a timestamp and source attribution. The frontend should display enrichment confidence (High / Medium / Low) and allow the user to manually override any enriched field.

### 4.2 · Entity-Type Enrichment Surface in UI

The enrichment results must be surfaced cleanly in the contact detail panel. The following entity types each require a tailored display card:

  * **Person Card:** Avatar, name, title, org, social icons with links, bio snippet, location, enrichment staleness badge.
  * **Phone Card:** Number, carrier, line type (mobile/VoIP/landline), country, validity status, spam score if available.
  * **Email Card:** Address, deliverability score, domain reputation, professional vs. personal classification.
  * **Organization Card:** Company name, logo, industry, headcount range, funding stage, website, associated contacts within PRM.
  * **Location Card:** City, region, timezone (critical for scheduling awareness), country flag, map thumbnail.

## 05 · Social Platform Integration

Social integration is the next frontier for a PRM. The goal is not mirroring social networks — it is signal capture: understanding what is happening in a contact's professional and personal life to enable more meaningful interactions.

### 5.1 · Integration Architecture

Each platform has fundamentally different API posture, rate limits, and privacy constraints. A tiered approach is recommended:

| **Platform**        | **API Access**         | **Direction**  | **PRM Use Case**                                                                               |
| :-----------------: | :--------------------: | :------------: | :--------------------------------------------------------------------------------------------: |
| **LinkedIn**        | OAuth 2.0 (limited)    | Read + Write\* | Import professional profile, title, org, connect date. \*Post InMail via API (Partner only).   |
| **Google Contacts** | People API (active)    | Bi-directional | Full sync already partially implemented — expand to photo, birthday, notes, and custom fields. |
| **X / Twitter**     | v2 API (Basic)         | Read-only      | Monitor public mentions, profile bio changes, recent posts as relationship signals.            |
| **Instagram**       | Graph API              | Read-only      | Business profile data only. Personal profiles require user-granted permission.                 |
| **Facebook**        | Graph API (restricted) | Read-only      | Very limited — mutual friends, page follows. Not recommended as primary integration.           |

Note: LinkedIn's official API is heavily restricted for non-partner apps. For personal use, profile data enrichment via the OSINT pipeline (Stage 5 in Section 4) is the more pragmatic approach in the near term.

### 5.2 · Social Signal Feed

Rather than simply importing contact data, the platform should implement a Social Signal Feed — a curated stream of activity from connected contacts that surfaces in the Timeline view.

  * Capture public LinkedIn activity (posts, role changes, company announcements) via profile monitoring.
  * Surface X/Twitter posts from followed contacts as lightweight signals in the contact timeline.
  * Use Gemini to classify social signals by relevance: role change, product launch, life event, thought leadership — enabling the user to respond with context.
  * 'Reply with context' feature: when a contact posts about a topic, Gemini suggests a personalized response referencing your shared history.

## 06 · Strategic Pivots & Future-Proofing

### 6.1 · The Five Critical Pivots

|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| **01** **Migrate to a Real Backend (Cloud Run + PostgreSQL)** **● Critical** *Impact: Foundational* \[Architecture\]\[Database\]\[Scalability\]Google Apps Script / Sheets is a proof-of-concept stack. Migrating to a proper backend (Node.js/Python on Cloud Run, Railway, or Fly.io) with PostgreSQL unlocks everything else in this document — enrichment pipelines, relationship graphs, social integrations, and real-time capabilities. This is the single highest-priority architectural decision.                                                                             |
| **02** **Relationship Intelligence Engine (Graph + Scoring)** **● High** *Impact: Competitive Differentiation* \[AI\]\[Graph\]\[UX\]Introduce a Relationship Strength Score for every contact — a composite metric derived from: interaction recency, call frequency, sentiment trend, and response latency. Surface this score on every contact card. Add a Relationship Graph visualization showing how contacts are interconnected through shared organizations, call history, and co-mentions in transcripts. This transforms the PRM from a log into an intelligence layer.       |
| **03** **Proactive AI Nudges & Smart Follow-Up Engine** **● High** *Impact: User Retention* \[AI\]\[Gemini\]\[Engagement\]Shift Gemini's role from reactive summarization to proactive intelligence. After each call brief is generated, the AI should produce: a recommended follow-up date, a draft follow-up message, a list of open commitments extracted from the transcript, and alerts when a commitment is approaching its deadline. This creates a habit loop that makes Horizon PRM indispensable to the user's workflow.                                                    |
| **04** **End-to-End Encryption for Sensitive Contact & Call Data** **● Critical** *Impact: Trust & Compliance* \[Security\]\[Privacy\]\[Compliance\]Call transcripts contain deeply sensitive relationship intelligence. The platform must introduce field-level encryption for transcript content, enrichment results, and strategic notes — with keys managed per-user. This is not a feature; it is a trust prerequisite for any serious professional using the platform. Without it, the PRM cannot be recommended to users in regulated industries (finance, legal, healthcare).  |
| **05** **Lab as a Staging Ground for Intelligence Features** **● Medium** *Impact: Innovation Velocity* \[Developer Experience\]\[Innovation\]The existing Lab view is a hidden gem — it is already a developer console for testing integrations. Evolve it into a full Intelligence Workbench: a sandboxed environment where the user can test Gemini prompts against real contacts, preview enrichment results before they go live, and experiment with scoring models. This dramatically accelerates feature development and gives power users a sense of control and co-ownership. |

## 07 · Recommended Implementation Roadmap

| **Phase**   | **Timeline**                    | **Deliverables**                                                                                                                                                                                             |
| :---------: | :-----------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| **Phase 1** | Weeks 1–4 (Foundation)          | Migrate backend to Cloud Run + PostgreSQL. Implement RESTful API with `/contacts`, `/calls`, `/jobs` resources. Port all existing Google Sheets data. Establish Zod schema validation on frontend API layer. |
| **Phase 2** | Weeks 5–8 (Design System)       | Build unified design token system. Consolidate ContactDrawer into tabbed panel. Implement React Query for all data fetching. Upgrade Dashboard with Relationship Health Scores and Needs Attention panel.    |
| **Phase 3** | Weeks 9–14 (Enrichment)         | Build asynchronous OSINT enrichment pipeline (phone, email, org, social). Surface enrichment in Contact Enrichment tab with confidence scores. Add enrichment status indicators throughout UI.               |
| **Phase 4** | Weeks 15–20 (Intelligence)      | Launch proactive AI nudge engine. Implement Relationship Graph model and visualization. Add Smart Follow-Up drafting. Extend CommandPalette with semantic search.                                            |
| **Phase 5** | Weeks 21–26 (Social + Security) | Integrate Google People bi-directional sync (full field set). Add LinkedIn and X profile monitoring via OSINT. Implement field-level encryption for transcripts and enrichment data.                         |

**Horizon PRM has the ingredients of a remarkable platform.**

*The path from call logger to Relationship Intelligence Platform is clear.*

*Execute the five critical pivots in this review and Horizon will stand apart.*
