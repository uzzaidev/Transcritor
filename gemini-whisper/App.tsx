import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, RefreshCw, Mic, Globe, Play, Loader2, X, FileText, Settings, Video, Download, Send, AlertTriangle } from 'lucide-react';
import FileUpload from './components/FileUpload';
import TranscriptionView from './components/TranscriptionView';
import SettingsModal from './components/SettingsModal';
import ContextRecorder from './components/ContextRecorder';
import FileQueue from './components/FileQueue';
import SpeakerIdentificationModal from './components/SpeakerIdentificationModal';
import AtaGenerationModal from './components/AtaGenerationModal';
import { discoverSpeakers, transcribeMedia } from './services/transcriptionService';
import { ProcessStatus, QueueItem, SpeakerDiscoveryResult, TranscriptionResult } from './types';
import { useAppSettings } from './hooks/useAppSettings';
import { useAtaPipeline } from './hooks/useAtaPipeline';
import { buildSpeakerProfiles, normalizeSpeakerNames, rebuildResultWithNames } from './utils/speakerUtils';

import { calculateOpenAICost, formatCurrency } from './utils/costCalculator';
import AudioRecorder from './components/AudioRecorder';
import { getFileChunks, CHUNK_SIZE, formatBytes } from './utils/fileUtils';

type ViewMode = 'files' | 'live-context';

