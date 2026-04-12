import { CallRecord, Contact, ApiResponse, RawLog } from '../types';
import { formatDuration, normalizeDate } from '../utils/helpers';
import { connectionLogger } from '../utils/connectionLogger';



const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_V1 = API_URL.includes('/api/v1') ? API_URL : `${API_URL}/api/v1`;

/**
 * Transform raw log data from Google Sheets to CallRecord format
 */
const transformLog = (log: RawLog, index: number): CallRecord => {
  const rawNotes = log.strategic_notes || '';
  const rawTags = log.tags ? log.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

  let brief = undefined;
  let status: CallRecord['status'] = 'QUEUED';

  try {
    const trimmed = rawNotes.trim();

    if (trimmed.startsWith('{')) {
      // JSON format - AI processed
      const parsed = JSON.parse(trimmed);
      brief = {
        title: parsed.title || 'Strategic Brief',
        summary: parsed.summary || 'No summary available.',
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : (Array.isArray(parsed.actionItems) ? parsed.actionItems : []),
        tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : rawTags,
        sentiment: parsed.sentiment || 'Neutral',
      };
      status = 'COMPLETED';
    } else if (trimmed.length > 10) {
      // Plain text format
      brief = {
        title: 'Executive Summary',
        summary: trimmed,
        action_items: [],
        tags: rawTags,
        sentiment: 'Neutral',
      };
      status = 'COMPLETED';
    }
  } catch (error) {
    console.warn(`Failed to parse brief for log row ${index}:`, error);
    status = 'ERROR';
    brief = {
      title: 'Processing Error',
      summary: 'Raw data could not be parsed.',
      action_items: [],
      tags: ['#error'],
      sentiment: 'Negative',
    };
  }

  // Override with explicit status if provided
  if (log.status) {
    const validStatuses = {
      completed: 'COMPLETED',
      pending: 'QUEUED',
      processing: 'QUEUED',
      error: 'ERROR',
    };
    const lowerStatus = log.status.toLowerCase();
    if (Object.keys(validStatuses).includes(lowerStatus)) {
      status = validStatuses[lowerStatus as keyof typeof validStatuses] as CallRecord['status'];
    }
  }

  return {
    id: (log as any).id || `log-${index}-${Date.now()}`,
    timestamp: normalizeDate(log.timestamp),
    contact_name: String(log.contact_name || 'Unknown Caller'),
    phone_number: (log.phone_number?.toString() || log.phone?.toString() || ''),
    duration: typeof log.duration === 'number' ? formatDuration(log.duration) : String(log.duration || '0:00'),
    transcript: String(log.transcript || (log as any).note || ''),
    executive_brief: brief as CallRecord['executive_brief'],
    tags: brief?.tags || rawTags,
    status,
  };
};

/**
 * Transform raw contact data to Contact format
 */
const transformContact = (contact: any, index: number): Contact => {
  return {
    id: contact.id || `contact-${index}-${Date.now()}`,
    first_name: contact.first_name || contact.name?.split(' ')[0] || 'Unknown',
    last_name: contact.last_name || contact.name?.split(' ').slice(1).join(' ') || '',
    birthdate: contact.birthdate || null,
    name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown Contact',
    phone: contact.phone || contact.phone_number || '',
    email: contact.email || '',
    organization_id: contact.organization_id || contact.company_id || '',
    last_contact_at: normalizeDate(contact.last_contact_at || contact.last_synced),
    total_calls: typeof contact.call_count === 'number' ? contact.call_count : 0,
    health_score: contact.health_score || 0,
    photo_url: contact.photo_url || null,
  };
};

/**
 * Fetch data from Google Apps Script backend
 */
