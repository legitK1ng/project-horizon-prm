# Horizon PRM — Ingestion, Reconciliation & Intelligence Architecture
**Version:** 1.0  
**Addresses:** Correction Series Prompt 3 — Ingestion Fragmentation, Reconciliation Gap, LLM Capability  
**Companion Documents:** DESIGN_TOKENS.md, CONSTITUTION_PATCH.md  
**Last Updated:** 2026-06-13

---

## Preface

Three concerns are addressed here as a unified system because they are the same problem viewed from three angles. The ingestion paths are fragmented, so data arrives inconsistently. The reconciliation engine is absent, so arriving data is never promoted into structured knowledge. The onboard LLM is conversational-class only, so there is no intelligence layer capable of doing the extraction that reconciliation requires. Fixing one without the others produces no net gain.

This document defines the target architecture. It is prescriptive and specific enough to implement directly.

---

## Part 1 — Ingestion Method Inventory

### Current State

Five distinct ingestion paths exist across the project. None are visible from a single surface. Status varies by path:

| # | Method | Trigger | Current Status | Produces |
|---|---|---|---|---|
| 1 | ACR Webhook | ACR Phone POST on call end | Active — primary path | Audio file + metadata JSON |
| 2 | ACR WiFi Server | Manual — user initiates in browser | Unconnected — no UI | Audio files via HTTP |
| 3 | Local Folder Monitor | Scheduled or manual scan | Unimplemented | Audio files via filesystem |
| 4 | ACR .acr-backup Import | Manual file selection | Undocumented | Bulk audio archive |
| 5 | Direct Audio Drop | Manual — drag file to UI | Implied but unbuilt | Single audio file |

Methods 2–5 are either unbuilt or invisible. Users using ACR's WiFi Web Server feature (which serves recordings at `http://<phone-ip>:8000`) have no way to pull those recordings into Horizon without manually copying files. Method 3 would allow the Z2G3 to watch a network share or SMB mount continuously.

### Target State

All five methods are surfaced in a single **System** tab within Settings. Each method has its own status, last-activity indicator, and trigger control. The ingestion pipeline below each method is identical — the only difference is how audio files arrive.

---

## Part 2 — The Canonical Data Taxonomy

This defines every field that should exist per entity. Any data touch point that cannot produce a field directly should queue an enrichment task to fill it.

### Contact Entity — 28 Fields

| # | Field | Type | Source | Confidence Tier |
|---|---|---|---|---|
| 1 | `name_normalized` | string | Manual / Google Contacts / Transcript | High |
| 2 | `phone_e164` | string | Webhook metadata / Filename parse | High |
| 3 | `phone_carrier` | string | NumVerify / Carrier API | Medium |
| 4 | `phone_line_type` | enum: mobile/voip/landline | NumVerify | Medium |
| 5 | `phone_geo_region` | string | NumVerify / Phone prefix | Medium |
| 6 | `email` | string | Google Contacts / Transcript extract | Medium |
| 7 | `organization` | string | OSINT / Transcript extract | Medium |
| 8 | `job_title` | string | OSINT / Transcript extract | Medium |
| 9 | `linkedin_url` | string | OSINT enrichment | Medium |
| 10 | `twitter_handle` | string | OSINT enrichment | Low |
| 11 | `website` | string | OSINT enrichment | Low |
| 12 | `address` | string | Google Contacts / OSINT | Low |
| 13 | `photo_url` | string | Google Contacts / LinkedIn | Low |
| 14 | `birthday` | date | Google Contacts / Manual | Low |
| 15 | `relationship_health_score` | float 0–100 | Computed — decay model | Computed |
| 16 | `last_contact_at` | timestamp | Call records | Computed |
| 17 | `contact_frequency_30d` | int | Call records | Computed |
| 18 | `avg_sentiment_score` | float -1–1 | Aggregated from calls | Computed |
| 19 | `dominant_category` | enum | Aggregated from calls | Computed |
| 20 | `total_call_count` | int | Call records | Computed |
| 21 | `total_call_duration_seconds` | int | Call records | Computed |
| 22 | `open_commitments_count` | int | Extracted from calls | Computed |
| 23 | `osint_stage` | int 0–6 | OSINT pipeline progress | Tracked |
| 24 | `osint_confidence` | float 0–1 | Per-field confidence average | Computed |
| 25 | `data_completeness_score` | float 0–1 | Computed from filled fields | Computed |
| 26 | `enrichment_sources` | array | Provenance tracker | Tracked |
| 27 | `voice_profile_id` | uuid | Pyannote voice profile | Tracked |
| 28 | `embedding_id` | uuid | pgvector embedding ref | Tracked |

