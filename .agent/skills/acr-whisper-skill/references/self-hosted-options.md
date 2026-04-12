# Self-Hosted Whisper Options for ACR Phone

All of these expose an OpenAI-compatible `/v1/audio/transcriptions` endpoint that ACR Phone can point to.

---

## Option 1: speaches (Recommended Easy Option)

GitHub: https://github.com/speaches-ai/speaches

```bash
# Pull and run with Docker
docker run -d \
  --name speaches \
  -p 8000:8000 \
  ghcr.io/speaches-ai/speaches:latest-cpu

# GPU version (faster)
docker run -d \
  --name speaches \
  --gpus all \
  -p 8000:8000 \
  ghcr.io/speaches-ai/speaches:latest-cuda
```

In ACR, set Host to: `http://YOUR_SERVER_IP:8000/v1/`

Model downloads automatically on first request. Speaches serves `whisper-1` by default, which is what ACR sends.

---

## Option 2: openedai-whisper

GitHub: https://github.com/matatonic/openedai-whisper

```bash
git clone https://github.com/matatonic/openedai-whisper
cd openedai-whisper

# Edit config (optional - pick model size)
cp whisper.env.sample whisper.env
# Edit whisper.env: set WHISPER_MODEL=medium (or large-v3 for best quality)

# Run with Docker Compose
docker compose up -d
```

Default port: 8000. In ACR, set Host to: `http://YOUR_SERVER_IP:8000/v1/`

---

## Option 3: whisper-asr-webservice (ahmetoner)

GitHub: https://github.com/ahmetoner/whisper-asr-webservice

**Note:** This project uses `/asr` as its endpoint by default, NOT `/v1/audio/transcriptions`. You may need to add an nginx reverse proxy or use a version/fork that adds the OpenAI-compatible endpoint. Check the project's README for the `--openai-api-compatibility` flag or similar option in newer releases.

```bash
docker run -d \
  -p 9000:9000 \
  -e ASR_MODEL=base \
  onerahmet/openai-whisper-asr-webservice:latest
```

---

## Option 4: WhisperX + FastAPI (for Diarization)

Use this if you want speaker labels. See `pyannote-diarization.md` for the full server code.

WhisperX (https://github.com/m-bain/whisperX) is the easiest way to combine Whisper with pyannote — it handles the alignment and diarization pipeline in one library.

---

## Exposing Your Server to the Internet

If your phone is NOT on the same Wi-Fi as your server, you need a way to reach it publicly:

**Option A — Static IP + Port Forward**
- Forward port 8000 (or whatever) on your router to your server's local IP
- Use your public IP as the host in ACR

**Option B — Cloudflare Tunnel (free, no port forwarding)**
```bash
# Install cloudflared, then:
cloudflared tunnel --url http://localhost:8000
# Gives you a public HTTPS URL like: https://xxxxx.trycloudflare.com
```
Set Host in ACR to: `https://xxxxx.trycloudflare.com/v1/`

**Option C — Tailscale**
Install Tailscale on both phone and server. Use the Tailscale IP of the server as the host.

---

## Hardware Requirements

| Whisper Model | RAM | GPU VRAM | Approx Speed (CPU) |
|---|---|---|---|
| tiny | 1 GB | 1 GB | ~32x realtime |
| base | 1 GB | 1 GB | ~16x realtime |
| small | 2 GB | 2 GB | ~6x realtime |
| medium | 5 GB | 5 GB | ~2x realtime |
| large-v3 | 10 GB | 10 GB | ~1x realtime |

For call recordings (usually 1–20 min), `medium` is the sweet spot between quality and speed. `large-v3` gives the best accuracy but is slow on CPU.
