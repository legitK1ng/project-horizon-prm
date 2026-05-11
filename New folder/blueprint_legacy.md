# Horizon PRM: System Blueprint

## The High Point of View
Horizon is a proactive, intelligence-driven CRM. It transitions away from flat lists and reactive data entry into a 3-tier model (Entities, Relationships, Touchpoints) utilizing invisible OSINT enrichment and chronological timelines. 

## Core Architecture
* **Frontend:** React + Vite, strict TypeScript, Tailwind CSS. Path aliases (`@/components`) are mandatory.
* **State Management:** Custom React Hooks + Context (no massive monolithic states).
* **Data Model:** * `profiles`: User auth and limits.
  * `contacts`: Core entity records (Master Truth).
  * `call_records`: Transcripts, metadata, and JSONB executive briefs.

## UX & Intelligence Philosophy
* **Command Center:** The Dashboard surfaces intelligence (Health Scores, Needs Attention) proactively.
* **Power Interface:** The Command Palette is the primary navigation and execution hub.
* **Timeline-First:** Interactions render as a scrollable, conversational feed, not static tables.

"Ralph Loop" syntax found in YouTube resource 
