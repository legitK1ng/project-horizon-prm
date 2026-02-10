/**
 * PROJECT HORIZON PRM - MAIN BACKEND CONTROLLER
 * Google Apps Script Backend
 * 
 * Handles:
 * - doPost: Webhook receiver for ACR Phone app
 * - doGet: API endpoint for frontend data fetching
 * - processQueue: Background Gemini processing (time-trigger)
 */

// ============================================================================
// WEBHOOK INGESTION (doPost)
// ============================================================================

function doPost(e) {
  logToCloud('INFO', 'Webhook received');

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(LOG_SHEET_NAME, HEADERS.LOGS);

    // Parse incoming data
    let params = {};
    if (e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch {
        params = e.parameter || {};
      }
    } else {
      params = e.parameter || {};
    }

    // ROUTING: Check for Call Report signature & Map to Logs
    // The new feature sends: direction, date, number, contact, etc.
    if (params.number !== undefined && params.direction !== undefined && params.date !== undefined) {
      // Map ACR fields to Logs
      const rawDate = params.date || '';
      const directionMap = { '1': 'Incoming', '2': 'Outgoing', '3': 'Missed', '5': 'Rejected' };
      const direction = directionMap[params.direction] || params.direction || 'Unknown';
      
      const noteData = {
        source: 'ACR_REPORT',
        direction: direction,
        raw_date: rawDate
      };
      
      const transcriptText = params.notes || `Call Report: ${direction}`;
      
      sheet.appendRow([
        new Date(), // timestamp
        params.contact || 'Unknown', // contact_name
        params.number || '', // phone
        params.duration || 0, // duration
        transcriptText, // transcript
        JSON.stringify(noteData), // strategic_notes
        '#call_report', // tags
        'COMPLETED', // status
        rawDate // external_id
      ]);
      
      logToCloud('INFO', `Call Report Saved to Logs: ${params.number}`);
      return ContentService.createTextOutput('Success: Report Saved');
    }

    const transcript = params.transcript || params.note || '';
    const contactNameParam = params.contact_name || params.name;
    const phone = params.phone_number || params.phone || '';
    const externalId = params.external_id ? params.external_id.toString() : '';

    // DEDUPLICATION CHECK
    // If external_id exists, check if we already have it.
    if (externalId) {
       const idColIndex = HEADERS.LOGS.indexOf('external_id');
       if (idColIndex > -1) {
         // This is expensive O(N) but safe for reasonable sizes. 
         // For massive sheets, we'd want a separate index sheet or CacheService.
         const data = sheet.getDataRange().getValues();
         // Start from row 1 (skip header)
         for (let i = 1; i < data.length; i++) {
           if (data[i][idColIndex].toString() === externalId) {
             // SMART UPDATE: Check if we can improve existing data
             const rowIdx = i + 1;
             const nameIdx = HEADERS.LOGS.indexOf('contact_name');
             const existingName = data[i][nameIdx];

             // If existing is Unknown and new is known, UPDATE it.
             if (existingName === 'Unknown Caller' && contactNameParam && contactNameParam !== 'Unknown Caller') {
                sheet.getRange(rowIdx, nameIdx + 1).setValue(contactNameParam);
                logToCloud('INFO', `Updated row ${rowIdx} name: ${contactNameParam}`);
                return ContentService.createTextOutput('Updated: Contact Name'); 
             }

             logToCloud('INFO', `Skipped duplicate ID: ${externalId}`);
             return ContentService.createTextOutput('Skipped: Duplicate');
           }
         }
       }
    }
    
    // SMART CONTACT MATCHING
    
    // SMART CONTACT MATCHING
    let contactName = contactNameParam || 'Unknown Caller';
    
    if (phone) {
      // 1. Normalize input phone (remove non-digits, take last 10)
      const cleanInput = phone.toString().replace(/\D/g, '').slice(-10);
      
      if (cleanInput.length >= 10) {
        // 2. Search Contacts Sheet
        const contactSheet = ss.getSheetByName('Contacts_Sync');
        if (contactSheet) {
          const data = contactSheet.getDataRange().getValues();
          // Assuming Name is col 0, Phone is col 1 (adjust based on actual sheet structure)
          // Based on apiService.ts transformContact: Full Name, Phone...
          // We need header mapping or assume column indices? 
          // Safer to find column by header.
          const headers = data[0].map(h => h.toString().toLowerCase());
          const nameIdx = headers.indexOf('full name') > -1 ? headers.indexOf('full name') : 0;
          const phoneIdx = headers.indexOf('phone') > -1 ? headers.indexOf('phone') : 1;
          
          for (let i = 1; i < data.length; i++) {
            const rowPhone = data[i][phoneIdx].toString().replace(/\D/g, '').slice(-10);
            if (rowPhone === cleanInput) {
              contactName = data[i][nameIdx];
              logToCloud('INFO', `Matched phone ${phone} to ${contactName}`);
              break;
            }
          }
        }
      }
    }
    const duration = params.duration || 0;
    const strategic_notes = params.strategic_notes || '';
    const tags = params.tags || '';
    const status = params.status || 'QUEUED';

    // Skip if no transcript
    if (!transcript && !params.test) {
      logToCloud('WARNING', 'Skipped: Missing transcript');
      return ContentService.createTextOutput('Skipped: No transcript');
    }

    // Append to sheet with provided details
    sheet.appendRow([
      new Date(),
      contactName,
      phone,
      duration,
      transcript,
      strategic_notes,
      tags,
      status,
      externalId, 
    ]);

    logToCloud('INFO', `Saved call from: ${contactName}`);
    return ContentService.createTextOutput('Success');
  } catch (error) {
    logToCloud('CRITICAL', `Webhook Failed: ${error.message}`);
    return ContentService.createTextOutput('Error: ' + error.message);
  }
}

