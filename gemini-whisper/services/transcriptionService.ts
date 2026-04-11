import {
  ApiKeys,
  SpeakerDiscoveryResult,
  SpeakerProfile,
  SpeakerSegment,
  TranscriptionOptions,
  TranscriptionProvider,
  TranscriptionResult,
} from "../types";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_SEGMENT_DURATION_SECONDS = 600;
const GEMINI_DIARIZATION_SEGMENT_SECONDS = 240;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_DEBUG_PREVIEW = 800;

const safePreview = (value: unknown, maxLength = MAX_DEBUG_PREVIEW): string => {
  if (typeof value !== "string") return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
};

const isGeminiDebugEnabled = (): boolean => {
  const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
  if (isDev) return true;

  try {
    return localStorage.getItem("gw_debug_gemini") === "1";
  } catch {
    return false;
  }
};

const logGeminiDebug = (label: string, details?: Record<string, unknown>): void => {
  if (!isGeminiDebugEnabled()) return;
  if (!details) {
    console.log(`[GeminiDebug] ${label}`);
    return;
  }

  console.groupCollapsed(`[GeminiDebug] ${label}`);
  Object.entries(details).forEach(([key, value]) => {
    console.log(`${key}:`, value);
  });
  console.groupEnd();
};

const stripMarkdownJsonFences = (input: string): string => {
  return input
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
};

const extractBalancedJsonObject = (input: string): string | undefined => {
  const start = input.indexOf("{");
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth++;
      continue;
    }

    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  return undefined;
};

const repairLikelyJson = (input: string): string => {
  let repaired = input.replace(/^\uFEFF/, "").trim();

  repaired = repaired
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/,\s*\.\.\.\s*,/g, ",")
    .replace(/,\s*\.\.\.\s*(?=[}\]])/g, "")
    .replace(/\[\s*\.\.\.\s*\]/g, "[]");

  return repaired;
};

const decodeJsonLikeString = (value: string): string => {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
};

const extractJsonLikeStringField = (input: string, fieldName: string): string | null => {
  const keyRegex = new RegExp(`"${fieldName}"\\s*:\\s*"`, "i");
  const keyMatch = keyRegex.exec(input);
  if (!keyMatch) return null;

  let i = keyMatch.index + keyMatch[0].length;
  let escaped = false;
  let collected = "";

  while (i < input.length) {
    const ch = input[i];
    if (escaped) {
      collected += `\\${ch}`;
      escaped = false;
      i++;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      i++;
      continue;
    }
    if (ch === "\"") {
      break;
    }
    collected += ch;
    i++;
  }

  return decodeJsonLikeString(collected).trim();
};

const coerceTextFromResponse = (responseText: string): string => {
  const stripped = stripMarkdownJsonFences(responseText);
  const jsonTextField = extractJsonLikeStringField(stripped, "text");
  if (jsonTextField && jsonTextField.length > 0) {
    return jsonTextField;
  }
  return stripped.trim();
};

const formatTimestamp = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

class ModelJsonParseError extends Error {
  rawText: string;
  contextLabel: string;
  parseErrors: string[];
  finishReason?: string;

  constructor(message: string, rawText: string, contextLabel: string, parseErrors: string[]) {
    super(message);
    this.name = "ModelJsonParseError";
    this.rawText = rawText;
    this.contextLabel = contextLabel;
    this.parseErrors = parseErrors;
  }
}

const parseClockLikeTime = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed.includes(":")) return null;
  const parts = trimmed.split(":").map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) return null;

  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => !Number.isFinite(num))) return null;

  if (nums.length === 2) {
    const [minutes, seconds] = nums;
    return minutes * 60 + seconds;
  }
  if (nums.length === 3) {
    const [hours, minutes, seconds] = nums;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
};

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsedClock = parseClockLikeTime(value);
    if (parsedClock !== null) return parsedClock;

    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getGeminiApiKey = (): string => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing.");
  }
  return apiKey;
};

const getGeminiResponseText = (responseJson: any): string => {
  const parts = responseJson?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
};

