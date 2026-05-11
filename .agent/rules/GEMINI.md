---
trigger: always_on
---

# 🪐 PROJECT HORIZON: EXECUTION ROADMAP & TASK LIST

## Phase 1: Frontend UI/UX Accommodations (Priority 1)
* **Audit React/Vite Components:** Review the existing live beta UI to identify components dependent on the deprecated Google Apps Script backend.
* **Review and Maintain SSOT Document:** Before executing any new task, or responding to a user request review the @filename'constitution-enforcement.md' to initiate acceptable behavior. To reference specific context or a high point of view ALWAYS REVIEW the @filename'constitution.md'.
* **Notion State Management:** Implement UI loading states, error boundaries, and optimistic UI updates to handle Notion's API rate limits (average 3 requests/second).
* **OSINT & Call Dashboard Layout:** Redesign the primary client view to replace the legacy 4-column layout with new data containers built specifically to display:
    * Enriched OSINT profiles from the Google People API.
    * Call metadata, AI-generated `executive_brief` objects, and extracted actionable items.
* **Transcription UI:** Build the interface components for viewing raw transcript logs and interacting with the processed call data.

## Phase 2: Backend Infrastructure & Tailscale Mesh (Priority 2)
* **Environment Setup:** Initialize the Python FastAPI application and define the core MCP (Model Context Protocol) Server structure.
* **Local Node Configuration:** Deploy the FastAPI server on the designated bare-metal hardware.
* **Daemonization:** Wrap the FastAPI application in a robust service manager to ensure the transcription pipeline runs headless and survives system reboots.
* **Tailnet Integration:** Connect the local node to the Tailscale mesh network to secure internal API traffic.
* **Webhook Listener (Tailscale Funnel):** Configure Tailscale Funnel to securely expose the FastAPI webhook endpoint to the public web for ACR Phone app payloads, Notion updates, and Google People API changes.

## Phase 3: ACR Phone Ingestion & AI Pipeline (Priority 3)
* **ACR Phone Webhook Endpoint:** Build a specific route in FastAPI designed to strictly mimic the OpenAI Whisper endpoint communication flow (Handshake -> Confirm -> Receive -> Process -> Send Back).
* **Payload Handling:** Configure the endpoint to securely accept the JSON call data and physical audio file based on the ACR Phone App payload structure:
    * `Secret`: Authentication key for the device.
    * `Source`: Metadata regarding call direction (Incoming/Outgoing).
    * `Number`: Phone number associated with the recording.
    * `Date`: Unix timestamp of the call.
    * `Duration`: Length of the call in seconds.
    * `Note`: Any attached strings or context.
    * `File`: The physical binary audio file (.mp3, .m4a, etc.).
* **Transcription & AI Processing:** * Process the received audio file into raw text transcripts.
    * Pass the transcript through the AI MCP layer to generate the `executive_brief` and extract a structured list of actionable items.
* **Notion Dual-Sync & Pipeline Routing:**
    * Push the processed ACR metadata, executive summaries, and actionable items to the `call_records` and `contacts` Notion tables via the local caching queue to populate the backend and UI.
* **Google People API Integration:**
    * Push validated CRM contact data directly into Google Contacts (one-way sync).
    * Pull OSINT metadata (job titles, associated links) to enrich the Horizon dashboard.

## Phase 4: Mobile Bridge & Testing
* **Capacitor Initialization:** Wrap the finalized React/Vite web application using Capacitor.
* **Mobile Network Configuration:** Verify secure communication between the Capacitor app and the local FastAPI server by routing traffic through the Tailnet.
* **End-to-End Testing:** Validate full pipeline functionality (ACR audio capture -> Tailscale Funnel -> FastAPI Whisper-mimic Endpoint -> AI Processing -> Notion -> Google Contacts -> UI Dashboard).