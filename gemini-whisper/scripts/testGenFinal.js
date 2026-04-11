
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

// The model that appeared in listModels
const model = 'gemini-2.5-flash-native-audio-latest';

async function test(version) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
    console.log(`Testing ${model} with ${version}...`);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello" }] }]
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log(`✅ SUCCESS ${version}`);
        } else {
            console.log(`❌ FAILED ${version}: ${data.error?.message}`);
        }
    } catch (e) { console.log("Exception:", e.message); }
}

async function run() {
    await test('v1beta');
    await test('v1alpha');
}
run();
