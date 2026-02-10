
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// CONFIGURATION
// !! IMPORTANT: This URL must match your Google Apps Script Deployment URL !!
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbwEMlb34FBjb5jjvyDVf6x_zQREjZcMSbf78xHx-_E9GPtrnaXRvBTm7cbbuKcNQ_aH/exec';
const LOCAL_ACR_URL = 'http://192.168.0.62:8000/'; // Your Wifi Transfer URL
const HTML_FILE = '../ACR Phone.html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, HTML_FILE);

async function main() {
    console.log('🚀 Starting ACR Import...');
    let html = '';

    // 1. Try to fetch from Live Wifi URL first
    try {
        console.log(`🌐 Attempting to connect to ${LOCAL_ACR_URL}...`);
        const response = await fetch(LOCAL_ACR_URL);
        if (response.ok) {
            html = await response.text();
            console.log(`✅ Connected to device! Downloaded ${html.length} bytes.`);
        } else {
            throw new Error(`Device responded with ${response.status}: ${response.statusText}`);
        }
    } catch (err) {
        console.warn(`⚠️ Could not connect to Wifi Transfer: ${err.message}`);
        console.log(`📂 Falling back to local file: ${HTML_FILE}`);
        try {
            html = fs.readFileSync(filePath, 'utf8');
            console.log(`📄 Read file: ${html.length} bytes`);
        } catch (fileErr) {
            console.error('❌ Fatal: Neither URL nor File could be read.', fileErr);
            return;
        }
    }

    // 2. Process Data
    // The splitter logic handles the massive file size better than regex on the whole string
    const listItems = html.split('<li><a href="');
    console.log(`🔍 Found ${listItems.length} potential items`);

    let count = 0;
    const total = listItems.length;

    for (const item of listItems) {
        if (!item.includes('?job=db')) continue; // Skip headers or garbage

        // Extract Name and Time
        // href="http://...id=9907">Name @ Time</a>
        const titleMatch = item.match(/>([^<]+)<\/a>/);
        const idMatch = item.match(/id=(\d+)/);

        if (!titleMatch) continue;

        const externalId = idMatch ? `acr-${idMatch[1]}` : null; // e.g. "acr-9907"
        const fullTitle = titleMatch[1]; // e.g., "+1 320-674-2900 @ 12:54 AM"

        // Split Name and Time
        const parts = fullTitle.split(' @ ');
        const contactNameOrPhone = parts[0];

        // Extract Transcript
        // <p class="tab note">...content...</p>
        const noteMatch = item.match(/<p class="tab note">([\s\S]*?)<\/p>/);
        let transcript = '';

        if (noteMatch) {
            transcript = noteMatch[1]
                .replace(/<br>/g, '\n')
                .replace(/^\s+|\s+$/g, '')
                .replace(/\d{2}:\d{2}\n\d+:\s/g, '') // Timestamp cleanup
                .split('\n').map(line => line.trim()).filter(l => l && !l.match(/^\d+$/)).join('\n');
        }

        if (!transcript) {
            // console.log(`Skipping ${contactNameOrPhone} - No transcript`);
            continue;
        }

        // Determine if title is phone or name
        const isPhone = contactNameOrPhone.match(/^[+\d\s-]+$/);

        const payload = {
            contact_name: isPhone ? 'Unknown Caller' : contactNameOrPhone,
            phone_number: isPhone ? contactNameOrPhone.replace(/\D/g, '') : '',
            transcript: transcript,
            status: 'QUEUED', // Important: Backend looks for this status to trigger Gemini
            duration: 0,
            external_id: externalId,
            import_source: 'ACR_HISTORY'
        };

        // Send to Backend
        try {
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`✅ [${++count}] Imported: ${contactNameOrPhone}`);
            } else {
                console.error(`❌ Failed: ${contactNameOrPhone} - ${response.statusText}`);
            }
        } catch (err) {
            console.error(`❌ Network Error: ${contactNameOrPhone}`, err.message);
        }

        // Delay to avoid hitting GAS rate limits
        await new Promise(r => setTimeout(r, 1200));
    }

    console.log('🎉 Import Complete!');
}

main();
