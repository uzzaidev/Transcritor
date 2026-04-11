
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

async function check(version) {
    console.log(`\n--- Querying ${version} ---`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            data.models.forEach(m => {
                // Filter to likely candidates to keep output clean, but include capabilities
                if (m.name.includes('gemini')) {
                    console.log(`Name: ${m.name}`);
                    console.log(`Methods: ${JSON.stringify(m.supportedGenerationMethods)}`);
                    console.log('---');
                }
            });
        } else {
            console.log("Error:", JSON.stringify(data));
        }
    } catch (e) {
        console.log("Exception:", e.message);
    }
}

async function run() {
    await check('v1beta');
    await check('v1alpha');
}

run();
