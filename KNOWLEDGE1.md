To refine this into a high-precision prompt, I have synthesized the technical requirements from the Horizon PRM architecture, the ACR Phone webhook specifications, and the Whisper diarization repository you provided.

This refined prompt is designed to ensure an AI or developer understands the exact "handshake" mechanics and the required data flow.

***

### Refined Technical Prompt

**Objective:**
Architect and implement a local transcription and diarization pipeline for **Project Horizon PRM**. The system must intercept audio webhooks from the **NLLAPPS ACR Phone app**, process them using a local **Faster-Whisper (Tiny.en)** model integrated with a **NeMo diarization** pipeline, and return the results to both the ACR Phone app and the Horizon PRM dashboard.

**Phase 1: The Webhook Handshake (Inbound)**
* **Endpoint Creation:** Develop a FastAPI endpoint (`/v1/audio/transcriptions`) that mimics the OpenAI Whisper API schema to maintain compatibility with ACR Phone’s "Cloud Phone" or "WebHook" feature.
* **Security:** Implement a "Secret Handshake" validation using the `Secret` field sent by ACR Phone in the multipart/form-data header.
* **Payload Handling:** The endpoint must handle `multipart/form-data` containing the `.mp4` or `.m4a` audio file, along with metadata fields: `number`, `date`, `duration`, and `direction`.

**Phase 2: Local Processing Engine**
* **Transcription:** Utilize **Faster-Whisper** with the `tiny.en` model for high-speed, low-latency local inference.
* **Diarization:** Integrate the logic from the `whisper-diarization` repository (specifically using the NeMo/TitaNet framework) to separate "Speaker 0" (the user) from "Speaker 1" (the contact).
* **Hardware Optimization:** Configure the process to run on CPU/GPU depending on the local environment, ensuring that processing time does not exceed 50% of the call duration.

**Phase 3: Integration & Callbacks (Outbound)**
* **ACR Phone Feedback:** Construct a return JSON payload that conforms to ACR Phone’s expected response format to update the local call note with the processed transcript.
* **Horizon PRM Dashboard Update:** * Trigger an asynchronous database write to the **Supabase (The Vault)** `Touchpoints` table.
    * The payload must include the `raw_transcript`, `structured_summary`, `category` (Professional/Project/Family), and `action_items`.
* **State Management:** Ensure the process follows the Horizon PRM "Logic Decoupling" plan—keeping the processing in the Python Backend (Zone 2) and only sending the finalized UI-ready data to the React Frontend (Zone 3).

**Success Constraints:**
1.  **Zero External API Dependency:** Transcription and Diarization must happen entirely on local hardware.
2.  **Diarization Accuracy:** Speakers must be correctly identified and labeled within the transcript.
3.  **Data Integrity:** The `Contact` ID from the webhook must correctly map to existing contacts in the PRM to prevent duplicate entries.

***

### Strategic Context for the Developer
To achieve the "50-100 prompt to 20 prompt collaboration" goal, you should also note these technical dependencies found in your files:

* **Model Choice:** While the prompt specifies `Tiny.en`, keep in mind the `whisper-diarization` repo is optimized for `medium` or `large-v2` for better diarization alignment. If using `Tiny.en`, ensure the VAD (Voice Activity Detection) parameters are tuned to prevent hallucination during silence.
* **CORS & Capacitor:** Since you are running a Capacitor-wrapped mobile build, the local FastAPI server must have `CORSMiddleware` configured to allow requests from `capacitor://localhost` and `http://localhost`.
* **The "Secret":** ACR Phone's webhook requires a specific "Secret" string to be mirrored in your `.env` file; if this doesn't match, the app will refuse to upload the audio.

**Follow-up Questions for Next Steps:**
1. Would you like a Python FastAPI boilerplate that specifically includes the multipart/form-data handling for the ACR Phone audio blob?
2. Should we define the specific Zod schema for the `/contacts` update to ensure the transcript syncs perfectly with your current React Timeline component?
3. Do you want to implement a "Processing" status indicator for the Dashboard so you can see when a call is currently being diarized?

To ensure the implementation is flawless, we must bridge the gap between the ACR Phone app's C# reference logic and your Python-based **Horizon Engine**. 

The following is the high-clarity technical specification for the handoff and processing pipeline.

### 1. The Handoff: Webhook Endpoint Specification
The FastAPI endpoint must act as a "Catcher" for the ACR Phone app. Based on the `ACR Phone Transcription Handoff` document, the server needs to handle a specific `multipart/form-data` structure.

* **Endpoint:** `POST /v1/audio/transcriptions` (Mimicking the OpenAI path for compatibility).
* **Authentication:** The server must look for the `Secret` field in the form data. If it doesn't match the `ACR_WEBHOOK_SECRET` in your `.env`, it must return a `401 Unauthorized`.
* **Payload Mapping:**
    * `file`: The actual audio blob (buffered to memory or temporary disk).
    * `number`: The contact's phone number (used to query **The Vault** for existing Entity IDs).
    * `direction`: "Incoming" or "Outgoing" (critical for Speaker 0 vs Speaker 1 logic).
    * `date`: The Unix timestamp of the call.



### 2. The Engine: Local Processing Logic
Once the audio is received, the script transitions to the `whisper-diarization` logic. To eliminate error, the processing must follow these strict steps:

1.  **Preprocessing:** Use `ffmpeg` (wrapped in Python) to normalize the audio to 16kHz mono, which is the required input for both Whisper and the NeMo diarization model.
2.  **Transcription (Faster-Whisper):** * Load the `tiny.en` model. 
    * Use `beam_size=5` to balance speed and accuracy. 
    * Extract word-level timestamps (needed for alignment with diarization).