const parseJsonFromModelText = (
  rawText: string,
  contextLabel: string
): any => {
  const text = rawText.trim();
  if (!text) throw new Error(`${contextLabel}: empty response from Gemini.`);

  const noFences = stripMarkdownJsonFences(text);
  const balancedFromRaw = extractBalancedJsonObject(text);
  const balancedFromNoFences = extractBalancedJsonObject(noFences);

  const candidates = [
    { label: "stripped_fences", content: noFences },
    { label: "balanced_raw", content: balancedFromRaw },
    { label: "balanced_no_fences", content: balancedFromNoFences },
    { label: "repaired_stripped_fences", content: repairLikelyJson(noFences) },
    {
      label: "repaired_balanced_no_fences",
      content: balancedFromNoFences ? repairLikelyJson(balancedFromNoFences) : undefined,
    },
    {
      label: "repaired_balanced_raw",
      content: balancedFromRaw ? repairLikelyJson(balancedFromRaw) : undefined,
    },
    { label: "raw_text", content: text },
    { label: "repaired_raw_text", content: repairLikelyJson(text) },
  ].filter((entry) => Boolean(entry.content)) as Array<{ label: string; content: string }>;

  const parseErrors: string[] = [];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.content);
      logGeminiDebug(`${contextLabel} - JSON parsed`, {
        strategy: candidate.label,
        rawLength: text.length,
      });
      return parsed;
    } catch (error: any) {
      parseErrors.push(`${candidate.label}: ${error?.message || "Unknown parse error"}`);
    }
  }

  logGeminiDebug(`${contextLabel} - JSON parse failed`, {
    parseErrors,
    rawLength: text.length,
    rawPreview: safePreview(text),
  });

  throw new ModelJsonParseError(
    `${contextLabel}: Gemini did not return valid JSON. ` +
      `Raw preview: "${safePreview(text, 260)}". ` +
      `See browser console for full debug details.`,
    text,
    contextLabel,
    parseErrors
  );
};

const renderSegmentsAsTranscript = (segments: SpeakerSegment[]): string => {
  return segments
    .map((segment) => `[${formatTimestamp(segment.startTime)}] ${segment.speaker}: ${segment.text}`.trim())
    .join("\n\n");
};

const normalizeSegments = (
  rawSegments: unknown,
  absoluteOffsetSec: number,
  speakerNameMap?: Map<string, string>
): SpeakerSegment[] => {
  if (!Array.isArray(rawSegments)) return [];

  return rawSegments
    .map((segment) => {
      const speakerRaw = typeof segment?.speaker === "string" ? segment.speaker.trim() : "";
      const text = typeof segment?.text === "string" ? segment.text.trim() : "";
      const start = normalizeNumber(segment?.startTime ?? segment?.start);
      const end = normalizeNumber(segment?.endTime ?? segment?.end);

      if (!speakerRaw || !text || start === null || end === null || end <= start) {
        return null;
      }

      const mappedSpeaker = speakerNameMap?.get(speakerRaw) || speakerRaw;
      return {
        speaker: mappedSpeaker,
        startTime: Number((absoluteOffsetSec + start).toFixed(1)),
        endTime: Number((absoluteOffsetSec + end).toFixed(1)),
        text,
      };
    })
    .filter((segment): segment is SpeakerSegment => Boolean(segment));
};

const filterTopSegmentsPerSpeaker = (
  segments: SpeakerSegment[],
  maxPerSpeaker: number
): SpeakerSegment[] => {
  const counter = new Map<string, number>();
  return segments.filter((segment) => {
    const current = counter.get(segment.speaker) || 0;
    if (current >= maxPerSpeaker) {
      return false;
    }
    counter.set(segment.speaker, current + 1);
    return true;
  });
};

