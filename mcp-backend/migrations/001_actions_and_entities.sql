-- ============================================================
-- Horizon PRM — Migration 001
-- Items: 2 (call_logs), 11 (tasks/projects), 13 (entities),
--        14 (vectors), 19 (attachments), 22 (indexes)
-- Run via: psql $DATABASE_URL -f migrations/001_actions_and_entities.sql
-- Or apply through Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Enable pgvector extension (Item 14) ─────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── call_logs (Item 2) ──────────────────────────────────────
-- Normalised call log with dedup and aggregation support.

CREATE TABLE IF NOT EXISTS call_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id   UUID             REFERENCES contacts(id) ON DELETE SET NULL,
    phone_number TEXT             NOT NULL,
    timestamp    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    duration     INTEGER,                             -- seconds
    direction    TEXT             CHECK (direction IN ('inbound', 'outbound', 'unknown')),
    source       TEXT             DEFAULT 'acr',      -- 'acr' | 'manual' | 'import'
    raw_data     JSONB,
    created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_call_log UNIQUE (phone_number, timestamp)  -- dedup guard
);

CREATE INDEX IF NOT EXISTS idx_call_logs_contact    ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone      ON call_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp  ON call_logs(timestamp DESC);

-- ── tasks (Item 11) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
    id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    title          TEXT    NOT NULL,
    description    TEXT,
    status         TEXT    NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','in_progress','completed','cancelled')),
    source         TEXT    NOT NULL DEFAULT 'user'
                           CHECK (source IN ('user','ai_generated','ai_approved')),
    priority       TEXT    NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('low','medium','high','urgent')),
    due_date       DATE,
    project_id     UUID    REFERENCES projects(id) ON DELETE SET NULL,
    contact_id     UUID    REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name   TEXT,
    tags           TEXT[]  DEFAULT '{}',
    ai_confidence  FLOAT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact    ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due        ON tasks(due_date);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_tasks_updated
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── projects (Item 11) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT    NOT NULL,
    description TEXT,
    status      TEXT    NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','on_hold','completed','archived')),
    notes       TEXT,
    tags        TEXT[]  DEFAULT '{}',
    start_date  DATE,
    end_date    DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TRIGGER trg_projects_updated
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── attachments (Item 19) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS attachments (
    id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id    UUID  NOT NULL,
    entity_type  TEXT  NOT NULL CHECK (entity_type IN ('task','project','contact','call')),
    file_name    TEXT  NOT NULL,
    file_path    TEXT  NOT NULL,
    file_type    TEXT,
    file_size    BIGINT,
    url          TEXT,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_id, entity_type);

-- ── entities (Item 13) ──────────────────────────────────────
-- Centralised entity resolution / normalization store.

CREATE TABLE IF NOT EXISTS entities (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    type             TEXT    NOT NULL
                             CHECK (type IN ('contact','task','project','location','organization')),
    name             TEXT    NOT NULL,
    normalized_name  TEXT    NOT NULL,           -- lowercase, stripped
    aliases          TEXT[]  DEFAULT '{}',
    metadata         JSONB   DEFAULT '{}',
    relationship_ids UUID[]  DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_type            ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_normalized_name ON entities(normalized_name);

CREATE TRIGGER trg_entities_updated
    BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── entity_relationships (Item 13) ──────────────────────────

CREATE TABLE IF NOT EXISTS entity_relationships (
    id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    from_entity_id  UUID  NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id    UUID  NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    type            TEXT  NOT NULL
                          CHECK (type IN ('assigned_to','related_to','located_at','belongs_to','references')),
    weight          FLOAT DEFAULT 1.0,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_relationship UNIQUE (from_entity_id, to_entity_id, type)
);

CREATE INDEX IF NOT EXISTS idx_entity_rel_from ON entity_relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_rel_to   ON entity_relationships(to_entity_id);

-- ── vectors (Item 14) ───────────────────────────────────────
-- Generation : gudzenkoi/kimi-k2:1t-cloud  (via Ollama, remote host)
-- Embeddings : Google text-embedding-004   (cloud API, no VRAM)
-- text-embedding-004 produces 768-dim vectors.

CREATE TABLE IF NOT EXISTS vectors (
    id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id    UUID    NOT NULL,
    entity_type  TEXT    NOT NULL,   -- 'contact' | 'transcript' | 'task' | 'project'
    content      TEXT    NOT NULL,   -- source text that was embedded
    embedding    vector(768),        -- pgvector column
    model        TEXT    DEFAULT 'text-embedding-004',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vectors_entity ON vectors(entity_id, entity_type);

-- HNSW index for fast approximate nearest-neighbour search
-- (cosine distance — appropriate for text embeddings)
CREATE INDEX IF NOT EXISTS idx_vectors_hnsw
    ON vectors USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ── contacts: phone number index (Item 22) ──────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- ── Helper view: task completion rate per project ────────────

CREATE OR REPLACE VIEW project_task_stats AS
SELECT
    p.id                                            AS project_id,
    p.title                                         AS project_title,
    COUNT(t.id)                                     AS total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
    ROUND(
        COUNT(t.id) FILTER (WHERE t.status = 'completed')::numeric /
        NULLIF(COUNT(t.id), 0) * 100,
    1)                                              AS completion_pct
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.title;
