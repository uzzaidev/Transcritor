import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, Pause, Users, X } from "lucide-react";
import { SPEAKER_COLORS, SpeakerDiscoveryResult, SpeakerSegment } from "../types";
import { extractAudioClips } from "../utils/audioSlicer";

interface SpeakerIdentificationModalProps {
  isOpen: boolean;
  file: File;
  discoveryResult: SpeakerDiscoveryResult;
  initialNames?: Record<string, string>;
  onConfirm: (names: Record<string, string>) => void;
  onCancel: () => void;
}

const MAX_SAMPLE_SECONDS = 8;

const getBestSampleSegment = (
  discoveryResult: SpeakerDiscoveryResult,
  speakerId: string
): SpeakerSegment | null => {
  const speakerSegments = discoveryResult.segments.filter((segment) => segment.speaker === speakerId);
  if (speakerSegments.length === 0) {
    return null;
  }

  return speakerSegments.reduce((best, current) =>
    current.text.length > best.text.length ? current : best
  );
};

const SpeakerIdentificationModal: React.FC<SpeakerIdentificationModalProps> = ({
  isOpen,
  file,
  discoveryResult,
  initialNames,
  onConfirm,
  onCancel,
}) => {
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [sampleUrls, setSampleUrls] = useState<Record<string, string | null>>({});
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [playingSpeaker, setPlayingSpeaker] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sampleUrlsRef = useRef<string[]>([]);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const speakers = discoveryResult.speakers;
  const orderedSamples = useMemo(
    () => speakers.map((speakerId) => ({ speakerId, sample: getBestSampleSegment(discoveryResult, speakerId) })),
    [discoveryResult, speakers]
  );

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingSpeaker(null);
  };

  const revokeSampleUrls = () => {
    for (const url of sampleUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    sampleUrlsRef.current = [];
  };

  useEffect(() => {
    if (!isOpen) {
      stopAudio();
      revokeSampleUrls();
      setSampleUrls({});
      return;
    }

    const defaultNames: Record<string, string> = {};
    for (const speaker of speakers) {
      defaultNames[speaker] = initialNames?.[speaker] || "";
    }
    setSpeakerNames(defaultNames);

    let cancelled = false;
    setLoadingSamples(true);
    stopAudio();
    revokeSampleUrls();
    setSampleUrls({});

    const clipRequests = orderedSamples
      .filter(({ sample }) => Boolean(sample))
      .map(({ speakerId, sample }) => ({
        id: speakerId,
        startSec: sample!.startTime,
        endSec: Math.min(sample!.endTime, sample!.startTime + MAX_SAMPLE_SECONDS),
      }));

    extractAudioClips(file, clipRequests)
      .then((map) => {
        if (cancelled) {
          Object.values(map).forEach((url) => {
            if (url) URL.revokeObjectURL(url);
          });
          return;
        }

        speakers.forEach((speakerId) => {
          map[speakerId] = map[speakerId] || null;
        });

        Object.values(map).forEach((url) => {
          if (url) {
            sampleUrlsRef.current.push(url);
          }
        });
        setSampleUrls(map);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSamples(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [discoveryResult, file, initialNames, isOpen, orderedSamples, speakers]);

  useEffect(() => {
    return () => {
      stopAudio();
      revokeSampleUrls();
    };
  }, []);

  const handlePlayPause = async (speakerId: string) => {
    const url = sampleUrls[speakerId];
    if (!url) return;

    if (playingSpeaker === speakerId && audioRef.current) {
      stopAudio();
      return;
    }

    stopAudio();
    const audio = new Audio(url);
    audio.onended = () => {
      if (audioRef.current === audio) {
        stopAudio();
      }
    };

    audioRef.current = audio;
    setPlayingSpeaker(speakerId);

    try {
      await audio.play();
    } catch (_error) {
      stopAudio();
    }
  };

  const handleNameChange = (speakerId: string, value: string) => {
    setSpeakerNames((prev) => ({ ...prev, [speakerId]: value }));
  };

  const handleConfirm = () => {
    const normalized: Record<string, string> = {};
    for (const speakerId of speakers) {
      normalized[speakerId] = (speakerNames[speakerId] || "").trim();
    }
    onConfirm(normalized);
  };

  const handleInputEnter = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const nextSpeaker = speakers[index + 1];
    if (nextSpeaker) {
      inputRefs.current[nextSpeaker]?.focus();
      return;
    }
    handleConfirm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Identificar Falantes
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {speakers.length} falantes detectados. Dê um nome para cada voz antes da transcrição final.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {orderedSamples.map(({ speakerId, sample }, index) => {
            const color = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
            const clipUrl = sampleUrls[speakerId];
            const isPlaying = playingSpeaker === speakerId;

            return (
              <div
                key={speakerId}
                className={`rounded-xl border ${color.border} bg-slate-800/40 p-4`}
                style={{ boxShadow: `inset 4px 0 0 ${color.hex}` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${color.text}`}>
                      {speakerId}
                    </span>
                  </div>
                  <button
                    onClick={() => handlePlayPause(speakerId)}
                    disabled={loadingSamples || !clipUrl}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-slate-100 flex items-center gap-2"
                  >
                    {loadingSamples ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {isPlaying ? "Pausar" : "Play"}
                  </button>
                </div>

                <p className="mt-3 text-sm text-slate-300 italic">
                  "{sample?.text || "Sem trecho de referência disponível."}"
                </p>

                <input
                  ref={(element) => {
                    inputRefs.current[speakerId] = element;
                  }}
                  type="text"
                  value={speakerNames[speakerId] || ""}
                  onChange={(event) => handleNameChange(speakerId, event.target.value)}
                  onKeyDown={(event) => handleInputEnter(event, index)}
                  placeholder="Nome do falante..."
                  className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={() => onConfirm({})}
            className="px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Pular - usar labels genéricos
          </button>
          <button
            onClick={handleConfirm}
            disabled={loadingSamples}
            className="px-4 py-2 text-sm rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingSamples && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpeakerIdentificationModal;
