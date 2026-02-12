
import fs from 'fs';
import fetch from 'node-fetch'; // Requires node-fetch or native fetch in Node 18+

// URL from clasp deploy output (@28)
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwZnHQg04j9xgBxO-iMDSWjCrPbQAtTo-1cMsasqxpMNKdfT4gUVmP0FmgqgqDJIV5T/exec';

const LOGS_PATH = './parsed_logs.json';

async function testIngest() {
    if (!fs.existsSync(LOGS_PATH)) {
        console.error("❌ parsed_logs.json not found.");
        return;
    }

    const logs = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
    const sample = logs[0]; // Take the first log

    console.log("📤 Sending sample log to GAS...");
    console.log("   Contact:", sample.contact_name);
    console.log("   Time:", sample.timestamp);

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(sample),
            headers: { 'Content-Type': 'application/json' },
            follow: 5 // Follow redirects (GAS Web Apps redirect)
        });

        const text = await response.text();
        console.log("📥 Response:", text);

        if (text.includes("Success")) {
            console.log("✅ Verification PASSED: Backend accepted the data.");
        } else {
            console.error("❌ Verification FAILED: Backend returned error.");
        }

    } catch (error) {
        console.error("❌ Connection Failed:", error.message);
    }
}

testIngest();
