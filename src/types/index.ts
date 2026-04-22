export type AppView = 'DASHBOARD' | 'LOGS' | 'CONTACTS' | 'ACTIONS' | 'LAB';

export type ConnectionStatus = 'connected' | 'offline' | 'error';

export interface DashboardStats {
    totalContacts: number;
    callsThisWeek: number;
    avgHealth: number;
    needsAttention: number;
}

export interface GoogleTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

export interface ExecutiveBrief {
    title?: string;
    summary?: string;
    action_items?: string[];
    key_points?: string[];
    tags?: string[];
    sentiment?: 'Positive' | 'Neutral' | 'Negative';
    keywords?: string[];
}

export interface CallRecord {
    id: string;
    contact_id?: string | null;
    contact_name: string;
    phone_number?: string | null;
    duration?: string | number | null;
    transcript?: string | null;
    executive_brief?: ExecutiveBrief | null;
    status?: 'QUEUED' | 'COMPLETED' | 'SKIPPED_SHORT' | 'ERROR' | null;
    sentiment?: 'Positive' | 'Neutral' | 'Negative' | null;
    tags?: string[];
    recommended_followup_date?: string | null;
    draft_followup_message?: string | null;
    timestamp: string;
    keywords?: string[];
    created_at?: string;
}

export interface Contact {
    id: string;
    first_name: string;
    last_name?: string | null;
    full_name?: string | null;
    birthdate?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    organization?: string | null;
    organization_id?: string | null;
    company_id?: string | null;
    notes?: string | null;
    tags?: string[];
    health_score?: number | null;
    is_favorite?: boolean;
    last_contact_at?: string | null;
    photo_url?: string | null;
    total_calls?: number | null;
    raw_data?: any;           // Full Google People API Person object
    google_resource_name?: string | null;
    last_synced?: string | null;
    created_at?: string;
    updated_at?: string;
    org?: string | null;
}

export interface PersonData {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    title?: string | null;
    organization?: string | null;
    photoUrl?: string | null;
    notes?: string | null;
    found: boolean;
    tags?: string[];
}

export interface Persona {
    id: 'consultant' | 'mobilemech' | 'finance' | 'straight' | 'system';
    label: string;
    description: string;
}

export interface Nudge {
    id: string;
    contact_id: string;
    contact_name: string;
    type: 'FOLLOW_UP' | 'RECONNECT' | 'INFO_BATCH';
    reason: string;
    suggested_action: string;
    due_in: string;
    priority_score: number;
    email?: string | null;
    phone?: string | null;
}

export interface EnrichmentJob {
    id: string;
    contact_id: string;
    stage: number;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'DEAD_LETTER';
    attempts: number;
    result_json?: any;
    source_name?: string;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    error_message?: string;
    fetched_at?: string;
    created_at: string;
    updated_at: string;
}

export interface HistoryItem {
    id: string;
    timestamp: string;
    label: string;
    description: string;
    pinned: boolean;
    revertable: boolean;
    onRevert?: () => void;
}

export interface RawLog {
    timestamp?: string | number;
    contact_name?: string;
    phone_number?: string | number;
    phone?: string | number;
    duration?: string | number;
    transcript?: string | null;
    status?: string;
    strategic_notes?: string;
    tags?: string;
}

export interface RawContact {
    full_name?: string;
    phone?: string | number;
    organization?: string;
    company?: string;
    last_synced?: string | number;
    call_count?: number;
}

export interface ApiResponse {
    status: 'success' | 'error';
    message?: string;
    logs?: RawLog[];
    contacts?: RawContact[];
    data?: any;
}

// ── Actions / Tasks / Projects ──────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskSource = 'user' | 'ai_generated' | 'ai_approved';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export interface Task {
    id: string;
    title: string;
    description?: string | null;
    status: TaskStatus;
    source: TaskSource;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string | null;
    project_id?: string | null;
    contact_id?: string | null;
    contact_name?: string | null;
    tags?: string[];
    ai_confidence?: number | null;
    created_at: string;
    updated_at: string;
}

export interface ProjectSection {
    title: string;
    content: string;
}

export interface Project {
    id: string;
    title: string;
    description?: string | null;
    status: ProjectStatus;
    tasks?: Task[];
    notes?: string | null;
    people?: Array<{ contact_id: string; name: string; role?: string }>;
    attachments?: Attachment[];
    tags?: string[];
    start_date?: string | null;
    end_date?: string | null;
    created_at: string;
    updated_at: string;
}

export interface Attachment {
    id: string;
    entity_id: string;
    entity_type: 'task' | 'project' | 'contact' | 'call';
    file_name: string;
    file_path: string;
    file_type: string;
    file_size?: number | null;
    uploaded_at: string;
    url?: string | null;
}

// ── Entity Resolution / Normalization (Item 13) ────────────────────────────

export type EntityType = 'contact' | 'task' | 'project' | 'location' | 'organization';
export type RelationshipType = 'assigned_to' | 'related_to' | 'located_at' | 'belongs_to' | 'references';

export interface Entity {
    id: string;
    type: EntityType;
    name: string;
    normalized_name: string;
    aliases: string[];
    metadata: Record<string, any>;
    relationship_ids: string[];
    created_at: string;
    updated_at: string;
}

export interface EntityRelationship {
    id: string;
    from_entity_id: string;
    to_entity_id: string;
    type: RelationshipType;
    weight?: number;
    metadata?: Record<string, any>;
    created_at: string;
}

// ── Canvas Graph (Item 12) ──────────────────────────────────────────────────

export interface CanvasNode {
    id: string;
    label: string;
    type: 'project' | 'task' | 'person' | 'location' | 'attachment' | 'note';
    data?: Record<string, any>;
}

export interface CanvasEdge {
    from: string;
    to: string;
    label?: string;
}

export interface CanvasGraph {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
}

// ── Observability (Item 21) ─────────────────────────────────────────────────

export interface StructuredLog {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: string;
    source?: string;
    data?: Record<string, any>;
}
