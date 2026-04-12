# 🧱 Setup Guide: Project Horizon v2.0

## *Enterprise-Grade Configuration & Onboarding*

This guide provides a comprehensive setup for the **Topology v1.0** architecture of Project Horizon. Horizon uses a hybrid **FastAPI (MCP)** backend and a **React (Vite)** frontend, fully connected to **Supabase** and our **Intelligence Enrichment Pipeline**.

---

## 🛠️ PREREQUISITES

Ensure you have the following installed before proceeding:

* **Node.js**: v18+ (LTS recommended)
* **Python**: v3.11+
* **Git**: Latest version
* **Database**: A **Supabase** project (PostgreSQL)
* **Google Cloud Account**: For Google People API, Cloud Run, and Google OAuth.

---

## 🏗️ 1. REPOSITORY SETUP

Clone the repository and initialize submodules:

```bash
git clone https://github.com/legitK1ng/project-horizon-prm
cd project-horizon-prm
```

---

## 🐍 2. BACKEND CONFIG (FastAPI MCP)

The backend manages the AI intelligence and our secure Supabase bridge.

1. **Create Virtual Environment**:

   ```bash
   cd mcp-backend
   python -m venv venv
   .\venv\Scripts\activate
   ```

2. **Install Dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Variables**:

   Create `.env` in `mcp-backend/` based on [MANIFEST.md](file:///c:/Users/owner/OneDrive/Desktop/horizon/mcp-backend/MANIFEST.md) (or use your master `.env` in the root).

   **Key Vars**:

   ```env
   # Supabase
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   # AI Enrichment
   HUGGINGFACE_TOKEN=...
   GOOGLE_API_KEY=...
   # Encryption (REQ-039)
   FIELD_ENCRYPTION_MASTER_KEY=...
   ```

4. **Run the Backend**:

   ```bash
   uvicorn main:app --reload
   ```

   *Access API docs at `http://localhost:8000/docs`*

---

## ⚛️ 3. FRONTEND CONFIG (Vite React)

Our frontend is a premium, performance-optimized React dashboard.

1. **Install Node Modules**:

   ```bash
   npm install
   ```

2. **Root `.env` Configuration**:

   Vite requires prefixed environment variables for client-side access.

   ```env
   VITE_GOOGLE_CLIENT_ID=...
   # (Local Dev uses a Vite Proxy: /api -> localhost:8000)
   ```

3. **Launch the Dashboard**:

   ```bash
   npm run dev
   ```

   *Open `http://localhost:3000` to start using Horizon.*

---

## 🛡️ 4. SUPABASE & DATABASE SCHEMA

Ensure your Supabase PostgreSQL database is seeded correctly.

1. Run the migrations in `mcp-backend/run_migrations.py`.
2. Verify the existence of `profiles`, `contacts`, and `call_records` tables via the Supabase Dashboard.

> [!CAUTION]
> **FIELD-LEVEL ENCRYPTION**: Do not change your `FIELD_ENCRYPTION_MASTER_KEY` once data is encrypted in Supabase. Lost keys will result in permanent transcript data loss.

---

## 🚀 5. GCP CLOUD RUN DEPLOYMENT

To deploy the backend to production:

1. Ensure you have the `gcloud` CLI installed and authenticated.
2. Run the deployment script (coming in v1.1).
3. Set all secrets in **GCP Secret Manager**.

---

## ❓ TROUBLESHOOTING

* **"Localhost Trap"**: If your dashboard can't connect, check your `vite.config.ts` proxy settings.
* **OSINT Failures**: Ensure your `HUGGINGFACE_TOKEN` has permissions for the `pyannote/speaker-diarization-3.1` model.
* **OAuth Loops**: Check your "Authorized Redirect URIs" in the Google Cloud Console.

---

**Next Step: [READMEv3.md](file:///c:/Users/owner/OneDrive/Desktop/horizon/READMEv3.md)**
