# Backend Dependencies Analysis — Addendum

**Date**: 2026-06-16  
**Supplement to**: ENGINEERING_REVIEW_2026-06-16_AUTOMATED.md

---

## Python Backend Stack Discovery

### Environment
- **Python Version**: 3.11.15 ✅ (Current stable release)
- **Dependency Management**: requirements.txt
- **Location**: `mcp-backend/requirements.txt`

### Core Dependencies

**Web Framework**:
- `fastapi` — Modern async web framework
- `uvicorn` — ASGI server for FastAPI
- ✅ **Assessment**: Industry-standard production stack

**Database & API**:
- `supabase` — PostgreSQL client
- `mcp` — Model Context Protocol
- `pydantic-settings` — Configuration management
- `httpx` — Async HTTP client
- ✅ **Assessment**: Well-chosen async-first libraries

**Security**:
- `cryptography` — Encryption primitives
- `python-dotenv` — Environment variable management
- ✅ **Assessment**: Proper security foundations

**AI/ML Stack**:
- `google-api-python-client` — Google APIs
- `google-auth` + `google-auth-oauthlib` — OAuth flow
- `google-genai>=1.16.0` — Google Generative AI (embeddings via text-embedding-004)
- `torch` — PyTorch deep learning framework
- `faster-whisper` — Optimized Whisper speech-to-text
- `pyannote.audio` — Speaker diarization and audio analysis
- ✅ **Assessment**: Production-grade AI stack for audio transcription

**Optional Dependencies** (Commented):
- `slowapi` — Redis-backed rate limiting (multi-worker support)
- `voyageai` — Alternative embeddings provider (Voyage AI, 1024-dim)
- ⚠️ **Note**: These are documented but not currently active

---

## Architecture Notes

### AI Processing Pipeline (Inferred)
1. **Audio Ingestion** → Whisper v1-compatible endpoint (port 9000)
2. **Transcription** → faster-whisper (optimized for CPU/GPU)
3. **Speaker Diarization** → pyannote.audio (who spoke when)
4. **Embeddings** → Google text-embedding-004 OR Voyage AI
5. **Generation** → Ollama (gudzenkoi/kimi-k2:1t-cloud, remote host)

### Performance Considerations
- ✅ `faster-whisper` chosen over original Whisper (3-4x faster, lower memory)
- ✅ Remote Ollama host eliminates local VRAM requirement
- ✅ Google embeddings API reduces infrastructure complexity
- ⚠️ PyTorch dependency adds ~2GB to deployment size (consider torch-cpu if no GPU)

---

## Security Assessment — Backend

### Strengths
1. ✅ `cryptography` library used for encryption (industry-standard)
2. ✅ Environment variables via `python-dotenv` (secrets not hardcoded)
3. ✅ OAuth 2.0 flow for Google authentication (secure)
4. ✅ Bearer token authentication on ingestion endpoint

### Recommendations
1. **Pin Dependency Versions** ⚠️ CRITICAL
   ```txt
   # Current: Unpinned versions allow arbitrary updates
   fastapi
   uvicorn
   
   # Recommended: Pin to specific versions
   fastapi==0.115.0
   uvicorn[standard]==0.32.1
   supabase==2.12.0
   # ... etc for all dependencies
   ```
   **Risk**: Unpinned versions can introduce breaking changes or vulnerabilities on `pip install`

2. **Add `pip-audit` to CI/CD**
   ```bash
   pip install pip-audit
   pip-audit --desc --require requirements.txt
   ```
   **Benefit**: Automated vulnerability scanning for Python dependencies

3. **Consider `requirements-dev.txt` Separation**
   ```txt
   # requirements.txt — production only
   # requirements-dev.txt — testing tools (pytest, black, mypy)
   ```
   **Benefit**: Smaller production container images, clearer dependency boundaries

4. **Document Optional Dependencies**
   - Clarify when `slowapi` should be enabled (multi-worker deployments)
   - Document `voyageai` activation steps if Google embeddings are insufficient

---

## Python Dependency Vulnerabilities

### Status: ⚠️ UNKNOWN (Requires Manual Audit)

**Recommended Action**:
```bash
cd mcp-backend

# Install pip-audit if not present
pip install pip-audit

# Scan for known vulnerabilities
pip-audit --desc

# Alternative: Use safety
pip install safety
safety check --file requirements.txt
```

**Common Vulnerabilities to Watch**:
- `cryptography` — Regularly updated for security patches
- `torch` — Large dependency, occasional CVEs for serialization issues
- `httpx` — HTTP client, potential SSRF vulnerabilities
- `google-*` packages — OAuth flow security is critical

---

## Backend Testing Gap

### Discovered: NO PYTHON TEST FILES
**Location Searched**: `mcp-backend/` (no `test_*.py` or `*_test.py` files found)

**Missing Coverage**:
- [ ] Ingestion endpoint tests (`test_ingestion_server.py`)
- [ ] Authentication flow tests (`test_auth.py`)
- [ ] Encryption key verification tests (`test_security.py`)
- [ ] Sentinel bot self-healing tests (`test_sentinel.py`)
- [ ] Database integration tests (`test_supabase.py`)

