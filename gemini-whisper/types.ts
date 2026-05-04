export enum ProcessStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  AWAITING_NAMES = 'AWAITING_NAMES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export type ColorToken = {
  bg: string;
  text: string;
  border: string;
  hex: string;
};

export interface SpeakerSegment {
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SpeakerProfile {
  id: string;
  displayName: string;
  color: ColorToken;
  sampleText: string;
}

export interface SpeakerDiscoveryResult {
  language: string;
  speakers: string[];
  segments: SpeakerSegment[];
}

export const SPEAKER_COLORS: ColorToken[] = [
  { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40', hex: '#93c5fd' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40', hex: '#fcd34d' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', hex: '#6ee7b7' },
  { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40', hex: '#fda4af' },
  { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40', hex: '#d8b4fe' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40', hex: '#67e8f9' },
];

export interface TranscriptionResult {
  text: string;
  language?: string;
  summary?: string;
  provider: string;
  segments?: SpeakerSegment[];
  speakerProfiles?: SpeakerProfile[];
}

export interface AtaProjectProfile {
  id: string;
  projeto: string;
  sprint: string;
  participantes: string;
  destinatarios: string;
}

export interface AtaPipelineDefaults {
  projeto: string;
  sprint: string;
  participantes: string;
  destinatarios: string;
  autoGenerateAta: boolean;
  projectProfiles: AtaProjectProfile[];
}

export interface AtaPipelineRequest {
  arquivoFonte: string;
  transcriptText: string;
  projeto: string;
  sprint: string;
  participantes: string[];
  destinatarios: string[];
  meetingTitle: string;
  meetingDate: string;
}

export interface AtaPipelineExecutionResult {
  success: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  pythonExecutable?: string;
  operation?: 'run' | 'reprocess-latest' | 'preflight' | 'cleanup-generated';
  result?: {
    success: boolean;
    state?: {
      arquivos_derivados?: string[];
      validation_result?: {
        valid?: boolean;
        score?: number;
        errors?: string[];
        warnings?: string[];
      };
      delivery_result?: {
        success: boolean;
        error?: string;
        provider?: string;
        sent_at?: string;
      };
      audit_result?: {
        passed: boolean;
        issues?: string[];
      };
    };
  };
  preflight?: {
    smtp_ready?: boolean;
    smtp_dry_run?: boolean;
    smtp_connection_ok?: boolean;
    smtp_auth_ok?: boolean;
    smtp_login_verified?: boolean;
    smtp_verify_error?: string;
    openai_configured?: boolean;
    runtime_events_ready?: boolean;
    latest_runtime_event?: string;
  };
  maintenance?: {
    scanned_files?: number;
    archived_files?: string[];
    skipped_files?: string[];
    archive_root?: string;
  };
}

export type AtaPipelineStatus = 'idle' | 'running' | 'success' | 'error';

export interface MediaFile {
  file: File;
  previewUrl: string;
  type: 'audio' | 'video';
}

export type TranscriptionProvider = 'gemini' | 'openai' | 'huggingface';

export interface ApiKeys {
  openai: string;
  huggingface: string;
}

export interface TranscriptionOptions {
  diarization?: boolean;
  language?: string;
  duration?: number;
  onProgress?: (message: string) => void;
  speakerProfiles?: SpeakerProfile[];
}

export interface QueueItem {
  id: string;
  file: File;
  status: ProcessStatus;
  result?: TranscriptionResult;
  error?: string;
  type: 'audio' | 'video';
  previewUrl?: string;
  progressMessage?: string;
  discoveryResult?: SpeakerDiscoveryResult;
  speakerNames?: Record<string, string>;
  awaitingDiarization?: boolean;
  processedMode?: 'transcribe' | 'translate';
  autoRunAta?: boolean;
  meetingTitle?: string;
  ataPipelineStatus?: AtaPipelineStatus;
  ataPipelineMessage?: string;
  ataPipelineResult?: AtaPipelineExecutionResult;
}