### Call Record — 26 Fields

| # | Field | Type | Source |
|---|---|---|---|
| 1 | `call_id` | uuid | System generated |
| 2 | `contact_id` | uuid | Resolved via phone_e164 lookup |
| 3 | `phone_number` | string | Webhook / filename / sidecar |
| 4 | `direction` | enum: in/out | Webhook metadata |
| 5 | `started_at` | timestamp | Webhook / filename parse |
| 6 | `duration_seconds` | int | Audio file length |
| 7 | `audio_path` | string | Ingestion |
| 8 | `ingestion_method` | enum | Which path delivered the file |
| 9 | `transcript` | encrypted text | Faster-Whisper |
| 10 | `diarized_segments` | json | Pyannote |
| 11 | `executive_brief` | string | Gemini Flash extraction |
| 12 | `sentiment` | enum: positive/neutral/negative | Gemini Flash extraction |
| 13 | `sentiment_score` | float -1–1 | Gemini Flash extraction |
| 14 | `action_items` | json array | Gemini Flash extraction |
| 15 | `commitments` | json array | Gemini Flash extraction |
| 16 | `follow_up_date` | date | Gemini Flash extraction |
| 17 | `draft_follow_up_message` | string | Gemini Flash generation |
| 18 | `auto_tags` | string array | Gemini Flash extraction |
| 19 | `category` | enum | Gemini Flash classification |
| 20 | `whisper_confidence` | float | Faster-Whisper output |
| 21 | `diarization_confidence` | float | Pyannote output |
| 22 | `speakers_resolved` | bool | Speaker-to-contact matched |
| 23 | `vector_embedding` | vector(768) | pgvector |
| 24 | `processing_status` | enum | Pipeline state machine |
| 25 | `retry_count` | int | Sentinel tracking |
| 26 | `encryption_iv` | string | AES encryption |

---

## Part 3 — Reconciliation Engine

### The Gap

Currently there is no reconciliation — there is only ingestion. Data arrives and is stored. Nothing compares incoming data against what already exists, nothing fills gaps, nothing improves confidence scores over time, and nothing detects that two records describe the same person.

### Design Principle

Every data write is a reconciliation event. The engine runs on every save, not just on demand. The question it answers for each field is: "Is this new value more reliable than what we already have?"

### Confidence Weighting

Each field in the database carries a companion `_provenance` JSON object:

```json
{
  "source": "osint_verified",
  "confidence": 0.85,
  "updated_at": "2026-06-04T14:23:00Z",
  "raw_value": "Acme Corporation Inc."
}
```

Source confidence tiers (used for merge decisions):

```python
CONFIDENCE_WEIGHTS = {
    'manual':                1.00,  # User typed it directly
    'google_contacts':       0.90,  # Verified by the user's address book
    'osint_verified':        0.85,  # LinkedIn/Clearbit verified match
    'webhook_metadata':      0.80,  # ACR Phone header data — authoritative for calls
    'transcript_extraction': 0.70,  # Gemini extracted from call content
    'filename_parse':        0.50,  # Extracted from the audio filename
    'llm_inference':         0.40,  # Inferred without direct evidence
}
```

**Merge rule:** A field is updated only when the incoming value's source confidence is strictly greater than the existing field's stored confidence. Manual entries (1.0) are never overwritten by any automated source.

