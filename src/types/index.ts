export type AppView = 'DASHBOARD' | 'LOGS' | 'CONTACTS' | 'ACTIONS' | 'LAB';

export type ConnectionStatus = 'connected' | 'offline' | 'error';

export interface ExecutiveBrief {
    title: string;
    summary: string;
    actionItems: string[];
    tags: string[];
    sentiment: 'Positive' | 'Neutral' | 'Negative';
}

export interface CallRecord {
    id: string; // Mapped from external_id
    timestamp: string;
    contactName: string;
    phoneNumber: string;
    duration: string | number;
    transcript: string;
    executiveBrief?: ExecutiveBrief; // Mapped from strategic_notes
    tags: string[];
    status: 'QUEUED' | 'COMPLETED' | 'SKIPPED_SHORT' | 'ERROR';
}

export interface Contact {
    id: string;
    name: string;
    phone: string;
    email?: string;
    organization?: string;
    lastContacted: string;
    notes?: string;
    tags?: string[];
    totalCalls: number;
}

export interface Persona {
    id: 'consultant' | 'mobilemech' | 'finance' | 'straight' | 'system';
    label: string;
    description: string;
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
    transcript?: string;
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
}

export interface PersonData {
    found: boolean;
    name?: string;
    photoUrl?: string;
    email?: string;
    organization?: string;
    title?: string;
    resourceName?: string;
    etag?: string;
    error?: string;
}

export interface GeminiResponse {
    text: () => string;
}
