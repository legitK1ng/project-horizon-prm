
import fs from 'fs';
import fetch from 'node-fetch';

// Will execute against the new deployment (@31)
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwuQyTkN-fqEcnx6iIUO1qjdGzMjPqjIb6Ak5puh0pn18vTPzBQczf-BEWVztMpVh_I/exec';
const LOGS_PATH = './parsed_logs.json';
const CHUNK_SIZE = 50;

async function ingestLogs() {
    console.log("🚀 Starting Bulk Ingestion (Batch Mode)...");

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