### Reconciliation Pipeline

This runs in `services/reconciliation_service.py` as a method callable from any ingestion path:

```python
async def reconcile_contact(
    phone_e164: str,
    incoming_fields: dict,           # field_name → (value, source_type)
    db_client: SupabaseClient,
) -> ReconciliationResult:
    """
    1. IDENTIFY  — find existing contact by phone_e164
    2. COMPARE   — field-by-field confidence comparison
    3. MERGE     — apply higher-confidence updates only
    4. SCORE     — recompute completeness score
    5. ENRICH    — queue gaps for downstream enrichment
    6. VECTORIZE — regenerate embedding if name/org changed
    7. NOTIFY    — push Supabase realtime update to frontend
    """

    # Step 1: Identify
    existing = await db_client.table('contacts').select('*').eq(
        'phone_e164', phone_e164
    ).maybe_single().execute()

    if existing.data is None:
        # New contact — create with incoming data
        return await _create_contact(phone_e164, incoming_fields, db_client)

    # Step 2: Compare — collect fields where incoming confidence > existing
    updates = {}
    for field_name, (new_value, source_type) in incoming_fields.items():
        incoming_conf = CONFIDENCE_WEIGHTS.get(source_type, 0.3)
        existing_prov = existing.data.get(f'{field_name}__provenance', {})
        existing_conf = existing_prov.get('confidence', 0.0)

        if incoming_conf > existing_conf and new_value is not None:
            updates[field_name] = new_value
            updates[f'{field_name}__provenance'] = {
                'source': source_type,
                'confidence': incoming_conf,
                'updated_at': datetime.utcnow().isoformat(),
                'raw_value': new_value,
            }

    if not updates:
        return ReconciliationResult(contact_id=existing.data['id'], updated=False)

    # Step 3: Merge
    await db_client.table('contacts').update(updates).eq('id', existing.data['id']).execute()

    # Step 4: Score completeness
    updated_record = {**existing.data, **updates}
    completeness = _compute_completeness(updated_record)
    await db_client.table('contacts').update({
        'data_completeness_score': completeness,
        'updated_at': datetime.utcnow().isoformat(),
    }).eq('id', existing.data['id']).execute()

    # Step 5: Enrich gaps
    await _queue_enrichment_gaps(updated_record, db_client)

    # Step 6: Vectorize if identity fields changed
    if any(f in updates for f in ('name_normalized', 'organization', 'job_title')):
        await _regenerate_contact_embedding(existing.data['id'], updated_record, db_client)

    # Step 7: Notify (Supabase Realtime fires automatically on table update)
    return ReconciliationResult(
        contact_id=existing.data['id'],
        updated=True,
        fields_updated=list(updates.keys()),
        completeness=completeness,
    )
```

### Completeness Score Algorithm

```python
def _compute_completeness(record: dict) -> float:
    """
    Scores how complete a contact record is.
    
    Full credit (1.0 per field): field is set AND confidence >= 0.7
    Half credit (0.5 per field): field is set BUT confidence < 0.7
    Zero credit:                 field is null/empty
    """
    WEIGHTED_FIELDS = {
        # Core identity — max weight
        'name_normalized': 2.0,
        'phone_e164':      2.0,
        'email':           1.5,
        'organization':    1.5,
        'job_title':       1.0,
        # OSINT fields — standard weight
        'linkedin_url':    1.0,
        'phone_carrier':   0.5,
        'phone_line_type': 0.5,
        'phone_geo_region':0.5,
        'address':         0.5,
        # Relationship metrics — computed, always available
        'relationship_health_score': 1.0,
        'avg_sentiment_score':       1.0,
    }

    total_possible = sum(WEIGHTED_FIELDS.values())
    earned = 0.0

    for field, weight in WEIGHTED_FIELDS.items():
        value = record.get(field)
        prov = record.get(f'{field}__provenance', {})
        conf = prov.get('confidence', 0.0) if value else 0.0

        if value and conf >= 0.70:
            earned += weight
        elif value and conf > 0.0:
            earned += weight * 0.5

    return round(earned / total_possible, 3)
```

