# KNOWLEDGE3: The "Entity Graph" Model (REQ-017)

## 1. MISSION & PHILOSOPHY

Project Horizon moves beyond a flat contact list into a **3-tier Relational Intelligence Model**. This allows the system to understand not just *who* a person is, but the *context* of their associations (Organizations, Referrals, Project Teams).

## 2. THE 3-TIER ARCHITECTURE

### Tier 1: Entities (The Master Truth)

Entities are unique, non-duplicative records representing people or organizations.

- **Profiles**: The user's own data and preferences.
- **Contacts (People)**: Core PII (Name, Phone, Email) + AI-derived traits.
- **Organizations**: Promoted to first-class entities. Stores headcount, industry, and domain.

### Tier 2: Relationships (Context & Strength)

Junction models that define the nature and "health" of links between Entities.

- **Relation Types**: `Employee`, `Client`, `Referral`, `Family`, `Partner`.
- **Strength Score**: A dynamic value (0-100) calculated by the **Health Engine**.
- **Contextual Metadata**: When and how the relationship started.

### Tier 3: Touchpoints (The Interaction Feed)

Immutable logs of every interaction, serving as the source of truth for the Relationship Engine.

- **Call Records**: Transcripts, sentiment, and `executive_brief` objects.
- **Digital signals**: (Future) Emails, Calendar events, and Social Signals (X/LinkedIn).

## 3. IDENTITY RESOLUTION PIPELINE (REQ-096, REQ-099)

The system uses a "Lookup-then-Create" strategy for incoming data (e.g., ACR Webhooks).

1. **Signal Inbound**: Phone number or Email detected.
2. **Local Cache Check**: Search `contacts` table for matching unique identifiers.
3. **External Sync (Google People API)**: If not found locally, fetch from Google Contacts.
4. **Orphan Handling**: If no match exists, create a "New Lead" entity with the raw identifier.
5. **Association logic**: Automatically link the Touchpoint to the Resolved Entity.

## 4. DATA SCHEMA (SUPABASE/POSTGRESQL)

| Table | Key Column | Description |
| :--- | :--- | :--- |
| `entities` | `id (UUID)` | Master record (Type: Individual/Org). |
| `relationships` | `from_id, to_id` | Junction table (Entity A -> Entity B). |
| `touchpoints` | `entity_id` | Interaction log (Link to Entity). |
| `enriched_data` | `entity_id` | JSONB blob of OSINT signals. |

## 5. INTELLIGENCE SCORING (REQ-017, REQ-036)

**Relationship Health Score** is calculated as a weighted composite:

- **Recency (40%)**: Decay over 30/60/90 days of silence.
- **Frequency (30%)**: Volume of touchpoints in the rolling 30-day window.
- **Sentiment (30%)**: AI-derived trend from the last 5 transcripts.

---

### Meta

*Status: Synthesized | Integrated with health_service.py*
