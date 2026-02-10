
import { CallRecord, Contact, ExecutiveBrief } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================
// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
export const API_URL = "https://script.google.com/macros/s/AKfycbxAcLVDNwGHwdv84-Zfw5IBk-vPwZ5_Cx8LFyk67WnZU1xjXjxFSH2f7rTz2R4qdJsw/exec"; 
// ============================================================================

interface RawLog {
  timestamp: string | number;
  contact_name: string;
  phone: string;
  duration: string | number;
  transcript: string;
  strategic_notes: string; // Hybrid field: JSON or Markdown
  tags: string;
  status?: string; // Optional override from sheet
}

interface RawContact {
  full_name: string;
  phone: string;
  email?: string;
  organization?: string;
  company?: string; // Common alternative column name
  last_synced: string;
  call_count?: number;
}

interface ApiResponse {
  logs: RawLog[];
  contacts: RawContact[];
}

/**
 * Helper to format duration. 
 * Handles spreadsheet seconds (e.g. 125) -> "2m 05s"
 * Or passes through existing strings.
 */
const formatDuration = (val: string | number | undefined): string => {
  if (val === undefined || val === null || val === '') return "0m 00s";
  
  // If it's a number (seconds)
  if (typeof val === 'number') {
    const minutes = Math.floor(val / 60);
    const seconds = Math.floor(val % 60);
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  
  // If string looks like number
  if (!isNaN(Number(val)) && !val.includes(':')) {
    const num = Number(val);
    const minutes = Math.floor(num / 60);
    const seconds = Math.floor(num % 60);
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }

  return val.toString();
};

/**
 * Helper to ensure Date object validity
 */
const normalizeDate = (val: string | number | undefined): string => {
  if (!val) return new Date().toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

/**
 * Fetches data from the Google Apps Script backend.
 * Returns null if API_URL is not configured, triggering mock data fallback.
 */
export const fetchProjectHorizonData = async (): Promise<{ calls: CallRecord[], contacts: Contact[] } | null> => {
  if (!API_URL) {
    console.warn("Project Horizon: API_URL is empty. Using mock data.");
    return null;
  }

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      mode: "cors",
      credentials: "omit", 
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      }
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      console.error("Received HTML instead of JSON. This usually indicates a permissions error.");
      throw new Error("ACCESS_DENIED: Script access must be set to 'Anyone' in Google Deploy settings.");
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    const data: ApiResponse = await response.json();

    // --- PROCESS CALL LOGS ---
    const logsArray = Array.isArray(data.logs) ? data.logs : [];
    
    const calls: CallRecord[] = logsArray.map((log, index) => {
      let brief: ExecutiveBrief | undefined;
      const rawNotes = log.strategic_notes || "";
      const rawTags = log.tags ? log.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      // Logic to determine Brief & Status
      let derivedStatus: 'completed' | 'pending' | 'processing' | 'error' = 'pending';

      try {
        const trimmedNotes = rawNotes.trim();
        
        if (trimmedNotes.startsWith('{')) {
           // JSON Format (AI Processed)
           const parsed = JSON.parse(trimmedNotes);
           
           brief = {
             title: parsed.title || "Strategic Brief",
             summary: parsed.summary || "No summary available.",
             actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
             tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : rawTags
           };
           derivedStatus = 'completed';

        } else if (trimmedNotes.length > 10) {
          // Plain Text / Markdown Format (Likely Manual or Simple AI)
          brief = {
            title: "Executive Summary",
            summary: trimmedNotes,
            actionItems: [], // Cannot reliably extract bullets from plain text without AI
            tags: rawTags
          };
          derivedStatus = 'completed';
        } else {
          // Empty or too short -> Pending AI processing
          derivedStatus = 'pending';
        }
      } catch (e) {
        console.warn(`Failed to parse brief for log row ${index}`, e);
        derivedStatus = 'error';
        brief = {
          title: "Processing Error",
          summary: "Raw data could not be parsed. See raw transcript.",
          actionItems: [],
          tags: ['#error']
        };
      }

      // If the sheet explicitly sends a status column, honor it, otherwise use derived
      if (log.status && ['completed', 'pending', 'processing', 'error'].includes(log.status.toLowerCase())) {
        derivedStatus = log.status.toLowerCase() as any;
      }

      return {
        id: `row-${index}`, // Ideally this should be a unique ID from the sheet (e.g. log.id)
        timestamp: normalizeDate(log.timestamp),
        contactName: log.contact_name || "Unknown Caller",
        phoneNumber: log.phone ? log.phone.toString() : "",
        duration: formatDuration(log.duration),
        rawTranscript: log.transcript || "",
        executiveBrief: brief,
        status: derivedStatus,
        selected: false
      };
    });

    // --- PROCESS CONTACTS ---
    const contactsArray = Array.isArray(data.contacts) ? data.contacts : [];
    
    const contacts: Contact[] = contactsArray.map((c, index) => ({
      id: `contact-${index}`,
      name: c.full_name || "Unknown Contact",
      phone: c.phone ? c.phone.toString() : "",
      // Prioritize organization column, fall back to company, then email, then empty
      organization: c.organization || c.company || c.email || "", 
      lastContacted: normalizeDate(c.last_synced),
      totalCalls: typeof c.call_count === 'number' ? c.call_count : 0,
      selected: false
    }));

    return { calls, contacts };

  } catch (error) {
    console.error("Project Horizon Fetch Error:", error);
    throw error;
  }
};
