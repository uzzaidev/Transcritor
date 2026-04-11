import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// --- Types ---
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

// --- Main Component ---
const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [status, setStatus] = useState<string>("Ready");
  const [error, setError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const liveClientRef = useRef<any>(null); // Use any for simplicity with the SDK wrapper
  const currentTranscriptRef = useRef<string>("");
  const streamRef = useRef<MediaStream | null>(null); // Screen stream
  const audioStreamRef = useRef<MediaStream | null>(null); // Mic stream

  // Initialize Gemini
  useEffect(() => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setError("API_KEY not found in environment.");
      return;
    }
    const ai = new GoogleGenAI({ apiKey });
    liveClientRef.current = ai.live;
  }, []);

  // --- Mouse Listener for Screenshots ---
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Button 3 is "Back", Button 4 is "Forward" on many mice
      if (isRecording && (e.button === 3 || e.button === 4)) {
        e.preventDefault(); // Prevent browser navigation
        takeScreenshot();
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    // Also listen for contextmenu to prevent it on side buttons if necessary, though mousedown usually catches it.
    // We also prevent default on 'mouseup' just in case the browser navigates on up.
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

  // --- Core Logic ---

  const startRecording = async () => {
    setError(null);
    try {
      // 1. Get Screen Stream (System Audio + Video)
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: {
            // Request system audio
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
        }
      });

      // 2. Get Microphone Stream
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true, // Echo cancellation is good if we are recording system audio that might play back speech
        },
      });

      streamRef.current = screenStream;
      audioStreamRef.current = micStream;

      // Set video source for screenshots (hidden video element)
      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
        videoRef.current.play();
      }

      // 3. Audio Mixing & Processing
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioCtx;

      const micSource = audioCtx.createMediaStreamSource(micStream);
      
      // If system audio is present, mix it
      let systemSource = null;
      if (screenStream.getAudioTracks().length > 0) {
        systemSource = audioCtx.createMediaStreamSource(screenStream);
      }

      const dest = audioCtx.createMediaStreamDestination();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0;

      micSource.connect(gainNode);
      if (systemSource) {
        systemSource.connect(gainNode);
      }
      
      // Process audio for Gemini
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      gainNode.connect(processor);
      processor.connect(audioCtx.destination);

      // 4. Connect to Gemini Live
      connectToGemini(processor);

      setIsRecording(true);
      setStatus("Recording... (Click side mouse button to capture)");

      // Handle stream stop (e.g., user clicks "Stop sharing" in browser UI)
      screenStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (err: any) {
      console.error(err);
      setError("Failed to start recording: " + err.message);
    }
  };

  const connectToGemini = (processor: ScriptProcessorNode) => {
    if (!liveClientRef.current) return;

    const sessionPromise = liveClientRef.current.connect({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      config: {
        responseModalities: [Modality.AUDIO], // We must accept audio, but we'll ignore it mostly
        inputAudioTranscription: {}, // Enable user transcription
        systemInstruction: "You are a helpful assistant. You are listening to a user record a session.",
      },
      callbacks: {
        onopen: () => {
          console.log("Gemini Live Session Opened");
        },
        onmessage: (message: LiveServerMessage) => {
          // Handle Input Transcription (User's Voice)
          if (message.serverContent?.inputTranscription) {
             const text = message.serverContent.inputTranscription.text;
             if (text) {
               currentTranscriptRef.current += text;
               updateTranscriptUI(text, false);
             }
          }

          // Handle Turn Complete (Finalize text)
          if (message.serverContent?.turnComplete) {
             updateTranscriptUI("", true);
             currentTranscriptRef.current = ""; // Reset current buffer
          }
        },
        onclose: () => {
          console.log("Session Closed");
        },
        onerror: (e: any) => {
          console.error("Session Error", e);
        },
      },
    });

    sessionPromiseRef.current = sessionPromise;

    // Stream Audio Data
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Downsample/Convert to PCM 16-bit
      const l = inputData.length;
      const int16 = new Int16Array(l);
      for (let i = 0; i < l; i++) {
        // Simple clipping
        let s = Math.max(-1, Math.min(1, inputData[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const uint8 = new Uint8Array(int16.buffer);
      // Encode to base64 manually
      let binary = '';
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const b64 = btoa(binary);

      sessionPromise.then((session: any) => {
        session.sendRealtimeInput({
            media: {
                mimeType: "audio/pcm;rate=16000",
                data: b64
            }
        });
      });
    };
  };

  const updateTranscriptUI = (text: string, isFinal: boolean) => {
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.isFinal) {
        // Update the last pending item
        const newText = isFinal ? last.text : last.text + text; 
        // Note: The logic here is simplified. Gemini sends partials then finals. 
        // We'll append for now.
        const updated = [...prev];
        updated[updated.length - 1] = { text: newText, isFinal: isFinal };
        return updated;
      } else {
        // Start new item
        return [...prev, { text: text, isFinal: isFinal }];
      }
    });
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatus("Stopped");

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
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");

      // Get Context (last ~200 chars of transcript)
      // We look at the finalized transcripts + current buffer
      const fullText = transcripts.map(t => t.text).join(" ") + " " + currentTranscriptRef.current;
      const contextText = fullText.slice(-300) || "No speech detected recently.";

      const newShot: Screenshot = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        imageData: dataUrl,
        context: "..." + contextText,
      };

      setScreenshots((prev) => [newShot, ...prev]);
    }
  };

  return (
    <>
      <header>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Context Recorder</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isRecording && <span className="status-dot"></span>}
          <span style={{ fontSize: '0.875rem', color: '#94a3b8', marginRight: '1rem' }}>{status}</span>
          
          {!isRecording ? (
            <button className="btn btn-primary" onClick={startRecording}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Start Recording
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={takeScreenshot}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Take Screenshot (Mouse 3/4)
              </button>
              <button className="btn btn-danger" onClick={stopRecording}>
                Stop
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div style={{ background: '#450a0a', color: '#fca5a5', padding: '1rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div className="container">
        {/* Left Panel: Transcript */}
        <div className="panel" style={{ flex: 2 }}>
          <div className="panel-header">
            <span>Live Transcript</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#94a3b8' }}>Gemini 2.5 Flash Native</span>
          </div>
          <div className="panel-content">
            {transcripts.length === 0 && (
              <div style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>
                Waiting for speech...
              </div>
            )}
            {transcripts.map((item, idx) => (
              <div key={idx} className={`transcript-item ${!item.isFinal ? 'current' : ''}`}>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Screenshots Timeline */}
        <div className="panel" style={{ flex: 1, minWidth: '350px' }}>
          <div className="panel-header">
            <span>Capture Timeline</span>
          </div>
          <div className="panel-content">
            {screenshots.length === 0 && (
              <div style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>
                Screenshots will appear here.<br/>
                <small>Use side mouse buttons or the button above.</small>
              </div>
            )}
            {screenshots.map((shot) => (
              <div key={shot.id} className="timeline-card">
                <img src={shot.imageData} alt="Screen capture" className="timeline-img" />
                <div className="timeline-info">
                  <div className="timeline-time">{shot.timestamp}</div>
                  <div className="timeline-context">
                    "{shot.context}"
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden elements for capturing */}
      <video ref={videoRef} className="hidden-video" muted playsInline />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);