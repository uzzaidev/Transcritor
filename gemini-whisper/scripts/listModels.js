
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not found in .env.local");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to get client? 
        // Actually the SDK doesn't expose listModels directly on the main class in some versions,
        // let's try a direct fetch if the SDK is tricky, but let's try the SDK method first if it exists.
        // The newer @google/genai might have it, but here we installed @google/generative-ai?
        // Wait, package.json said "@google/genai": "^1.41.0" OR "react"?
        // Let's check package.json again.

        // Attempting to use the fetch endpoint directly for certainty as SDK versions vary.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.name.includes('gemini') || m.name.includes('flash')) {
                    console.log(`- ${m.name.replace('models/', '')}: ${m.displayName}`);
                }
            });
        } else {
            console.log("Error listing models:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
