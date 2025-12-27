import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../utils/supabase/client";

interface Chat {
    id: string;
    partnerId: string;
    partnerName: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    isGroup?: boolean;
}

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

export function useChats(userId: string | null) {
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const selectedChatRef = useRef<Chat | null>(null);

    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);

    const loadChats = useCallback(async (uid: string) => {
        // 1. Fetch conversations this user belongs to
        const { data: userConvs, error: convError } = await supabase
            .from("conversation_participants")
            .select(`
        conversation_id,
        conversations (
            id,
            last_message_text,
            last_message_at
        )
      `)
            .eq("user_id", uid);

        if (convError) {
            console.error("Error loading user conversations:", convError);
            return;
        }

        const convIds = userConvs.map(c => c.conversation_id);
        if (convIds.length === 0) {
            setChats([]);
            return;
        }

        // 2. Fetch all partner participants for these conversations in ONE batch
        const { data: partners, error: partError } = await supabase
            .from("conversation_participants")
            .select(`
        conversation_id,
        user_id,
        profiles (id, display_name)
      `)
            .in("conversation_id", convIds)
            .neq("user_id", uid);

        if (partError) {
            console.error("Error loading partners:", partError);
            return;
        }

        // Map regular chats
        const regularChats: Chat[] = userConvs.map((item: any) => {
            const partner = partners.find(p => p.conversation_id === item.conversation_id);
            const partnerName = partner?.profiles && !Array.isArray(partner.profiles)
                ? (partner.profiles as any).display_name
                : "Unknown User";

            return {
                id: item.conversation_id,
                partnerId: partner?.user_id || "unknown",
                partnerName: partnerName,
                lastMessage: item.conversations?.last_message_text || "",
                lastMessageTime: item.conversations?.last_message_at || "",
                unreadCount: 0,
                isGroup: false
            };
        });

        // 3. Fetch Groups
        const { data: userGroups, error: groupError } = await supabase
            .from("group_members")
            .select(`
        group_id,
        groups (
          id,
          name,
          updated_at
        )
      `)
            .eq("user_id", uid);

        let groupChats: Chat[] = [];

        if (userGroups && !groupError) {
            const groupIds = userGroups.map(g => g.group_id);

            const { data: lastMessages } = await supabase
                .from("group_messages")
                .select("group_id, text, created_at")
                .in("group_id", groupIds)
                .order("created_at", { ascending: false });

            groupChats = userGroups.map((item: any) => {
                const group = item.groups;
                const lastMsg = lastMessages?.find(m => m.group_id === group.id);

                return {
                    id: group.id,
                    partnerId: group.id,
                    partnerName: group.name,
                    lastMessage: lastMsg?.text || "No messages yet",
                    lastMessageTime: lastMsg?.created_at || group.updated_at,
                    unreadCount: 0,
                    isGroup: true
                };
            });
        }

        // Combine and sort
        const allChats = [...regularChats, ...groupChats].sort((a, b) => {
            const dateA = new Date(a.lastMessageTime).getTime();
            const dateB = new Date(b.lastMessageTime).getTime();
            return dateB - dateA;
        });

        setChats(allChats);
    }, []);

    const loadMessages = useCallback(async (id: string, isGroup: boolean = false) => {
        // Check if this is still the selected chat to avoid race conditions during polling
        if (id !== selectedChatRef.current?.id) return;

        let data, error;

        if (isGroup) {
            const result = await supabase
                .from("group_messages")
                .select("*")
                .eq("group_id", id)
                .order("created_at", { ascending: true });
            data = result.data;
            error = result.error;
        } else {
            const result = await supabase
                .from("messages")
                .select("*")
                .eq("conversation_id", id)
                .order("created_at", { ascending: true });
            data = result.data;
            error = result.error;
        }

        if (error) {
            console.error("Error loading messages:", error);
            return;
        }

        // Again, check if chat changed while we were fetching
        if (id !== selectedChatRef.current?.id) return;

        const formattedMessages = (data || []).map(m => ({
            id: m.id,
            senderId: m.sender_id,
            text: m.text,
            fileUrl: m.file_url,
            fileType: m.file_type,
            fileName: m.file_name,
            timestamp: m.created_at,
            isRead: m.is_read || false,
            replyToId: m.reply_to_id,
            reactions: m.reactions || {}
        }));

        setMessages(prev => {
            // Preserve any optimistic messages that haven't been confirmed by the server yet
            const optimistic = prev.filter(m => (m as any).isOptimistic);
            const confirmedIds = new Set(formattedMessages.map(m => m.id));
            const remainingOptimistic = optimistic.filter(m => !confirmedIds.has(m.id));

            return [...formattedMessages, ...remainingOptimistic];
        });

        // Mark as read if selecting chat
        if (userId && !isGroup) {
            markMessagesAsRead(id, userId);
        }
    }, [userId]);

    const markMessagesAsRead = async (conversationId: string, uid: string) => {
        await supabase
            .from("messages")
            .update({ is_read: true })
            .eq("conversation_id", conversationId)
            .neq("sender_id", uid)
            .eq("is_read", false);
    };

    const handleSelectChat = useCallback((chat: Chat) => {
        setSelectedChat(chat);
        loadMessages(chat.id, chat.isGroup);
        localStorage.setItem("chat_app_selected_chat", JSON.stringify(chat));
    }, [loadMessages]);

    // Load chats when userId changes
    useEffect(() => {
        if (userId) {
            loadChats(userId);
        }
    }, [userId, loadChats]);

    return {
        chats,
        selectedChat,
        messages,
        setMessages,
        setSelectedChat,
        loadChats,
        loadMessages,
        handleSelectChat,
        selectedChatRef
    };
}
