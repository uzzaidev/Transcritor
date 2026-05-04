import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { MediaFile } from '../types';

interface AudioRecorderProps {
    onRecordingComplete: (file: MediaFile) => void;
    disabled?: boolean;
    idleLabel?: string;
    recordingLabel?: string;
    stopTitle?: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
    onRecordingComplete,
    disabled,
    idleLabel = "Record Audio",
    recordingLabel = "Recording in progress...",
    stopTitle = "Stop Recording",
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const startRecording = async () => {
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(audioStream);

            const mediaRecorder = new MediaRecorder(audioStream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], `recording-${new Date().toISOString()}.webm`, { type: 'audio/webm' });
                const previewUrl = URL.createObjectURL(blob);

                onRecordingComplete({
                    file,
                    previewUrl,
                    type: 'audio'
                });

                // Cleanup stream
                audioStream.getTracks().forEach(track => track.stop());
                setStream(null);
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Start Timer
            setDuration(0);
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please ensure you have granted permission.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center justify-center p-4">
            {!isRecording ? (
                <button
                    onClick={startRecording}
                    disabled={disabled}
                    className={`
                        group flex items-center gap-3 px-6 py-3 rounded-full font-medium transition-all
                        ${disabled
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 shadow-lg hover:shadow-xl'}
                    `}
                >
                    <div className="p-2 rounded-full bg-red-500/10 group-hover:bg-red-500/20 text-red-500 transition-colors">
                        <Mic className="w-5 h-5" />
                    </div>
                    <span>{idleLabel}</span>
                </button>
            ) : (
                <div className="flex flex-col items-center gap-4 animate-fade-in">
                    <div className="flex items-center gap-4 bg-slate-800/80 backdrop-blur border border-red-500/30 px-6 py-3 rounded-full shadow-lg shadow-red-500/10">
                        <div className="relative">
                            <span className="absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75 animate-ping"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </div>
                        <span className="font-mono text-lg font-medium text-slate-200 w-16 text-center">
                            {formatDuration(duration)}
                        </span>
                        <button
                            onClick={stopRecording}
                            className="p-2 hover:bg-red-500/20 rounded-full text-red-400 hover:text-red-300 transition-colors"
                            title={stopTitle}
                        >
                            <Square className="w-5 h-5 fill-current" />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 animate-pulse">{recordingLabel}</p>
                </div>
            )}
        </div>
    );
};

export default AudioRecorder;