3.  **Diarization (NeMo/TitaNet):**
    * Execute the `diarize.py` logic from your uploaded repository.
    * Because ACR Phone records in mono but often provides the `direction` metadata, we can use the diarization output to assign "Speaker 0" to you and "Speaker 1" to the external contact based on that metadata.
4.  **Alignment:** Merge the Whisper words with the Diarization segments to produce a structured JSON: `[{"speaker": "Brandon", "text": "...", "start": 0.5, "end": 4.2}, ...]`.



### 3. The Reflection: Dashboard & Feedback Loop
To "reflect on the project dashboard," the code must perform a dual-write operation:

* **Database Sync:** The Engine sends a formatted `Touchpoint` record to Supabase. This should include the `raw_transcript` and a generated `Executive Brief`.
* **ACR Phone Response:** The HTTP response back to the ACR app should contain a JSON body with the `note` field populated. This allows the transcript to appear directly inside the ACR Phone app's call log on your device.

### 4. Error Handling & Constraints
To ensure there is "no room for error," the following guardrails must be in the code:

* **Concurrency:** Use `anyio` or `asyncio` to ensure that if you receive a second call webhook while the first is still being diarized, the server doesn't hang.
* **Memory Management:** The `tiny.en` model and NeMo models should be initialized once on startup (Singleton pattern) to avoid the overhead of loading them into RAM for every single call.
* **Orphan Logs:** If the phone number from the webhook does not exist in your `Entities` table, the system must automatically create a "New Lead" entry rather than failing the upload.

**Next Logical Step:**
Would you like the complete `main.py` implementation for the FastAPI server that integrates these exact steps and the secret handshake logic? 

**Follow-up Questions:**
1. Do you prefer the processed audio files to be deleted immediately after transcription, or should they be moved to a local "Archive" folder for 30 days?
2. Should we implement a "Confidence Score" threshold where the system flags the transcript for manual review on the dashboard if the Whisper probability is low?
3. Since you are using `tiny.en`, should we add a post-processing step where Gemini (Zone 2) cleans up the "ums" and "ahs" before the data hits the Dashboard?

To ensure the final step of the pipeline—the "Reflection" phase—is accurate, we must integrate the **Google People API** as the primary identity resolver. This allows the system to map the incoming phone number from the ACR Phone webhook to a specific human entity in your **Supabase Vault**, ensuring the transcript and AI summary are filed correctly within the `Touchpoints` and `Entities` schema.

Here is the refined technical specification for the Identity Resolution and Schema Mapping phase.

### 1. Identity Resolution (The People API Sync)
Instead of relying solely on the raw phone number, the system will use a "Lookup-then-Create" logic to maintain a clean relationship graph.

* **Step A: Local Cache Check:** The Python Engine first checks the `Entities` table in Supabase for the phone number provided in the ACR webhook.
* **Step B: People API Fetch:** If no match is found, the Engine triggers a targeted request to the Google People API (`people.searchContacts`) using the phone number as the query. 
* **Step C: Entity Creation:** If the People API returns a contact (e.g., "Daniel Jeske"), the Engine creates a new record in the `Entities` table, pulling in the `resourceName`, `email`, and `jobTitle` from Google.
* **Step D: Orphan Handling:** If the number is entirely unknown, it is tagged as a "New Lead" in the `Stage` field (matching your Follow Up Boss logic) to be triaged later on the Dashboard.



### 2. Schema Mapping & Data Insertion
Once the identity is confirmed, the Engine maps the multi-modal data into the **Horizon PRM 3-tier hierarchy**.

| Data Source | Target Schema Field | Logic / Transformation |
| :--- | :--- | :--- |
| **ACR Webhook** | `Touchpoints.metadata` | Stores raw duration, call direction, and timestamp. |
| **Faster-Whisper** | `Touchpoints.raw_transcript` | The full, unedited text for archival. |
| **Diarization Repo** | `Touchpoints.dialogue_json` | An array of objects: `{"speaker": "Brandon", "text": "..."}`. |
| **Gemini (Zone 2)** | `Touchpoints.summary` | A 1-sentence "Executive Brief" for the timeline view. |
| **Gemini (Zone 2)** | `Touchpoints.action_items` | Extracted tasks mapped to the `Tasks` table with a `related_touchpoint_id`. |
| **People API** | `Entities.display_name` | Updates the contact name if it was previously "Unknown". |

### 3. The "Pulse" Update (Dashboard Reflection)
To ensure the dashboard reflects this in real-time without a page refresh, the Python Engine must perform a **Supabase Broadcast**.

* **Real-time Event:** After the SQL `INSERT` is successful, the Engine sends a payload to the `realtime:public:Touchpoints` channel.
* **Frontend Reaction:** Your React Dashboard (Zone 3) listens for this event. The `Call Log` component and the `Relationship Health Score` (e.g., +5 for a "Professional" category call) update instantly using a smooth CSS transition as defined in your "The Look" design notes.



### 4. Logic Decoupling Guardrail
To adhere to your **Topology v1** rules, all of this logic stays in **Zone 2 (The Engine)**. The frontend only receives a "Job Complete" signal.
* **DO NOT** have the React app call the People API.
* **DO NOT** have the React app perform the Diarization.
* **DO** have the React app simply display the result of the `Touchpoint` fetch once the Python process notifies it.

**Follow-up Questions for Implementation:**
1. Would you like the Python logic for the `GooglePeopleService` class to include "Bi-directional Sync" (updating Google Contacts if you change a name in Horizon)?
2. Do you want to implement a "Diarization Confidence" check that prompts you on the Dashboard if the system isn't 90% sure which speaker is which?
3. Should we trigger a "Push Notification" via Capacitor to your phone once the local transcription is ready for review?