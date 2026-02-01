
export interface CallRecord {
  id: string;
  timestamp: string;
  contactName: string;
  phoneNumber: string;
  duration: string;
  rawTranscript: string;
  executiveBrief?: ExecutiveBrief;
  status: 'pending' | 'processing' | 'completed' | 'error';
  selected?: boolean; // For bulk actions
}

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
  selected?: boolean; // For bulk actions
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  LOGS = 'LOGS',
  CONTACTS = 'CONTACTS',
  ACTIONS = 'ACTIONS', // New Tab
  LAB = 'LAB'
}

export interface HistoryItem {
  id: string;
  timestamp: string; // ISO string
  label: string;
  description: string;
  pinned: boolean;
  // In a real app, we might store full state snapshots. 
  // For this prototype, we will simulate reversibility via a callback or description.
  revertable: boolean;
  onRevert?: () => void;
}
