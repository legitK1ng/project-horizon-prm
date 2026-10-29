# Horizon PRM — Contact Intelligence & Obsidian Integration Architecture
**Version:** 1.0  
**Correction Series:** Prompt 4  
**Companion Documents:** INGESTION_RECONCILIATION_ARCHITECTURE.md, CONSTITUTION_PATCH.md, DESIGN_TOKENS.md  
**Last Updated:** June 2026

---

## Preface

This document addresses four interconnected concerns raised after the prior architecture was set:

1. Calls carry more structured intelligence than is being extracted — sentiment, dates, commitments, named projects, and voice identity are all latent in every recording
2. There is no unified view of a person across touchpoint types (calls, emails, MMS, files)
3. The timeline UI spec for the contact drawer and the full-page contact view is undefined
4. Obsidian, as a mature knowledge management layer with LLM tool support, can serve as the file and note management system — eliminating the need to build that infrastructure from scratch

Where this document conflicts with prior documents, this document is authoritative on all matters specific to contact intelligence, voice profiles, the touchpoint model, the timeline, and the Obsidian layer. It amends, not replaces, the ingestion and reconciliation architecture.

---

## Part 1 — Intelligence Extraction Expansion

### What Calls Actually Contain

Every call that passes through the Horizon pipeline contains more structured intelligence than is currently extracted. The existing pipeline extracts: executive brief, sentiment, action items, tags, category. The full extractable payload is larger:

| Intelligence Type | Example | Current Status |
|---|---|---|
| Executive brief | "Discussed Q3 contract renewal" | ✅ Extracted |
| Sentiment | Positive / Neutral / Negative | ✅ Extracted |
| Action items | "Send proposal by Friday" | ✅ Extracted |
| Tags / category | Professional, Finance | ✅ Extracted |
| Explicit dates | "June 15", "next quarter", "end of month" | ❌ Not extracted |
| Commitments with parties | "Sarah will send the term sheet" | ❌ Not extracted |
| Named projects or deals | "the Atlas deal", "Project Meridian" | ❌ Not extracted |
| People mentioned (third parties) | "I'll loop in Marcus from legal" | ❌ Not extracted |
| Requirements and obligations | "they need the final report before Q3 close" | ❌ Not extracted |
| Voice segments (key statements) | Speaker + timestamp + quote | ❌ Not stored |
| Follow-up draft message | Ready-to-send text based on call outcome | ❌ Not generated |

### Expanded Extraction Schema

The `StructuredExtractionService` introduced in the prior architecture document is expanded with this schema:

```python
class FullCallExtractionResult(BaseModel):
    # Existing fields
    executive_brief: str                    # One sentence
    sentiment: Literal["positive", "neutral", "negative"]
    sentiment_score: float                  # -1.0 to 1.0
    action_items: list[str]                 # Tasks for the user
    tags: list[str]
    category: Literal["Professional", "Personal", "Family", "Unknown"]

    # New fields
    extracted_dates: list[ExtractedDate]    # All date references in call
    commitments: list[Commitment]           # Named parties + obligations
    mentioned_projects: list[str]           # Deal/project names mentioned
    mentioned_third_parties: list[str]      # Other people referenced by name
    requirements: list[str]                 # Things required of either party
    key_statements: list[KeyStatement]      # Most important quotes, with speaker
    follow_up_draft: str                    # Ready-to-send message to this contact
    follow_up_date: Optional[str]           # When to follow up (ISO date or description)
    call_topics: list[str]                  # High-level subjects discussed


class ExtractedDate(BaseModel):
    raw: str                                # "next Friday", "June 15", "end of Q3"
    iso: Optional[str]                      # Resolved to ISO date where possible
    context: str                            # Sentence it appeared in
    type: Literal["deadline", "meeting", "event", "vague"]


class Commitment(BaseModel):
    party: Literal["user", "contact", "third_party"]
    party_name: Optional[str]               # Name if third_party
    obligation: str                         # What they committed to
    deadline: Optional[str]                 # When, if mentioned
    is_open: bool                           # Not yet marked done


class KeyStatement(BaseModel):
    speaker: Literal["user", "contact"]
    quote: str                              # Verbatim quote from transcript
    timestamp_seconds: Optional[int]        # Position in audio
    significance: str                       # Why this is notable
```

### Project Auto-Creation Logic

A project is created or linked when a call meets one or more trigger conditions:

