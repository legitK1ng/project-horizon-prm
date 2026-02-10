/**
 * Core type definitions for Project Horizon PRM
 */

export interface CallRecord {
  id: string;
  timestamp: string;
  contactName: string;
  phoneNumber: string;
  duration: string;
  rawTranscript: string;
  executiveBrief?: ExecutiveBrief;
  status: CallStatus;
  selected?: boolean;
}

export type CallStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ExecutiveBrief {
  title: string;
  summary: string;
  actionItems: string[];
  tags: string[];
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  organization?: string;
  lastContacted?: string;
  totalCalls: number;
  selected?: boolean;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  LOGS = 'LOGS',
  CONTACTS = 'CONTACTS',
  ACTIONS = 'ACTIONS',
  LAB = 'LAB',
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

export type BrainType = 'consultant' | 'mobilemech' | 'finance' | 'straight' | 'system';

export type ConnectionStatus = 'connected' | 'offline';

// API Response types
export interface ApiResponse {
  status: 'success' | 'error';
  logs?: RawLog[];
  contacts?: RawContact[];
  message?: string;
}

export interface RawLog {
  timestamp: string | number;
  contact_name: string;
  phone: string;
  duration: string | number;
  transcript: string;
  strategic_notes: string;
  tags: string;
  status?: string;
}

export interface RawContact {
  full_name: string;
  phone: string;
  email?: string;
  organization?: string;
  company?: string;
  last_synced: string;
  call_count?: number;
}

// Gemini API types
export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export interface GeminiResponse {
  title: string;
  summary: string;
  actionItems: string[];
  tags: string[];
}
