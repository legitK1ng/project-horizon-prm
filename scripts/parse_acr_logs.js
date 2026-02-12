
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

// CONFIGURATION
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, '../ACR Phone.html');
const OUTPUT_FILE = path.join(__dirname, '../parsed_logs.json');

/**
 * Parses ACR Phone.html using a Bottom-Up strategy.
 */
function parseACRLogs() {
    console.log('🚀 Starting ACR Parsing...');

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ File not found: ${INPUT_FILE}`);
        return;
    }

    const html = fs.readFileSync(INPUT_FILE, 'utf8');
    const $ = cheerio.load(html);
    const validCalls = [];

    // 1. Get all list items in reverse order (Bottom-Up)
    // We select direct children <li> of the main list (assuming structural consistency)
    // If strict hierarchy is unknown, selecting all 'li' is safer but requires filtering.
    const allItems = $('li').toArray().reverse();

    let currentDate = null;

    console.log(`🔍 Processing ${allItems.length} items...`);

    for (const element of allItems) {
        const $el = $(element);

        // A. Check for Date Header
        if ($el.hasClass('date-header')) {
            // Update current date context
            // Format example: "Jan 28, 2026"
            currentDate = $el.text().trim();
            continue; // Move to next item (which is essentially 'previous' in time)
        }

        // B. It's a Call Record (or garbage)
        // We look for the anchor tag with details
        const $link = $el.find('a[href*="job=db"]');
        if ($link.length === 0) continue;

        if (!currentDate) {
            // console.warn('⚠️ Found call record before any Date Header. Skipping orphan.');
            continue;
        }

        // EXTRACT DETAILS
        const fullTitle = $link.text().trim(); // "Kiana Stewart @ 11:27 AM" or "+1 555... @ ..."
        // Split by last occurrence of ' @ ' in case name has @
        const lastAtIndex = fullTitle.lastIndexOf(' @ ');
        if (lastAtIndex === -1) continue;

        const contactNameOrPhone = fullTitle.substring(0, lastAtIndex).trim();
        const timeString = fullTitle.substring(lastAtIndex + 3).trim(); // "11:27 AM"

        // PARSE CONTACT / PHONE
        let contactName = contactNameOrPhone;
        let phoneNumber = null;

        // Simple heuristic: If it looks like a phone number, it's a number.
        // Remove spaces, dashes, pluses to check if digits
        const cleanStr = contactNameOrPhone.replace(/[+\s-]/g, '');
        if (/^\d+$/.test(cleanStr)) {
            phoneNumber = contactNameOrPhone; // Keep formatting
            contactName = 'Unknown';
        }

        // PARSE TIMESTAMP
        // Combine Date Header + Time String
        const dateTimeStr = `${currentDate} ${timeString}`;
        const timestamp = new Date(dateTimeStr).toISOString();

        // EXTRACT TRANSCRIPT & DURATION
        const $note = $el.find('p.tab.note');
        if ($note.length === 0) continue;

        // The structure inside <p class="tab note"> is usually:
        // <span class="tab note">00:00</span> Real Transcript Text... <br> ...

        // We want the text *after* the initial 00:00 span
        // But cheerio .text() gets everything. 
        // Let's get the full text first.
        let fullNoteText = $note.text();
        // Remove the first "00:00" if present (it's often in a span)
        fullNoteText = fullNoteText.replace(/^\s*00:00\s*/, '');

        // DURATION EXTRACTION
        // Find all MM:SS patterns
        const timeMatches = fullNoteText.match(/\d{2}:\d{2}/g);
        let duration = '00:00';
        if (timeMatches && timeMatches.length > 0) {
            duration = timeMatches[timeMatches.length - 1]; // Last one is likely total duration
        }

        // CLEAN TRANSCRIPT
        // Remove all MM:SS markers and clean up whitespace
        let rawTranscript = fullNoteText
            .replace(/\d{2}:\d{2}/g, '') // Remove timestamps
            .replace(/\s+/g, ' ')        // Collapse whitespace
            .trim();

        if (rawTranscript.length < 5) continue; // Skip empty/garbage

        validCalls.push({
            contact_name: contactName,
            phone_number: phoneNumber,
            timestamp,
            duration,
            transcript: rawTranscript,
            status: 'completed' // For our internal tracking
        });
    }

    console.log(`✅ Parsed ${validCalls.length} valid calls.`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validCalls, null, 2));
    console.log(`💾 Saved to ${OUTPUT_FILE}`);
}

// Run
parseACRLogs();
