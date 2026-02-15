/**
 * PROJECT HORIZON PRM - CONFIGURATION & UTILITIES
 * Google Apps Script Backend Configuration
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROJECT_NUMBER = '5744119255'; // Replace with your GCP project number
const LOG_SHEET_NAME = 'Logs';
const CALL_REPORT_SHEET_NAME = 'call_report';
const CALENDAR_ID = 'classroom106114988262286153479@group.calendar.google.com';
const SPREADSHEET_ID = '1IHUhndDYoTQzClUDN4U-aHTE1R5RSWZ8DdNEoEJF9Ew'; // Explicit ID
const GEMINI_SECRET_NAME = `projects/${PROJECT_NUMBER}/secrets/GEMINI_API_KEY/versions/latest`;

const HEADERS = {
  LOGS: [
    'Timestamp',
    'Contact Name',
    'Phone Number',
    'Duration',
    'Transcript',
    'Strategic Notes',
    'Tags',
    'Status',
    'External ID',
  ],
};

// ============================================================================
// GEMINI API
// ============================================================================

function listModel() {
  // Use your existing helper function to get the key from Script Properties
  const apiKey = getGeminiKey();

  if (!apiKey) {
    console.error("API Key not found in Script Properties.");
    return [];
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey;

  try {
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());

    // This will log the full list to your Execution Log so you can see them
    if (json.models) {
      const modelNames = json.models.map(model => model.name);
      console.log("Available Models:", modelNames);
      return modelNames;
    }
  } catch (e) {
    console.error("Error fetching models: " + e.toString());
  }
  return [];
}
function callGeminiAPI(transcript) {
  const key = getGeminiKey();
  if (!key) throw new Error('API Key missing');

  const model = getLatestFlashModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`;

  const prompt = `You are a CRM Intelligence Agent.
Analyze this call transcript and extract key data.
Return STRICT JSON only (no markdown, no blocks):
{
  "title": "Short title for the conversation",
  "summary": "Concise executive summary of the call",
  "actionItems": ["Action 1", "Action 2"],
  "tags": ["#tag1", "#tag2"],
  "sentiment": "Positive" | "Neutral" | "Negative",
  "detected_contact": {
    "name": "Name if mentioned, else null",
    "organization": "Organization if mentioned, else null"
  }
}

Transcript: ${transcript}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() !== 200) {
    const errorText = response.getContentText();
    logToCloud('ERROR', `Gemini API failed: ${errorText}`);
    throw new Error(`Gemini Error ${response.getResponseCode()}: ${errorText}`);
  }

  const json = JSON.parse(response.getContentText());

  if (!json.candidates || !json.candidates[0].content) {
    return { brief: 'Analysis Blocked', tags: '#error' };
  }

  const text = json.candidates[0].content.parts[0].text;
  const cleanText = text.replace(/```json|```/g, '').trim();

  return JSON.parse(cleanText);
}

// ============================================================================
// SECRET MANAGER
// ============================================================================

// ============================================================================
// SECRET MANAGER & PROPERTIES
// ============================================================================

function getGeminiKey() {
  // 1. Try Script Properties (Easier Setup)
  try {
    const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (key) return key;
  } catch (e) {
    console.warn('Script Properties access failed:', e);
  }

  // 2. Try Secret Manager (Advanced GCP Setup)
  if (!PROJECT_NUMBER || PROJECT_NUMBER === 'YOUR_PROJECT_NUMBER') {
    console.timeEnd('Gemini Auth');
    return null; // Stop here if no project number
  }

  const url = `https://secretmanager.googleapis.com/v1/${GEMINI_SECRET_NAME}:access`;
  const params = {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, params);
    if (response.getResponseCode() !== 200) throw new Error(response.getContentText());

    const data = JSON.parse(response.getContentText());
    return Utilities.newBlob(Utilities.base64Decode(data.payload.data)).getDataAsString();
  } catch (e) {
    logToCloud('CRITICAL', `Secret Manager failed: ${e.message}`);
    return null;
  }
}

// ============================================================================
// CLOUD LOGGING
// ============================================================================

function logToCloud(severity, message) {
  // Fallback to console if GCP is not configured
  if (!PROJECT_NUMBER || PROJECT_NUMBER === 'YOUR_PROJECT_NUMBER') {
    console.log(`[${severity}] ${message}`);
    return;
  }

  const url = 'https://logging.googleapis.com/v2/entries:write';
  const payload = {
    logName: `projects/${PROJECT_NUMBER}/logs/horizon_backend`,
    resource: { type: 'global' },
    entries: [{ severity, textPayload: message }],
  };

  const params = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    UrlFetchApp.fetch(url, params);
  } catch (e) {
    console.error('Cloud logging failed:', e);
  }
}

// ============================================================================
// SETUP UTILITY
// ============================================================================

function oneTimeSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateSheet(LOG_SHEET_NAME, HEADERS.LOGS);
  logToCloud('INFO', 'Setup complete. Sheets verified.');
}

/**
 * Automatically selects the latest available Flash model.
 */
function getLatestFlashModel() {
  try {
    const models = listModel();
    // Filter for standard 'flash' models
    const flashModels = models.filter(name =>
      name.includes('flash') &&
      !name.includes('preview') &&
      !name.includes('lite') &&
      !name.includes('audio')
    );

    // Sort to get the highest version first (e.g., 2.5 > 2.0 > 1.5)
    flashModels.sort().reverse();

    const selected = flashModels[0] || 'models/gemini-1.5-flash';
    console.log("Selected Model: " + selected);
    return selected;
  } catch (e) {
    console.warn("Could not auto-select model, defaulting to 1.5-flash");
    return 'models/gemini-1.5-flash';
  }
}

function testGeminiConnection() {
  const fakeTranscript = "Caller: Hello, I'd like to order a pizza. Agent: Sure, what kind? Caller: Pepperoni.";

  console.log("Testing Gemini connection...");
  try {
    const result = callGeminiAPI(fakeTranscript);
    console.log("SUCCESS! Gemini returned:", JSON.stringify(result));
    return { status: 'success', data: result };
  } catch (e) {
    console.error("TEST FAILED: " + e.message);
    return { status: 'error', message: e.message };
  }
}