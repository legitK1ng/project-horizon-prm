import { CallRecord, Contact, ApiResponse, RawLog, RawContact } from '@/types';
import { formatDuration, normalizeDate, getEnvVar } from '@/utils/helpers';
import { connectionLogger } from '@/utils/connectionLogger';



const API_URL = getEnvVar('VITE_BACKEND_URL');

/**
 * Transform raw log data from Google Sheets to CallRecord format
 */
const transformLog = (log: RawLog, index: number): CallRecord => {
  const rawNotes = log.strategic_notes || '';
  const rawTags = log.tags ? log.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  let brief = undefined;
  let status: CallRecord['status'] = 'QUEUED';

  try {
    const trimmed = rawNotes.trim();

    if (trimmed.startsWith('{')) {
      // JSON format - AI processed
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
        // Handle double-encoded JSON (common in GAS)
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
      } catch (e) {
        console.warn('JSON Parse Error:', e);
        parsed = {};
      }

      brief = {
        title: parsed.title || 'Strategic Brief',
        summary: parsed.summary || 'No summary available.',
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : rawTags,
        sentiment: parsed.sentiment || 'Neutral',
      };
      status = 'COMPLETED';
    } else if (trimmed.length > 10) {
      // Plain text format
      brief = {
        title: 'Executive Summary',
        summary: trimmed,
        actionItems: [],
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
      actionItems: [],
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
    id: `log-${index}-${Date.now()}`,
    timestamp: normalizeDate(log.timestamp),
    contactName: String(log.contact_name || 'Unknown Caller'),
    phoneNumber: log.phone_number?.toString() || log.phone?.toString() || '',
    duration: formatDuration(log.duration),
    transcript: String(log.transcript || ''),
    executiveBrief: brief as CallRecord['executiveBrief'],
    tags: brief?.tags || rawTags,
    status,
  };
};

/**
 * Transform raw contact data to Contact format
 */
const transformContact = (contact: RawContact, index: number): Contact => {
  return {
    id: `contact-${index}-${Date.now()}`,
    name: contact.full_name || 'Unknown Contact',
    phone: contact.phone?.toString() || '',
    organization: contact.organization || contact.company || '',
    lastContacted: normalizeDate(contact.last_synced),
    totalCalls: typeof contact.call_count === 'number' ? contact.call_count : 0,
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

    const response = await fetch(API_URL, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      throw new Error('Access Denied: Received HTML instead of JSON. Check GAS permissions.');
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
    contact_name: call.contactName,
    phone_number: call.phoneNumber,
    transcript: call.transcript,
    duration: typeof call.duration === 'string' ? 0 : call.duration,
    strategic_notes: call.executiveBrief ? JSON.stringify(call.executiveBrief) : '',
    tags: call.executiveBrief?.tags.join(',') || '',
    status: call.status,
  };

  try {
    connectionLogger.addLog('info', method, API_URL, `Transmitting call: ${call.contactName}`);

    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
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
    const response = await fetch(`${API_URL}?action=list_models`);
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
    const response = await fetch(`${API_URL}?action=run_tests`);
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
      `${API_URL}?action=test_gemini`,
      'Testing Gemini Connection...'
    );

    const response = await fetch(`${API_URL}?action=test_gemini`);
    const data = await response.json();

    connectionLogger.addLog(
      response.ok ? 'success' : 'error',
      method,
      `${API_URL}?action=test_gemini`,
      'Gemini Test Complete',
      { details: data, duration: Date.now() - startTime }
    );

    return data;
  } catch (e: any) {
    connectionLogger.addLog(
      'error',
      method,
      `${API_URL}?action=test_gemini`,
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
      `${API_URL}?action=trigger_processing`,
      'Triggering background processing...'
    );

    const response = await fetch(`${API_URL}?action=trigger_processing`);
    const data = await response.json();

    connectionLogger.addLog(
      response.ok ? 'success' : 'error',
      method,
      `${API_URL}?action=trigger_processing`,
      'Processing Triggered',
      { details: data, duration: Date.now() - startTime }
    );

    return data;
  } catch (e: any) {
    connectionLogger.addLog(
      'error',
      method,
      `${API_URL}?action=trigger_processing`,
      'Trigger Failed',
      { details: e.message, duration: Date.now() - startTime }
    );
    return { status: 'error', message: e.message };
  }
};

export const searchPerson = async (query: string): Promise<any> => {
  if (!API_URL) return { found: false };
  try {
    const response = await fetch(`${API_URL}?action=search_person&query=${encodeURIComponent(query)}`);
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
      headers: { 'Content-Type': 'text/plain' }, // Use text/plain to avoid options preflight issues in GAS
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

    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
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
