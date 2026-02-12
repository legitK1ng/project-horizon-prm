
import fs from 'fs';
import fetch from 'node-fetch';

// Will execute against the new deployment (@31)
// REPLACE THIS WITH YOUR NEW DEPLOYMENT URL
const WEB_APP_URL = 'YOUR_WEB_APP_URL_HERE';
const LOGS_PATH = './parsed_logs.json';
const CHUNK_SIZE = 50;

async function ingestLogs() {
    console.log("🚀 Starting Bulk Ingestion (Batch Mode)...");

    if (WEB_APP_URL.includes('YOUR_WEB_APP_URL')) {
        console.error("❌ ERROR: You must update WEB_APP_URL in scripts/ingest_acr_logs.js with your new Web App URL.");
        return;
    }

    if (!fs.existsSync(LOGS_PATH)) {
        console.error("❌ parsed_logs.json not found.");
        return;
    }

    const logs = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
    const total = logs.length;
    console.log(`📦 Loaded ${total} records.`);

    let successCount = 0;
    let chunkCount = 0;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = logs.slice(i, i + CHUNK_SIZE);
        chunkCount++;
        console.log(`\r⏳ Sending Batch ${chunkCount} (${chunk.length} records)...`);

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify(chunk),
                headers: { 'Content-Type': 'application/json' },
                follow: 5
            });

            const text = await response.text();
            if (text.includes("Batch") || text.includes("Success")) {
                successCount += chunk.length;
                console.log(`   ✅ Batch ${chunkCount} Success: ${text}`);
            } else {
                console.error(`   ❌ Batch ${chunkCount} Failed: ${text}`);
            }

        } catch (error) {
            console.error(`   ❌ Batch ${chunkCount} Error: ${error.message}`);
        }

        // Short delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("\n\n🎉 Ingestion Complete!");
    console.log(`✅ Total Uploaded: ${successCount} / ${total}`);
}

ingestLogs();
