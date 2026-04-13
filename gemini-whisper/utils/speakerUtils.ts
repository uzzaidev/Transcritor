import {
  SPEAKER_COLORS,
  SpeakerDiscoveryResult,
  SpeakerProfile,
  TranscriptionResult,
} from "../types";

const formatTimestamp = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const normalizeSpeakerNames = (
  discovery: SpeakerDiscoveryResult,
  rawNames: Record<string, string>
): Record<string, string> => {
  const normalized: Record<string, string> = {};
  discovery.speakers.forEach((speakerId) => {
    normalized[speakerId] = rawNames[speakerId]?.trim() || speakerId;
  });
  return normalized;
};

export const buildSpeakerProfiles = (
  discovery: SpeakerDiscoveryResult,
  names: Record<string, string>
): SpeakerProfile[] => {
  return discovery.speakers.map((speakerId, index) => ({
    id: speakerId,
    displayName: names[speakerId] || speakerId,
    color: SPEAKER_COLORS[index % SPEAKER_COLORS.length],
    sampleText:
      discovery.segments.find((segment) => segment.speaker === speakerId)?.text?.slice(0, 120) ||
      "",
  }));
};

export const rebuildResultWithNames = (
  result: TranscriptionResult,
  discovery: SpeakerDiscoveryResult,
  names: Record<string, string>
): TranscriptionResult => {
  if (!result.segments || result.segments.length === 0) {
    return result;
  }

  const profiles = buildSpeakerProfiles(discovery, names);
  const renameMap = new Map<string, string>();

  profiles.forEach((profile) => {
    renameMap.set(profile.id, profile.displayName);
  });

  result.speakerProfiles?.forEach((profile) => {
    const nextName = names[profile.id] || profile.displayName;
    renameMap.set(profile.id, nextName);
    renameMap.set(profile.displayName, nextName);
  });

  const renamedSegments = result.segments.map((segment) => ({
    ...segment,
    speaker: renameMap.get(segment.speaker) || segment.speaker,
  }));

  const text = renamedSegments
    .map((segment) => `[${formatTimestamp(segment.startTime)}] ${segment.speaker}: ${segment.text}`)
    .join("\n\n");

  return {
    ...result,
    text,
    segments: renamedSegments,
    speakerProfiles: profiles,
  };
};