**Recommended Test Structure**:
```
mcp-backend/
├── tests/
│   ├── __init__.py
│   ├── conftest.py                    # Pytest fixtures
│   ├── test_ingestion_server.py       # Whisper endpoint tests
│   ├── test_auth.py                   # Bearer token validation
│   ├── test_encryption.py             # Crypto round-trip tests
│   ├── test_sentinel.py               # Self-healing logic tests
│   ├── test_routers/
│   │   ├── test_calls.py
│   │   ├── test_contacts.py
│   │   ├── test_enrichments.py
│   │   └── ...
│   └── integration/
│       ├── test_supabase_integration.py
│       └── test_ollama_integration.py
└── requirements-dev.txt               # pytest, pytest-asyncio, httpx test client
```

**Priority Tests** (Implement First):
1. **Authentication** — Verify bearer token rejects invalid keys
2. **Encryption** — Round-trip test to prevent data corruption
3. **Ingestion Endpoint** — POST multipart file uploads work correctly
4. **Health Checks** — `/v1/health` returns expected structure

---

## Performance & Scalability Notes

### Current Architecture
- **Single Process**: Uvicorn runs ingestion server on port 9000
- **Concurrency**: Async/await via FastAPI (efficient for I/O-bound work)
- **Heavy Compute**: Whisper transcription (CPU/GPU-bound)

### Scaling Recommendations

**Horizontal Scaling** (Multiple Workers):
```bash
# Option 1: Uvicorn with workers (shared memory limits)
uvicorn ingestion_server:app --host 0.0.0.0 --port 9000 --workers 4

# Option 2: Gunicorn + Uvicorn (production-grade)
gunicorn ingestion_server:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:9000
```
**Note**: Enable `slowapi` with Redis for multi-worker rate limiting

**Vertical Scaling** (Whisper Optimization):
- ✅ Already using `faster-whisper` (3-4x faster than original)
- Consider GPU acceleration if available (CUDA/ROCm)
- Alternative: Offload to external Whisper service (Deepgram, AssemblyAI)

**Task Queue** (Async Processing):
```python
# For long-running transcriptions, use Celery or Temporal
# POST /v1/audio/transcriptions returns job ID immediately
# Client polls GET /v1/jobs/{job_id} for status
```

---

## Deployment Checklist — Backend

**Pre-Production**:
- [ ] Pin all dependency versions in requirements.txt
- [ ] Run `pip-audit` and remediate vulnerabilities
- [ ] Implement core test suite (auth, encryption, ingestion)
- [ ] Configure production ASGI server (Gunicorn + Uvicorn)
- [ ] Set up process supervision (systemd, supervisor, or Docker)
- [ ] Configure logging to file + stdout (structured JSON logs)
- [ ] Set up health check monitoring (port 9000 `/v1/health`)
- [ ] Document environment variables (HORIZON_API_KEY, SUPABASE_URL, etc.)
- [ ] Create secrets management strategy (AWS Secrets Manager, Vault, etc.)
- [ ] Configure HTTPS/TLS termination (reverse proxy or load balancer)
- [ ] Set up firewall rules (restrict port 9000 to authorized IPs)
- [ ] Test failover/recovery procedures (what if Supabase goes down?)
- [ ] Document Sentinel bot configuration and troubleshooting

**Production Hardening**:
- [ ] Enable HTTPS-only mode
- [ ] Configure CORS for production domains only
- [ ] Add request size limits (prevent DoS via large file uploads)
- [ ] Implement rate limiting (per-IP, per-API-key)
- [ ] Add request ID tracking for distributed tracing
- [ ] Configure log rotation (avoid disk space exhaustion)
- [ ] Set up alerting (PagerDuty, Opsgenie) for critical errors
- [ ] Create disaster recovery runbook
- [ ] Document rollback procedures

---

## Final Backend Assessment

**Code Quality**: A (90/100)
- ✅ Clean FastAPI patterns
- ✅ Async/await properly implemented
- ✅ Structured logging in place
- ⚠️ Unpinned dependencies (security risk)
- ⚠️ No tests (critical gap)

**Security**: B- (75/100)
- ✅ Bearer token authentication
- ✅ Encryption key verification
- ✅ OAuth 2.0 flow for Google
- ⚠️ Unpinned dependencies (unknown vulnerabilities)
- ⚠️ No dependency vulnerability scanning in CI/CD

**Production Readiness**: ⚠️ 65/100
- ✅ Process running and stable (port 9000 active)
- ✅ Health checks implemented
- ⚠️ No tests (cannot verify correctness)
- ⚠️ No load testing (unknown capacity)
- ⚠️ Single-process deployment (no redundancy)

**Recommendation**: Address dependency pinning and add core test suite before production deployment. Backend is functional but lacks production hardening.

---

**Analysis Complete**: 2026-06-16  
**Next Action**: Pin Python dependencies and implement `test_ingestion_server.py`
