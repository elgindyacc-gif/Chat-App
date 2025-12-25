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

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startRecording = async () => {
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("Your browser doesn't support audio recording. Please use Chrome, Firefox, or Edge.");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Determine supported MIME type
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options = { mimeType: 'audio/webm;codecs=opus' };
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' };
            } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                options = { mimeType: 'audio/aac' };
            }
            // If none match, let browser choose default (pass empty or don't pass mimeType)

            const mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const type = (options as any).mimeType || 'audio/webm'; // Fallback for blob type
                const blob = new Blob(chunksRef.current, { type });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setDuration(0);

            // Start timer
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
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

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
                                    {[...Array(20)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 bg-[#00a884] rounded-full transition-all"
                                            style={{
                                                height: `${Math.random() * 100}%`,
                                                opacity: 0.3 + Math.random() * 0.7
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
                    <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center">
                        <Mic className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1">
                        <p className="text-white text-sm font-medium">Voice message recorded</p>
                        <p className="text-gray-400 text-xs">{formatDuration(duration)}</p>
                    </div>

                    <Button
                        onClick={handleSend}
                        className="bg-[#00a884] hover:bg-[#00956f] text-white"
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
                </>
            )}
        </div>
    );
}
