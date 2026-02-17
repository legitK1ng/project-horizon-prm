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
  console.log('Webhook received', JSON.stringify(e.parameter));
  logToCloud('INFO', 'Webhook received');

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(LOG_SHEET_NAME, HEADERS.LOGS);

    // Parse incoming data
    let params = {};
    let isBatch = false;

    if (e.postData && e.postData.contents) {
      try {
        const payload = JSON.parse(e.postData.contents);
        if (Array.isArray(payload)) {
          // BATCH HANDLING
          const rows = [];
          payload.forEach(item => {
            // Extract fields for each item
            const pDate = item.timestamp ? new Date(item.timestamp) : new Date();
            const pName = item.contact_name || 'Unknown';
            const pPhone = item.phone_number || '';
            const pDur = item.duration || 0;
            const pTrans = item.transcript || item.note || '';

            // Fix: Check if it's already a string (double encoding prevention)
            let pNotes = '';
            if (item.strategic_notes) {
              pNotes = typeof item.strategic_notes === 'string'
                ? item.strategic_notes
                : JSON.stringify(item.strategic_notes);
            }

            rows.push([
              pDate, pName, pPhone, pDur, pTrans, pNotes, '#batch_import', 'QUEUED', ''
            ]);
          });

          if (rows.length > 0) {
            sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
            return ContentService.createTextOutput(`Batch success: ${rows.length} rows`);
          }
          return ContentService.createTextOutput('Batch empty');
        } else {
          params = payload;
        }
      } catch {
        params = e.parameter || {};
      }
    } else {
      params = e.parameter || {};
    }

    // UPDATE PERSON ACTION
    if (params.action === 'update_person') {
      const result = updatePerson(params);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    // ORIGINAL SINGLE RECORD LOGIC FOLLOWS...

    // ANALYZE TEXT ACTION (Gemini)
    if (params.action === 'analyze_text') {
      const transcript = params.transcript || '';
      try {
        const analysis = callGeminiAPI(transcript);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: analysis }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ROUTING: Check for Call Report signature & Map to Logs
    // ...


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
        typeof noteData === 'string' ? noteData : JSON.stringify(noteData), // strategic_notes
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
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().toLowerCase().trim());

      let idColIndex = headers.indexOf('external id');
      if (idColIndex === -1) idColIndex = headers.indexOf('external_id');

      if (idColIndex > -1) {
        // This is expensive O(N) but safe for reasonable sizes. 
        // For massive sheets, we'd want a separate index sheet or CacheService.
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

    // Timestamp Logic: Use provided timestamp (for imports) or current time
    let timestamp = new Date();
    if (params.timestamp) {
      const parsedDate = new Date(params.timestamp);
      if (!isNaN(parsedDate.getTime())) {
        timestamp = parsedDate;
      }
    }

    // Append to sheet with provided details
    sheet.appendRow([
      timestamp,
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
    const action = e.parameter.action;

    if (action === 'list_models') {
      return ContentService.createTextOutput(JSON.stringify(getGeminiModels()))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'run_tests') {
      return ContentService.createTextOutput(JSON.stringify(runBackendTests()))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'test_gemini') {
      const result = testGeminiConnection();
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'trigger_processing') {
      const result = processQueue(); // Call processQueue manually
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        processed: result
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'search_person') {
      const query = e.parameter.query;
      // Note: Requires "People API" Advanced Service enabled in Apps Script
      const result = searchPerson(query);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Moved sheet fetching inside try/catch or keep it specific?
    // Let's just wrap the actions for now, or the whole thing.
    // The structure of the file makes it hard to wrap *everything* without replacing the huge block.
    // Let's just wrap the actions section.

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName('Logs');
    // Explicitly name the Contacts sheet if it isn't already a variable
    const contactSheet = ss.getSheetByName('Contacts_Sync');

    // 1. Define how many columns are ACTUAL data (e.g., 4 columns for Contacts)
    // Adjust these numbers to match your real sheet layout!
    const logColumns = 12;       // Expanded to 12 to capture A-L (User has formulas in F, L, M, N)
    const contactColumns = 6;   // Expanded to capture all contact fields

    // 2. Fetch only that specific box of data
    // getRange(row, col, numRows, numCols)
    // We use getDisplayValues() to avoid formula errors and date object issues
    const logsRaw = logSheet
      ? logSheet.getRange(1, 1, logSheet.getLastRow(), logColumns).getDisplayValues()
      : [];

    const contactsRaw = contactSheet
      ? contactSheet.getRange(1, 1, contactSheet.getLastRow(), contactColumns).getDisplayValues()
      : [];

    const response = {
      status: 'success',
      logs: dataToJSON(logsRaw),       // Convert Array[][] to Object[]
      contacts: dataToJSON(contactsRaw), // Convert Array[][] to Object[]
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
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

  // Dynamic Header Detection (Scan first 10 rows)
  let headerRowIndex = -1;
  let headers = [];

  for (let r = 0; r < Math.min(data.length, 10); r++) {
    const rowStr = data[r].map(h => h.toString().toLowerCase().trim());
    if (rowStr.indexOf('status') > -1) {
      headerRowIndex = r;
      headers = rowStr;
      break;
    }
  }

  if (headerRowIndex === -1) {
    logToCloud('CRITICAL', 'Status column not found in first 10 rows');
    return;
  }

  const COL_STATUS = headers.indexOf('status');
  const COL_TRANSCRIPT = headers.indexOf('transcript');
  const COL_NOTES = headers.indexOf('strategic notes') > -1 ? headers.indexOf('strategic notes') : headers.indexOf('strategic_notes');
  const COL_TAGS = headers.indexOf('tags');

  // ... (rest of function uses headers/COL_X correctly)

  let processedCount = 0;
  const BATCH_LIMIT = 15; // Increased to 15 for visibility

  // Count/Log Queue Size for debugging
  const queuedCount = data.filter((r, idx) => idx > headerRowIndex && r[COL_STATUS] === 'QUEUED').length;
  console.log(`Found ${queuedCount} items waiting in QUEUE. Processing batch of ${BATCH_LIMIT}...`);

  // Start processing AFTER the header row
  console.log(`Searching for QUEUED items starting at row ${headerRowIndex + 2}...`);

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    if (processedCount >= BATCH_LIMIT) break;

    const row = data[i];
    // console.log(`Row ${i+1} Status: ${row[COL_STATUS]}`); // Uncomment for verbose logging

    if (row[COL_STATUS] === 'QUEUED') {
      console.log(`Processing Row ${i + 1}...`);
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
            const colNameIdx = headers.indexOf('contact name') > -1 ? headers.indexOf('contact name') : headers.indexOf('contact_name');
            const currentName = row[colNameIdx];
            if (!currentName || currentName === 'Unknown Caller' || currentName === 'Manual Entry') {
              const newName = analysis.detected_contact.name;
              const colContact = colNameIdx;
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
  return processedCount;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function dataToJSON(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0].map((h) => h.toString().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((row) => {
    let obj = {};
    headers.forEach((h, i) => {
      // FIX: Handle Excel Serial Dates in Timestamp (Column 0, key 'timestamp')
      if (h === 'timestamp' && typeof row[i] === 'number' && row[i] > 40000) {
        // approximate conversion: (serial - 25569) * 86400 * 1000
        const date = new Date((row[i] - 25569) * 86400 * 1000);
        obj[h] = date.toISOString();
      } else {
        obj[h] = row[i];
      }
    });
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

/**
 * COMPLETELY RESET THE LOGS SHEET (DANGER)
 * Clears all content and resets headers.
 * Use for schema alignment.
 */
function resetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
  }
  sheet.appendRow(HEADERS.LOGS);
  // Format Header Row
  sheet.getRange(1, 1, 1, HEADERS.LOGS.length).setFontWeight('bold').setBackground('#f3f3f3');
  sheet.setFrozenRows(1);
  logToCloud('WARNING', 'Logs Sheet Reset Complete');
  return 'Reset Complete';
}

/**
 * DATA SAFEGUARD: ENFORCE SCHEMA
 * Scans, Identifies Anchors, Realigns, and Type Casts.
 * Run this after imports to self-heal data.
 */
function enforceSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) return 'Sheet not found';

  const data = sheet.getDataRange().getValues();
  // Assume Row 1 is Headers. Start at Row 2.
  if (data.length < 2) return 'No data to clean';

  // Column Indices (0-based) based on "The Schema"
  // Timestamp=0, Contact=1, Phone=2, Duration=3, Transcript=4, Notes=5, Tags=6, Status=7, ExtID=8
  const IDX = {
    TIMESTAMP: 0,
    CONTACT: 1,
    PHONE: 2,
    DURATION: 3,
    TRANSCRIPT: 4,
    NOTES: 5,
    TAGS: 6,
    STATUS: 7,
    EXT_ID: 8
  };

  let updates = 0;

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let changed = false;

    // 1. ANCHOR: TIMESTAMP (Column 0)
    if (!isValidDate(row[IDX.TIMESTAMP])) {
      // Search row for date
      const foundDateIdx = row.findIndex(cell => isValidDate(cell));
      if (foundDateIdx !== -1) {
        row[IDX.TIMESTAMP] = new Date(row[foundDateIdx]);
        if (foundDateIdx !== IDX.TIMESTAMP) row[foundDateIdx] = ''; // Clear source
        changed = true;
        console.log(`Row ${i + 1}: Moved Timestamp from Col ${foundDateIdx} to ${IDX.TIMESTAMP}`);
      }
    }

    // 2. ANCHOR: TRANSCRIPT (Column 4)
    // Look for long text (>50 chars)
    if (typeof row[IDX.TRANSCRIPT] !== 'string' || row[IDX.TRANSCRIPT].length < 20) {
      // Potential misalignment. Scan row.
      const foundTransIdx = row.findIndex(cell => typeof cell === 'string' && cell.length > 50 && !isJsonString(cell));
      if (foundTransIdx !== -1 && foundTransIdx !== IDX.TRANSCRIPT) {
        row[IDX.TRANSCRIPT] = row[foundTransIdx];
        if (foundTransIdx !== IDX.NOTES) row[foundTransIdx] = ''; // Clear source unless it's notes (which shouldn't happen due to check)
        changed = true;
        console.log(`Row ${i + 1}: Moved Transcript from Col ${foundTransIdx} to ${IDX.TRANSCRIPT}`);
      }
    }

    // 3. ANCHOR: STRATEGIC NOTES (Column 5)
    // Look for JSON string
    if (!isJsonString(row[IDX.NOTES])) {
      const foundJsonIdx = row.findIndex(cell => isJsonString(cell));
      if (foundJsonIdx !== -1 && foundJsonIdx !== IDX.NOTES) {
        row[IDX.NOTES] = row[foundJsonIdx];
        if (foundJsonIdx !== IDX.TRANSCRIPT) row[foundJsonIdx] = '';
        changed = true;
        console.log(`Row ${i + 1}: Moved JSON from Col ${foundJsonIdx} to ${IDX.NOTES}`);
      }
    }

    // 4. TYPE CAST & CLEANUP
    // Phone -> String
    if (row[IDX.PHONE] && typeof row[IDX.PHONE] !== 'string') {
      row[IDX.PHONE] = row[IDX.PHONE].toString();
      changed = true;
    }

    // Status -> Ensure Enum
    const validStatus = ['QUEUED', 'COMPLETED', 'SKIPPED_SHORT', 'ERROR'];
    if (!validStatus.includes(row[IDX.STATUS])) {
      if (row[IDX.TRANSCRIPT]) {
        // Safe default: If we have transcript + notes, it's completed. Else QUEUED.
        row[IDX.STATUS] = (row[IDX.NOTES] && row[IDX.NOTES].length > 5) ? 'COMPLETED' : 'QUEUED';
        changed = true;
      } else {
        row[IDX.STATUS] = 'ERROR';
        changed = true;
      }
    }

    // UPDATE SHEET
    if (changed) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      updates++;
    }
  }

  if (updates > 0) logToCloud('INFO', `Cleanup: Updated ${updates} rows.`);
  return `Cleanup Complete. Updated ${updates} rows.`;
}

// === HELPERS ===

function isValidDate(d) {
  if (Object.prototype.toString.call(d) === "[object Date]") {
    return !isNaN(d.getTime());
  }
  if (typeof d === 'string' && d.length > 10) {
    const t = Date.parse(d);
    return !isNaN(t);
  }
  return false;
}

function isJsonString(str) {
  if (typeof str !== 'string') return false;
  try {
    const o = JSON.parse(str);
    if (o && typeof o === "object") return true;
  } catch (e) { }
  return false;
}

// ============================================================================
// PEOPLE API (Advanced Service)
// ============================================================================

function searchPerson(query) {
  if (!query) return { found: false };

  try {
    // Search for contacts
    // readMask: names, photos, emailAddresses, phoneNumbers, organizations
    const people = People.People.searchContacts({
      query: query,
      readMask: 'names,photos,emailAddresses,phoneNumbers,organizations',
      pageSize: 1
    });

    if (people.results && people.results.length > 0) {
      const person = people.results[0].person;

      const name = person.names ? person.names[0].displayName : '';
      const photoUrl = person.photos ? person.photos[0].url : '';
      const email = person.emailAddresses ? person.emailAddresses[0].value : '';
      const org = person.organizations ? person.organizations[0].name : '';
      const title = person.organizations ? person.organizations[0].title : '';

      return {
        found: true,
        name: name,
        photoUrl: photoUrl,
        email: email,
        organization: org,
        title: title,
        resourceName: person.resourceName,
        etag: person.etag
      };
    }
  } catch (e) {
    console.error('People Search Error:', e);
    return {
      found: false,
      error: e.message,
      note: 'Ensure People API Advanced Service is enabled in Apps Script'
    };
  }

  return { found: false };
}

function updatePerson(params) {
  const resourceName = params.resourceName;
  const etag = params.etag;

  if (!resourceName || !etag) {
    return { status: 'error', message: 'Missing resourceName or etag' };
  }

  const person = {
    etag: etag,
    names: params.name ? [{ givenName: params.name.split(' ')[0], familyName: params.name.split(' ').slice(1).join(' ') }] : undefined,
    organizations: (params.organization || params.title) ? [{ name: params.organization, title: params.title }] : undefined,
    emailAddresses: params.email ? [{ value: params.email }] : undefined,
    phoneNumbers: params.phone ? [{ value: params.phone }] : undefined
  };

  // Construct update mask based on provided fields
  const updateFields = [];
  if (params.name) updateFields.push('names');
  if (params.organization || params.title) updateFields.push('organizations');
  if (params.email) updateFields.push('emailAddresses');
  if (params.phone) updateFields.push('phoneNumbers');

  if (updateFields.length === 0) {
    return { status: 'success', message: 'No fields to update' };
  }

  try {
    const updatedContact = People.People.updateContact(person, resourceName, {
      updatePersonFields: updateFields.join(',')
    });

    return {
      status: 'success',
      person: {
        name: updatedContact.names ? updatedContact.names[0].displayName : '',
        etag: updatedContact.etag
      }
    };
  } catch (e) {
    console.error('People Update Error:', e);
    return { status: 'error', message: e.message };
  }
}
