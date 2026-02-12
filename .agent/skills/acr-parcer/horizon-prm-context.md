# 🛠️ Agent Skill: "Horizon Quality Control"

## Trigger

When the user asks to "Verify Deployment" or "Test the Loop":

## Protocol

1. **Frontend Check (Browser Tool):**
    * Navigate to the web app URL.
    * Verify the 'Health Check' indicator (if exists) or critical UI elements.
    * *Constraint:* If visual verification fails, STOP and report.

2. **Backend Verification (Reasoning):**
    * If the user reports a specific error (e.g., "Error 500"), ask for the `clasp logs` or Cloud Logging output.
    * *Note:* I cannot natively "watch" logs in real-time, but I can analyze pasted log dumps instantly.

3. **Data Validation (Sheets):**
    * Draft a specific verification query: "Please paste the last 5 rows of the 'Logs' sheet so I can confirm the timestamp matches."

## Interactive Testing (User-Assisted)

If the user provides a URL, use the `browser_agent` to perform a "Smoke Test":

1. Load the page.
2. Identify interactive elements (Forms, Buttons).
3. Report back on load time and visual layout stability.