const App: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('files');
    // const [media, setMedia] = useState<MediaFile | null>(null); // Replaced by queue
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const queueRef = useRef<QueueItem[]>([]); // Ref to track queue state instantly for loop logic
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);
    const isProcessingRef = useRef(false);

    // Sync Ref with State
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    // Kept for "current active file" focus if needed, or just use queue status
    const [activeFileId, setActiveFileId] = useState<string | null>(null);

    const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.IDLE); // Global status (deprecate if possible)

    const [mode, setMode] = useState<'transcribe' | 'translate'>('transcribe');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [inputMode, setInputMode] = useState<'upload' | 'record'>('upload');
    const [recordingIntent, setRecordingIntent] = useState<'transcription' | 'meeting-ata'>('transcription');
    const [useDiarization, setUseDiarization] = useState(false);
    const [language, setLanguage] = useState<string>('Portuguese');

    // Cost Tracking
    const [sessionCost, setSessionCost] = useState<number>(0);

    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [viewResult, setViewResult] = useState<{ text: string, type: string } | null>(null);
    const [diarizationPendingItem, setDiarizationPendingItem] = useState<QueueItem | null>(null);
    const { provider, setProvider, apiKeys, setApiKeys, ataDefaults, setAtaDefaults, secureStorageStatus } = useAppSettings();

    const {
        ataModalItemId,
        ataModalItem,
        ataPipelineError,
        isRunningAtaPipeline,
        pipelineOpsState,
        setAtaModalItemId,
        handleAtaPipelineSubmit,
        handleOpenAtaModal,
        handlePreflightPipeline,
        handleReprocessLatestPipeline,
        handleCleanupGeneratedArtifacts,
    } = useAtaPipeline({
        queue,
        setQueue,
        ataDefaults,
        setAtaDefaults,
    });

    // Media element ref (for duration check of active file)
    const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

    const handleFilesSelected = (files: File[]) => {
        const newItems: QueueItem[] = files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file: file,
            status: ProcessStatus.PENDING,
            type: file.type.startsWith('video/') ? 'video' : 'audio',
            previewUrl: URL.createObjectURL(file)
        }));

        setQueue(prev => [...prev, ...newItems]);
        setStatus(ProcessStatus.IDLE);
        setErrorMsg(null);

        // If queue was empty, maybe auto-select first as "preview" if we want?
        // For now, we just add to queue.
    };

    const handleRemoveFromQueue = (id: string) => {
        if (diarizationPendingItem?.id === id) {
            setDiarizationPendingItem(null);
        }
        if (ataModalItemId === id) {
            setAtaModalItemId(null);
        }
        setQueue(prev => prev.filter(item => item.id !== id));
    };

    const handleClearCompleted = () => {
        if (diarizationPendingItem && (diarizationPendingItem.status === ProcessStatus.COMPLETED || diarizationPendingItem.status === ProcessStatus.ERROR)) {
            setDiarizationPendingItem(null);
        }
        setQueue(prev => prev.filter(item => item.status !== ProcessStatus.COMPLETED && item.status !== ProcessStatus.ERROR));
    };



    const processQueue = async () => {
        if (isProcessingRef.current) return;

        // Validation for missing keys
        if (provider === 'openai' && !apiKeys.openai) {
            setErrorMsg("Please enter your OpenAI API Key in Settings.");
            setIsSettingsOpen(true);
            return;
        }
        if (provider === 'huggingface' && !apiKeys.huggingface) {
            setErrorMsg("Please enter your Hugging Face Token in Settings.");
            setIsSettingsOpen(true);
            return;
        }

        setIsProcessingQueue(true);
        isProcessingRef.current = true;
        setStatus(ProcessStatus.PROCESSING);

        const processNext = async () => {
            const currentQueue = queueRef.current;
            const awaitingItem = currentQueue.find(
                item => item.status === ProcessStatus.AWAITING_NAMES && item.discoveryResult
            );

            if (awaitingItem) {
                setDiarizationPendingItem(awaitingItem);
                setIsProcessingQueue(false);
                isProcessingRef.current = false;
                setStatus(ProcessStatus.IDLE);
                return;
            }

            const nextItem = currentQueue.find(i => i.status === ProcessStatus.PENDING);

            if (!nextItem) {
                setIsProcessingQueue(false);
                isProcessingRef.current = false;
                setStatus(ProcessStatus.IDLE);
                return;
            }

            const currentId = nextItem.id;
            const file = nextItem.file;

            setQueue(prev => prev.map(i => i.id === currentId ? { ...i, status: ProcessStatus.PROCESSING, progressMessage: "Initializing..." } : i));

            try {
                const shouldUseChunking = file.size > CHUNK_SIZE && provider !== 'gemini';
                const shouldRunDiarizationFlow = useDiarization && provider === 'gemini' && mode === 'transcribe';
                let resultData: TranscriptionResult;
                let discoveryResult: SpeakerDiscoveryResult | undefined;
                let speakerNames: Record<string, string> | undefined;

                if (shouldRunDiarizationFlow) {
                    setQueue(prev => prev.map(item =>
                        item.id === currentId
                            ? { ...item, status: ProcessStatus.UPLOADING, progressMessage: "Discovering speakers..." }
                            : item
                    ));

                    discoveryResult = await discoverSpeakers(file, {
                        language,
                        onProgress: (msg) => {
                            setQueue(prev => prev.map(item =>
                                item.id === currentId ? { ...item, progressMessage: msg } : item
                            ));
                        }
                    });

                    const uniqueSpeakers = Array.from(new Set(discoveryResult.speakers));

                    if (uniqueSpeakers.length > 1) {
                        const awaitingQueueItem: QueueItem = {
                            ...nextItem,
                            status: ProcessStatus.AWAITING_NAMES,
                            progressMessage: "Aguardando identificação...",
                            discoveryResult,
                            awaitingDiarization: true,
                        };

                        setQueue(prev => prev.map(item => item.id === currentId ? awaitingQueueItem : item));
                        setDiarizationPendingItem(awaitingQueueItem);
                        setIsProcessingQueue(false);
                        isProcessingRef.current = false;
                        setStatus(ProcessStatus.IDLE);
                        return;
                    }

                    speakerNames = normalizeSpeakerNames(discoveryResult, {});
                    const profiles = buildSpeakerProfiles(discoveryResult, speakerNames);

                    resultData = await transcribeMedia(
                        file,
                        mode,
                        provider,
                        apiKeys,
                        {
                            diarization: true,
                            language,
                            speakerProfiles: profiles,
                            duration: 0,
                            onProgress: (msg) => {
                                setQueue(prev => prev.map(item =>
                                    item.id === currentId ? { ...item, progressMessage: msg } : item
                                ));
                            }
                        }
                    );
                } else if (shouldUseChunking) {
                    const chunks = getFileChunks(file);
                    let fullText = "";

                    for (let i = 0; i < chunks.length; i++) {
                        if (!isProcessingRef.current) break; // Emergency stop
                        const chunk = chunks[i];

                        const msg = `Processing chunk ${i + 1}/${chunks.length}`;
                        setQueue(prev => prev.map(item => item.id === currentId ? { ...item, progressMessage: msg } : item));

                        const chunkFile = new File([chunk.blob], `${file.name}.part${i}`, { type: file.type });
                        const chunkResult = await transcribeMedia(
                            chunkFile,
                            mode,
                            provider,
                            apiKeys,
                            {
                                diarization: useDiarization,
                                language,
                                duration: 0,
                                onProgress: () => { } // chunks already track via loop
                            }
                        );
                        if (chunkResult.text) fullText += (fullText ? "\n\n" : "") + chunkResult.text;
                    }
                    resultData = {
                        text: fullText,
                        provider: `${getProviderName()} (Chunked)`,
                        language: 'en'
                    };

                } else {
                    if (provider === 'gemini') {
                        setQueue(prev => prev.map(item => item.id === currentId ? { ...item, status: ProcessStatus.UPLOADING, progressMessage: "Uploading..." } : item));
                    }

                    resultData = await transcribeMedia(
                        file,
                        mode,
                        provider,
                        apiKeys,
                        {
                            diarization: useDiarization,
                            language,
                            duration: 0,
                            onProgress: (msg) => {
                                setQueue(prev => prev.map(item => item.id === currentId ? { ...item, progressMessage: msg } : item));
                            }
                        }
                    );
                }

                setQueue(prev => prev.map(item => item.id === currentId
                    ? {
                        ...item,
                        status: ProcessStatus.COMPLETED,
                        result: resultData,
                        processedMode: mode,
                        progressMessage: "Done",
                        discoveryResult: discoveryResult || item.discoveryResult,
                        speakerNames: speakerNames || item.speakerNames,
                        awaitingDiarization: false,
                    }
                    : item
                ));

            } catch (err: any) {
                console.error("Processing error:", err);
                setQueue(prev => prev.map(item => item.id === currentId
                    ? { ...item, status: ProcessStatus.ERROR, error: err.message, progressMessage: "Error", awaitingDiarization: false }
                    : item
                ));
            }

            if (isProcessingRef.current) {
                setTimeout(processNext, 100);
            }
        };

        processNext();
    };

    const handleMeetingRecordingComplete = (mediaFile: { file: File; previewUrl: string; type: 'audio' | 'video' }) => {
        const recordedAt = new Date();
        const title = `Reuniao gravada ${recordedAt.toLocaleDateString('pt-BR')} ${recordedAt
            .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            .replace(':', 'h')}`;
        const newItem: QueueItem = {
            id: Math.random().toString(36).substr(2, 9),
            file: mediaFile.file,
            status: ProcessStatus.PENDING,
            type: 'audio',
            previewUrl: mediaFile.previewUrl,
            autoRunAta: true,
            meetingTitle: title,
            progressMessage: "Aguardando transcricao da reuniao...",
        };

        const nextQueue = [...queueRef.current, newItem];
        queueRef.current = nextQueue;
        setQueue(nextQueue);
        setViewMode('files');
        setInputMode('upload');
        setErrorMsg(null);
        setStatus(ProcessStatus.IDLE);

        setTimeout(() => {
            processQueue();
        }, 0);
    };

    const handleDiarizationConfirm = async (rawNames: Record<string, string>) => {
        if (!diarizationPendingItem) return;

        const currentItem = queueRef.current.find(item => item.id === diarizationPendingItem.id) || diarizationPendingItem;
        const discovery = currentItem.discoveryResult;
        if (!discovery) {
            setDiarizationPendingItem(null);
            return;
        }

        const normalizedNames = normalizeSpeakerNames(discovery, rawNames);

        if (currentItem.status === ProcessStatus.COMPLETED && currentItem.result) {
            const rebuiltResult = rebuildResultWithNames(currentItem.result, discovery, normalizedNames);
            setQueue(prev => prev.map(item =>
                item.id === currentItem.id
                    ? { ...item, result: rebuiltResult, speakerNames: normalizedNames }
                    : item
            ));
            setDiarizationPendingItem(null);
            return;
        }

        setDiarizationPendingItem(null);
        setIsProcessingQueue(true);
        isProcessingRef.current = true;
        setStatus(ProcessStatus.PROCESSING);
        setQueue(prev => prev.map(item =>
            item.id === currentItem.id
                ? { ...item, status: ProcessStatus.PROCESSING, progressMessage: "Applying speaker profiles...", speakerNames: normalizedNames }
                : item
        ));

        try {
            const profiles = buildSpeakerProfiles(discovery, normalizedNames);
            const result = await transcribeMedia(
                currentItem.file,
                'transcribe',
                'gemini',
                apiKeys,
                {
                    diarization: true,
                    language: language || discovery.language,
                    speakerProfiles: profiles,
                    duration: 0,
                    onProgress: (msg) => {
                        setQueue(prev => prev.map(item =>
                            item.id === currentItem.id ? { ...item, progressMessage: msg } : item
                        ));
                    }
                }
            );

            setQueue(prev => prev.map(item =>
                item.id === currentItem.id
                    ? {
                        ...item,
                        status: ProcessStatus.COMPLETED,
                        result,
                        processedMode: 'transcribe',
                        discoveryResult: discovery,
                        speakerNames: normalizedNames,
                        awaitingDiarization: false,
                        progressMessage: "Done",
                    }
                    : item
            ));
        } catch (err: any) {
            setQueue(prev => prev.map(item =>
                item.id === currentItem.id
                    ? {
                        ...item,
                        status: ProcessStatus.ERROR,
                        error: err.message,
                        progressMessage: "Error",
                        awaitingDiarization: false,
                    }
                    : item
            ));
        } finally {
            setIsProcessingQueue(false);
            isProcessingRef.current = false;
            setStatus(ProcessStatus.IDLE);
            processQueue();
        }
    };

    const handleRequestRename = (itemId: string) => {
        const item = queueRef.current.find(entry => entry.id === itemId);
        if (!item?.discoveryResult) return;
        setDiarizationPendingItem(item);
    };

    const handleDiarizationCancel = () => {
        setDiarizationPendingItem(null);
    };


    const getProviderName = () => {
        switch (provider) {
            case 'openai': return 'OpenAI Whisper';
            case 'huggingface': return 'HF Whisper v3';
            case 'gemini': default: return 'Gemini 2.5 Flash';
        }
    };

    // Get Gemini API Key (either from env or potentially settings if we added it there)
    // For now assuming it is in env as per original app, but could be extended
    const geminiApiKey = process.env.GEMINI_API_KEY || "";
    const selectedAtaProfile = ataDefaults.projectProfiles.find(
        (profile) => profile.projeto.trim().toLowerCase() === ataDefaults.projeto.trim().toLowerCase()
    );
    const meetingAtaProject = selectedAtaProfile?.projeto || ataDefaults.projeto;
    const meetingAtaSprint = selectedAtaProfile?.sprint || ataDefaults.sprint;
    const meetingAtaParticipants = selectedAtaProfile?.participantes || ataDefaults.participantes;
    const meetingAtaRecipients = selectedAtaProfile?.destinatarios || ataDefaults.destinatarios;
    const meetingAtaReady = Boolean(
        meetingAtaProject.trim() &&
        meetingAtaSprint.trim() &&
        meetingAtaRecipients.trim()
    );

    const handleSessionComplete = async (audioBlob: Blob, screenshots: any[], duration: number) => {
        const file = new File([audioBlob], `session_${new Date().toISOString()}.webm`, { type: 'audio/webm' });

        // Add to queue
        const newItem: QueueItem = {
            id: Math.random().toString(36).substr(2, 9),
            file: file,
            status: ProcessStatus.PENDING,
            type: 'audio',
            previewUrl: URL.createObjectURL(file)
        };

        setQueue(prev => [...prev, newItem]);
        setViewMode('files');
        setInputMode('upload');

        // Immediately start processing this single item if queue was idle?
        // Or just let user click "Start Processing"
        // User flow suggests auto-process for session mode.
        // We'll implemented a dedicated "auto-process" for this flow later if needed, 
        // but for now let's add to queue and maybe trigger the queue processor if idle.

        // Actually, the previous logic handled it specifically. 
        // Let's adapt it to use the new queue system OR keep a special "Session Mode" handling.
        // Given the requirement "upload more than one file", the queue is best.
        // But for Session, we specifically want the Markdown output with Screenshots.
        // The QueueItem type doesn't support screenshots yet.
        // Let's stick to the special Session handling for now regarding the Markdown generation 
        // OR extend QueueItem.
        // Extending QueueItem is cleaner.

        // TODO: Add screenshots support to QueueItem if we want full unification.
        // For now, I will revert to the separate handleSessionComplete logic just for the "Session Recording" flow
        // to ensure I don't break the feature I just verified. 
        // BUT, the user prompt asked to allow "transcribing more than one file".
        // It implies the "Files" tab should support batch.

        // So:
        // 1. Files Tab -> Batch Queue
        // 2. Live Context -> Session Recording -> Special handling (or Single Item Queue)

        // Let's keep the special handling for `handleSessionComplete` from the previous step 
        // effectively bypassing the queue for that specific workflow to guarantee the Markdown feature works as previously verified.

        processSessionAuto(file, screenshots, duration);
    };

    // Legacy-ish function for the specific Session Flow (Live Context -> Stop -> Process)
    const processSessionAuto = async (file: File, screenshots: any[], duration: number) => {
        setViewMode('files');
        // We construct a temporary single-item "view" or just use the Result view overlays?
        // Actually, the "Files" view is now the Queue view. 
        // If we want to show the session result, we might need to handle it.

        // Let's create a queue item for it, process it, and when done, generate the markdown.
        const id = Math.random().toString(36).substr(2, 9);
        const newItem: QueueItem = {
            id,
            file,
            status: ProcessStatus.PROCESSING, // Start immediately
            type: 'audio',
            previewUrl: URL.createObjectURL(file),
            progressMessage: "Processing session..."
        };
        setQueue([newItem]); // Replace queue or append? Replace feels safer for "Session Mode" focus.

        try {
            const result = await transcribeMedia(
                file,
                'transcribe',
                'gemini',
                apiKeys,
                { duration, onProgress: (m) => setQueue(q => q.map(i => i.id === id ? { ...i, progressMessage: m } : i)) }
            );

            setQueue(q => q.map(i => i.id === id ? { ...i, status: ProcessStatus.COMPLETED, result, processedMode: 'transcribe', progressMessage: "Done" } : i));

            // Auto-generate Markdown
            const markdown = generateMarkdown(result.text, screenshots);
            downloadMarkdown(markdown);

        } catch (e: any) {
            setQueue(q => q.map(i => i.id === id ? { ...i, status: ProcessStatus.ERROR, error: e.message } : i));
        }
    };

    const downloadMarkdown = (content: string) => {
        const element = document.createElement("a");
        const mdBlob = new Blob([content], { type: 'text/markdown' });
        element.href = URL.createObjectURL(mdBlob);
        element.download = `Context_Session_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const downloadText = (text: string) => {
        const element = document.createElement("a");
        const blob = new Blob([text], { type: 'text/plain' });
        element.href = URL.createObjectURL(blob);
        element.download = `transcription_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const generateMarkdown = (transcript: string, screenshots: any[]) => {
        let md = `# Context Session Report - ${new Date().toLocaleString()}\n\n`;
        const timeToSeconds = (timeStr: string) => {
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            return 0;
        };

        md += `## Transcription & Context\n\n`;

        const lines = transcript.split('\n');
        let currentScreenshotIndex = 0;
        const sortedScreenshots = [...screenshots].sort((a, b) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp));

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            md += `${line}\n`;
            const match = line.match(/\[(\d{1,2}:\d{2})\]/) || line.match(/\((\d{1,2}:\d{2})\)/);
            if (match) {
                const lineTime = timeToSeconds(match[1]);
                while (
                    currentScreenshotIndex < sortedScreenshots.length &&
                    timeToSeconds(sortedScreenshots[currentScreenshotIndex].timestamp) <= lineTime + 10
                ) {
                    const shot = sortedScreenshots[currentScreenshotIndex];
                    md += `\n> **📸 Screenshot at ${shot.timestamp}**\n`;
                    md += `![Screenshot ${currentScreenshotIndex + 1}](${shot.imageData})\n\n`;
                    currentScreenshotIndex++;
                }
            }
        }
        while (currentScreenshotIndex < sortedScreenshots.length) {
            const shot = sortedScreenshots[currentScreenshotIndex];
            md += `\n> **📸 Screenshot at ${shot.timestamp}**\n`;
            md += `![Screenshot ${currentScreenshotIndex + 1}](${shot.imageData})\n\n`;
            currentScreenshotIndex++;
        }
        return md;
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 selection:bg-blue-500/30 font-sans">
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                apiKeys={apiKeys}
                setApiKeys={setApiKeys}
                provider={provider}
                setProvider={setProvider}
                ataDefaults={ataDefaults}
                setAtaDefaults={setAtaDefaults}
                secureStorageStatus={secureStorageStatus}
                pipelineOpsState={pipelineOpsState}
                onPreflight={handlePreflightPipeline}
                onReprocessLatest={handleReprocessLatestPipeline}
                onCleanupGenerated={handleCleanupGeneratedArtifacts}
            />

            <AtaGenerationModal
                isOpen={Boolean(ataModalItem)}
                item={ataModalItem}
                defaults={ataDefaults}
                projectProfiles={ataDefaults.projectProfiles}
                isSubmitting={isRunningAtaPipeline}
                errorMessage={ataPipelineError}
                onClose={() => setAtaModalItemId(null)}
                onSubmit={handleAtaPipelineSubmit}
            />

            {diarizationPendingItem?.discoveryResult && (
                <SpeakerIdentificationModal
                    isOpen={Boolean(diarizationPendingItem)}
                    file={diarizationPendingItem.file}
                    discoveryResult={diarizationPendingItem.discoveryResult}
                    initialNames={diarizationPendingItem.speakerNames}
                    onConfirm={handleDiarizationConfirm}
                    onCancel={handleDiarizationCancel}
                />
            )}

            {/* Header */}
            <header className="fixed top-0 w-full z-40 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            Gemini Whisper
                        </span>
                    </div>

                    {/* Navigation */}
                    <div className="hidden md:flex bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
                        <button
                            onClick={() => setViewMode('files')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'files'
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            Files
                        </button>
                        <button
                            onClick={() => setViewMode('live-context')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'live-context'
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <Video className="w-4 h-4" />
                            Live Context
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block text-xs font-medium text-slate-500 border border-slate-800 rounded-full px-3 py-1">
                            Running: <span className="text-slate-300">{getProviderName()}</span>
                        </div>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-12 px-4 sm:px-6 max-w-7xl mx-auto">
                <div className="md:hidden flex mb-6 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
                    {/* Mobile Nav contents... same as before */}
                </div>

                {/* Result Modal */}
                {viewResult && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
                            <div className="flex justify-between items-center p-4 border-b border-slate-700">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-400" />
                                    Transcription Result
                                </h2>
                                <button onClick={() => setViewResult(null)} className="text-slate-400 hover:text-white transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-6 bg-slate-950/50 font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {viewResult.text}
                            </div>
                            <div className="p-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-900">
                                <button
                                    onClick={() => {
                                        const blob = new Blob([viewResult.text], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `transcription-${new Date().toISOString().slice(0, 10)}.txt`;
                                        a.click();
                                    }}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2 border border-slate-600"
                                >
                                    <Download className="w-4 h-4" /> Download Text
                                </button>
                                <button
                                    onClick={() => setViewResult(null)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'live-context' ? (
                    <ContextRecorder apiKey={geminiApiKey} onSessionComplete={handleSessionComplete} />
                ) : (
                    <>
                        {/* Main Files View */}
                        {queue.length === 0 ? (
                            // Empty State
                            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in text-center">
                                <div className="mb-8 max-w-2xl">
                                    <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                                        Batch Transcription <br />
                                        <span className="text-blue-400">Made Easy</span>
                                    </h1>
                                    <p className="text-lg text-slate-400 mb-2">
                                        Upload multiple files. Support for WhatsApp Audio (.ogg, .m4a).
                                    </p>
                                </div>

                                <div className="bg-slate-800/50 p-1 rounded-lg flex items-center gap-1 mb-8 border border-slate-700">
                                    <button
                                        onClick={() => setInputMode('upload')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${inputMode === 'upload' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Upload Files
                                    </button>
                                    <button
                                        onClick={() => setInputMode('record')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${inputMode === 'record' ? 'bg-red-500/20 text-red-200 shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Record Audio
                                    </button>
                                </div>

                                {inputMode === 'upload' ? (
                                    <FileUpload onFilesSelected={handleFilesSelected} />
                                ) : (
                                    <div className="w-full max-w-2xl border-2 border-dashed border-slate-700 rounded-xl p-8 bg-slate-800/30 flex flex-col items-center justify-center min-h-[360px]">
                                        <div className="mb-6 grid w-full max-w-xl gap-3 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => setRecordingIntent('transcription')}
                                                className={`rounded-xl border px-4 py-3 text-left transition-all ${recordingIntent === 'transcription'
                                                    ? 'border-blue-500 bg-blue-500/10 text-white'
                                                    : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                                                    }`}
                                            >
                                                <p className="text-sm font-semibold">Só transcrever</p>
                                                <p className="mt-1 text-xs opacity-70">Grava e adiciona o áudio na fila.</p>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRecordingIntent('meeting-ata')}
                                                className={`rounded-xl border px-4 py-3 text-left transition-all ${recordingIntent === 'meeting-ata'
                                                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                                                    : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                                                    }`}
                                            >
                                                <p className="flex items-center gap-2 text-sm font-semibold">
                                                    <Send className="h-4 w-4" />
                                                    Reunião + ATA
                                                </p>
                                                <p className="mt-1 text-xs opacity-70">Ao parar, transcreve e envia a ATA.</p>
                                            </button>
                                        </div>

                                        {recordingIntent === 'meeting-ata' && (
                                            <div
                                                className={`mb-6 w-full max-w-xl rounded-xl border px-4 py-3 text-sm ${meetingAtaReady
                                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                                                    }`}
                                            >
                                                {meetingAtaReady ? (
                                                    <>
                                                        <p className="font-semibold">Modo reunião pronto para envio automático.</p>
                                                        <p className="mt-1 text-xs opacity-80">
                                                            Projeto: {meetingAtaProject} | Sprint: {meetingAtaSprint} | Destinatários: {meetingAtaRecipients}
                                                        </p>
                                                        {meetingAtaParticipants ? (
                                                            <p className="mt-1 text-xs opacity-80">Participantes padrão: {meetingAtaParticipants}</p>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <p className="flex items-start gap-2">
                                                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                        Configure projeto, sprint e destinatários em Settings antes de usar o envio automático.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <AudioRecorder
                                            disabled={recordingIntent === 'meeting-ata' && !meetingAtaReady}
                                            idleLabel={recordingIntent === 'meeting-ata' ? 'Iniciar reunião' : 'Record Audio'}
                                            recordingLabel={recordingIntent === 'meeting-ata' ? 'Reunião em andamento...' : 'Recording in progress...'}
                                            stopTitle={recordingIntent === 'meeting-ata' ? 'Finalizar reunião e enviar ATA' : 'Stop Recording'}
                                            onRecordingComplete={(file) => {
                                                if (recordingIntent === 'meeting-ata') {
                                                    handleMeetingRecordingComplete(file);
                                                    return;
                                                }
                                                handleFilesSelected([file.file]);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Queue View
                            <div className="animate-fade-in-up">
                                <div className="grid lg:grid-cols-2 gap-8">
                                    {/* Left: Queue List */}
                                    <div className="space-y-6">
                                        <FileQueue
                                            queue={queue}
                                            onRemove={handleRemoveFromQueue}
                                            onDownload={(id, format) => {
                                                const item = queue.find(i => i.id === id);
                                                if (item?.result) downloadText(item.result.text);
                                            }}
                                            onView={(id) => {
                                                const item = queue.find(i => i.id === id);
                                                if (item?.result) setViewResult({ text: item.result.text, type: 'txt' });
                                            }}
                                            onClearCompleted={handleClearCompleted}
                                        />

                                        {/* Queue Controls */}
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setInputMode('upload')}
                                                className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors text-sm"
                                            >
                                                + Add More Files
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right: Controls & Active Result */}
                                    <div className="space-y-6">
                                        {/* Helper Panel */}
                                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 relative overflow-hidden">
                                            {/* Background accent */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Global Options</h3>
                                            </div>

                                            {/* Language Selector */}
                                            <div className="mb-6">
                                                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                                                    Source Language
                                                </label>
                                                <select
                                                    value={language}
                                                    onChange={(e) => setLanguage(e.target.value)}
                                                    disabled={isProcessingQueue}
                                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none disabled:opacity-50"
                                                >
                                                    <option value="Portuguese">Portuguese (Brazil)</option>
                                                    <option value="English">English</option>
                                                    <option value="Spanish">Spanish</option>
                                                    <option value="French">French</option>
                                                    <option value="German">German</option>
                                                    <option value="Italian">Italian</option>
                                                    <option value="Japanese">Japanese</option>
                                                    <option value="Chinese">Chinese</option>
                                                    <option value="Russian">Russian</option>
                                                </select>
                                            </div>

                                            {/* Speaker Diarization Toggle */}
                                            <div className="mb-6">
                                                <button
                                                    onClick={() => setUseDiarization(d => !d)}
                                                    disabled={isProcessingQueue}
                                                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all disabled:opacity-50
                                                        ${useDiarization
                                                            ? 'border-amber-500 bg-amber-500/10 text-white'
                                                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <svg className={`w-5 h-5 ${useDiarization ? 'text-amber-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                        <div className="text-left">
                                                            <p className="font-medium text-sm">Speaker Identification</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">Label each speaker separately</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${useDiarization ? 'bg-amber-500' : 'bg-slate-700'}`}>
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${useDiarization ? 'translate-x-5' : 'translate-x-1'}`}></div>
                                                    </div>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <button
                                                    onClick={() => setMode('transcribe')}
                                                    disabled={isProcessingQueue}
                                                    className={`
                                                    flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                                                    ${mode === 'transcribe'
                                                            ? 'border-blue-500 bg-blue-500/10 text-white shadow-lg shadow-blue-500/10'
                                                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800'}
                                                `}
                                                >
                                                    <Mic className={`w-6 h-6 mb-2 ${mode === 'transcribe' ? 'text-blue-400' : 'text-slate-500'}`} />
                                                    <span className="font-medium">Transcribe</span>
                                                </button>

                                                <button
                                                    onClick={() => setMode('translate')}
                                                    disabled={isProcessingQueue}
                                                    className={`
                                                    flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                                                    ${mode === 'translate'
                                                            ? 'border-purple-500 bg-purple-500/10 text-white shadow-lg shadow-purple-500/10'
                                                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800'}
                                                `}
                                                >
                                                    <Globe className={`w-6 h-6 mb-2 ${mode === 'translate' ? 'text-purple-400' : 'text-slate-500'}`} />
                                                    <span className="font-medium">Translate</span>
                                                </button>
                                            </div>

                                            <div className="mb-6">
                                                <button
                                                    onClick={processQueue}
                                                    disabled={isProcessingQueue || queue.every(i => i.status === ProcessStatus.COMPLETED)}
                                                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2
                                                        ${isProcessingQueue ? 'bg-slate-700 cursor-wait' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-[1.02]'}
                                                    `}
                                                >
                                                    {isProcessingQueue ? (
                                                        <><Loader2 className="w-5 h-5 animate-spin" /> Processing Queue...</>
                                                    ) : (
                                                        <><Play className="w-5 h-5 fill-current" /> Start Processing Queue</>
                                                    )}
                                                </button>
                                            </div>

                                            {queue.some(i => i.status === ProcessStatus.COMPLETED) && (
                                                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                                    <p className="text-sm text-green-400">
                                                        Processing complete! Download results from the queue list.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Results Section */}
                                {queue.some(file => file.status === ProcessStatus.COMPLETED && file.result) && (
                                    <div className="mt-12 border-t border-slate-800 pt-8">
                                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                            <Sparkles className="w-6 h-6 text-blue-400" />
                                            Completed Transcriptions
                                        </h2>
                                        <div className="space-y-8">
                                            {queue.filter(file => file.status === ProcessStatus.COMPLETED && file.result).map((file) => (
                                                <div key={file.id} className="relative">
                                                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-transparent rounded-full opacity-50"></div>
                                                    <h3 className="text-lg font-medium text-slate-300 mb-3 flex items-center gap-2">
                                                        {file.type === 'audio' ? <Mic className="w-4 h-4 text-slate-500" /> : <Video className="w-4 h-4 text-slate-500" />}
                                                        {file.file.name}
                                                    </h3>
                                                    <TranscriptionView
                                                        result={file.result!}
                                                        mode={mode}
                                                        onDownload={() => downloadText(file.result!.text)}
                                                        extraActions={(
                                                            <button
                                                                onClick={() => handleOpenAtaModal(file.id)}
                                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 transition-colors"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                                Gerar ATA
                                                            </button>
                                                        )}
                                                        onRequestRename={file.discoveryResult ? () => handleRequestRename(file.id) : undefined}
                                                    />
                                                    {file.ataPipelineStatus && file.ataPipelineStatus !== 'idle' && (
                                                        <div
                                                            className={`mt-3 rounded-lg border px-4 py-3 text-sm ${file.ataPipelineStatus === 'success'
                                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                                                : file.ataPipelineStatus === 'running'
                                                                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                                                                    : 'border-red-500/30 bg-red-500/10 text-red-200'
                                                                }`}
                                                        >
                                                            <p className="font-medium">{file.ataPipelineMessage}</p>
                                                            {file.ataPipelineResult?.result?.state?.arquivos_derivados?.length ? (
                                                                <p className="mt-1 text-xs opacity-80">
                                                                    Artefatos gerados: {file.ataPipelineResult.result.state.arquivos_derivados.length}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                        }
                    </>
                )}
            </main >
        </div >
    );
};

export default App;
