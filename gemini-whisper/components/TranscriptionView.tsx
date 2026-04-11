import React, { useState } from 'react';
import { Copy, Check, Languages, FileText, Download } from 'lucide-react';
import { SPEAKER_COLORS, TranscriptionResult } from '../types';

interface TranscriptionViewProps {
  result: TranscriptionResult;
  mode: 'transcribe' | 'translate';
  onDownload?: () => void;
  extraActions?: React.ReactNode;
  onRequestRename?: () => void;
}

const formatTimestamp = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const TranscriptionView: React.FC<TranscriptionViewProps> = ({ result, mode, onDownload, extraActions, onRequestRename }) => {
  const [copied, setCopied] = useState(false);
  const hasSegments = Boolean(result.segments?.length);

  const speakerProfileMap = new Map(
    (result.speakerProfiles || []).map(profile => [profile.displayName, profile.color] as const)
  );

  const speakerLegend = Array.from(
    new Set((result.segments || []).map(segment => segment.speaker))
  ).map((speaker, index) => ({
    speaker,
    color: speakerProfileMap.get(speaker) || SPEAKER_COLORS[index % SPEAKER_COLORS.length],
  }));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl animate-fade-in-up">
      <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${mode === 'transcribe' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
            {mode === 'transcribe' ? <FileText className="w-5 h-5" /> : <Languages className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-white font-medium">
              {mode === 'transcribe' ? 'Transcription Result' : 'English Translation'}
            </h3>
            {result.language && (
              <p className="text-xs text-slate-400">Detected Language: <span className="text-slate-300">{result.language}</span></p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {extraActions}
          {onRequestRename && hasSegments && (
            <button
              onClick={onRequestRename}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
            >
              Editar Nomes
            </button>
          )}
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download .txt
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {result.summary && (
          <div className="mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Summary</h4>
            <p className="text-slate-200 text-sm italic leading-relaxed">
              "{result.summary}"
            </p>
          </div>
        )}

        <div className="relative">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Full Text</h4>
          <div className="prose prose-invert prose-slate max-w-none">
            {hasSegments ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 mb-3">
                  {speakerLegend.map(({ speaker, color }) => (
                    <span
                      key={speaker}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${color.bg} ${color.text} ${color.border}`}
                    >
                      {speaker}
                    </span>
                  ))}
                </div>

                {(result.segments || []).map((segment, index) => {
                  const color = speakerProfileMap.get(segment.speaker) || SPEAKER_COLORS[index % SPEAKER_COLORS.length];
                  return (
                    <div
                      key={`${segment.speaker}-${segment.startTime}-${index}`}
                      className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3"
                      style={{ boxShadow: `inset 3px 0 0 ${color.hex}` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold ${color.text}`}>{segment.speaker}</span>
                        <span className="text-xs text-slate-400">{formatTimestamp(segment.startTime)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-200 text-sm">
                        {segment.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed text-slate-200">
                {result.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionView;