const recoverDiscoveryFromRawText = (
  rawText: string,
  fallbackLanguage?: string
): SpeakerDiscoveryResult | null => {
  const text = stripMarkdownJsonFences(rawText);
  const languageMatch = text.match(/"language"\s*:\s*"([^"]+)"/i);
  const language = languageMatch?.[1]?.trim() || fallbackLanguage || "Unknown";

  const speakers = Array.from(
    new Set(
      (text.match(/"Speaker\s+\d+"/g) || [])
        .map((token) => token.replace(/"/g, "").trim())
    )
  ).slice(0, 6);

  const segmentRegex =
    /"speaker"\s*:\s*"([^"]+)"[\s\S]*?"startTime"\s*:\s*("?[^,\]\}\n"]+"?)[\s\S]*?"endTime"\s*:\s*("?[^,\]\}\n"]+"?)[\s\S]*?"text"\s*:\s*"([^"]*)"/gi;
  const segments: SpeakerSegment[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = segmentRegex.exec(text)) !== null) {
    const speaker = match[1]?.trim();
    const startRaw = match[2]?.replace(/"/g, "").trim();
    const endRaw = match[3]?.replace(/"/g, "").trim();
    const start = normalizeNumber(startRaw);
    const end = normalizeNumber(endRaw);
    const snippet = (match[4] || "").trim();

    if (!speaker || start === null || end === null || end <= start) {
      continue;
    }

    segments.push({
      speaker,
      startTime: Number(start.toFixed(1)),
      endTime: Number(end.toFixed(1)),
      text: snippet,
    });
  }

  if (speakers.length === 0) {
    return null;
  }

  return {
    language,
    speakers,
    segments,
  };
};

const getMediaDuration = async (file: File): Promise<number> => {
  if (typeof document === "undefined") {
    return 0;
  }

  const objectUrl = URL.createObjectURL(file);
  const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
  media.preload = "metadata";
  media.src = objectUrl;

  try {
    const duration = await new Promise<number>((resolve) => {
      const cleanup = () => {
        media.removeAttribute("src");
        media.load();
        URL.revokeObjectURL(objectUrl);
      };

      const timeout = window.setTimeout(() => {
        cleanup();
        resolve(0);
      }, 7000);

      media.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        const value = Number.isFinite(media.duration) ? media.duration : 0;
        cleanup();
        resolve(value > 0 ? value : 0);
      };

      media.onerror = () => {
        window.clearTimeout(timeout);
        cleanup();
        resolve(0);
      };
    });

    return duration;
  } catch {
    URL.revokeObjectURL(objectUrl);
    return 0;
  }
};

const uploadFileToGemini = async (
  file: File,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<string> => {
  onProgress?.("Initiating upload...");
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
  const metadata = { file: { display_name: file.name } };

  const initResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": file.size.toString(),
      "X-Goog-Upload-Header-Content-Type": file.type || "application/octet-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!initResponse.ok) {
    throw new Error(`Failed to initialize upload: ${initResponse.statusText}`);
  }

  const sessionUrl = initResponse.headers.get("x-goog-upload-url");
  if (!sessionUrl) {
    throw new Error("Failed to get upload session URL.");
  }

  onProgress?.("Uploading bytes...");
  const uploadResponse = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      "Content-Length": file.size.toString(),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file bytes: ${uploadResponse.statusText}`);
  }

  const uploadResult = await uploadResponse.json();
  const fileUri = uploadResult?.file?.uri;
  const fileName = uploadResult?.file?.name?.split("/")?.pop();
  if (!fileUri || !fileName) {
    throw new Error("Gemini did not return a valid file URI.");
  }

  onProgress?.("Verifying file readiness...");
  let state = uploadResult.file.state;

  while (state === "PROCESSING") {
    onProgress?.("Waiting for file processing...");
    await sleep(2000);
    const checkUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`;
    const checkResponse = await fetch(checkUrl);
    const checkResult = await checkResponse.json();
    state = checkResult?.state;

    if (state === "FAILED") {
      throw new Error("Gemini file processing failed.");
    }
  }

  return fileUri;
};

const requestGeminiJson = async ({
  apiKey,
  file,
  prompt,
  onProgress,
  generationConfig,
}: {
  apiKey: string;
  file: File;
  prompt: string;
  onProgress?: (msg: string) => void;
  generationConfig?: Record<string, any>;
}): Promise<any> => {
  logGeminiDebug("requestGeminiJson - request", {
    fileName: file.name,
    mimeType: file.type || "audio/mp4",
    promptPreview: safePreview(prompt, 500),
    generationConfig,
  });

  const fileUri = await uploadFileToGemini(file, apiKey, onProgress);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { fileData: { mimeType: file.type || "audio/mp4", fileUri } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 0,
        },
        ...generationConfig,
      },
    }),
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error?.message || errorMessage;
    } catch (_error) {
      // keep statusText
    }
    logGeminiDebug("requestGeminiJson - HTTP error", {
      status: response.status,
      statusText: response.statusText,
      errorMessage,
    });
    throw new Error(`Gemini Error: ${errorMessage}`);
  }

  const rawJson = await response.json();
  const text = getGeminiResponseText(rawJson);
  logGeminiDebug("requestGeminiJson - response", {
    responseTextLength: text.length,
    responsePreview: safePreview(text),
    candidatesCount: rawJson?.candidates?.length || 0,
    finishReason: rawJson?.candidates?.[0]?.finishReason || "unknown",
  });
  const finishReason = rawJson?.candidates?.[0]?.finishReason || "unknown";
  try {
    return parseJsonFromModelText(text, "Discovery pass");
  } catch (error) {
    if (error instanceof ModelJsonParseError) {
      error.finishReason = finishReason;
      error.message = `${error.message} (finishReason: ${finishReason})`;
    }
    throw error;
  }
};

