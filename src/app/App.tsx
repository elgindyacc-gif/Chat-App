import { useState, useEffect, useRef, useCallback } from "react";
import { ChatLogin } from "./components/ChatLogin";
import { ChatRegister } from "./components/ChatRegister";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import { CallWindow } from "./components/CallWindow";
import { NewChat } from "./components/NewChat";
import { CreateGroup } from "./components/CreateGroup";
import { RequestList } from "./components/RequestList";
import { Settings } from "./components/Settings";
import { SplashScreen } from "./components/SplashScreen"; // Import SplashScreen
import { supabase } from "../utils/supabase/client";
import { requestForToken, onForegroundMessage } from "./utils/firebase";
import { projectId, publicAnonKey } from "../utils/supabase/info";
import { toast } from "sonner";
import { ArrowLeft, Bell, Check, MessageSquare, RefreshCw } from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  name: string;
  avatar_url?: string;
}

interface Chat {
  id: string; // conversation_id or group_id
  partnerId: string; // partner_id or group_id
  partnerName: string; // partner_name or group_name
  partnerAvatar?: string;
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

interface CallState {
  id: string; // signaling session id
  callerId: string;
  callerName: string;
  recipientId: string;
  type: "audio" | "video";
  status: "ringing" | "connected" | "ended" | "missed";
  offer?: any; // WebRTC Session Description (offer)
  answer?: any; // WebRTC Session Description (answer)
  iceCandidates?: any[]; // ICE candidates
}

type View = "login" | "register" | "chatList" | "chatWindow" | "newChat" | "requests" | "createGroup" | "settings";
type LoginStep = "login" | "signup" | "pin_entry";

export default function App() {
  const [showSplash, setShowSplash] = useState(true); // Default to showing splash
  const [view, setView] = useState<View>("login");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [loginStep, setLoginStep] = useState<LoginStep>("login");
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<CallState | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const totalUnreadRef = useRef(0);
  const isPollingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);