```python
PROJECT_TRIGGERS = {
    "explicit_mention":   1,   # Transcript contains "the X project" / "deal Y" / "initiative Z"
    "recurring_topic":    1,   # Same key term appeared in a prior call with this contact
    "commitment_cluster": 1,   # 3+ commitments in a single call (indicates structured work)
    "date_cluster":       1,   # 3+ named dates (indicates a phased timeline)
}

# Project is created/linked when any trigger fires.
# If trigger score >= 2: auto-create without user prompt.
# If trigger score == 1: surface suggestion in the nudge shelf.
```

```python
async def evaluate_project_signals(
    call_result: FullCallExtractionResult,
    contact_id: str,
    db_client,
) -> list[ProjectAction]:
    """
    Evaluate extraction result for project signals.
    Returns list of actions: create_project, link_project, or suggest_project.
    """
    actions = []

    for project_name in call_result.mentioned_projects:
        # Check if project already exists (by name + embedding similarity)
        existing = await _find_project_by_name_or_similarity(project_name, db_client)

        if existing:
            # Link this call to the existing project
            actions.append(ProjectAction(
                type="link_project",
                project_id=existing["id"],
                call_id=call_result.call_id,
            ))
        else:
            trigger_score = 1  # "explicit_mention" fires by definition here
            trigger_score += await _count_prior_mentions(project_name, contact_id, db_client)

            if trigger_score >= 2:
                actions.append(ProjectAction(
                    type="create_project",
                    name=project_name,
                    contacts=[contact_id],
                    tasks=call_result.action_items,
                    dates=call_result.extracted_dates,
                    source_call_id=call_result.call_id,
                ))
            else:
                actions.append(ProjectAction(
                    type="suggest_project",
                    name=project_name,
                    source_call_id=call_result.call_id,
                ))

    return actions
```

### Date Extraction → Task and Calendar Items

Extracted dates route to tasks or calendar entries based on type:

| Date Type | Destination | Example |
|---|---|---|
| `deadline` | Task with due date | "send the proposal by June 15" → task, due June 15 |
| `meeting` | Calendar event suggestion | "let's talk Thursday at 2" → calendar suggestion |
| `event` | Calendar event | "the conference is June 20–22" → calendar event |
| `vague` | Stored on call record only | "sometime next month" → not actioned, just stored |

---

## Part 2 — Voice Profile Management

### The Problem

Pyannote outputs `Speaker_00` and `Speaker_01`. Today these labels persist in the transcript. There is no system that says "this voice pattern belongs to Sarah Chen." After processing a hundred calls, the system should know every contact's voice — and should retroactively label older transcripts.

### Voice Profile Database

```sql
-- New table: voice_profiles
CREATE TABLE voice_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID REFERENCES contacts(id),
    embedding       vector(512),        -- Pyannote speaker embedding
    sample_call_id  UUID,               -- Call this profile was derived from
    confidence      FLOAT,              -- How reliable is this profile (0–1)
    created_at      TIMESTAMPTZ DEFAULT now(),
    verified        BOOLEAN DEFAULT false -- User confirmed this is the right person
);

-- Contacts table: add voice profile link
ALTER TABLE contacts ADD COLUMN primary_voice_profile_id UUID REFERENCES voice_profiles(id);
```

### Speaker Resolution Pipeline

```python
async def resolve_speakers(
    diarized_segments: list[DiarizedSegment],
    call_metadata: dict,
    db_client,
) -> list[DiarizedSegment]:
    """
    Replace Speaker_00/Speaker_01 labels with actual names.
    
    Logic:
    1. Speaker determined by call direction (outgoing: Speaker_00 = user)
    2. Contact speaker: look up voice_profiles for this phone number
    3. If profile match found (cosine distance < 0.12): label as contact name
    4. If no profile: create new voice profile from this call's speaker embedding
    5. Mark call.speakers_resolved = True when both speakers are identified
    """
    direction = call_metadata.get("direction", "outgoing")
    phone_e164 = call_metadata.get("phone_e164")

    # User is always known
    user_speaker_id = "Speaker_00" if direction == "outgoing" else "Speaker_01"
    contact_speaker_id = "Speaker_01" if direction == "outgoing" else "Speaker_00"

    # Look up contact's voice profile
    contact = await db_client.table("contacts").select("*, primary_voice_profile_id").eq(
        "phone_e164", phone_e164
    ).maybe_single().execute()

    resolved = {}
    resolved[user_speaker_id] = "You"

    if contact.data and contact.data.get("primary_voice_profile_id"):
        # Known contact with voice profile — label directly
        resolved[contact_speaker_id] = contact.data["name_normalized"]
    else:
        # Unknown or unverified — label by contact name, create profile
        name = contact.data["name_normalized"] if contact.data else "Unknown"
        resolved[contact_speaker_id] = name
        # Extract and store voice embedding from this call's segments
        await _create_voice_profile(
            contact_id=contact.data["id"] if contact.data else None,
            segments=[s for s in diarized_segments if s.speaker == contact_speaker_id],
            call_id=call_metadata["call_id"],
            db_client=db_client,
        )

    # Apply labels to all segments
    for seg in diarized_segments:
        seg.speaker_name = resolved.get(seg.speaker, seg.speaker)

    return diarized_segments
```

