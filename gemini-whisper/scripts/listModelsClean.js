
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

async function check(version) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`✅ ${m.name} (${version})`);
                }
            });
        }
    } catch (e) {
        console.log("Exception:", e.message);
    }
}

async function run() {
    console.log("Models supporting generateContent:");
    await check('v1beta');
    await check('v1alpha');
}

run();