### Gap Detection and Enrichment Queue

After reconciliation, fields that are null or below confidence 0.5 are queued:

```python
async def _queue_enrichment_gaps(record: dict, db_client):
    """
    Queue missing high-value fields for OSINT enrichment.
    Only queues if not already in the enrichment queue.
    """
    GAP_ENRICHMENT_MAP = {
        'organization':  'osint_company_lookup',
        'job_title':     'osint_company_lookup',
        'linkedin_url':  'osint_linkedin_search',
        'email':         'osint_email_finder',
        'phone_carrier': 'carrier_lookup',
    }

    existing_queue = await db_client.table('enrichment_queue').select('task_type').eq(
        'contact_id', record['id']
    ).eq('status', 'pending').execute()
    already_queued = {r['task_type'] for r in existing_queue.data}

    for field, task_type in GAP_ENRICHMENT_MAP.items():
        value = record.get(field)
        prov = record.get(f'{field}__provenance', {})
        conf = prov.get('confidence', 0.0) if value else 0.0

        if (not value or conf < 0.5) and task_type not in already_queued:
            await db_client.table('enrichment_queue').insert({
                'contact_id': record['id'],
                'task_type': task_type,
                'priority': 'normal',
                'status': 'pending',
                'created_at': datetime.utcnow().isoformat(),
            }).execute()
```

### Calling Reconciliation from Every Ingestion Path

Every ingestion path — webhook, WiFi pull, folder scan, backup import — ends with the same two calls:

```python
# Pattern every ingestion handler follows:

# 1. Reconcile the contact first
result = await reconcile_contact(
    phone_e164=normalize_e164(phone_number),
    incoming_fields={
        'name_normalized': (contact_name, 'webhook_metadata'),
        'phone_e164':      (normalize_e164(phone_number), 'webhook_metadata'),
    },
    db_client=db,
)

# 2. Then create the call record linked to the resolved contact
await db.table('call_records').insert({
    'contact_id': result.contact_id,
    'phone_number': phone_number,
    'direction': direction,
    'ingestion_method': 'webhook',  # or 'wifi', 'folder', 'backup'
    ...
}).execute()

# 3. Then queue transcription
await transcription_manager.run_transcription(
    audio_path=audio_path,
    call_id=call_id,
    metadata=metadata,
)
```

---

## Part 4 — Vector and ML Integration

### Embedding Strategy

Every contact and call record has a vector embedding stored in pgvector. These serve three purposes:

**1. Deduplication — contact merge detection:**
When a contact's name or organization changes, regenerate its embedding and run:
```sql
SELECT id, name_normalized, organization,
       (embedding <=> $1::vector) AS distance
FROM contacts
WHERE id != $2
  AND (embedding <=> $1::vector) < 0.08
ORDER BY distance ASC
LIMIT 5;
```
Distance < 0.08 (cosine) surfaces a merge suggestion. The user approves or dismisses.

**2. Semantic call search:**
Call transcript embeddings allow "find all calls where we discussed pricing" to return relevant results even when the word "pricing" doesn't appear literally.

**3. Relationship similarity:**
"Show me contacts similar to [person]" using contact embedding proximity. Useful for finding warm intros.

### Generating Contact Embeddings

The contact embedding is generated from a structured text representation:
```python
def _contact_to_embed_string(record: dict) -> str:
    """Produces a canonical text representation for embedding."""
    parts = [
        record.get('name_normalized', ''),
        record.get('organization', ''),
        record.get('job_title', ''),
        record.get('phone_geo_region', ''),
        record.get('dominant_category', ''),
    ]
    return ' | '.join(p for p in parts if p)
```

Use Gemini's `text-embedding-004` model (768 dimensions, free tier available).

### Relationship Health Decay Model

The health score is a living number, not a snapshot. It decays with time since last contact and recovers with positive interaction:

