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
    contact_id: string;
    contact_name: string;
    phone_number?: string | null;
    duration?: string | number | null;
    transcript?: string | null;
    executive_brief?: ExecutiveBrief | null;
    status?: 'QUEUED' | 'COMPLETED' | 'SKIPPED_SHORT' | 'ERROR';
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
    raw_data?: any;
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