### Retroactive Labeling

When a voice profile is manually confirmed (user taps "This is Sarah" on an unlabeled transcript), a background job re-labels all previous calls from the same contact:

```python
async def retroactive_speaker_relabel(contact_id: str, db_client):
    """
    After a voice profile is confirmed, relabel all previous calls from this contact.
    Only affects calls where speakers_resolved = false.
    """
    calls = await db_client.table("call_records").select("id, diarized_segments").eq(
        "contact_id", contact_id
    ).eq("speakers_resolved", False).execute()

    for call in calls.data:
        updated_segments = _apply_name_labels(call["diarized_segments"], contact_id)
        await db_client.table("call_records").update({
            "diarized_segments": updated_segments,
            "speakers_resolved": True,
        }).eq("id", call["id"]).execute()
```

---

## Part 3 — Unified Contact Touchpoint Model

### Current State

Only calls exist as discrete touchpoints. Emails, MMS, and files are referenced in the Obsidian layer but not tracked as structured records in Supabase.

### New: `touchpoints` Table

A unified table for every interaction type with a contact:

```sql
CREATE TABLE touchpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID NOT NULL REFERENCES contacts(id),
    type            TEXT NOT NULL,        -- 'call' | 'email' | 'mms' | 'media' | 'file' | 'note'
    occurred_at     TIMESTAMPTZ NOT NULL, -- When this happened
    direction       TEXT,                 -- 'incoming' | 'outgoing' | null for symmetric
    subject         TEXT,                 -- Email subject / file name / call brief
    preview         TEXT,                 -- First ~200 chars of content
    sentiment       TEXT,                 -- If extractable
    call_record_id  UUID REFERENCES call_records(id),  -- If type='call'
    attachments     JSONB,                -- [{name, size, mime, url, obsidian_path}]
    metadata        JSONB,                -- Type-specific data
    obsidian_path   TEXT,                 -- Link into Obsidian vault
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for fast timeline queries
CREATE INDEX idx_touchpoints_contact_time ON touchpoints(contact_id, occurred_at DESC);
```

### Touchpoint Type Specifications

**Call touchpoints** are created automatically when `call_records` status → COMPLETED:
```python
await db.table("touchpoints").insert({
    "contact_id": call.contact_id,
    "type": "call",
    "occurred_at": call.started_at,
    "direction": call.direction,
    "subject": brief.executive_brief,
    "preview": brief.summary,
    "sentiment": brief.sentiment,
    "call_record_id": call.id,
    "metadata": {
        "duration_seconds": call.duration_seconds,
        "speakers_resolved": call.speakers_resolved,
        "action_item_count": len(brief.action_items),
        "mentioned_projects": brief.mentioned_projects,
    },
    "obsidian_path": f"Contacts/{contact.name_normalized}/Calls/{call.started_at:%Y-%m-%d}.md",
})
```

**Email touchpoints** require Gmail/Outlook integration (Phase 2). Schema placeholder defined now so the frontend timeline can be built generically:
```python
# metadata for type='email':
{
    "from": "sender@domain.com",
    "to": ["recipient@domain.com"],
    "message_id": "gmail-message-id",
    "thread_id": "gmail-thread-id",
    "label_ids": ["INBOX"],
    "has_attachments": True,
}
```

**MMS/Media touchpoints** sourced from ACR Phone's media data or Google Photos sync:
```python
# metadata for type='mms' or 'media':
{
    "media_count": 3,
    "media_types": ["image/jpeg", "video/mp4"],
    "thumbnail_paths": ["path1", "path2", "path3"],
    "carrier_message_id": "...",
}
```