```python
def compute_health_score(
    last_contact_days_ago: int,
    contact_frequency_90d: int,
    avg_sentiment: float,          # -1.0 to 1.0
    open_commitments: int,
) -> float:
    """
    Components:
    - Recency (40%):  logarithmic decay, half-life ~30 days
    - Frequency (30%): normalized against 4 calls/month baseline
    - Sentiment (20%): mapped from -1:1 to 0:1
    - Commitment drag (-10%): each open commitment reduces score
    """
    recency = max(0, 1 - (last_contact_days_ago / 90)) ** 1.5 * 40
    frequency = min(contact_frequency_90d / 12, 1.0) * 30
    sentiment = ((avg_sentiment + 1) / 2) * 20
    commitment_drag = min(open_commitments * 3, 10)

    raw = recency + frequency + sentiment - commitment_drag
    return max(0.0, min(100.0, round(raw, 1)))
```

### Transcript-Based Speaker Profile Matching

After diarization, `Speaker_00` and `Speaker_01` labels are matched to known contacts via voice profile ID stored in `contacts.voice_profile_id`. Over time, the system builds confidence that `Speaker_00` in calls from +15551234567 is always the user, and `Speaker_01` is the contact.

Once resolved: `call_records.speakers_resolved = true` and diarized_segments gain real names instead of labels. All historical calls from the same contact can be retroactively labeled.

---

## Part 5 — Intelligence Layer Upgrade

### The Problem with Kimi K2 for Structured Extraction

Kimi K2 is a conversational frontier model, routed through an Ollama cloud proxy. It is excellent at the Copilot chat interface — follow-up questions, planning, summarization. It is the wrong tool for structured extraction because:

1. It has no JSON schema enforcement. Extraction prompts return free-form text that requires regex parsing, which is brittle on production transcripts.
2. It is not grounded in Horizon's entity model. It does not know the 28-field contact taxonomy or the 26-field call taxonomy.
3. Each extraction call is a round-trip to a cloud proxy. For bulk reconciliation (35 calls after a WiFi sync), this creates a queue backlog.
4. Costs are unpredictable at scale.

Kimi K2 **stays** as the Copilot chat model. It is not replaced. A separate extraction model is added alongside it.

### Target: Structured Extraction Service

A new `StructuredExtractionService` wraps all extraction calls behind a single interface. It routes to the best available model:

```python
class StructuredExtractionService:
    """
    Routes extraction requests to the best available model.
    Priority: Gemini Flash (online) → Local Extraction Model (offline/fallback)
    
    Used for:
    - Call transcript → 26 structured fields
    - Contact OSINT → enrichment fields
    - Commitment extraction
    - Action item detection
    - Sentiment scoring
    """

    async def extract_call_fields(
        self, transcript: str, metadata: dict
    ) -> CallExtractionResult:
        """Returns all 26 structured call fields from a transcript."""
        schema = CALL_EXTRACTION_SCHEMA  # Pydantic model matching the 26-field taxonomy
        prompt = CALL_EXTRACTION_PROMPT.format(
            transcript=transcript,
            direction=metadata.get('direction', 'unknown'),
            duration=metadata.get('duration_seconds', 0),
        )
        return await self._run_extraction(prompt, schema)

    async def extract_contact_from_transcript(
        self, transcript: str, known_phone: str
    ) -> ContactExtractionResult:
        """Extracts organization, title, name corrections from call content."""
        schema = CONTACT_TRANSCRIPT_SCHEMA
        prompt = CONTACT_EXTRACTION_PROMPT.format(transcript=transcript)
        return await self._run_extraction(prompt, schema)

    async def _run_extraction(self, prompt: str, schema: BaseModel) -> BaseModel:
        """Route to Gemini Flash first, fall back to local model."""
        try:
            return await self._gemini_extract(prompt, schema)
        except Exception as e:
            logger.warning(f"Gemini extraction failed, falling back to local: {e}")
            return await self._local_extract(prompt, schema)
```

