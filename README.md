# 🪐 Project Horizon: Enterprise-Grade Relationship Intelligence (PRM)

## *The Future of Proactive Relationship Management*

[![Horizon Tech](https://img.shields.io/badge/Architecture-Topology%20v1.0-blueviolet?style=for-the-badge)](https://github.com/legitK1ng/project-horizon-prm)
[![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20Supabase-blue?style=for-the-badge)](https://github.com/legitK1ng/project-horizon-prm)
[![AI](https://img.shields.io/badge/AI-Gemini%20%7C%20MCP-orange?style=for-the-badge)](https://github.com/legitK1ng/project-horizon-prm)

---

## 🏛️ VISION & IDENTITY

Project Horizon is not a "Contact List"—it's a **Relationship Intelligence Platform (PRM)** designed to transition from reactive workflows to **Proactive AI-Driven Nudging**. We provide an "Enterprise-Grade" architecture (Topology v1) that centralizes entities, relationships, and touchpoints into a unified intelligence surface.

---

## 🚀 THE 5 CRITICAL PIVOTS (The Strategic Law)

Every feature and line of code in Horizon is measured against these five pillars:

1. **Decoupling**: Complete independence from legacy/GAS scripts.
2. **Relational Intelligence**: Moving from "Flat Lists" to a 3-tier model (Entities → Relationships → Touchpoints).
3. **Proactive AI**: Transitioning from "Summarization" to "Proactive Nudging" (Relationship Health Scores).
4. **OSINT Pipeline**: Asynchronous enrichment for phone, email, social, and organization signals.
5. **Security**: Field-level AES encryption for transcripts and sensitive relationship notes.

---

## 🛠️ THE TOPOLOGY V1 TECH STACK

Built for scale, security, and intelligence:

* **Frontend**: React (Vite) + TypeScript + Tailwind CSS (Glassmode UI) + Unified `apiClient` architecture.
* **Mobile Engine**: Capacitor (Cross-platform support).
* **Backend**: Python (FastAPI) structured as a **Model Context Protocol (MCP)** Server—giving AI agentic control over your data.
* **Database**: Supabase (PostgreSQL) — Relational Data with RLS (Row Level Security).
* **Intelligence**: Google Gemini (Flash 1.5/Pro) integrated via a global background floating chat interface + Custom OSINT enrichment and diarization.
* **Infrastructure**: GCP Cloud Run (Serverless).

---

## 📂 CORE SYSTEM ARCHITECTURE

The system centers on three core entities linked by stable UUIDs:

* `profiles`: User auth and subscription management.
* `contacts`: The "Master Truth" for people and entities.
* `call_records`: Encrypted transcripts, interaction logging, and `executive_brief` objects.
* `enriched_entities`: JSONB storage for the OSINT enrichment pipeline.

---

## 📦 SETUP & INSTALLATION GUIDE

Ensure you have the following installed before proceeding:

* **Node.js**: v18+ (LTS recommended)
* **Python**: v3.11+
* **Git**: Latest version
* **Database**: A **Supabase** project (PostgreSQL)
* **Google Cloud Account**: For Google People API, Cloud Run, and Google OAuth.

### 1. Repository Setup

```bash
git clone https://github.com/legitK1ng/project-horizon-prm
cd project-horizon-prm
```

### 2. Backend Config (FastAPI MCP)

The backend manages the AI intelligence (speaker diarization, Gemini prompting) and our secure Supabase bridge.

1. **Create Virtual Environment**:

   ```bash
   cd mcp-backend
   python -m venv venv
   .\venv\Scripts\activate   # (Windows)
   source venv/bin/activate  # (Mac/Linux)
   ```

2. **Install Dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Variables**:
   Create a `.env` in `mcp-backend/`. Needed variables:

   ```env
   # Supabase
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   # AI / Integrations
   HUGGINGFACE_TOKEN=...
   GOOGLE_API_KEY=...
   # Encryption
   FIELD_ENCRYPTION_MASTER_KEY=...
   ```

4. **Run the Backend**:

   ```bash
   uvicorn main:app --reload --port 8000
   # Optionally run the background ingestion daemon:
   uvicorn ingestion_server:app --host 0.0.0.0 --port 9000
   ```

### 3. Frontend Config (Vite React)

1. **Install Node Modules**:

   ```bash
   # from project root
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` at the root level:

   ```env
   VITE_GOOGLE_CLIENT_ID=...
   # Note: Local dev proxies /api to localhost:8000 automatically via vite.config.ts
   ```

3. **Launch the Dashboard**:

   ```bash
   npm run dev
   ```

### 4. Database Setup

1. Run the migrations in `mcp-backend/run_migrations.py`.
2. Verify the existence of `profiles`, `contacts`, and `call_records` tables via the Supabase Dashboard.

> **Warning:** Do not change your `FIELD_ENCRYPTION_MASTER_KEY` once data is encrypted in Supabase. Lost keys will result in permanent transcript data loss.

---

## 🔮 ROADMAP & ADVANCEMENT

> **Project Horizon is evolving rapidly.** We are currently in "Topology Phase 1".

* **Invisible OSINT (v1.1)**: Automatic person enrichment using Hunter, NumVerify, and Gemini background processing.
* **Proactive Health Scores (v1.2)**: "Needs Attention" algorithms that track relationship decay.
* **The Timeline Feed**: Linear/Notion style chronological feed for every contact interaction.
* **Field-Level Encryption (v2)**: Fully non-deterministic salts for ultra-secure "Vault" transcripts.

---

## 📜 LICENSE

###### Confidential — Private Property of Project Horizon Team
