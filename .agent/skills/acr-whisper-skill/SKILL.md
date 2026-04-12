---
name: acr-whisper-transcription
description: >
  Expert guide for everything related to ACR Phone (by NLLAPPS) call transcription using
  OpenAI Whisper. Use this skill whenever a user mentions ACR Phone, NLLAPPS, call recording
  transcription, Whisper transcription setup, ACR transcription not working, self-hosted
  Whisper for ACR, or pyannote speaker diarization with ACR call recordings. Covers:
  (1) setting up ACR with the official OpenAI Whisper cloud endpoint, including the full
  API handshake, auth, file transfer, and JSON response flow; (2) troubleshooting common
  errors and failures; (3) building and connecting a self-hosted OpenAI-compatible Whisper
  server (speaches, openedai-whisper, WhisperX-FastAPI); (4) adding pyannote speaker
  diarization to a self-hosted endpoint so ACR transcripts show "Speaker 1 / Speaker 2"
  labels. Always trigger this skill for ACR + transcription questions even if the user
  only mentions one component (e.g., just "ACR" or just "Whisper endpoint").
---

# ACR Phone + Whisper Transcription Expert Skill

## 0. Read the User First

Before answering, gauge technical level from context cues:

- **Non-technical** (says "I'm not a developer", "I just want it to work", uses plain English):
  → Use plain English, avoid jargon, offer the **Cloud (OpenAI) path only** unless they ask for self-hosting. Walk through every step with screenshots-level detail.
- **Technical** (mentions Docker, FastAPI, API keys, curl, Python, self-hosting):
  → Speak peer-to-peer, include code snippets, give options, explain trade-offs.
- **Mixed / unclear**: Default to plain English with technical details in collapsible code blocks.

---

## 1. How ACR + Whisper Works (The Full Picture)

Understanding the end-to-end flow is essential for both setup AND troubleshooting.

### The Data Flow

```
[Phone call ends]
       ↓
ACR records audio → saves as .m4a / .mp3 / .wav on device
       ↓
ACR (triggered by schedule or "Transcribe" tap) reads the file
       ↓
ACR sends HTTP POST — multipart/form-data — to Whisper endpoint
       ↓
Whisper endpoint processes audio → returns JSON
       ↓
ACR parses JSON, saves {"text": "..."} as a Note on the recording
```

### The Exact HTTP Request ACR Sends

```
POST https://api.openai.com/v1/audio/transcriptions
Authorization: Bearer sk-xxxxxxxxxxxxxxxxxxxx
Content-Type: multipart/form-data; boundary=<generated>

--boundary
Content-Disposition: form-data; name="file"; filename="recording.m4a"
Content-Type: application/octet-stream

<raw audio binary>
--boundary
Content-Disposition: form-data; name="model"

whisper-1
--boundary--
```

**Key facts about this request:**
- The audio file is sent as raw binary (not base64, not JSON-encoded)
- `model` must be `whisper-1` for the official OpenAI endpoint
- Max file size: **25 MB** — ACR recordings over this will fail silently
- Supported formats: `mp3`, `mp4`, `m4a`, `wav`, `webm`, `mpeg`, `mpga`
- ACR does NOT use a webhook. It calls the endpoint directly and waits for the response.

### The Exact JSON Response ACR Expects

```json
{
  "text": "Hello, this is the transcribed content of the call."
}
```

ACR stores the value of `"text"` as the note. That's all it reads. If your self-hosted endpoint returns anything else at the top level, ACR will silently get no note.

---

## 2. Path A: Official OpenAI Whisper Cloud Setup

**Best for:** Non-technical users, privacy-tolerant, low volume.

**Cost:** ~$0.006 per minute of audio (as of early 2026 — check platform.openai.com for current pricing).

### Step-by-Step Setup

**Step 1 — Get an OpenAI API Key**
1. Go to https://platform.openai.com
2. Sign in or create an account
3. Navigate to API Keys → Create new secret key
4. Copy the key immediately — you won't see it again
5. Add billing at https://platform.openai.com/account/billing (pay-as-you-go works fine)

**Step 2 — In ACR Phone, enable Whisper**
1. Open ACR Phone → tap the ⋮ menu (top right) → **Cloud Services**
2. Tap **+ Add** (or the speech bubble/transcription icon depending on version)
3. Select **OpenAI Whisper** from the list
4. Paste your API key into the **API Key** field
5. Leave the **Host** field as-is (`https://api.openai.com/v1/`) unless self-hosting
6. Tap **Save** / **Enable**

**Step 3 — Test it**
1. Make or play back a short call recording
2. Long-press the recording → **Transcribe** (or it may trigger automatically)
3. Wait ~10–30 seconds
4. The note icon should appear on the recording — tap it to read the transcript