### Gemini Flash as the Extraction Engine

Gemini Flash (already integrated for brief generation) is promoted to the primary extraction model. It supports structured output via `response_mime_type: "application/json"` and `response_schema`, which eliminates regex parsing entirely:

```python
async def _gemini_extract(self, prompt: str, schema: BaseModel) -> BaseModel:
    response = await genai_client.generate_content_async(
        contents=prompt,
        generation_config=types.GenerationConfig(
            response_mime_type="application/json",
            response_schema=schema.model_json_schema(),
            temperature=0.1,           # Low temperature for extraction
            max_output_tokens=2048,
        ),
    )
    return schema.model_validate_json(response.text)
```

### Local Extraction Fallback

For offline use and bulk batch jobs, add a small Ollama model dedicated to extraction:

```bash
# Add to model roster — does NOT replace Kimi K2
ollama pull llama3.2:3b     # 2GB RAM, fast, adequate for structured extraction
```

Wire into the fallback path:
```python
async def _local_extract(self, prompt: str, schema: BaseModel) -> BaseModel:
    response = await httpx.AsyncClient().post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3.2:3b",
            "prompt": EXTRACTION_SYSTEM_PROMPT + "\n\n" + prompt,
            "stream": False,
            "format": "json",
        }
    )
    return schema.model_validate_json(response.json()['response'])
```

### Updated LLM Role Assignment

| Model | Role | Trigger |
|---|---|---|
| Gemini Flash | Structured extraction, brief generation, enrichment inference | All extraction tasks |
| Kimi K2 (Ollama) | Conversational Copilot chat | User chat interface only |
| llama3.2:3b (Ollama) | Local extraction fallback | Offline / Gemini unavailable |
| Gemini text-embedding-004 | Contact + call embeddings | Any record create/update |

---

## Part 6 — Implementation Roadmap

Apply in this order. Each step is independently deliverable.

**Step 1 — Reconciliation Engine (no UI changes)**
- Create `services/reconciliation_service.py` with the engine above
- Create `enrichment_queue` table in Supabase
- Add `__provenance` columns to `contacts` table
- Wire reconcile call into the existing webhook handler
- Test: a second call from the same number should update the contact, not create a duplicate

**Step 2 — Structured Extraction Service**
- Create `services/extraction_service.py`
- Define Pydantic extraction schemas for calls and contacts
- Move all Gemini calls in the transcription pipeline into this service
- Verify JSON schema output matches the 26-field call taxonomy

**Step 3 — WiFi Sync Backend Endpoint**
```
POST /api/v1/ingestion/wifi-sync
Body: { url: "http://192.168.40.117:8000" }
Response: SSE stream of progress events
```
- Connect to ACR WiFi server, list recordings
- Compare against `call_records` to find new files
- Download new files to the audio archive
- Run reconcile + transcription pipeline on each
- Push SSE events: `connecting`, `reconciling`, `downloading`, `transcribing`, `complete`

**Step 4 — Folder Monitor Backend Endpoint**
```
POST /api/v1/ingestion/folder-scan
Body: { path: "/abs/path/to/folder" }
```
- Scan directory for audio files matching known formats
- Compare against existing `call_records` by filename hash
- Queue new files for reconciliation + transcription

**Step 5 — Settings UI**
- Implement the System tab ingestion panel (see companion component)
- Wire to the two new endpoints with SSE progress display
- Reflect call count updates via Supabase Realtime subscription

**Step 6 — Vector + Deduplication**
- Add `embedding` vector(768) column to `contacts`
- Generate embeddings on first contact create and on identity field update
- Run deduplication check on every new contact creation
- Surface merge suggestions in the contact drawer

**Step 7 — Enrichment Queue Worker**
- Sentinel picks up `enrichment_queue` tasks on its background loop
- Each task type maps to an OSINT enrichment function
- Results feed back through `reconcile_contact()` with the appropriate source type

---

*End of INGESTION_RECONCILIATION_ARCHITECTURE.md*