export const discoverSpeakers = async (
  file: File,
  options: TranscriptionOptions = {}
): Promise<SpeakerDiscoveryResult> => {
  const apiKey = getGeminiApiKey();
  options.onProgress?.("Running speaker discovery...");

  const primaryPrompt = `
You are a speaker diarization AI.
Analyze this audio file and identify all distinct speakers.

Identify at most 6 primary speakers.
For each speaker, provide 1-2 representative speech segments.
Timestamps must be absolute seconds from the very start of the file (float, 1 decimal place).
Label speakers in order of first appearance: "Speaker 1", "Speaker 2", etc.
Do not use placeholders like "...". Return concrete values only.
Keep each segment text short (max 14 words).

Return ONLY valid JSON:
{
  "language": "<detected language name>",
  "speakers": ["Speaker 1", "Speaker 2"],
  "segments": [
    { "speaker": "Speaker 1", "startTime": 0.0, "endTime": 8.5, "text": "..." },
    { "speaker": "Speaker 2", "startTime": 9.2, "endTime": 17.1, "text": "..." }
  ]
}
  `.trim();

  const compactFallbackPrompt = `
You are a speaker diarization AI. Return compact JSON only.
Identify up to 4 speakers and provide exactly 1 short segment per speaker.
Each segment text must be 6-10 words, no punctuation-heavy prose.
Use absolute seconds from start. Labels: "Speaker 1", "Speaker 2", etc.
No markdown, no explanation, no extra keys.

Return exactly:
{
  "language": "Portuguese",
  "speakers": ["Speaker 1", "Speaker 2"],
  "segments": [
    { "speaker": "Speaker 1", "startTime": 0.0, "endTime": 6.0, "text": "..." },
    { "speaker": "Speaker 2", "startTime": 8.0, "endTime": 13.0, "text": "..." }
  ]
}
  `.trim();

  const attempts = [
    {
      label: "primary",
      prompt: primaryPrompt,
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    },
    {
      label: "compact_fallback",
      prompt: compactFallbackPrompt,
      generationConfig: { temperature: 0.0, maxOutputTokens: 2048 },
    },
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      if (attempt.label !== "primary") {
        options.onProgress?.("Retrying speaker discovery in compact mode...");
      }

      const json = await requestGeminiJson({
        apiKey,
        file,
        prompt: attempt.prompt,
        onProgress: options.onProgress,
        generationConfig: attempt.generationConfig,
      });

      const speakers = Array.isArray(json?.speakers)
        ? json.speakers
            .filter((speaker: unknown) => typeof speaker === "string" && speaker.trim())
            .slice(0, 6)
        : [];
      const segments = normalizeSegments(json?.segments, 0).map((segment) => ({
        ...segment,
        startTime: Number(segment.startTime.toFixed(1)),
        endTime: Number(segment.endTime.toFixed(1)),
      }));

      if (speakers.length === 0) {
        throw new Error("Discovery returned no speakers.");
      }

      return {
        language:
          typeof json?.language === "string" && json.language.trim()
            ? json.language.trim()
            : options.language || "Unknown",
        speakers,
        segments: filterTopSegmentsPerSpeaker(segments, 2),
      };
    } catch (error) {
      if (error instanceof ModelJsonParseError) {
        const recovered = recoverDiscoveryFromRawText(error.rawText, options.language);
        if (recovered) {
          logGeminiDebug("discoverSpeakers - recovered from partial JSON", {
            attempt: attempt.label,
            recoveredSpeakers: recovered.speakers.length,
            recoveredSegments: recovered.segments.length,
            finishReason: error.finishReason || "unknown",
          });
          options.onProgress?.("Discovery recovered from partial JSON.");
          return {
            ...recovered,
            segments: filterTopSegmentsPerSpeaker(recovered.segments, 2),
          };
        }
      }

      lastError = error;
      logGeminiDebug("discoverSpeakers - attempt failed", {
        attempt: attempt.label,
        errorMessage: (error as Error)?.message || "Unknown error",
      });
    }
  }

  throw new Error(
    `Discovery pass failed after retry. ${(lastError as Error)?.message || "Unknown discovery error."}`
  );
};