  const [canNotify, setCanNotify] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("chat_app_sound_enabled") !== "false";
  });
  const [currentSoundId, setCurrentSoundId] = useState(() => {
    return localStorage.getItem("chat_app_sound_id") || "default";
  });

  const notificationSounds = [
    { id: 'whistle', name: 'Whistle Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
    { id: 'bell', name: 'Success Bell', url: 'https://assets.mixkit.co/active_storage/sfx/600/600-preview.mp3' },
    { id: 'note', name: 'Electronic Note', url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' },
    { id: 'digital', name: 'Digital Alert', url: 'https://assets.mixkit.co/active_storage/sfx/2361/2361-preview.mp3' },
  ];

  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    localStorage.setItem("chat_app_sound_id", currentSoundId);
    const selectedSound = notificationSounds.find(s => s.id === currentSoundId) || notificationSounds[0];
    notificationSoundRef.current = new Audio(selectedSound.url);
    notificationSoundRef.current.load();

    // Initialize ringtone (standard ringing sound)
    ringtoneSoundRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3");
    ringtoneSoundRef.current.loop = true;
    ringtoneSoundRef.current.load();
  }, [currentSoundId]);

  // Ref to hold the latest soundEnabled value to avoid stale closures in subscriptions
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem("chat_app_sound_enabled", String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    // Check initial mic permission
    if (navigator.permissions && (navigator.permissions as any).query) {
      (navigator.permissions as any).query({ name: 'microphone' }).then((result: any) => {
        setMicEnabled(result.state === 'granted');
        result.onchange = () => setMicEnabled(result.state === 'granted');
      }).catch(() => { });
    }
    // Check notification permission
    setCanNotify(Notification.permission === 'granted');
  }, []);

  const enableMic = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Microphone access requires a secure context (HTTPS or localhost).");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicEnabled(true);
      toast.success("Microphone access granted!");
    } catch (err: any) {
      console.error("Mic error:", err);
      if (err.name === 'NotAllowedError') {
        toast.error("Microphone access denied by browser.");
      } else {
        toast.error("Microphone access failed: " + err.message);
      }
    }
  };

  // Unlock audio on first user interaction to bypass autoplay policy
  useEffect(() => {
    const unlockAudio = () => {
      if (notificationSoundRef.current) {
        notificationSoundRef.current.play().then(() => {
          notificationSoundRef.current?.pause();
          notificationSoundRef.current!.currentTime = 0;
        }).catch(() => { });
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const enableNotifications = async () => {
    const token = await requestForToken();
    if (token && currentUser) {
      setCanNotify(true);
      toast.success("Notifications enabled!");
      // Play a test sound to unlock audio context for Safari
      if (notificationSoundRef.current) {
        notificationSoundRef.current.currentTime = 0;
        notificationSoundRef.current.play().catch(() => { });
      }

      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-f2fe46ac/fcm-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({
              user_id: currentUser.id,
              fcm_token: token,
            }),
          }
        );

        if (!response.ok) {
          // Edge Function not found (404) or other error
          if (response.status === 404) {
            console.warn("FCM Edge Function not deployed. In-app notifications will still work.");
            // Don't show error to user - in-app notifications work fine
          } else {
            throw new Error(`FCM registration failed: ${response.status}`);
          }
        }
      } catch (err: any) {
        // Log error but don't disrupt user experience
        console.error("Failed to register FCM token:", err);
        // In-app notifications still work, so we don't need to alert the user
        // Push notifications when app is closed won't work, but that's acceptable for MVP
      }
    } else if (!token) {
      // User denied notification permission or browser doesn't support it
      toast.error("Notification permission denied or not supported");
    }
  };

  // Auth Subscription
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setCurrentUser(null);
        setView("login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Pending Requests
  const fetchRequests = async (userId: string) => {
    const { data, error } = await supabase
      .from("chat_requests")
      .select(`
id,
  sender_id,
  profiles!sender_id(display_name)
      `)
      .eq("receiver_id", userId)
      .eq("status", "pending");

    if (error) {
      console.error("Error fetching requests:", error);
      return;
    }

    setPendingRequests(data.map(r => ({
      id: r.id,
      sender_id: r.sender_id,
      sender_name: (r.profiles as any)?.display_name || "Unknown"
    })));
  };

  // FCM registration removed from here, now handled by enableNotifications explicitly

  const fetchProfile = async (userId: string, isPinVerified = false) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      // Handle both 406 (RLS) and PGRST116 (no rows) errors
      if (error.code === 'PGRST116' || error.message?.includes('406')) {
        console.warn("Profile missing for user. Logging out to clear stale session.");
        // Log user out to clear the orphaned session
        await supabase.auth.signOut();
        setCurrentUser(null);
        setView("login");
      } else {
        console.error("Error fetching profile:", error);
      }
      setIsLoading(false);
      return;
    }

    setCurrentUser({
      id: data.id,
      username: data.username,
      name: data.display_name || data.username,
      avatar_url: data.avatar_url
    });

    if (!data.display_name) {
      setLoginStep("signup");
      changeView("login");
    } else {
      // Restore state from localStorage
      const savedView = localStorage.getItem("chat_app_view") as View;
      const savedChatJson = localStorage.getItem("chat_app_selected_chat");

      if (savedView === "chatWindow" && savedChatJson) {
        try {
          const chat = JSON.parse(savedChatJson);
          setSelectedChat(chat);
          loadMessages(chat.id, chat.isGroup);
          setView("chatWindow");
        } catch (e) {
          changeView("chatList");
        }
      } else if (savedView && savedView !== "login") {
        changeView(savedView);
      } else {
        // Always start from chat list after login
        changeView("chatList");
      }

      Promise.all([
        loadChats(userId),
        fetchRequests(userId)
      ]);
    }
    setIsLoading(false);
  };

  const loadChats = async (userId: string) => {
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
      .eq("user_id", userId);

    if (convError) {
      console.error("Error loading user conversations:", convError);
      throw convError; // Propagate error for polling to catch
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
        profiles (id, display_name, avatar_url)
      `)
      .in("conversation_id", convIds)
      .neq("user_id", userId);

    if (partError) {
      console.error("Error loading partners:", partError);
      throw partError; // Propagate error for polling to catch
    }

    // 2.5 Fetch unread counts for 1-1 chats
    const { data: unreadData } = await supabase
      .from("messages")
      .select("conversation_id")
      .eq("is_read", false)
      .neq("sender_id", userId)
      .in("conversation_id", convIds);

    const unreadCountsMap: Record<string, number> = {};
    unreadData?.forEach((m: any) => {
      unreadCountsMap[m.conversation_id] = (unreadCountsMap[m.conversation_id] || 0) + 1;
    });

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
        partnerAvatar: partner?.profiles && !Array.isArray(partner.profiles)
          ? (partner.profiles as any).avatar_url
          : undefined,
        lastMessage: item.conversations?.last_message_text || "",
        lastMessageTime: item.conversations?.last_message_at || "",
        unreadCount: unreadCountsMap[item.conversation_id] || 0,
        isGroup: false
      };
    });

    // 3. Fetch Groups - Re-enabled with Error Handling
    let userGroups: any[] = [];
    try {
      const { data, error: groupError } = await supabase
        .from("group_members")
        .select(`
          group_id,
          groups (
            id,
            name,
            updated_at
          )
        `)
        .eq("user_id", userId);

      if (!groupError && data) {
        userGroups = data;
      } else if (groupError) {
        console.warn("Group fetch error (likely RLS recursion):", groupError.message);
        throw groupError; // Propagate error for polling to catch
      }
    } catch (e) {
      console.warn("Unexpected error fetching groups:", e);
      throw e; // Propagate error for polling to catch
    }

    let groupChats: Chat[] = [];

    if (userGroups.length > 0) {
      // Fetch details for each group (last message etc)
      const groupIds = userGroups.map((g: any) => g.group_id);

      // Fetch unread counts for group chats
      const { data: groupUnreadData } = await supabase
        .from("group_messages")
        .select("group_id")
        .eq("is_read", false)
        .neq("sender_id", userId)
        .in("group_id", groupIds);

      const groupUnreadCountsMap: Record<string, number> = {};
      groupUnreadData?.forEach((m: any) => {
        groupUnreadCountsMap[m.group_id] = (groupUnreadCountsMap[m.group_id] || 0) + 1;
      });

      const { data: lastMessages } = await supabase
        .from("group_messages")
        .select("group_id, text, created_at")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false });

      groupChats = userGroups.map((item: any) => {
        const group = item.groups;
        // Find last message for this group (simple in-memory approach, for optimized SQL use a view/function)
        const lastMsg = lastMessages?.find(m => m.group_id === group.id);

        return {
          id: group.id,
          partnerId: group.id, // for groups, partnerId is groupId
          partnerName: group.name,
          partnerAvatar: undefined, // Groups could have avatars too if implemented
          lastMessage: lastMsg?.text || "No messages yet",
          lastMessageTime: lastMsg?.created_at || group.updated_at,
          unreadCount: groupUnreadCountsMap[group.id] || 0,
          isGroup: true
        };
      });
    }

    // Combine and sort alphabetically as requested to prevent "jumping"
    const allChats = [...regularChats, ...groupChats].sort((a, b) => {
      return a.partnerName.localeCompare(b.partnerName);
    });

    // Sound logic: If total unread count increased, play notification sound
    const newTotalUnread = allChats.reduce((sum, c) => sum + c.unreadCount, 0);
    if (newTotalUnread > totalUnreadRef.current) {
      playNotificationSound();
    }
    totalUnreadRef.current = newTotalUnread;
    setChats(allChats);
  };

  const loadMessages = async (id: string, isGroup: boolean = false) => {
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
      throw error; // Propagate error for polling to catch
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
    const me = currentUserRef.current;
    if (me && !isGroup) {
      markMessagesAsRead(id, me.id);
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

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    // Optimistically clear unread count in local state
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));

    loadMessages(chat.id, chat.isGroup);
    changeView("chatWindow");
    localStorage.setItem("chat_app_selected_chat", JSON.stringify(chat));

    if (currentUser && !chat.isGroup) {
      markMessagesAsRead(chat.id, currentUser.id).then(() => {
        loadChats(currentUser.id);
      });
    }
  };

  // UUID Generator that works in HTTP/Non-secure contexts
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Wrap in useCallback to ensure stable reference
  const handleSendMessage = useCallback(async (text: string, fileUrl?: string, fileType?: string, fileName?: string, replyToId?: string) => {

    if (!currentUser || !selectedChat) {
      return;
    }

    // Use proper UUID generator
    const newMessageId = generateUUID();

    const tempMessage = {
      id: newMessageId,
      senderId: currentUser.id,
      text,
      fileUrl,
      fileType,
      fileName,
      timestamp: new Date().toISOString(),
      isRead: false,
      isOptimistic: true, // Flag to identify it's not confirmed yet
      replyToId // Added replyToId
    };

    // 1. Optimistic Update: Add to UI immediately
    setMessages(prev => [...prev, tempMessage]);

    try {
      let data, error;

      if (selectedChat.isGroup) {
        const result = await supabase
          .from("group_messages")
          .insert({
            id: newMessageId,
            group_id: selectedChat.id,
            sender_id: currentUser.id,
            text,
            file_url: fileUrl,
            file_type: fileType,
            file_name: fileName,
            reply_to_id: replyToId
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from("messages")
          .insert({
            id: newMessageId,
            conversation_id: selectedChat.id,
            sender_id: currentUser.id,
            text,
            file_url: fileUrl,
            file_type: fileType,
            file_name: fileName,
            reply_to_id: replyToId
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      if (data) {
        setMessages(prev => prev.map(m => m.id === newMessageId ? { ...m, isOptimistic: false } : m));
      }

    } catch (error: any) {
      console.error("Error sending message:", error);
      setMessages(prev => prev.filter(m => m.id !== newMessageId));
      toast.error("Failed to send message: " + (error.message || "Unknown error"));
    }
  }, [currentUser, selectedChat]);

  const handleSendVoiceMessage = async (audioBlob: Blob) => {
    if (!currentUser || !selectedChat) return;

    const tempId = generateUUID();
    const tempUrl = URL.createObjectURL(audioBlob);

    // Optimistic Update for Voice
    const tempMessage: Message = {
      id: tempId,
      senderId: currentUser.id,
      text: "🎤 Voice Message",
      fileUrl: tempUrl,
      fileType: "audio", // Keep as generic audio for UI
      timestamp: new Date().toISOString(),
      isRead: false
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      const mimeType = audioBlob.type || 'audio/webm';
      const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm';
      const fileName = `voice_${Date.now()}_${currentUser.id}.${extension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob, {
          contentType: mimeType,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName);

      let error;
      if (selectedChat.isGroup) {
        const result = await supabase
          .from("group_messages")
          .insert({
            id: tempId,
            group_id: selectedChat.id,
            sender_id: currentUser.id,
            text: "🎤 Voice Message",
            file_url: publicUrl,
            file_type: "audio"
          });
        error = result.error;
      } else {
        const result = await supabase
          .from("messages")
          .insert({
            id: tempId,
            conversation_id: selectedChat.id,
            sender_id: currentUser.id,
            text: "🎤 Voice Message",
            file_url: publicUrl,
            file_type: "audio"
          });
        error = result.error;
      }

      if (error) throw error;

      // Update URL to public one and remove blob URL
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, fileUrl: publicUrl } : m));
      URL.revokeObjectURL(tempUrl);

    } catch (error: any) {
      console.error("Error sending voice message:", error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error(`Voice send failed: ${error.message || "Unknown error"}`);
      URL.revokeObjectURL(tempUrl);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from("messages")
        .update({
          text: "🚫 This message was deleted",
          file_url: null,
          file_type: null,
          file_name: null
        })
        .eq("id", messageId)
        .eq("sender_id", currentUser.id); // Only sender can delete

      if (error) throw error;

      // Update UI immediately
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, text: "🚫 This message was deleted", fileUrl: null, fileType: null, fileName: null }
          : m
      ));

      toast.success("Message deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!currentUser) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = { ...(message.reactions || {}) };
    const hadThisEmoji = (currentReactions[emoji] || []).includes(currentUser.id);

    // Limit to one reaction per user: Remove user from any other emoji category
    Object.keys(currentReactions).forEach(key => {
      currentReactions[key] = (currentReactions[key] || []).filter(id => id !== currentUser.id);
      if (currentReactions[key].length === 0) delete currentReactions[key];
    });

    if (!hadThisEmoji) {
      // Add new reaction
      currentReactions[emoji] = [...(currentReactions[emoji] || []), currentUser.id];
    }

    // Optimistic Update
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: currentReactions } : m));

    try {
      const table = selectedChat?.isGroup ? "group_messages" : "messages";
      const { error } = await supabase
        .from(table)
        .update({ reactions: currentReactions })
        .eq("id", messageId);

      if (error) throw error;
    } catch (error) {
      console.error("Error reacting:", error);
      // Revert on error
      if (selectedChat) loadMessages(selectedChat.id, selectedChat.isGroup);
    }
  };

  // Refs to keep track of state in callbacks without re-subscribing
  const selectedChatRef = useRef<Chat | null>(null);
  const activeCallRef = useRef<CallState | null>(null);
  const currentUserRef = useRef<UserProfile | null>(null);
  const chatChannelRef = useRef<any>(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
    activeCallRef.current = activeCall;
  }, [selectedChat, activeCall]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const playNotificationSound = useCallback(() => {
    // Uses refs for stable execution
    if (soundEnabledRef.current && notificationSoundRef.current) {
      notificationSoundRef.current.currentTime = 0;
      notificationSoundRef.current.play()
        .catch(e => {
          console.log("Sound play failed:", e);
          if (e.name === "NotAllowedError") {
            // Optional: toast.info("Click anywhere to enable notification sounds");
          }
        });
    }
  }, []); // Truly stable callback

  // Real-time Subscriptions (Messages, Conversations, Presence, Typing)
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel("chat-realtime");
    chatChannelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMessage = payload.new as any;
          const currentChat = selectedChatRef.current;
          const me = currentUserRef.current;

          if (currentChat && newMessage.conversation_id === currentChat.id) {
            setMessages((prev) => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, {
                id: newMessage.id,
                senderId: newMessage.sender_id,
                text: newMessage.text,
                fileUrl: newMessage.file_url,
                fileType: newMessage.file_type,
                fileName: newMessage.file_name,
                timestamp: newMessage.created_at,
                isRead: newMessage.is_read || false,
                replyToId: newMessage.reply_to_id,
                reactions: newMessage.reactions || {}
              }];
            });
            if (me) markMessagesAsRead(currentChat.id, me.id);
          } else if (me && newMessage.sender_id !== me.id) {
            // Play sound ONLY for background chats
            playNotificationSound();
          }
          // Refresh chat list to update last message and unread count
          if (me) loadChats(me.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const updatedMsg = payload.new as any;
          const currentChat = selectedChatRef.current;
          if (currentChat && updatedMsg.conversation_id === currentChat.id) {
            setMessages(prev => prev.map(m =>
              m.id === updatedMsg.id ? {
                ...m,
                isRead: updatedMsg.is_read,
                text: updatedMsg.text, // Handle edits/deletions
                reactions: updatedMsg.reactions || {}
              } : m
            ));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          if (currentUserRef.current) loadChats(currentUserRef.current.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_participants" },
        (payload) => {
          if (currentUserRef.current && (payload.new.sender_id === currentUserRef.current.id || payload.new.receiver_id === currentUserRef.current.id)) {
            fetchRequests(currentUserRef.current.id);
          }
        }
      )
      .on("broadcast", { event: "call-offer" }, ({ payload }) => {
        const me = currentUserRef.current;
        if (me && payload.recipientId === me.id) {
          // Check if already in a call
          if (activeCallRef.current) {
            // Send busy signal (optional, but good UX)
            return;
          }

          setActiveCall({
            id: payload.id,
            callerId: payload.callerId,
            callerName: payload.callerName,
            recipientId: me.id,
            type: payload.type,
            status: "ringing",
            offer: payload.offer,
            iceCandidates: []
          });

          // Play ringtone
          if (soundEnabledRef.current && ringtoneSoundRef.current) {
            ringtoneSoundRef.current.play().catch(e => console.error("Ringtone failed:", e));
          }
        }
      })
      .on("broadcast", { event: "call-answer" }, ({ payload }) => {
        const me = currentUserRef.current;
        if (me && payload.recipientId === me.id && activeCallRef.current?.id === payload.id) {
          setActiveCall(prev => prev ? { ...prev, answer: payload.answer, status: "connected" } : null);
        }
      })
      .on("broadcast", { event: "ice-candidate" }, ({ payload }) => {
        const me = currentUserRef.current;
        if (me && payload.recipientId === me.id && activeCallRef.current?.id === payload.id) {
          setActiveCall(prev => {
            if (!prev) return null;
            return {
              ...prev,
              iceCandidates: [...(prev.iceCandidates || []), payload.candidate]
            };
          });
        }
      })
      .on("broadcast", { event: "call-ended" }, ({ payload }) => {
        if (activeCallRef.current && activeCallRef.current.id === payload.id) {
          setActiveCall(null);
          if (ringtoneSoundRef.current) {
            ringtoneSoundRef.current.pause();
            ringtoneSoundRef.current.currentTime = 0;
          }
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => onlineIds.add(p.user_id));
        });
        setOnlineUsers(onlineIds);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { user_id, conversation_id, is_typing } = payload;
        const currentChat = selectedChatRef.current;
        const me = currentUserRef.current;
        if (currentChat && conversation_id === currentChat.id && user_id !== me?.id) {
          setTypingUsers(prev => ({ ...prev, [user_id]: is_typing }));
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_requests" },
        (payload) => {
          if (currentUserRef.current) {
            fetchRequests(currentUserRef.current.id);

            // If my request was accepted/rejected
            if (payload.eventType === "UPDATE") {
              const newReq = payload.new as any;
              if (newReq.sender_id === currentUserRef.current.id) {
                if (newReq.status === "rejected") {
                  toast.error("Your chat request was declined.");
                  supabase.from('chat_requests').delete().eq('id', newReq.id).then();
                } else if (newReq.status === "accepted") {
                  loadChats(currentUserRef.current.id);
                }
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        (payload) => {
          const newMsg = payload.new as any;
          const currentChat = selectedChatRef.current;
          const me = currentUserRef.current;

          if (currentChat && currentChat.isGroup && newMsg.group_id === currentChat.id) {
            const formattedMsg = {
              id: newMsg.id,
              senderId: newMsg.sender_id,
              text: newMsg.text,
              fileUrl: newMsg.file_url,
              fileType: newMsg.file_type,
              fileName: newMsg.file_name,
              timestamp: newMsg.created_at,
              isRead: false,
              replyToId: newMsg.reply_to_id,
              reactions: newMsg.reactions || {}
            };
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, formattedMsg];
            });
          } else if (me && newMsg.sender_id !== me.id) {
            // Play sound ONLY if not in this group chat
            playNotificationSound();
          }
          if (me) loadChats(me.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_messages" },
        (payload) => {
          const updatedMsg = payload.new as any;
          const currentChat = selectedChatRef.current;
          if (currentChat && currentChat.isGroup && updatedMsg.group_id === currentChat.id) {
            setMessages(prev => prev.map(m =>
              m.id === updatedMsg.id ? {
                ...m,
                text: updatedMsg.text,
                reactions: updatedMsg.reactions || {}
              } : m
            ));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_members" },
        (payload) => {
          const newMember = payload.new as any;
          const me = currentUserRef.current;
          if (me && newMember.user_id === me.id) {
            loadChats(me.id);
            toast.info("You were added to a group");
          }
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && currentUserRef.current) {
          await channel.track({ user_id: currentUserRef.current.id, online_at: new Date().toISOString() });
        }
      });

    // Handle Firebase Foreground Notifications
    const unsubscribeFCM = onForegroundMessage((payload: any) => {
      console.log("FCM Foreground Message:", payload);
      playNotificationSound();
    });

    return () => {
      channel.unsubscribe();
      unsubscribeFCM();
    };
  }, [currentUser, playNotificationSound]); // Explicitly depend on playNotificationSound

  // Polling Fallback: Fetch latest data every 1 second as requested
  useEffect(() => {
    if (!currentUser) return;

    const pollInterval = setInterval(async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        // 1. Refresh chat list
        await loadChats(currentUser.id);
        consecutiveErrorsRef.current = 0; // Reset on success

        // 2. Refresh current message list if in a chat
        const currentChat = selectedChatRef.current;
        if (currentChat) {
          await loadMessages(currentChat.id, currentChat.isGroup);
        }

        // 3. Refresh requests
        await fetchRequests(currentUser.id);
      } catch (err) {
        consecutiveErrorsRef.current++;
        console.error("Polling error:", err);
      } finally {
        isPollingRef.current = false;
      }
    }, 1000); // Poll every 1 second
    return () => clearInterval(pollInterval);
  }, [currentUser]);

  const handleSendTyping = (isTyping: boolean) => {
    if (!currentUser || !selectedChat) return;
    if (chatChannelRef.current) {
      chatChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: currentUser.id, conversation_id: selectedChat.id, is_typing: isTyping }
      });
    }
  };

  const changeView = (newView: View) => {
    setView(newView);
    localStorage.setItem("chat_app_view", newView);
    if (newView !== "chatWindow") {
      localStorage.removeItem("chat_app_selected_chat");
      setSelectedChat(null);
    }
  };

  const handleLogout = async () => {
    localStorage.clear();
    await supabase.auth.signOut();
  };

  const handleRegister = async (userId: string, name: string, password: string) => {
    try {
      const email = `${userId.trim().toLowerCase()}@app.local`;

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: userId.trim().toLowerCase(),
            display_name: name.trim(),
            pin: password
          },
        },
      });

      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }

      toast.success("Account created successfully!");
      changeView("login");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    }
  };


  const handleAcceptRequest = async (requestId: string, senderId: string) => {
    if (!currentUser) return;

    try {

      // 1. Update request status to accepted FIRST
      const { error: reqErr } = await supabase
        .from('chat_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (reqErr) {
        console.error("Step 1 (Update Request) failed:", reqErr);
        throw reqErr;
      }

      // 2. Create conversation record
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convErr) {
        console.error("Step 2 (Create Conversation) failed:", convErr);
        throw convErr;
      }

      // 3. Add participants (both)
      const { error: partErr } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conv.id, user_id: currentUser.id },
          { conversation_id: conv.id, user_id: senderId }
        ]);

      if (partErr) {
        console.error("Step 3 (Add Participants) failed:", partErr);
        throw partErr;
      }

      toast.success("Request accepted!");

      // Refresh chats and requests
      await Promise.all([
        loadChats(currentUser.id),
        fetchRequests(currentUser.id)
      ]);

      // Auto-open the new chat
      const { data: partnerProfile, error: profErr } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", senderId)
        .single();

      if (profErr) {
        console.warn("Could not fetch partner profile for auto-open:", profErr);
      }

      const partnerName = partnerProfile?.display_name || "New Chat";
      console.log("Successfully accepting. Opening chat with:", partnerName);

      handleSelectChat({
        id: conv.id,
        partnerId: senderId,
        partnerName: partnerName,
        lastMessage: "",
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        isGroup: false
      });
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept request");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      // Mark as rejected instead of immediate delete so sender can get a notification
      await supabase
        .from('chat_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      toast.success("Request dismissed");
      if (currentUser) fetchRequests(currentUser.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to reject request");
    }
  };

  const sendSignalingMessage = useCallback((recipientId: string, event: string, payload: any) => {
    if (chatChannelRef.current) {
      chatChannelRef.current.send({
        type: "broadcast",
        event: event,
        payload: { ...payload, recipientId }
      });
    } else {
      const tempChannel = supabase.channel("chat-realtime");
      tempChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          tempChannel.send({
            type: "broadcast",
            event: event,
            payload: { ...payload, recipientId }
          });
        }
      });
    }
  }, []);

  const handleStartCall = async (recipientId: string, recipientName: string, type: "audio" | "video") => {
    if (!currentUser) return;

    const callId = Math.random().toString(36).substring(7);
    const newCall: CallState = {
      id: callId,
      callerId: currentUser.id,
      callerName: currentUser.name || currentUser.username,
      recipientId: recipientId,
      type: type,
      status: "ringing"
    };

    setActiveCall(newCall);
  };

  const handleEndCall = useCallback(() => {
    if (activeCallRef.current) {
      sendSignalingMessage(activeCallRef.current.recipientId, "call-ended", { id: activeCallRef.current.id });
      if (currentUserRef.current?.id === activeCallRef.current.recipientId) {
        sendSignalingMessage(activeCallRef.current.callerId, "call-ended", { id: activeCallRef.current.id });
      }
    }
    setActiveCall(null);
    if (ringtoneSoundRef.current) {
      ringtoneSoundRef.current.pause();
      ringtoneSoundRef.current.currentTime = 0;
    }
  }, [sendSignalingMessage]);

  if (errorStatus) {
    return (
      <div className="w-full h-[100dvh] bg-[#111b21] flex flex-col items-center justify-center text-red-500 p-6 text-center">
        <p className="text-xl font-bold mb-4">{errorStatus}</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 text-[#00a884] hover:underline"
        >
          <RefreshCw className="w-5 h-5" /> Retry
        </button>
      </div>
    );
  }

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-[100dvh] bg-[#111b21] flex flex-col items-center justify-center">
        <SplashScreen onFinish={() => { }} />
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] bg-[#111b21] overflow-hidden">
      {showSplash ? (
        <SplashScreen onFinish={handleSplashFinish} />
      ) : (
        <div className="flex h-full w-full">
          {currentUser ? (
            <div className="flex h-full w-full overflow-hidden">
              {/* Sidebar: Chat List */}
              <div className={`${view !== "chatList" ? "hidden md:flex" : "flex"} w-full md:w-[400px] flex-shrink-0 border-r border-gray-800`}>
                <ChatList
                  chats={chats}
                  currentUser={currentUser}
                  onlineUsers={onlineUsers}
                  pendingRequests={pendingRequests}
                  onAcceptRequest={handleAcceptRequest}
                  onRejectRequest={handleRejectRequest}
                  onSelectChat={(partnerId, partnerName) => {
                    const chat = chats.find(c => c.partnerId === partnerId);
                    if (chat) handleSelectChat(chat);
                  }}
                  onNewChat={() => changeView("newChat")}
                  onCreateGroup={() => changeView("createGroup")}
                  onLogout={handleLogout}
                  typingUsers={typingUsers}
                  onEnableNotifications={enableNotifications}
                  notificationsEnabled={canNotify}
                  onSettings={() => changeView("settings")}
                />
              </div>

              {/* Main Content: Chat Window, New Chat, Create Group, etc. */}
              <div className={`flex-1 flex flex-col min-w-0 ${view !== "chatList" ? "flex" : "hidden md:flex"}`}>
                {view === "chatWindow" && selectedChat ? (
                  <ChatWindow
                    currentUserId={currentUser.id}
                    partnerId={selectedChat.partnerId}
                    partnerName={selectedChat.partnerName}
                    partnerAvatar={selectedChat.partnerAvatar}
                    messages={messages}
                    isPartnerOnline={onlineUsers.has(selectedChat.partnerId)}
                    isPartnerTyping={typingUsers[selectedChat.partnerId] || false}
                    onBack={() => changeView("chatList")}
                    onSendMessage={handleSendMessage}
                    onSendVoiceMessage={handleSendVoiceMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onTyping={handleSendTyping}
                    onRefresh={() => loadMessages(selectedChat.id, selectedChat.isGroup)}
                    onReact={handleReact}
                    isGroup={selectedChat.isGroup}
                    onStartCall={(type) => handleStartCall(selectedChat.partnerId, selectedChat.partnerName, type)}
                  />
                ) : view === "requests" && currentUser ? (
                  <div className="flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-800 flex items-center gap-4">
                      <button onClick={() => changeView("chatList")} className="text-gray-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h2 className="text-white font-bold">Chat Requests</h2>
                    </div>
                    <RequestList
                      requests={pendingRequests}
                      onAccept={handleAcceptRequest}
                      onReject={handleRejectRequest}
                    />
                  </div>
                ) : view === "newChat" ? (
                  <NewChat
                    onBack={() => changeView("chatList")}
                    currentUserId={currentUser.id}
                  />
                ) : view === "settings" && currentUser ? (
                  <Settings
                    user={currentUser}
                    onBack={() => changeView("chatList")}
                    onUpdateProfile={(updatedUser) => setCurrentUser(updatedUser)}
                    onLogout={handleLogout}
                    notificationsEnabled={canNotify}
                    onEnableNotifications={enableNotifications}
                    micEnabled={micEnabled}
                    onEnableMic={enableMic}
                    soundEnabled={soundEnabled}
                    onToggleSound={(enabled) => {
                      setSoundEnabled(enabled);
                      localStorage.setItem("chat_app_sound_enabled", String(enabled));
                      toast.success(`Sound ${enabled ? 'enabled' : 'disabled'}`);
                    }}
                    currentSoundId={currentSoundId}
                    notificationSounds={notificationSounds}
                    onSelectSound={(id: string) => {
                      setCurrentSoundId(id);
                    }}
                    onTestSound={playNotificationSound}
                  />
                ) : view === "createGroup" ? (
                  <CreateGroup
                    onBack={() => changeView("chatList")}
                    currentUserId={currentUser.id}
                  />
                ) : (
                  <div className="flex-1 bg-[#222e35] flex flex-col items-center justify-center p-8 text-center border-l border-gray-800/50">
                    <div className="w-48 h-48 mb-8 opacity-10 bg-[#00a884] rounded-full flex items-center justify-center">
                      <Bell className="w-24 h-24 text-white" />
                    </div>
                    <h2 className="text-white text-3xl font-light mb-4">WhatsApp Web Replica</h2>
                    <p className="text-gray-400 max-w-sm text-sm leading-relaxed opacity-60">
                      Send and receive messages without keeping your phone online.
                    </p>
                    <div className="mt-auto text-gray-600 text-[10px] flex items-center gap-1">
                      <Check className="w-3 h-3" /> End-to-end encrypted
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Auth Views (Login/Register) */
            <div className="w-full h-full">
              {view === "login" && (
                <ChatLogin
                  initialStep={loginStep}
                  onLoginSuccess={() => {
                    supabase.auth.getUser().then(({ data: { user } }) => {
                      if (user) fetchProfile(user.id, true);
                    });
                  }}
                  onNavigateToRegister={() => changeView("register")}
                />
              )}
              {view === "register" && (
                <ChatRegister
                  onRegister={handleRegister}
                  onBackToLogin={() => changeView("login")}
                />
              )}
            </div>
          )}
        </div>
      )}

      {activeCall && currentUser && (
        <CallWindow
          callId={activeCall.id}
          callerId={activeCall.callerId}
          callerName={activeCall.callerName}
          recipientId={activeCall.recipientId}
          isIncoming={activeCall.recipientId === currentUser.id}
          type={activeCall.type}
          onEndCall={handleEndCall}
          currentUserId={currentUser.id}
          sendSignaling={sendSignalingMessage}
          incomingOffer={activeCall.offer}
          remoteAnswer={activeCall.answer}
          remoteIceCandidates={activeCall.iceCandidates}
        />
      )}

      {/* iOS Install Prompt Banner */}
      {(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
        if (isIOS && !isStandalone) {
          return (
            <div className="fixed bottom-0 left-0 w-full p-4 z-[9999]">
              <div className="bg-[#1f2c33] border border-[#00a884]/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#00a884] rounded-xl flex items-center justify-center flex-shrink-0">
                    <img src="icon.png" className="w-6 h-6 object-contain" alt="App Icon" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-xs mb-1">تثبيت التطبيق على آيفون 🍎</h3>
                    <p className="text-gray-400 text-[10px] leading-relaxed">
                      لتفعيل الإشعارات وتجربة أفضل: اضغط على <span className="inline-block px-1 bg-white/10 rounded">Share</span> ثم <span className="inline-block px-1 bg-white/10 rounded">Add to Home Screen</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}