**File touchpoints** created when any file is associated with a contact (email attachment, manual upload, backup import):
```python
# metadata for type='file':
{
    "filename": "Contract_v3.pdf",
    "size_bytes": 327680,
    "mime_type": "application/pdf",
    "source": "email_attachment",   # or 'manual_upload', 'acr_backup', 'mms'
    "storage_path": "/vault/Files/...",
    "obsidian_path": "Files/Contracts/...",
}
```

---

## Part 4 — Contact Timeline Specification

### Data Model for Timeline Queries

The contact timeline is a time-ordered list of touchpoints with optional nested detail:

```typescript
interface TimelineQuery {
  contact_id: string;
  types?: ('call' | 'email' | 'mms' | 'media' | 'file' | 'note')[];
  after?: string;   // ISO date
  before?: string;  // ISO date
  limit?: number;   // default 50
  cursor?: string;  // for pagination
}

interface TimelineEvent {
  id: string;
  type: string;
  occurred_at: string;
  direction?: string;
  subject: string;
  preview?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  attachments?: Attachment[];
  metadata: Record<string, unknown>;
  call_detail?: CallRecord;      // Populated if type='call' and expanded
  obsidian_path?: string;
}
```

```sql
-- Timeline query (backend):
SELECT t.*,
       cr.duration_seconds,
       cr.diarized_segments,
       cr.executive_brief,
       cr.action_items,
       cr.speakers_resolved
FROM touchpoints t
LEFT JOIN call_records cr ON t.call_record_id = cr.id
WHERE t.contact_id = $1
  AND ($2::text[] IS NULL OR t.type = ANY($2))
ORDER BY t.occurred_at DESC
LIMIT $3;
```

### View A: Full-Page Vertical Timeline (Outside Contact Drawer)

**Route:** `/contacts/:id/timeline`  
**Trigger:** Clicking a contact name from the main contact list (not "View profile" in drawer)

**Layout:**
```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   [Photo] Sarah Chen                    Health Ring [84]  │
│          Managing Director · Nexus Capital Partners              │
│          +1 (415) 555-0192 · Last contact: 2 days ago            │
├──────────────────────────────────────────────────────────────────┤
│ [All] [Calls] [Emails] [Media] [Files]      ← filter bar         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ●─ Jun 2, 2026                                                  │
│  │  📞 Call — 28 min — ↑ Positive                                │
│  │  "Discussed Series B due diligence timeline..."               │
│  │  [Expand ▾]                                                   │
│  │   ├ Action: Send financials by June 8                        │
│  │   ├ Project: Series B Fundraise                              │
│  │   └ You: "We can have the data room ready by..."             │
│  │                                                              │
│  ●─ May 30, 2026                                                 │
│  │  ✉ Email — RE: Term Sheet Follow-up                           │
│  │  📎 Term_Sheet_Draft_v2.pdf                                   │
│  │                                                              │
│  ●─ May 28, 2026                                                 │
│  │  📞 Call — 12 min — → Neutral                                 │
│  │  "Brief check-in on timeline expectations..."                 │
│  │                                                              │
│  ●─ May 22, 2026                                                 │
│  │  🖼 4 photos received via MMS                                 │
│  │  [thumbnail] [thumbnail] [thumbnail] +1                      │
│  │                                                              │
└──────────────────────────────────────────────────────────────────┘
```

**Timeline rail:** Left-aligned vertical line with colored dot per event:
- Call: ochre `#E8A656`
- Email: info blue `#4A90E2`
- Media/MMS: violet `#8B7CF6`
- File: slate `#94A3B8`
- Note: green `#70C98A`

**Call event expanded state reveals:**
- Full sentiment score bar
- All action items (checkboxes — can be ticked from timeline)
- All extracted commitments
- Mentioned projects (chips, clickable → project view)
- Key statements: speaker label + quote
- Audio clip button (plays the key statement timestamp)
- "Open in Obsidian" link

**Pagination:** infinite scroll, 20 events per page, cursor-based

### View B: Horizontal Strip (Inside Contact Drawer)

