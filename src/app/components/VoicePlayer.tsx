import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "./ui/button";

interface VoicePlayerProps {
    audioUrl: string;
    duration?: number;
}

export function VoicePlayer({ audioUrl, duration }: VoicePlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(duration || 0);
    const [playbackRate, setPlaybackRate] = useState(1);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.addEventListener('loadedmetadata', () => {
            setTotalDuration(audio.duration);
        });

        audio.addEventListener('timeupdate', () => {
            setCurrentTime(audio.currentTime);
        });

        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setCurrentTime(0);
        });

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, [audioUrl]);

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const time = parseFloat(e.target.value);
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const togglePlaybackRate = () => {
        if (!audioRef.current) return;
        const rates = [1, 1.5, 2];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];
        setPlaybackRate(nextRate);
        audioRef.current.playbackRate = nextRate;
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

    return (
        <div className="flex items-center gap-3 bg-[#005c4b] px-3 py-2 rounded-lg max-w-xs">
            <Button
                onClick={togglePlay}
                size="icon"
                className="w-8 h-8 bg-white/20 hover:bg-white/30 text-white flex-shrink-0"
            >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>

            <div className="flex-1 min-w-0">
                <div className="relative h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer group">
                    <div
                        className="absolute h-full bg-white/60 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                    <input
                        type="range"
                        min="0"
                        max={totalDuration}
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                </div>

                <div className="flex justify-between items-center mt-1">
                    <span className="text-white/80 text-xs font-mono">
                        {formatTime(currentTime)}
                    </span>
                    <button
                        onClick={togglePlaybackRate}
                        className="text-white/60 hover:text-white/90 text-xs font-bold transition-colors"
                    >
                        {playbackRate}x
                    </button>
                </div>
            </div>
        </div>
    );
}
