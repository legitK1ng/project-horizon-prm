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
      const parsed = JSON.parse(trimmed);
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
    phoneNumber: log.phone?.toString() || '',
    duration: formatDuration(log.duration),
    transcript: String(log.transcript || ''),
    executiveBrief: brief as CallRecord['executiveBrief'],
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