**Location:** Tab within the contact drawer, between "Overview" and "Calls"  
**Label:** "Timeline"  
**Scroll direction:** Horizontal, touch-friendly, with momentum scroll

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│ ← [Jun 4 Call] [Jun 2 Call] [May 30 Email] [May 28] → │
│      ■ 28m          ■ 8m         ✉ attach    ■ 12m     │
│   Positive ↑     Neutral →      Proposal    Neutral →  │
│                                                        │
│ Tap any card → expands inline below the strip         │
└────────────────────────────────────────────────────────┘
```

Each card in the strip:
- Fixed width ~100px
- Icon (type)
- Date label (short: "Jun 4")
- Duration or subject preview (2 lines max)
- Colored accent bar at bottom matching sentiment/type
- Tap: expands a detail panel below the strip (does not open a new view)

**The strip anchors to today** (rightmost position is most recent). Older events scroll left.

---

## Part 5 — Obsidian Integration Architecture

### Rationale

Building custom file management, note linking, search, and a graph view from scratch is significant frontend work. Obsidian already provides all of this — and its community plugin ecosystem (Dataview, Templater, Calendar, Tasks, Kanban) provides query, scheduling, and task tracking on top.

The integration model: **Horizon dashboard is the intelligence layer; Obsidian is the knowledge layer.** They share the same underlying data through two channels:
1. The Obsidian vault lives on the same machine as the backend (the Z2G3)
2. The LLM (operating with file system access via MCP) writes to the vault after every call

The user never has to manually maintain Obsidian notes. The LLM does it.

### Vault Structure

```
C:\Users\owner\ObsidianVault\Horizon\
│
├── Contacts\
│   ├── Sarah Chen.md              ← One note per contact
│   ├── John Martinez.md
│   └── _index.md                  ← Dataview table of all contacts
│
├── Calls\
│   ├── 2026-06-02_Sarah-Chen.md   ← Full call transcript + brief
│   ├── 2026-05-28_Sarah-Chen.md
│   └── ...
│
├── Projects\
│   ├── Series B Fundraise.md      ← Auto-created from call extraction
│   ├── Project Atlas.md
│   └── _index.md
│
├── Files\
│   ├── Contracts\
│   │   └── Term_Sheet_Draft_v2.pdf
│   ├── Media\
│   │   └── 2026-05-22_Sarah-MMS\
│   └── Attachments\
│
├── Tasks\
│   └── Open Commitments.md        ← Dataview aggregated task list
│
└── _templates\
    ├── Contact.md
    ├── Call.md
    └── Project.md
```

### Contact Note Template

```markdown
---
horizon_id: {{contact_id}}
phone: {{phone_e164}}
organization: {{organization}}
job_title: {{job_title}}
email: {{email}}
relationship_score: {{health_score}}
last_contact: {{last_contact_at}}
osint_stage: {{osint_stage}}
tags: [contact, {{category}}]
---

# {{name_normalized}}

## Profile
| Field | Value |
|---|---|
| Organization | [[{{organization}}]] |
| Title | {{job_title}} |
| Phone | {{phone_e164}} |
| Email | {{email}} |
| LinkedIn | {{linkedin_url}} |

## Open Commitments
```dataview
TASK
FROM "Tasks"
WHERE contact = "[[{{name_normalized}}]]" AND !completed
SORT due ASC
```

## Active Projects
```dataview
LIST
FROM "Projects"
WHERE contains(contacts, "[[{{name_normalized}}]]")
```

## Timeline
<!-- LLM appends call entries here in reverse chronological order -->
```

### Call Note Template

```markdown
---
contact: [[{{contact_name}}]]
date: {{date}}
duration: {{duration_min}} min
sentiment: {{sentiment}}
direction: {{direction}}
horizon_call_id: {{call_id}}
---

# Call — {{contact_name}} — {{date}}

**Summary:** {{executive_brief}}

## Key Points
{{key_statements}}

