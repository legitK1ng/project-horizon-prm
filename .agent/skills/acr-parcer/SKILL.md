---
name: acr-parser
description: >-
  Essential skill for parsing 'ACR Phone.html' call logs.
  Triggers automatically when the user uploads an ACR call log,
  asks to "process the phone file," or mentions "ACR data."
  Extracts Contact, Time, Duration, and Transcripts.
authors: 
  - Project Horizon
  - Gemini
version: 1.1.0
---

# ACR Phone Parser Skill

Use this skill when the user provides or references an `ACR Phone.html` file. This logic ensures raw call transcripts are correctly mapped to the Horizon PRM schema.

## Parsing Logic (Bottom-Up Segmentation)

When analyzing `ACR Phone.html`, do not parse top-down. Follow this strict "Bottom-Up, Segmented" strategy to accurately associate transcripts with the correct metadata.

### 1. Primary Segmentation (Date Blocks)

- **Traversal:** Start parsing from the **end** of the file and move upwards.
- **Delimiter:** Locate `<li>` elements with `class="date-header"` (e.g., `Jan 28, 2026`).
- **Logic:** Content *preceding* a header (when moving up) belongs to that date.

### 2. Individual Call Record Extraction

Within a date block, scan for lines matching the pattern: `[Contact Name/Number] @ [TIME]` (e.g., "Kiana Stewart @ 11:27 AM").

- **Contact Name:** The string before the "@".
- **Phone Number:** If the contact name is purely numeric, treat it as the phone number.
- **Start Time:** The string after the "@". Combine this with the Date Header to create the ISO timestamp.

### 3. Transcript & Duration Extraction

- **Transcript Start:** Look for the element `<span class="tab note">00:00`. The text immediately following this is the `rawTranscript`.
- **Transcript End:** The transcript block ends at the next opening HTML tag (`<`).
- **Duration:** Scan the transcript text for `MM:SS` timers (e.g., `00:05`, `01:30`). The **last** valid `MM:SS` pattern found before the end of the block is the total `duration`.

## Output Format

Always format the extracted data into a JSON object matching this schema:

```json
{
  "contact_name": "String",
  "phone_number": "String (or null)",
  "timestamp": "ISO 8601 String",
  "duration": "String",
  "transcript": "String (Full text without time markers)",
  "status": "completed"
}
```
