import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { supabase } from "../../utils/supabase/client";
import { toast } from "sonner";

interface CallWindowProps {
    callId: string;
    callerId: string;
    callerName: string;
    recipientId: string;
    isIncoming: boolean;
    type: "audio" | "video";
    onEndCall: () => void;
    currentUserId: string;
    sendSignaling: (recipientId: string, event: string, payload: any) => void;
    incomingOffer?: any;
    remoteAnswer?: any;
    remoteIceCandidates?: any[];
}

export function CallWindow({
    callId,
    callerId,
    callerName,
    recipientId,
    isIncoming,
    type,
    onEndCall,
    currentUserId,
    sendSignaling,
    incomingOffer,
    remoteAnswer,
    remoteIceCandidates
}: CallWindowProps) {
    const [status, setStatus] = useState<"connecting" | "ringing" | "connected" | "ended">("ringing");
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(type === "audio");
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const iceServers = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
        ],
    };

    const cleanup = useCallback(() => {
        localStream?.getTracks().forEach(track => track.stop());
        if (pcRef.current) {
            pcRef.current.onicecandidate = null;
            pcRef.current.ontrack = null;
            pcRef.current.close();
            pcRef.current = null;
        }
        setLocalStream(null);
        setRemoteStream(null);
    }, [localStream]);

    const handleEnd = useCallback(() => {
        cleanup();
        onEndCall();
    }, [cleanup, onEndCall]);

    // 1. Acquire Local Media
    useEffect(() => {
        const getMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: type === "video" ? {
                        facingMode: "user",
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } : false
                });
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("getUserMedia failed:", err);
                toast.error("كاميرا أو ميكروفون غير متاح. تأكد من استخدام HTTPS وإعطاء الأذونات.");
                handleEnd();
            }
        };
        getMedia();
    }, [type]);

    // 2. Initialize Peer Connection
    useEffect(() => {
        if (!localStream) return;

        const initPC = async () => {
            try {
                if (!pcRef.current) {
                    const pc = new RTCPeerConnection(iceServers);
                    pcRef.current = pc;

                    pc.ontrack = (event) => {
                        console.log("Remote track received");
                        setRemoteStream(event.streams[0]);
                        setStatus("connected");
                    };

                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            sendSignaling(isIncoming ? callerId : recipientId, "ice-candidate", {
                                id: callId,
                                candidate: event.candidate
                            });
                        }
                    };

                    pc.oniceconnectionstatechange = () => {
                        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                            console.log("ICE failed/disconnected");
                        }
                    };

                    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
                }

                if (isIncoming && incomingOffer && pcRef.current.signalingState === "stable") {
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingOffer));
                    const answer = await pcRef.current.createAnswer();
                    await pcRef.current.setLocalDescription(answer);
                    sendSignaling(callerId, "call-answer", { id: callId, answer });
                } else if (!isIncoming && pcRef.current.signalingState === "stable") {
                    const offer = await pcRef.current.createOffer();
                    await pcRef.current.setLocalDescription(offer);
                    sendSignaling(recipientId, "call-offer", {
                        id: callId,
                        callerId: currentUserId,
                        callerName,
                        type,
                        offer
                    });
                }
            } catch (err) {
                console.error("PC init failed:", err);
                handleEnd();
            }
        };

        initPC();

        return () => {
            // Signal App we are closing if component unmounts unexpectedly
        };
    }, [localStream, callId, isIncoming, incomingOffer, type, currentUserId, callerName, sendSignaling, handleEnd, callerId, recipientId]);

    // 3. Handle External Signaling (Answer/Candidates)
    useEffect(() => {
        if (remoteAnswer && pcRef.current && pcRef.current.signalingState === "have-local-offer") {
            pcRef.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer))
                .catch(e => console.error("Error setting answer:", e));
        }
    }, [remoteAnswer]);

    useEffect(() => {
        if (remoteIceCandidates && pcRef.current && pcRef.current.remoteDescription) {
            remoteIceCandidates.forEach(cand => {
                pcRef.current?.addIceCandidate(new RTCIceCandidate(cand))
                    .catch(e => console.error("Error adding candidate:", e));
            });
        }
    }, [remoteIceCandidates]);

    // 4. Remote Video Attachment
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
        }
    }, [remoteStream]);

    const toggleMute = () => {
        if (localStream) {
            const track = localStream.getAudioTracks()[0];
            if (track) {
                track.enabled = isMuted;
                setIsMuted(!isMuted);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream && type === "video") {
            const track = localStream.getVideoTracks()[0];
            if (track) {
                track.enabled = isVideoOff;
                setIsVideoOff(!isVideoOff);
            }
        }
    };

    const toggleSpeaker = () => {
        setIsSpeakerOn(!isSpeakerOn);
        if (remoteVideoRef.current) remoteVideoRef.current.muted = !isSpeakerOn;
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-[#111b21] flex flex-col items-center justify-center p-4">
            {type === "video" ? (
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="flex flex-col items-center gap-6 mb-20">
                    <Avatar className="w-32 h-32 border-4 border-[#00a884]/30 shadow-2xl">
                        <AvatarFallback className="bg-[#202c33] text-[#00a884] text-4xl font-bold">
                            {callerName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                        <h2 className="text-white text-3xl font-bold mb-2">{callerName}</h2>
                        <p className="text-[#00a884] font-medium animate-pulse uppercase tracking-widest text-xs">
                            {status === "ringing" ? (isIncoming ? "تحويل كول..." : "جاري الاتصال...") : "متصل"}
                        </p>
                    </div>
                </div>
            )}

            {type === "video" && localStream && (
                <div className="absolute top-6 right-6 w-32 md:w-48 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 z-10">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover -scale-x-100"
                    />
                </div>
            )}

            <div className="absolute bottom-12 flex items-center gap-6 bg-[#202c33]/90 backdrop-blur-xl p-6 rounded-full border border-white/10 shadow-2xl z-20">
                <Button
                    onClick={toggleMute}
                    className={`w-14 h-14 rounded-full ${isMuted ? "bg-red-500" : "bg-gray-700"}`}
                >
                    {isMuted ? <MicOff /> : <Mic />}
                </Button>

                {type === "video" && (
                    <Button
                        onClick={toggleVideo}
                        className={`w-14 h-14 rounded-full ${isVideoOff ? "bg-red-500" : "bg-gray-700"}`}
                    >
                        {isVideoOff ? <VideoOff /> : <Video />}
                    </Button>
                )}

                <Button
                    onClick={toggleSpeaker}
                    className={`w-14 h-14 rounded-full ${!isSpeakerOn ? "bg-red-500" : "bg-gray-700"}`}
                >
                    {isSpeakerOn ? <Volume2 /> : <VolumeX />}
                </Button>

                <Button
                    onClick={handleEnd}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
                >
                    <PhoneOff className="w-8 h-8" />
                </Button>
            </div>
        </div>
    );
}