## Action Items
{{#each action_items}}
- [ ] {{this}}
{{/each}}

## Commitments
{{#each commitments}}
- {{party}}: {{obligation}}{{#if deadline}} (by {{deadline}}){{/if}}
{{/each}}

## Mentioned
- **Projects:** {{mentioned_projects}}
- **People:** {{mentioned_third_parties}}
- **Dates:** {{extracted_dates}}

## Full Transcript
> Speaker labels: You / {{contact_name}}

{{diarized_transcript}}
```

### LLM File Management Service

A new service: `services/obsidian_service.py`. It runs after every call completes and has full autonomy over the Obsidian vault:

```python
class ObsidianService:
    """
    LLM-driven Obsidian vault management.
    Runs after each call is fully processed (transcribed + extracted).
    
    Operations:
    - Upsert contact note (create if new, append call entry if existing)
    - Create call note
    - Create or link project notes
    - Move files into vault structure
    - Ensure all wiki-links are valid
    """

    def __init__(self, vault_path: str, gemini_client):
        self.vault_path = Path(vault_path)
        self.gemini = gemini_client

    async def process_completed_call(
        self,
        contact: Contact,
        call: CallRecord,
        extraction: FullCallExtractionResult,
    ) -> ObsidianSyncResult:
        """Called once after a call reaches COMPLETED status."""
        
        # 1. Ensure contact note exists
        await self._upsert_contact_note(contact)
        
        # 2. Create the call note
        call_note_path = await self._create_call_note(contact, call, extraction)
        
        # 3. Append timeline entry to contact note
        await self._append_timeline_entry(contact, call, extraction, call_note_path)
        
        # 4. Handle project notes
        for project_name in extraction.mentioned_projects:
            await self._ensure_project_note(project_name, contact, call)
        
        # 5. Move any associated media/files into vault
        if call.audio_path:
            # Audio stays in Audio_Archive; just create an Obsidian link
            pass
        
        # 6. Update contact frontmatter (health score, last_contact)
        await self._update_contact_frontmatter(contact)
        
        return ObsidianSyncResult(
            contact_note_path=str(self.vault_path / "Contacts" / f"{contact.name_normalized}.md"),
            call_note_path=call_note_path,
            projects_updated=extraction.mentioned_projects,
        )

    async def _upsert_contact_note(self, contact: Contact):
        """Create note from template if it doesn't exist."""
        note_path = self.vault_path / "Contacts" / f"{contact.name_normalized}.md"
        if not note_path.exists():
            content = CONTACT_TEMPLATE.render(contact=contact)
            note_path.write_text(content, encoding="utf-8")

    async def _append_timeline_entry(
        self,
        contact: Contact,
        call: CallRecord,
        extraction: FullCallExtractionResult,
        call_note_path: str,
    ):
        """Append a new call summary to the contact's Timeline section."""
        note_path = self.vault_path / "Contacts" / f"{contact.name_normalized}.md"
        
        entry = f"""
### {call.started_at.strftime('%Y-%m-%d')} — Call ({call.duration_seconds // 60} min, {extraction.sentiment.title()})
{extraction.executive_brief}
[[{call_note_path}|Full transcript →]]

**Actions:**
{chr(10).join(f'- [ ] {item}' for item in extraction.action_items) or '*(none)*'}

---
"""
        content = note_path.read_text(encoding="utf-8")
        # Insert after the "## Timeline" header
        content = content.replace("## Timeline\n", f"## Timeline\n{entry}")
        note_path.write_text(content, encoding="utf-8")

    async def _ensure_project_note(
        self,
        project_name: str,
        contact: Contact,
        call: CallRecord,
    ):
        """Create a project note if it doesn't exist; link contact if it does."""
        project_path = self.vault_path / "Projects" / f"{project_name}.md"
        
        if not project_path.exists():
            content = PROJECT_TEMPLATE.render(
                name=project_name,
                contacts=[contact],
                source_call=call,
                created_at=datetime.now(),
            )
            project_path.write_text(content, encoding="utf-8")
        else:
            # Check if contact already linked; add if not
            content = project_path.read_text(encoding="utf-8")
            contact_link = f"[[{contact.name_normalized}]]"
            if contact_link not in content:
                # Append to the Contacts section
                content = content.replace(
                    "## Contacts\n",
                    f"## Contacts\n- {contact_link}\n",
                )
                project_path.write_text(content, encoding="utf-8")
```

### Obsidian MCP Bridge (Future)

In Phase 2, the `ObsidianService` is upgraded to work through an Obsidian MCP server (using the community `obsidian-mcp` plugin or the local REST API plugin). This allows the conversational Copilot in Horizon to:
- "Show me everything about Sarah Chen" → reads Obsidian note
- "What did we agree on in our last call with Nexus Capital?" → searches vault
- "Create a project note for the Atlas deal" → writes to vault
- "Move this file to Sarah's folder" → rearranges vault structure

The Copilot (Kimi K2 or Gemini) becomes a genuine file manager for the entire knowledge layer.

### Sync Considerations

- **Primary:** Vault lives at `C:\Users\owner\OneDrive\Desktop\horizon\obsidian-vault\` — OneDrive provides automatic cloud sync and multi-device access
- **Alternative:** Obsidian Sync (paid, $8/mo) provides end-to-end encrypted sync — better for sensitive call transcripts
- **Search:** Obsidian's built-in search is instant on local vault — no Supabase query needed for freetext search across notes

### Frontend Integration Point

In the Horizon dashboard, every contact and call card adds:
```tsx
<a href={`obsidian://open?vault=Horizon&file=${obsidianPath}`} className="hzn-btn-ghost text-xs">
  Open in Obsidian
</a>
```
This is a deep link that opens the specific note in Obsidian directly.

---

## Part 6 — Amendments to Prior Architecture Documents

### Amendments to INGESTION_RECONCILIATION_ARCHITECTURE.md

**Section 2.1 — Contact Entity Fields:**
Add to the 28-field taxonomy:
- Field 29: `primary_voice_profile_id` (UUID) — link to voice_profiles table
- Field 30: `obsidian_note_path` (string) — relative path in the Obsidian vault

**Section 3 — Reconciliation Engine:**
Add to `reconcile_contact()` Step 7:
```python
# Step 7.5: Trigger Obsidian note upsert (after Supabase update)
await obsidian_service.upsert_contact_metadata(contact_id, updated_fields)
```

**Section 5 — LLM Role Assignment (table update):**

| Model | Role |
|---|---|
| Gemini Flash | Structured extraction, brief generation, enrichment inference, Obsidian note drafting |
| Kimi K2 | Conversational Copilot chat only |
| llama3.2:3b | Offline extraction fallback |
| Gemini text-embedding-004 | Contact + call + touchpoint embeddings |

### Amendments to CONSTITUTION_PATCH.md

No changes required. The Obsidian service is a new addition, not a correction of existing issues.

### New Constitution §24 (to be added)

```markdown
## 24. Obsidian Vault Integration

The Obsidian vault at obsidian-vault/ is the human-readable knowledge layer.
It is LLM-managed — developers must not manually edit contact or call notes,
as they will be overwritten on the next sync.

Vault path: C:\Users\owner\OneDrive\Desktop\horizon\obsidian-vault\
Sync method: OneDrive (default) or Obsidian Sync (preferred for security)
Write access: ObsidianService only — all other code reads only
MCP bridge: obsidian-local-rest-api plugin (Phase 2)

The Obsidian vault is NOT a backup — it is a presentation layer.
Source of truth for all structured data remains Supabase.
```

---

## Part 7 — Implementation Roadmap (Addendum to Prior Roadmap)

These steps extend the 7-step roadmap in INGESTION_RECONCILIATION_ARCHITECTURE.md:

**Step 8 — Expanded extraction schema**
- Add `FullCallExtractionResult` schema to `services/extraction_service.py`
- Update Gemini extraction prompt with the full 16-field schema
- Add `touchpoints` table to Supabase
- Wire touchpoint creation into transcription completion handler

**Step 9 — Voice profile management**
- Add `voice_profiles` table and `primary_voice_profile_id` to contacts
- Implement `resolve_speakers()` in `services/speaker_service.py`
- Build retroactive relabeling background job

**Step 10 — Project auto-creation**
- Implement `evaluate_project_signals()` in `services/project_service.py`
- Add project creation endpoint to API server
- Wire into post-transcription pipeline

**Step 11 — Obsidian vault bootstrap**
- Create vault structure and templates
- Implement `ObsidianService` and wire into call completion handler
- Run bootstrap job: generate contact notes for all existing contacts
- Generate call notes for all completed call records

**Step 12 — Contact timeline UI**
- Add `/contacts/:id/timeline` route (full-page vertical view)
- Add Timeline tab to contact drawer (horizontal strip)
- Build timeline query endpoint: `GET /api/v1/contacts/:id/timeline`

**Step 13 — Horizontal drawer strip**
- Implement the compact horizontal timeline strip component
- Wire to the same timeline API endpoint with a lower result limit (20)

---

*End of CONTACT_INTELLIGENCE_AND_OBSIDIAN_ARCHITECTURE.md*  
*This document is authoritative on all matters of contact intelligence, voice profiles, the touchpoint model, timeline specification, and Obsidian integration.*