const parseDiarizedPlainText = (
  rawText: string,
  chunkStartSec: number,
  chunkEndSec: number,
  speakerMap: Map<string, string>
): SpeakerSegment[] => {
  const text = stripMarkdownJsonFences(rawText).trim();
  if (!text) return [];

  const aliasMap = new Map<string, string>();
  speakerMap.forEach((displayName, key) => {
    aliasMap.set(key.trim().toLowerCase(), displayName);
  });

  const blocks = text
    .split(/\n{2,}/)
    .flatMap((block) => block.split(/\n/))
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: SpeakerSegment[] = [];
  let currentSpeaker = "";
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentSpeaker || currentLines.length === 0) return;
    const joined = currentLines.join(" ").trim();
    if (!joined) return;

    segments.push({
      speaker: currentSpeaker,
      startTime: Number(chunkStartSec.toFixed(1)),
      endTime: Number(chunkEndSec.toFixed(1)),
      text: joined,
    });

    currentLines = [];
  };

  for (const line of blocks) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0 && colonIndex < 50) {
      const rawSpeaker = line.slice(0, colonIndex).trim();
      const normalizedSpeaker = rawSpeaker.toLowerCase();
      const candidateText = line.slice(colonIndex + 1).trim();
      const mappedSpeaker = aliasMap.get(normalizedSpeaker) || speakerMap.get(rawSpeaker) || rawSpeaker;
      const looksLikeSpeaker =
        aliasMap.has(normalizedSpeaker) ||
        /^speaker\s*\d+$/i.test(rawSpeaker) ||
        rawSpeaker.split(/\s+/).length <= 3;

      if (looksLikeSpeaker && candidateText) {
        if (mappedSpeaker !== currentSpeaker) {
          flush();
          currentSpeaker = mappedSpeaker;
        }
        currentLines.push(candidateText);
        continue;
      }
    }

    if (currentSpeaker) {
      currentLines.push(line);
    }
  }

  flush();
  return segments;
};

