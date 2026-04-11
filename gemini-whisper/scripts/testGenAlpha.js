
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash-native-audio-latest'
];

async function testModel(model, version) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

    console.log(`Testing ${model} (${version})...`);

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
            console.log(`✅ ${model} (${version}): SUCCESS`);
            return true;
        } else {
            console.log(`❌ ${model} (${version}): ${data.error?.message || data.error?.status || response.status}`);
            return false;
        }
    } catch (e) {
        console.log(`❌ ${model} (${version}): Exception ${e.message}`);
        return false;
    }
}

async function run() {
    for (const m of models) {
        await testModel(m, 'v1beta');
        await testModel(m, 'v1alpha');
    }
}

run();
