const PRE_ROLL_SECONDS = 0.5;
const POST_ROLL_SECONDS = 1.0;
const MAX_CLIP_DURATION_SECONDS = 8;

export interface AudioClipRequest {
  id: string;
  startSec: number;
  endSec: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const writeAscii = (view: DataView, offset: number, text: string): void => {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
};

const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: numChannels }, (_, channel) =>
    buffer.getChannelData(channel)
  );

  let offset = 44;
  for (let frame = 0; frame < buffer.length; frame++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = clamp(channelData[channel][frame], -1, 1);
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, Math.round(int16), true);
      offset += bytesPerSample;
    }
  }

  return wavBuffer;
};

const getAudioContextCtor = (): typeof AudioContext | null => {
  return (window.AudioContext || (window as any).webkitAudioContext || null) as typeof AudioContext | null;
};

const decodeFileToAudioBuffer = async (file: File): Promise<AudioBuffer | null> => {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    return null;
  }

  let audioContext: AudioContext | null = null;
  try {
    const fileBuffer = await file.arrayBuffer();
    audioContext = new AudioContextCtor();
    return await audioContext.decodeAudioData(fileBuffer.slice(0));
  } catch (error) {
    console.warn("Failed to decode audio for slicing:", error);
    return null;
  } finally {
    if (audioContext && audioContext.state !== "closed") {
      await audioContext.close();
    }
  }
};

const createEmptyBuffer = (
  channels: number,
  frameCount: number,
  sampleRate: number
): AudioBuffer | null => {
  try {
    return new AudioBuffer({
      length: frameCount,
      numberOfChannels: channels,
      sampleRate,
    });
  } catch (_error) {
    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) return null;

    const context = new AudioContextCtor();
    try {
      return context.createBuffer(channels, frameCount, sampleRate);
    } finally {
      context.close();
    }
  }
};

const sliceToWavObjectUrl = (
  decoded: AudioBuffer,
  startSec: number,
  endSec: number
): string | null => {
  const safeStart = clamp(startSec - PRE_ROLL_SECONDS, 0, decoded.duration);
  const requestedEnd = clamp(endSec + POST_ROLL_SECONDS, 0, decoded.duration);
  const safeEnd = clamp(
    Math.max(requestedEnd, safeStart + 0.2),
    safeStart + 0.2,
    Math.min(decoded.duration, safeStart + MAX_CLIP_DURATION_SECONDS)
  );

  const startSample = Math.floor(safeStart * decoded.sampleRate);
  const endSample = Math.ceil(safeEnd * decoded.sampleRate);
  const frameCount = Math.max(endSample - startSample, 1);

  const sliced = createEmptyBuffer(decoded.numberOfChannels, frameCount, decoded.sampleRate);
  if (!sliced) {
    return null;
  }

  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const source = decoded.getChannelData(channel);
    const segment = source.subarray(startSample, endSample);
    sliced.copyToChannel(segment, channel, 0);
  }

  const wavBuffer = audioBufferToWav(sliced);
  const blob = new Blob([wavBuffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
};

export async function extractAudioClips(
  file: File,
  requests: AudioClipRequest[]
): Promise<Record<string, string | null>> {
  const output: Record<string, string | null> = {};
  requests.forEach((request) => {
    output[request.id] = null;
  });

  if (requests.length === 0) {
    return output;
  }

  const decoded = await decodeFileToAudioBuffer(file);
  if (!decoded) {
    return output;
  }

  for (const request of requests) {
    try {
      output[request.id] = sliceToWavObjectUrl(decoded, request.startSec, request.endSec);
    } catch (error) {
      console.warn("Failed to extract one audio clip:", error);
      output[request.id] = null;
    }
  }

  return output;
}

export async function extractAudioClip(
  file: File,
  startSec: number,
  endSec: number
): Promise<string | null> {
  const singleId = "__single__";
  const result = await extractAudioClips(file, [{ id: singleId, startSec, endSec }]);
  return result[singleId] ?? null;
}