export const fetchProjectHorizonData = async (): Promise<{
  calls: CallRecord[];
  contacts: Contact[];
} | null> => {
  const method = 'GET';

  if (!API_URL || API_URL === '') {
    const msg = 'Backend URL not configured. Using mock data fallback.';
    console.warn(msg);
    connectionLogger.addLog('warning', method, 'N/A', msg);
    return null;
  }

  try {
    connectionLogger.addLog('info', method, API_URL, 'Fetching data...');

    const response = await fetch(`${API_V1}/data`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      throw new Error(`Access Denied: Received HTML instead of JSON. Ensure FastAPI backend is running at ${API_URL}.`);
    }

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as ApiResponse;

    if (data.status === 'error') {
      throw new Error(data.message || 'Server returned an error');
    }

    const logs = Array.isArray(data.logs) ? data.logs : [];
    const contactsData = Array.isArray(data.contacts) ? data.contacts : [];

    const calls = logs.map(transformLog);
    const contacts = contactsData.map(transformContact);

    connectionLogger.addLog('success', method, API_URL, `Fetched ${calls.length} calls, ${contacts.length} contacts`);
    return { calls, contacts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('API Fetch Error:', error);
    connectionLogger.addLog('error', method, API_URL, msg, error);
    throw error;
  }
};

/**
 * Post new call data to backend
 */
export const postCallData = async (call: CallRecord): Promise<boolean> => {
  const method = 'POST';

  if (!API_URL) {
    connectionLogger.addLog('error', method, 'N/A', 'Backend URL not configured');
    throw new Error('Backend URL not configured');
  }

  const payload = {
    contact_name: call.contact_name,
    phone_number: call.phone_number,
    transcript: call.transcript,
    duration: typeof call.duration === 'string' ? 0 : call.duration,
    strategic_notes: call.executive_brief ? JSON.stringify(call.executive_brief) : '',
    tags: call.executive_brief?.tags?.join(',') || '',
    status: call.status,
  };

  try {
    connectionLogger.addLog('info', method, API_URL, `Transmitting call: ${call.contact_name}`);

    const response = await fetch(`${API_V1}/calls`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      connectionLogger.addLog('success', method, API_URL, 'Data transmitted successfully');
      return true;
    } else {
      connectionLogger.addLog('error', method, API_URL, `Upload failed: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('POST Error:', error);
    connectionLogger.addLog('error', method, API_URL, `Network Error: ${msg}`, error);
    return false;
  }
};

/**
 * Fetch available Gemini models
 */
export const fetchModels = async (): Promise<{ models: { name: string; displayName: string }[] } | null> => {
  if (!API_URL) return null;
  try {
    const response = await fetch(`${API_V1}/models`);
    if (!response.ok) throw new Error('Failed to fetch models');
    return await response.json();
  } catch (e) {
    console.error(e);
    return null;
  }
};

/**
 * Run backend diagnostics
 */
export const runBackendDiagnostics = async (): Promise<{ status: string; results: any[] } | null> => {
  if (!API_URL) return null;
  try {
    const response = await fetch(`${API_V1}/diagnostics`);
    if (!response.ok) throw new Error('Failed to run diagnostics');
    return await response.json();
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const testGeminiConnection = async (): Promise<any> => {
  if (!API_URL) return null;
  const method = 'testGeminiConnection';
  const startTime = Date.now();

  try {
    connectionLogger.addLog(
      'info',
      method,
      `${API_URL}/test-gemini`,
      'Testing Gemini Connection...'
    );

    const response = await fetch(`${API_V1}/test-gemini`);
    const data = await response.json();

    connectionLogger.addLog(
      response.ok ? 'success' : 'error',
      method,
      `${API_URL}/test-gemini`,
      'Gemini Test Complete',
      { details: data, duration: Date.now() - startTime }
    );

    return data;
  } catch (e: any) {
    connectionLogger.addLog(
      'error',
      method,
      `${API_URL}/test-gemini`,
      'Gemini Test Failed',
      { details: e.message, duration: Date.now() - startTime }
    );
    return { status: 'error', message: e.message };
  }
};

export const triggerProcessing = async (): Promise<any> => {
  if (!API_URL) return null;
  const method = 'triggerProcessing';
  const startTime = Date.now();

  try {
    connectionLogger.addLog(
      'info',
      method,
      `${API_URL}/trigger-processing`,
      'Triggering background processing...'
    );

    const response = await fetch(`${API_V1}/trigger-processing`);
    const data = await response.json();

    connectionLogger.addLog(
      response.ok ? 'success' : 'error',
      method,
      `${API_URL}/trigger-processing`,
      'Processing Triggered',
      { details: data, duration: Date.now() - startTime }
    );

    return data;
  } catch (e: any) {
    connectionLogger.addLog(
      'error',
      method,
      `${API_URL}/trigger-processing`,
      'Trigger Failed',
      { details: e.message, duration: Date.now() - startTime }
    );
    return { status: 'error', message: e.message };
  }
};

export const searchPerson = async (query: string): Promise<any> => {
  if (!API_URL) return { found: false };
  try {
    const response = await fetch(`${API_V1}/search-person?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search person');
    return await response.json();
  } catch (e: any) {
    console.error('Person Search Error:', e);
    return { found: false, error: e.message };
  }
};

export const updatePerson = async (personData: any): Promise<any> => {
  if (!API_URL) return { status: 'error', message: 'API URL not configured' };

  try {
    const payload = {
      action: 'update_person',
      ...personData
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to update person');
    const result = await response.json();
    return result;
  } catch (e: any) {
    console.error('Person Update Error:', e);
    return { status: 'error', message: e.message };
  }
};

export const analyzeText = async (transcript: string): Promise<any> => {
  if (!API_URL) return { title: 'Error', summary: 'API URL not configured', actionItems: [], tags: ['#error'], sentiment: 'Neutral' };

  try {
    const payload = {
      action: 'analyze_text',
      transcript: transcript
    };

    const response = await fetch(`${API_V1}/analyze`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to analyze text');

    const result = await response.json();
    if (result.status === 'success' && result.data) {
      return result.data;
    } else {
      throw new Error(result.message || 'Analysis failed');
    }
  } catch (e: any) {
    console.error('Analysis Error:', e);
    return {
      title: 'Analysis Failed',
      summary: `Error: ${e.message}. Please check backend logs.`,
      actionItems: [],
      tags: ['#error'],
      sentiment: 'Negative'
    };
  }
};