// ============================================================================
// DATA API (doGet)
// ============================================================================

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    const contactSheet = ss.getSheetByName('Contacts_Sync');
    const callReportSheet = ss.getSheetByName(CALL_REPORT_SHEET_NAME);

    const response = {
      status: 'success',
      logs: logSheet ? dataToJSON(logSheet.getDataRange().getValues()) : [],
      contacts: contactSheet ? dataToJSON(contactSheet.getDataRange().getValues()) : [],
    };

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// BACKGROUND PROCESSOR (Time-driven Trigger)
// ============================================================================

function processQueue() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const COL_STATUS = headers.indexOf('status');
  const COL_TRANSCRIPT = headers.indexOf('transcript');
  const COL_NOTES = headers.indexOf('strategic_notes');
  const COL_TAGS = headers.indexOf('tags');

  if (COL_STATUS === -1) {
    logToCloud('CRITICAL', 'Status column not found');
    return;
  }

  let processedCount = 0;
  const BATCH_LIMIT = 3; // Process 3 calls per run

  for (let i = 1; i < data.length; i++) {
    if (processedCount >= BATCH_LIMIT) break;

    const row = data[i];
    if (row[COL_STATUS] === 'QUEUED') {
      const rowIndex = i + 1;
      const transcript = row[COL_TRANSCRIPT];

      try {
        if (transcript && transcript.length > 50) {
          const analysis = callGeminiAPI(transcript);

          // 1. Update Analysis Column (store full JSON for frontend parsing)
          // We assume analysis is a JSON object. We stringify it for storage.
          sheet.getRange(rowIndex, COL_NOTES + 1).setValue(JSON.stringify(analysis));
          
          // 2. Update Tags
          const tags = Array.isArray(analysis.tags) ? analysis.tags.join(', ') : analysis.tags;
          sheet.getRange(rowIndex, COL_TAGS + 1).setValue(tags);

          // 3. Smart Data Filling: Update Contact Name if 'Unknown' and Gemini found one
          if (analysis.detected_contact && analysis.detected_contact.name) {
             const currentName = row[headers.indexOf('contact_name')];
             if (!currentName || currentName === 'Unknown Caller' || currentName === 'Manual Entry') {
               const newName = analysis.detected_contact.name;
               const colContact = headers.indexOf('contact_name');
               if (colContact > -1) {
                  sheet.getRange(rowIndex, colContact + 1).setValue(newName);
                  logToCloud('INFO', `Gemini updated name for Row ${rowIndex} to ${newName}`);
               }
             }
          }

          sheet.getRange(rowIndex, COL_STATUS + 1).setValue('COMPLETED');
          logToCloud('INFO', `Processed Row ${rowIndex}`);
          Utilities.sleep(5000); // 5s delay
        } else {
          sheet.getRange(rowIndex, COL_STATUS + 1).setValue('SKIPPED_SHORT');
        }

        processedCount++;
      } catch (e) {
        if (e.message.includes('429')) {
          logToCloud('WARNING', 'Rate limit hit. Pausing queue.');
          break;
        }

        logToCloud('ERROR', `Row ${rowIndex} failed: ${e.message}`);
        sheet.getRange(rowIndex, COL_STATUS + 1).setValue('ERROR');
      }
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function dataToJSON(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0].map((h) => h.toString().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((row) => {
    let obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

// ============================================================================
// CALL REPORT HANDLER
// ============================================================================

// function processCallReport(params) { ... } // REMOVED

// ============================================================================
// CALENDAR IMPORT (Backfill)
// ============================================================================

function importCalendarHistory(daysToLookBack = 30) {
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) {
    console.error('Calendar not found: ' + CALENDAR_ID);
    return 'Error: Calendar not found';
  }

  const sheet = getOrCreateSheet(LOG_SHEET_NAME, HEADERS.LOGS);
  const existingData = sheet.getDataRange().getValues();
  // Deduplication Set
  const existingKeys = new Set();
  
  // Skip header
  for (let i = 1; i < existingData.length; i++) {
     const row = existingData[i];
     // Check external_id column (index 8)
     const extId = row[8] ? row[8].toString() : '';
     if (extId) existingKeys.add(extId);
  }

  const now = new Date();
  const startTime = new Date(now.getTime() - (daysToLookBack * 24 * 60 * 60 * 1000));
  
  const events = cal.getEvents(startTime, now);
  console.log(`Found ${events.length} events in the last ${daysToLookBack} days.`);
  
  let addedCount = 0;
  
  for (const event of events) {
    const title = event.getTitle();
    const desc = event.getDescription();
    const date = event.getStartTime();
    const eventId = event.getId(); // Use Calendar Event ID as external_id
    
    if (existingKeys.has(eventId)) {
      continue;
    }
    
    // Parse details (same logic as before)
    let number = '';
    let contact = 'Unknown';
    let direction = 'Unknown';
    let duration = 0;
    
    const lines = desc.split('\n');
    for (const line of lines) {
      if (line.startsWith('Phone:')) number = line.substring(6).trim();
      else if (line.startsWith('Name:')) contact = line.substring(5).trim();
      else if (line.startsWith('Type:')) direction = line.substring(5).trim();
      else if (line.startsWith('Duration:')) duration = line.substring(9).trim();
    }
    
    if (!number && title.includes(':')) {
       const parts = title.split(':');
       if (parts.length > 1) number = parts[1].trim();
    }
    
    const noteData = {
        source: 'CALENDAR_IMPORT',
        direction: direction,
        original_date: date.toISOString()
    };
    
    sheet.appendRow([
      date, // timestamp (use actual call time)
      contact, // contact_name
      number, // phone
      duration, // duration
      desc || title, // transcript (use desc or title)
      JSON.stringify(noteData), // strategic_notes
      '#calendar_import', // tags
      'COMPLETED', // status
      eventId // external_id
    ]);
    
    addedCount++;
  }
  
  console.log(`Imported ${addedCount} new calls.`);
  return `Success: Imported ${addedCount} calls.`;
}
