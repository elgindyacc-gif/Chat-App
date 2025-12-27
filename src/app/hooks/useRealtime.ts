import { useEffect, useRef, useState } from "react";
import { supabase } from "../../utils/supabase/client";
import { toast } from "sonner";

interface Message {
    id: string;
    senderId: string;
    text: string;
    fileUrl?: string | null;
    fileType?: string | null;
    fileName?: string | null;
    timestamp: string;
    isRead: boolean;
    replyToId?: string | null;
    reactions?: Record<string, string[]>;
}

interface Chat {
    id: string;
    isGroup?: boolean;
}

interface UseRealtimeProps {
    currentUserId: string | null;
    selectedChatRef: React.MutableRefObject<Chat | null>;
    onNewMessage: (message: Message) => void;
    onUpdateMessage: (message: Message) => void;
    onReloadChats: () => void;
    soundEnabled: boolean;
}

export function useRealtime({
    currentUserId,
    selectedChatRef,
    onNewMessage,
    onUpdateMessage,
    onReloadChats,
    soundEnabled
}: UseRealtimeProps) {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
    const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

    const [currentSoundId, setCurrentSoundId] = useState(() => {
        return localStorage.getItem("chat_app_sound_id") || "default";
    });

    const notificationSounds = [
        { id: "default", name: "Default (Ping)", url: "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" },
        { id: "bubbles", name: "Bubbles", url: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" },
        { id: "bell", name: "Church Bell", url: "https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3" },
        { id: "digital", name: "Digital Alert", url: "https://assets.mixkit.co/active_storage/sfx/2361/2361-preview.mp3" },
        { id: "success", name: "Success Chime", url: "https://assets.mixkit.co/active_storage/sfx/600/600-preview.mp3" }
    ];

    useEffect(() => {
        const selectedSound = notificationSounds.find(s => s.id === currentSoundId) || notificationSounds[0];
        notificationSoundRef.current = new Audio(selectedSound.url);
        notificationSoundRef.current.load();
    }, [currentSoundId]);

    const playNotificationSound = () => {
        if (notificationSoundRef.current && soundEnabled) {
            notificationSoundRef.current.currentTime = 0;
            notificationSoundRef.current.play().catch(e => console.log("Sound play failed:", e));
        }
    };

    const markMessagesAsRead = async (conversationId: string, userId: string) => {
        await supabase
            .from("messages")
            .update({ is_read: true })
            .eq("conversation_id", conversationId)
            .neq("sender_id", userId)
            .eq("is_read", false);
    };

    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase.channel("chat-realtime");

        channel
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages" },
                (payload) => {
                    const newMessage = payload.new as any;
                    const currentChat = selectedChatRef.current;

                    if (currentChat && newMessage.conversation_id === currentChat.id) {
                        onNewMessage({
                            id: newMessage.id,
                            senderId: newMessage.sender_id,
                            text: newMessage.text,
                            fileUrl: newMessage.file_url,
                            fileType: newMessage.file_type,
                            fileName: newMessage.file_name,
                            timestamp: newMessage.created_at,
                            isRead: newMessage.is_read,
                            replyToId: newMessage.reply_to_id,
                            reactions: newMessage.reactions || {}
                        });
                        if (currentUserId) markMessagesAsRead(currentChat.id, currentUserId);
                        // Play sound if message is from partner
                        if (newMessage.sender_id !== currentUserId) {
                            playNotificationSound();
                        }
                    } else if (newMessage.sender_id !== currentUserId) {
                        // Play sound for background chats
                        playNotificationSound();
                    }
                    onReloadChats();
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "messages" },
                (payload) => {
                    const updatedMsg = payload.new as any;
                    const currentChat = selectedChatRef.current;
                    if (currentChat && updatedMsg.conversation_id === currentChat.id) {
                        onUpdateMessage({
                            id: updatedMsg.id,
                            senderId: updatedMsg.sender_id,
                            text: updatedMsg.text,
                            fileUrl: updatedMsg.file_url,
                            fileType: updatedMsg.file_type,
                            fileName: updatedMsg.file_name,
                            timestamp: updatedMsg.created_at,
                            isRead: updatedMsg.is_read,
                            replyToId: updatedMsg.reply_to_id,
                            reactions: updatedMsg.reactions || {}
                        });
                    }
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "conversations" },
                () => {
                    onReloadChats();
                }
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "conversation_participants" },
                (payload) => {
                    if (payload.new.user_id === currentUserId) {
                        onReloadChats();
                    }
                }
            )
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState();
                const onlineIds = new Set<string>();
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => onlineIds.add(p.user_id));
                });
                setOnlineUsers(onlineIds);
            })
            .on("broadcast", { event: "typing" }, ({ payload }) => {
                setTypingUsers(prev => ({ ...prev, [payload.user_id]: payload.isTyping }));
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() });
                }
            });

        return () => {
            channel.unsubscribe();
        };
    }, [currentUserId, selectedChatRef, onNewMessage, onUpdateMessage, onReloadChats, soundEnabled]);

    const sendTypingIndicator = (isTyping: boolean, partnerId: string) => {
        supabase.channel("chat-realtime").send({
            type: "broadcast",
            event: "typing",
            payload: { user_id: currentUserId, partner_id: partnerId, isTyping }
        });
    };

    return {
        onlineUsers,
        typingUsers,
        sendTypingIndicator,
        notificationSounds,
        currentSoundId,
        setCurrentSoundId
    };
}
