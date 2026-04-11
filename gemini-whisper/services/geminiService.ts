import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptionResult } from "../types";

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove the data URL prefix (e.g., "data:audio/mp3;base64,")
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

export const transcribeMedia = async (
  file: File,
  mode: 'transcribe' | 'translate' = 'transcribe'
): Promise<TranscriptionResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Convert file to base64 for inline data transfer
  // Note: For very large files in production, use the File API upload method.
  // For this demo, we assume files < 20MB suitable for inlineData.
  const mediaPart = await fileToGenerativePart(file);

  // Use Gemini 2.5 Flash Native Audio for high-speed multimodal processing
  const model = 'gemini-2.5-flash-native-audio-preview-12-2025';

  let promptText = "";
  
  if (mode === 'transcribe') {
    promptText = `
      Please provide a highly accurate, word-for-word transcription of the audio in this file. 
      Format the output nicely with paragraphs where speakers change or topics shift.
      Also, detect the primary language spoken.
    `;
  } else {
    promptText = `
      Please translate the spoken audio in this file directly into English.
      Provide the English translation text.
      Also, provide a brief 1-sentence summary of the content.
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          mediaPart,
          { text: promptText }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: mode === 'transcribe' ? "The full transcription." : "The English translation.",
            },
            language: {
              type: Type.STRING,
              description: "The detected language of the audio.",
            },
            summary: {
              type: Type.STRING,
              description: "A brief summary of the content (if requested).",
            },
          },
          required: ["text"],
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
        throw new Error("No response generated from model.");
    }

    const jsonResult = JSON.parse(resultText);
    
    return {
      text: jsonResult.text || "No text found.",
      language: jsonResult.language,
      summary: jsonResult.summary,
      provider: 'Gemini 2.5 Flash'
    };

  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};