const transcribeWithGemini = async (
  file: File,
  mode: "transcribe" | "translate",
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> => {
  const apiKey = getGeminiApiKey();
  const targetLanguage = options.language || "Portuguese";
  const diarizationEnabled = mode === "transcribe" && Boolean(options.diarization);
  const expectsStructuredJson = mode === "translate";
  const speakerProfiles = options.speakerProfiles || [];

  if (diarizationEnabled && speakerProfiles.length === 0) {
    throw new Error("Speaker profiles are required before diarized transcription.");
  }

  options.onProgress?.("Starting upload...");
  const fileUri = await uploadFileToGemini(file, apiKey, options.onProgress);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const knownDuration = options.duration && options.duration > 0 ? options.duration : await getMediaDuration(file);
  const chunkDurationSec = diarizationEnabled
    ? GEMINI_DIARIZATION_SEGMENT_SECONDS
    : GEMINI_SEGMENT_DURATION_SECONDS;
  const segmentsCount =
    knownDuration > 0 ? Math.max(1, Math.ceil(knownDuration / chunkDurationSec)) : 1;

  const speakerMap = new Map<string, string>();
  for (const profile of speakerProfiles) {
    speakerMap.set(profile.id, profile.displayName);
    speakerMap.set(profile.displayName, profile.displayName);
  }

  let fullText = "";
  let finalLanguage = "";
  let finalSummary = "";
  const aggregatedSegments: SpeakerSegment[] = [];
  let metadataInitialized = false;

  const diarizationProfilesPrompt = diarizationEnabled
    ? `KNOWN SPEAKERS - use these exact names, no variations:\n${speakerProfiles
        .map((profile: SpeakerProfile) => `- ${profile.id} = ${profile.displayName}`)
        .join("\n")}`
    : "";

  type ChunkResult = {
    startSec: number;
    endSec: number;
    responseText: string;
    finishReason: string;
  };

  const fetchChunk = async (
    startSec: number,
    endSec: number,
    chunkLabel: string
  ): Promise<ChunkResult> => {
    const hasTimeFocus = knownDuration > 0;
    const timePrompt = hasTimeFocus
      ? `Focus only on the audio between ${formatTimestamp(startSec)} and ${formatTimestamp(endSec)}.`
      : "";

    const promptText =
      mode === "transcribe"
        ? diarizationEnabled
          ? `
You are a professional speech-to-text AI.
Transcribe the audio exactly as spoken in ${targetLanguage}.
${timePrompt}
Do NOT translate. Capture every word. Do not summarize or skip anything.

${diarizationProfilesPrompt}

Output format rules (strictly follow):
- One line per speaker turn: NAME: text
- Separate speaker turns with ONE blank line
- Group consecutive speech from the same speaker into ONE block
- Do NOT use JSON, markdown, bullet points, timestamps, or headers
- Do NOT add explanation text
            `.trim()
          : `
You are a professional speech-to-text AI.
Transcribe the audio exactly as spoken in ${targetLanguage}.
${timePrompt}
Do NOT translate. Capture every word and do not summarize.
Return ONLY the transcription text. Do NOT return JSON or markdown.
            `.trim()
        : `
Translate the spoken audio directly into English.
${timePrompt}
Return JSON with keys: text, language, summary.
          `.trim();

    logGeminiDebug("transcribeWithGemini - chunk request", {
      fileName: file.name,
      chunkLabel,
      startSec,
      endSec,
      diarizationEnabled,
      promptPreview: safePreview(promptText, 500),
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { fileData: { mimeType: file.type || "audio/mp4", fileUri } },
              { text: promptText },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: expectsStructuredJson ? "application/json" : "text/plain",
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = errorData?.error?.message || errorMessage;
      } catch (_error) {
        // keep statusText
      }
      logGeminiDebug("transcribeWithGemini - HTTP error", {
        chunkLabel,
        status: response.status,
        statusText: response.statusText,
        errorMessage,
      });
      throw new Error(`Gemini Error (segment ${chunkLabel}): ${errorMessage}`);
    }

    const rawResponse = await response.json();
    const responseText = getGeminiResponseText(rawResponse);
    const finishReason = rawResponse?.candidates?.[0]?.finishReason || "unknown";

    logGeminiDebug("transcribeWithGemini - chunk response", {
      chunkLabel,
      startSec,
      endSec,
      responseTextLength: responseText.length,
      responsePreview: safePreview(responseText),
      candidatesCount: rawResponse?.candidates?.length || 0,
      finishReason,
    });

    return {
      startSec,
      endSec,
      responseText,
      finishReason,
    };
  };

  const fetchChunkWithRetry = async (
    startSec: number,
    endSec: number,
    chunkLabel: string,
    depth = 0
  ): Promise<ChunkResult[]> => {
    const result = await fetchChunk(startSec, endSec, chunkLabel);

    if (result.finishReason === "MAX_TOKENS" && depth < 2 && (endSec - startSec) >= 60) {
      const mid = Math.round((startSec + endSec) / 2);
      options.onProgress?.(
        `Chunk MAX_TOKENS - splitting ${formatTimestamp(startSec)}-${formatTimestamp(endSec)}...`
      );
      logGeminiDebug("fetchChunkWithRetry - splitting chunk", {
        startSec,
        endSec,
        mid,
        depth,
        chunkLabel,
      });

      const [left, right] = await Promise.all([
        fetchChunkWithRetry(startSec, mid, `${chunkLabel}a`, depth + 1),
        fetchChunkWithRetry(mid, endSec, `${chunkLabel}b`, depth + 1),
      ]);
      return [...left, ...right].sort((a, b) => a.startSec - b.startSec);
    }

    return [result];
  };

  for (let index = 0; index < segmentsCount; index++) {
    const startSec = index * chunkDurationSec;
    const endSec = knownDuration > 0 ? Math.min((index + 1) * chunkDurationSec, knownDuration) : 0;
    const hasMultipleChunks = segmentsCount > 1 && knownDuration > 0;
    const progressMessage = hasMultipleChunks
      ? `Processing segment ${index + 1}/${segmentsCount} (${formatTimestamp(startSec)} - ${formatTimestamp(endSec)})`
      : `Processing segment ${index + 1}/${segmentsCount}`;
    options.onProgress?.(progressMessage);

    const chunkParts = await fetchChunkWithRetry(
      startSec,
      endSec,
      `${index + 1}/${segmentsCount}`
    );

    for (const part of chunkParts) {
      const partContext = `Transcription chunk ${formatTimestamp(part.startSec)}-${formatTimestamp(part.endSec)}`;
      let json: any = {};
      let chunkText = "";

      if (diarizationEnabled) {
        const chunkSegments = parseDiarizedPlainText(
          part.responseText,
          part.startSec,
          part.endSec,
          speakerMap
        );
        aggregatedSegments.push(...chunkSegments);

        if (chunkSegments.length > 0) {
          chunkText = chunkSegments
            .map((segment) => `${segment.speaker}: ${segment.text}`)
            .join("\n\n");
        } else {
          chunkText = coerceTextFromResponse(part.responseText);
        }
      } else if (expectsStructuredJson) {
        try {
          json = parseJsonFromModelText(part.responseText, partContext);
          chunkText = typeof json?.text === "string" ? json.text.trim() : "";
        } catch (error) {
          chunkText = coerceTextFromResponse(part.responseText);
          logGeminiDebug(`${partContext} - fallback text mode`, {
            reason: (error as Error)?.message || "Unknown parse error",
            coercedLength: chunkText.length,
          });
        }
      } else {
        chunkText = coerceTextFromResponse(part.responseText);
      }

      if (chunkText) {
        fullText += `${fullText ? "\n\n" : ""}${chunkText}`;
      }

      if (!metadataInitialized) {
        finalLanguage = typeof json?.language === "string"
          ? json.language
          : mode === "translate"
            ? "English"
            : targetLanguage;
        finalSummary = typeof json?.summary === "string" ? json.summary : "";
        metadataInitialized = true;
      }
    }
  }

  const diarizedText =
    diarizationEnabled && aggregatedSegments.length > 0
      ? renderSegmentsAsTranscript(aggregatedSegments)
      : fullText || "No text generated.";

  return {
    text: diarizedText,
    language: finalLanguage || "detected",
    summary: finalSummary,
    provider: `Gemini (${GEMINI_MODEL})`,
    segments: aggregatedSegments.length > 0 ? aggregatedSegments : undefined,
    speakerProfiles: diarizationEnabled ? speakerProfiles : undefined,
  };
};

const transcribeWithOpenAI = async (
  file: File,
  mode: "transcribe" | "translate",
  apiKey: string
): Promise<TranscriptionResult> => {
  if (!apiKey) throw new Error("OpenAI API Key is required.");

  const endpoint =
    mode === "translate"
      ? "https://api.openai.com/v1/audio/translations"
      : "https://api.openai.com/v1/audio/transcriptions";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI Error: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    text: data.text,
    provider: "OpenAI Whisper-1",
  };
};

const transcribeWithHuggingFace = async (
  file: File,
  mode: "transcribe" | "translate",
  token: string
): Promise<TranscriptionResult> => {
  if (!token) throw new Error("Hugging Face Token is required.");

  const modelId = "openai/whisper-large-v3";
  const url = `https://api-inference.huggingface.co/models/${modelId}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Hugging Face Error: ${err?.error || JSON.stringify(err)}`);
  }

  const data = await response.json();
  let text = data?.text;

  if (!text && Array.isArray(data)) {
    text = data.map((entry: any) => entry?.text || "").join(" ").trim();
  }

  return {
    text: text || "No text returned from Hugging Face.",
    provider: "HF Whisper Large v3",
  };
};

export const transcribeMedia = async (
  file: File,
  mode: "transcribe" | "translate",
  provider: TranscriptionProvider,
  apiKeys: ApiKeys,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> => {
  switch (provider) {
    case "openai":
      return transcribeWithOpenAI(file, mode, apiKeys.openai);
    case "huggingface":
      return transcribeWithHuggingFace(file, mode, apiKeys.huggingface);
    case "gemini":
    default:
      return transcribeWithGemini(file, mode, options);
  }
};
