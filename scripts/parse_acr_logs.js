
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

    const stats = {
        skippedNoLink: 0,
        skippedOrphan: 0,
        skippedBadFormat: 0,
        skippedNoNote: 0,
        skippedShortTranscript: 0
    };

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
        if ($link.length === 0) {
            stats.skippedNoLink++;
            continue;
        }

        if (!currentDate) {
            stats.skippedOrphan++;
            continue;
        }

        // EXTRACT DETAILS
        const fullTitle = $link.text().trim(); // "Kiana Stewart @ 11:27 AM" or "+1 555... @ ..."
        const lastAtIndex = fullTitle.lastIndexOf(' @ ');
        if (lastAtIndex === -1) {
            stats.skippedBadFormat++;
            continue;
        }

        const contactNameOrPhone = fullTitle.substring(0, lastAtIndex).trim();
        const timeString = fullTitle.substring(lastAtIndex + 3).trim();

        // PARSE CONTACT / PHONE
        let contactName = contactNameOrPhone;
        let phoneNumber = null;

        const cleanStr = contactNameOrPhone.replace(/[+\s-]/g, '');
        if (/^\d+$/.test(cleanStr)) {
            phoneNumber = contactNameOrPhone;
            contactName = 'Unknown';
        }

        // PARSE TIMESTAMP
        const dateTimeStr = `${currentDate} ${timeString}`;
        const timestamp = new Date(dateTimeStr).toISOString();

        // EXTRACT TRANSCRIPT & DURATION
        const $note = $el.find('p.tab.note');
        if ($note.length === 0) {
            stats.skippedNoNote++;
            continue;
        }

        let fullNoteText = $note.text();
        fullNoteText = fullNoteText.replace(/^\s*00:00\s*/, '');

        const timeMatches = fullNoteText.match(/\d{2}:\d{2}/g);
        let duration = '00:00';
        if (timeMatches && timeMatches.length > 0) {
            duration = timeMatches[timeMatches.length - 1];
        }

        let rawTranscript = fullNoteText
            .replace(/\d{2}:\d{2}/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (rawTranscript.length < 5) {
            stats.skippedShortTranscript++;
            continue;
        }

        validCalls.push({
            contact_name: contactName,
            phone_number: phoneNumber,
            timestamp,
            duration,
            transcript: rawTranscript,
            status: 'completed'
        });
    }

    console.log(`✅ Parsed ${validCalls.length} valid calls.`);
    console.log(`⚠️ Skipped Breakdown:`);
    console.log(`   - No Link (Structure/Date Header): ${stats.skippedNoLink}`);
    console.log(`   - Orphan (No Date Context): ${stats.skippedOrphan}`);
    console.log(`   - Bad Format (No ' @ '): ${stats.skippedBadFormat}`);
    console.log(`   - No Note/Transcript Element: ${stats.skippedNoNote}`);
    console.log(`   - Transcript Too Short (<5 chars): ${stats.skippedShortTranscript}`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validCalls, null, 2));
    console.log(`💾 Saved to ${OUTPUT_FILE}`);
}

// Run
parseACRLogs();
