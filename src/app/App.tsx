import { useState, useEffect, useRef, useCallback } from "react";
import { ChatLogin } from "./components/ChatLogin";
import { ChatRegister } from "./components/ChatRegister";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import { NewChat } from "./components/NewChat";
import { CreateGroup } from "./components/CreateGroup";
import { RequestList } from "./components/RequestList";
import { SplashScreen } from "./components/SplashScreen"; // Import SplashScreen
import { supabase } from "../utils/supabase/client";
import { requestForToken } from "./utils/firebase";
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
}

type View = "login" | "register" | "chatList" | "chatWindow" | "newChat" | "requests" | "createGroup";
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

  // FCM Handle
  useEffect(() => {
    if (currentUser) {
      const setupFCM = async () => {
        const token = await requestForToken();
        if (token) {
          try {
            await fetch(
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
          } catch (err) {
            console.error("Failed to register FCM token:", err);
          }
        }
      };
      setupFCM();
    }
  }, [currentUser]);

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
      .neq("user_id", userId);

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
      .eq("user_id", userId);

    let groupChats: Chat[] = [];

    if (userGroups && !groupError) {
      // Fetch details for each group (last message etc) - simplified for now
      // In a real app, you'd fetch last message from group_messages
      // For now, let's just fetch existing groups

      const groupIds = userGroups.map(g => g.group_id);

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
      isRead: m.is_read || false
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
    loadMessages(chat.id, chat.isGroup);
    changeView("chatWindow");
    localStorage.setItem("chat_app_selected_chat", JSON.stringify(chat));
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
            file_name: fileName
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
      fileType: "audio/webm",
      timestamp: new Date().toISOString(),
      isRead: false
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      const fileName = `voice_${Date.now()}_${currentUser.id}.webm`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm;codecs=opus',
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
      toast.error("Failed to send voice message");
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

  // Refs to keep track of state in callbacks without re-subscribing
  const selectedChatRef = useRef<Chat | null>(null);
  const currentUserRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Real-time Subscriptions (Messages, Conversations, Presence, Typing)
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel("chat-realtime");

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
                isRead: newMessage.is_read
              }];
            });
            if (me) markMessagesAsRead(currentChat.id, me.id);
          }
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
              m.id === updatedMsg.id ? { ...m, isRead: updatedMsg.is_read } : m
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
          if (currentUserRef.current && payload.new.user_id === currentUserRef.current.id) {
            loadChats(currentUserRef.current.id);
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
              isRead: false
            };
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, formattedMsg];
            });
          }
          if (me) loadChats(me.id);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]); // Now only depends on currentUser

  // Polling Fallback: Fetch latest data every 1 second as requested
  useEffect(() => {
    if (!currentUser) return;

    const pollInterval = setInterval(() => {
      // 1. Refresh chat list
      loadChats(currentUser.id);

      // 2. Refresh current message list if in a chat
      const currentChat = selectedChatRef.current;
      if (currentChat) {
        loadMessages(currentChat.id, currentChat.isGroup);
      }

      // 3. Refresh requests
      fetchRequests(currentUser.id);
    }, 1000); // Poll every 1 second for instant updates

    return () => clearInterval(pollInterval);
  }, [currentUser]);

  const handleSendTyping = (isTyping: boolean) => {
    if (!currentUser || !selectedChat) return;
    supabase.channel("chat-realtime").send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: currentUser.id, conversation_id: selectedChat.id, is_typing: isTyping }
    });
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

  if (errorStatus) {
    return (
      <div className="w-full h-screen bg-[#111b21] flex flex-col items-center justify-center text-red-500 p-6 text-center">
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
      <div className="w-full h-screen bg-[#111b21] flex flex-col items-center justify-center">
        <SplashScreen onFinish={() => { }} />
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#111b21] overflow-hidden">
      {showSplash ? (
        <SplashScreen onFinish={handleSplashFinish} />
      ) : (
        <div className="flex h-full w-full">
          {currentUser ? (
            <div className="flex h-full w-full overflow-hidden">
              {/* Sidebar: Chat List */}
              <div className={`${view === "chatWindow" ? "hidden md:flex" : "flex"} w-full md:w-[400px] flex-shrink-0 border-r border-gray-800`}>
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
                />
              </div>

              {/* Main Content: Chat Window or Placeholder */}
              <div className={`flex-1 flex flex-col min-w-0 ${view === "chatWindow" ? "flex" : "hidden md:flex"}`}>
                {view === "chatWindow" && selectedChat ? (
                  <ChatWindow
                    currentUserId={currentUser.id}
                    partnerId={selectedChat.partnerId}
                    partnerName={selectedChat.partnerName}
                    messages={messages}
                    isPartnerOnline={onlineUsers.has(selectedChat.partnerId)}
                    isPartnerTyping={typingUsers[selectedChat.partnerId] || false}
                    onBack={() => changeView("chatList")}
                    onSendMessage={handleSendMessage}
                    onSendVoiceMessage={handleSendVoiceMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onTyping={handleSendTyping}
                    onRefresh={() => loadMessages(selectedChat.id, selectedChat.isGroup)}
                    isGroup={selectedChat.isGroup}
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
    </div>
  );
}