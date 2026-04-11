import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, Square, Camera, Clock, AlertCircle, Settings } from "lucide-react";

interface ContextRecorderProps {
    apiKey: string;
    onSessionComplete: (audioBlob: Blob, screenshots: Screenshot[], duration: number) => void;
}

interface Screenshot {
    id: string;
    timestamp: string;
    imageData: string;
    context: string;
}

interface TranscriptItem {
    text: string;
    isFinal: boolean;
}

const ContextRecorder: React.FC<ContextRecorderProps> = ({ apiKey, onSessionComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [status, setStatus] = useState<string>("Ready");
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [shortcut, setShortcut] = useState("CommandOrControl+Shift+S");

    // Load shortcut and register
    useEffect(() => {
        const saved = localStorage.getItem("global-shortcut");
        if (saved) setShortcut(saved);

        try {
            const { ipcRenderer } = (window as any).require('electron');
            ipcRenderer.send('register-shortcut', saved || "CommandOrControl+Shift+S");
        } catch (e) {
            console.error("IPC not available (dev mode browser?)", e);
        }
    }, []);

    // Listen for shortcut trigger
    useEffect(() => {
        const handleTrigger = () => {
            console.log("Shortcut triggered!");
            // We need to use the ref value or ensure takeScreenshot has latest state? 
            // takeScreenshot uses refs (videoRef, canvasRef) and state (transcripts). 
            // Since this effect depends on [transcripts], it should be fine, but we need to re-bind listener.
            takeScreenshot();
        };

        try {
            const { ipcRenderer } = (window as any).require('electron');
            ipcRenderer.on('trigger-screenshot', handleTrigger);
            return () => {
                ipcRenderer.off('trigger-screenshot', handleTrigger);
            };
        } catch (e) {
            // Ignore if not in electron
        }
    }, [transcripts, isRecording]); // Re-bind when crucial state changes so capture has latest data

    const saveShortcut = () => {
        localStorage.setItem("global-shortcut", shortcut);
        try {
            const { ipcRenderer } = (window as any).require('electron');
            ipcRenderer.send('register-shortcut', shortcut);
        } catch (e) {
            console.error("Failed to register shortcut", e);
        }
        setIsSettingsOpen(false);
    };

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const liveClientRef = useRef<any>(null);
    const currentTranscriptRef = useRef<string>("");
    const streamRef = useRef<MediaStream | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);

    // MediaRecorder Ref
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);

    // Mouse Listener for Screenshots
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (isRecording && (e.button === 3 || e.button === 4)) {
                e.preventDefault();
                takeScreenshot();
            }
        };

        window.addEventListener("mousedown", handleMouseDown);
        const handleMouseUp = (e: MouseEvent) => {
            if (isRecording && (e.button === 3 || e.button === 4)) {
                e.preventDefault();
            }
        }
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isRecording]);

    const startRecording = async () => {
        setError(null);
        setScreenshots([]);
        chunksRef.current = [];

        try {
            // 1. Get Screen Stream
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: true
            });

            // 2. Get Microphone Stream
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            streamRef.current = screenStream;
            audioStreamRef.current = micStream;

            if (videoRef.current) {
                videoRef.current.srcObject = screenStream;
                videoRef.current.play();
            }

            // 3. Audio Mixing (System + Mic)
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;

            const micSource = audioCtx.createMediaStreamSource(micStream);
            const dest = audioCtx.createMediaStreamDestination();

            micSource.connect(dest);

            if (screenStream.getAudioTracks().length > 0) {
                const systemSource = audioCtx.createMediaStreamSource(screenStream);
                systemSource.connect(dest);
            }

            // 4. Initialize MediaRecorder with mixed audio
            const combinedStream = dest.stream;
            const mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.start(1000); // Collect 1s chunks
            mediaRecorderRef.current = mediaRecorder;
            startTimeRef.current = Date.now();

            setIsRecording(true);
            setStatus("Recording session...");

            screenStream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

        } catch (err: any) {
            console.error(err);
            setError("Failed to start recording: " + err.message);
        }
    };

    // Unused in new flow, but kept stubbed to avoid breakage if referenced elsewhere
    const connectToGemini = (processor: ScriptProcessorNode) => { };


    const updateTranscriptUI = (text: string, isFinal: boolean) => {
        setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && !last.isFinal) {
                const newText = isFinal ? last.text : last.text + text;
                const updated = [...prev];
                updated[updated.length - 1] = { text: newText, isFinal: isFinal };
                return updated;
            } else {
                return [...prev, { text: text, isFinal: isFinal }];
            }
        });
    };

    const stopRecording = () => {
        const endTime = Date.now();
        const duration = (endTime - startTimeRef.current) / 1000; // Duration in seconds

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                // Notify parent
                onSessionComplete(audioBlob, screenshots, duration);
            };
            mediaRecorderRef.current.stop();
        }

        setIsRecording(false);
        setStatus("Processing...");

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };

    const takeScreenshot = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/png");

            // Calculate relative timestamp
            let timestampStr = "00:00";
            if (startTimeRef.current > 0) {
                const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
                const mm = Math.floor(diff / 60).toString().padStart(2, '0');
                const ss = (diff % 60).toString().padStart(2, '0');
                timestampStr = `${mm}:${ss}`;
            }

            const newShot: Screenshot = {
                id: Date.now().toString(),
                timestamp: timestampStr, // Relative time for report
                imageData: dataUrl,
                context: "Screenshot taken at " + timestampStr,
            };

            setScreenshots((prev) => [newShot, ...prev]);
        }
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col gap-4 animate-fade-in-up">
            {/* Controls Header */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`}></div>
                    <span className="text-slate-200 font-medium">{status}</span>
                    {isRecording && (
                        <span className="text-xs text-slate-500 hidden sm:inline-block">
                            (Mouse Button 3/4 to capture)
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {!isRecording ? (
                        <button
                            onClick={startRecording}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            <Mic className="w-4 h-4" />
                            Start Recording
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={takeScreenshot}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors font-medium text-sm border border-slate-600"
                            >
                                <Camera className="w-4 h-4" />
                                Capture
                            </button>
                            <button
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors font-medium text-sm border border-red-500/20"
                            >
                                <Square className="w-4 h-4 fill-current" />
                                Stop
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors ml-2"
                        title="Shortcut Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <div className="flex-1 flex gap-4 min-h-0">
                {/* Live Transcript Panel */}
                <div className="flex-[2] bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-900/30 flex justify-between items-center">
                        <h3 className="font-medium text-slate-200">Live Transcript</h3>
                        <span className="text-xs text-slate-500 px-2 py-1 bg-slate-800 rounded border border-slate-700">Gemini 2.5 Flash</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
                        {transcripts.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                                <Mic className="w-8 h-8 mb-2" />
                                <p>Waiting for speech...</p>
                            </div>
                        )}
                        {transcripts.map((item, idx) => (
                            <div key={idx} className={`leading-relaxed ${!item.isFinal ? 'text-slate-300' : 'text-slate-400'}`}>
                                {item.text}
                            </div>
                        ))}
                        {/* Dummy div for auto-scroll if needed */}
                        <div />
                    </div>
                </div>

                {/* Timeline Panel */}
                <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col overflow-hidden min-w-[300px]">
                    <div className="p-4 border-b border-slate-700 bg-slate-900/30">
                        <h3 className="font-medium text-slate-200">Capture Timeline</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {screenshots.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                                <Camera className="w-8 h-8 mb-2" />
                                <p className="text-center text-sm">Screenshots will appear here.<br />Use side mouse buttons.</p>
                            </div>
                        )}
                        {screenshots.map((shot) => (
                            <div key={shot.id} className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden group">
                                <div className="relative aspect-video bg-black/50">
                                    <img src={shot.imageData} alt="Screen capture" className="w-full h-full object-cover" />
                                </div>
                                <div className="p-3">
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                        <Clock className="w-3 h-3" />
                                        <span className="font-mono">{shot.timestamp}</span>
                                    </div>
                                    <div className="text-xs text-slate-300 italic border-l-2 border-blue-500 pl-2 line-clamp-3">
                                        "{shot.context}"
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hidden elements */}
            <video ref={videoRef} className="hidden" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            {/* Shortcut Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-96 shadow-2xl">
                        <h3 className="text-lg font-medium text-white mb-4">Settings</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Global Screenshot Shortcut
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={shortcut}
                                        onChange={(e) => setShortcut(e.target.value)}
                                        placeholder="e.g. CommandOrControl+Shift+S"
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        onClick={saveShortcut}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Use Electron accelerator format (e.g., Ctrl+Shift+S, CommandOrControl+P).
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContextRecorder;
