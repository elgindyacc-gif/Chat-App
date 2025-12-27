import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, X } from "lucide-react";
import { Button } from "./ui/button";

interface VoiceRecorderProps {
    onSend: (audioBlob: Blob) => void;
    onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const [audioData, setAudioData] = useState<number[]>(new Array(20).fill(0));
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const startRecording = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("Microphone access is blocked! 🚫\n\nThis feature requires a Secure Connection (HTTPS) or Localhost.\n\nIf testing on phone via IP, this will NOT work.");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000
                }
            });

            // Set up real visualizer
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyzer = audioCtx.createAnalyser();
            analyzer.fftSize = 64;
            source.connect(analyzer);

            audioContextRef.current = audioCtx;
            analyzerRef.current = analyzer;

            const bufferLength = analyzer.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVisualizer = () => {
                if (!analyzerRef.current) return;
                analyzerRef.current.getByteFrequencyData(dataArray);

                // Convert to a smaller array for the UI (20 bars)
                const simplifiedData = [];
                const step = Math.floor(bufferLength / 20);
                for (let i = 0; i < 20; i++) {
                    simplifiedData.push(dataArray[i * step] || 0);
                }
                setAudioData(simplifiedData);
                animationFrameRef.current = requestAnimationFrame(updateVisualizer);
            };
            updateVisualizer();

            // Determine supported MIME type
            let options: MediaRecorderOptions = {
                audioBitsPerSecond: 256000 // 256kbps for premium quality
            };
            const types = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/aac',
            ];

            for (const type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    options.mimeType = type;
                    break;
                }
            }

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const type = mediaRecorder.mimeType || options.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());

                // Stop visualizer
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                if (audioContextRef.current) audioContextRef.current.close();
                audioContextRef.current = null;
                analyzerRef.current = null;
            };

            mediaRecorder.start();
            setIsRecording(true);
            setDuration(0);

            timerRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);
        } catch (error: any) {
            console.error("Microphone error:", error);

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert("❌ Microphone access denied!\n\n📱 To fix:\n1. Click the 🔒 lock icon in the address bar\n2. Set Microphone to 'Allow'\n3. Refresh the page and try again");
            } else if (error.name === 'NotFoundError') {
                alert("No microphone found. Please connect a microphone and try again.");
            } else {
                alert("Unable to access microphone: " + error.message);
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
    };

    const handleSend = () => {
        if (audioBlob) {
            onSend(audioBlob);
        }
    };

    const handleCancel = () => {
        if (isRecording) {
            stopRecording();
        }
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        setAudioBlob(null);
        setDuration(0);
        onCancel();
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
            if (previewAudioRef.current) previewAudioRef.current.pause();
        };
    }, []);

    const togglePreview = () => {
        if (!audioBlob) return;

        if (!previewAudioRef.current) {
            const url = URL.createObjectURL(audioBlob);
            previewAudioRef.current = new Audio(url);
            previewAudioRef.current.onended = () => setIsPlayingPreview(false);
        }

        if (isPlayingPreview) {
            previewAudioRef.current.pause();
            setIsPlayingPreview(false);
        } else {
            previewAudioRef.current.play();
            setIsPlayingPreview(true);
        }
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-[#202c33] rounded-lg border border-gray-700">
            {!audioBlob ? (
                <>
                    <Button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`${isRecording
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                            : 'bg-[#00a884] hover:bg-[#00956f]'
                            } text-white`}
                        size="icon"
                    >
                        {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>

                    <div className="flex-1">
                        {isRecording ? (
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-white font-mono text-sm">{formatDuration(duration)}</span>
                                <div className="flex-1 h-8 flex items-center gap-1">
                                    {audioData.map((val, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 bg-[#00a884] rounded-full transition-all duration-75"
                                            style={{
                                                height: `${Math.max(10, (val / 255) * 100)}%`,
                                                opacity: 0.5 + (val / 255) * 0.5
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Tap to record voice message</p>
                        )}
                    </div>

                    <Button
                        onClick={handleCancel}
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-500"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </>
            ) : (
                <>
                    <div
                        onClick={togglePreview}
                        className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#06cf9c] transition-all"
                    >
                        {isPlayingPreview ? (
                            <Square className="w-5 h-5 text-white fill-current" />
                        ) : (
                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1" />
                        )}
                    </div>

                    <div className="flex-1">
                        <p className="text-white text-sm font-medium">Preview Recording</p>
                        <p className="text-gray-400 text-xs">{formatDuration(duration)}</p>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            onClick={handleSend}
                            className="bg-[#00a884] hover:bg-[#00956f] text-white rounded-full w-10 h-10"
                            size="icon"
                        >
                            <Send className="w-5 h-5" />
                        </Button>

                        <Button
                            onClick={handleCancel}
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-red-500"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
