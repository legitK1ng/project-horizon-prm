---
trigger: always_on
---

# Project Context: Horizon PRM (v2.0)

**Architecture:** Hybrid Web App

* **Frontend:** React (Vite) + TypeScript + Tailwind CSS.
  * *Key Dirs:* `src/services` (API logic), `src/contexts` (State), `src/components`.
* **Backend:** Google Apps Script (GAS) acting as a serverless API & Webhook receiver.
  * *Key Dirs:* `backend/Code.gs` (Entry point), `backend/Config.gs`.
  * *Deployment:* Web App (Exec as user, Access: Anyone).
* **AI Engine:** Google Gemini API (handling "Processing Lab" personas like 'MobileMech' & 'Strategic Consultant').
* **Integrations:**
  * **Ingestion:** ACR Phone App Webhooks (fields: `contact_name`, `phone_number`, `note` as transcript, `duration` call duration).
  * **Storage/Sync:** Google Sheets (DB), Google People API (Contacts).

## Directive: The "Full-Stack Strategist" Protocol

**ALWAYS** filter your responses through these 3 lenses before replying:

1. **The "GAS Bridge" Check (Frontend <-> Backend)**
    * *Trigger:* When I ask for frontend features involving data (e.g., "save this contact").
    * *Action:* Do not just write the React `fetch`. **Immediately** check if the corresponding `doGet()` or `doPost()` handler exists in `backend/Code.gs`. If not, provide *both* the React Hook code AND the Apps Script handler code to ensure the bridge is complete.
    * *Optimization:* Suggest `google.script.run` patterns if we ever move to an embedded add-on, but prioritize the current REST API pattern (`VITE_BACKEND_URL`) for this web app build.

2. **The "Persona" Consistency Check**
    * *Trigger:* When modifying the AI processing logic.
    * *Action:* Recall that this project uses distinct personas (Strategic Consultant, Financial Analyst, etc.). Ask: "Does this change require an update to the prompt definitions in the Processing Lab?"
    * *Optimization:* Suggest moving hardcoded prompts to `Config.gs` or a script property so we can tweak Gemini's personality without redeploying the frontend.

3. **The "Google Ecosystem" Advantage**
    * *Trigger:* Any data manipulation task.
    * *Action:* leverage the "Hidden" APIs.
        * *Instead of:* "Let's write a regex to parse this date,"
        * *Suggest:* "Since we are in GAS, use `Utilities.formatDate()` or the `Intl` object directly."
        * *Instead of:* "Let's build a custom logger,"
        * *Suggest:* "Use `console.log` routed to **Cloud Logging** (stackdriver) since you already enabled that API in the setup."

## Goal

Build a seamless loop between the ACR Phone inputs, the Gemini analysis, and the Google Workspace outputs. Prioritize **type safety** (shared `types.ts`) between the React frontend and the GAS backend.

## 🛡️ Global Rule: Strict Data Schema

**Context:** The Google Sheet is the database. Data integrity is paramount.

## The Schema (Horizon_PRM)

| Sheet Header (Human Readable) | API/JSON Key (snake_case) | Type | Description |
| :--- | :--- | :--- | :--- |
| **Timestamp** | `timestamp` | ISO 8601 String | The actual time of the call (NOT upload time). |
| **Contact Name** | `contact_name` | String | Name of the caller (or "Unknown"). |
| **Phone Number** | `phone_number` | String | Normalized phone number (e.g., 10-digit). |
| **Duration** | `duration` | String/Number | Length of call (e.g., "05:00" or seconds). |
| **Transcript** | `transcript` | String | Full text of the conversation. |
| **Strategic Notes** | `strategic_notes` | JSON String | AI analysis object (summary, sentiment, etc.). |
| **Tags** | `tags` | String | Comma-separated tags (e.g., "#sales, #urgent"). |
| **Status** | `status` | Enum String | `QUEUED`, `COMPLETED`, `SKIPPED_SHORT`, `ERROR`. |
| **External ID** | `external_id` | String | Unique ID from source (e.g., ACR filename, Cal Event ID). |

## Strict Context

1. **Golden Source**: The Google Sheet Headers are the **Single Source of Truth**.
2. **Case Insensitivity**: Backend logic MUST handle headers case-insensitively (e.g., find "Status" or "status"), but WRITE them as Title Case.
3. **API Contract**: All POST requests to the GAS Web App MUST use the `API/JSON Key` (snake_case).
4. **No "Magic" Columns**: Do not add columns to the Sheet without updating this Schema definition AND `backend/Config.gs`.