**What ACR's APH (ACR Phone Helper) app does:** APH is a companion accessibility service that helps ACR capture call audio on devices that restrict recording. It does NOT affect Whisper transcription setup — that is handled entirely within the main ACR Phone app.

---

## 3. Path B: Self-Hosted Whisper Endpoint

**Best for:** Privacy-conscious users, high call volume, wanting to add diarization.

The key requirement: your server must expose an endpoint at `/v1/audio/transcriptions` that:
- Accepts `multipart/form-data` POST
- Returns `{"text": "..."}` JSON
- Is reachable by the phone over the internet (or local network if phone is on same Wi-Fi)

See `references/self-hosted-options.md` for full setup guides for each option.

### Quick Option Comparison

| Project | Diarization | GPU Needed | Docker | Difficulty |
|---|---|---|---|---|
| `speaches-ai/speaches` | No (ASR only) | Optional | Yes | Easy |
| `matatonic/openedai-whisper` | No | Optional | Yes | Easy |
| `ahmetoner/whisper-asr-webservice` | No | Optional | Yes | Easy (needs endpoint tweak — see ref) |
| WhisperX + custom FastAPI | Yes (via pyannote) | Recommended | Manual | Medium |
| `davidamacey/OpenTranscribe` | Yes | Recommended | Yes | Medium |
| `jfgonsalves/parakeet-diarized` | Yes | Recommended | Yes | Medium |

### Connecting ACR to Your Self-Hosted Server

In ACR → Cloud Services → OpenAI Whisper:
1. Set **Provider** to **Custom**
2. Set **Host** to your server's base URL, e.g.: `http://192.168.1.100:8000/v1/` or `https://whisper.mydomain.com/v1/`
3. Set API Key to anything (most self-hosted servers ignore it, but ACR requires a non-empty field)
4. Save

**Important:** ACR appends `audio/transcriptions` to your base URL. So if your base URL is `http://host:8000/v1/`, the full request goes to `http://host:8000/v1/audio/transcriptions`.

---

## 4. Path C: Pyannote Speaker Diarization

**What it does:** Answers "who spoke when?" — ACR's plain Whisper transcript becomes:

```
SPEAKER_00: Hello, is this John?
SPEAKER_01: Yes, speaking. How can I help?
SPEAKER_00: I wanted to follow up on the invoice...
```

**The architecture:**
```
ACR sends audio → Your FastAPI server
                       ↓
              [1] Whisper transcribes → segments with timestamps
              [2] pyannote diarizes → speaker turns with timestamps
              [3] Merge by temporal overlap → speaker-labeled transcript
                       ↓
              Returns {"text": "SPEAKER_00: Hello...\nSPEAKER_01: Yes..."}
                       ↓
                  ACR saves as note
```

See `references/pyannote-diarization.md` for the full implementation guide.

---

## 5. Troubleshooting

### ACR shows "Upload Failed" or no note appears

| Symptom | Likely Cause | Fix |
|---|---|---|
| Upload Failed immediately | Wrong API key / key revoked | Regenerate key at platform.openai.com |
| Upload Failed after ~30s | Network timeout, server unreachable | Check network; for self-hosted, verify port is open |
| No note, no error | Response format wrong | Your server's JSON doesn't have top-level `"text"` key |
| Note appears but is empty | Audio file silent or corrupted | Test the audio file directly |
| Works sometimes, fails sometimes | File too large (>25MB) | Enable compression in ACR settings; longer calls fail |
| 401 error in server logs | Bearer token issue | For self-hosted: your server may be rejecting auth header — check server config |
| 404 error | Wrong endpoint URL | Verify ACR is hitting `/v1/audio/transcriptions` exactly |

### Verifying with curl (for technical users)

Test your endpoint independently of ACR:

```bash
# Test OpenAI cloud
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer sk-YOUR_KEY" \
  -F "file=@/path/to/test.m4a" \
  -F "model=whisper-1"

# Test self-hosted
curl http://YOUR_HOST:PORT/v1/audio/transcriptions \
  -H "Authorization: Bearer dummy" \
  -F "file=@/path/to/test.m4a" \
  -F "model=whisper-1"
```

Expected output: `{"text":"..."}`

### ACR Version Issues

- The new cloud service system (v2) was a full rewrite. If you set up Whisper before the rewrite, you must **re-enable** it from scratch in Cloud Services.
- Some older APK versions don't show the Custom provider option. Update ACR Phone to the latest version from acr.app or Google Play.

---

## 6. Reference Files

- `references/self-hosted-options.md` — Full Docker/Python setup for speaches, openedai-whisper, WhisperX-FastAPI
- `references/pyannote-diarization.md` — Complete pyannote diarization implementation guide with code

Read the appropriate reference file when the user needs detailed self-hosting or diarization setup steps.
