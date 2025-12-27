import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Paperclip, Image as ImageIcon, FileText, Video, X, Check, CheckCheck, Mic, Reply, Trash2, RefreshCw, EllipsisVertical, Phone, Video as VideoIcon } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { VoiceRecorder } from "./VoiceRecorder";
import { VoicePlayer } from "./VoicePlayer";
import { ReplyPreview } from "./ReplyPreview";
import { FileViewer } from "./FileViewer";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

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
  reactions?: Record<string, string[]>; // { emoji: [userIds] }
}

interface ChatWindowProps {
  currentUserId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  messages: Message[];
  isPartnerOnline: boolean;
  isPartnerTyping: boolean;
  onBack: () => void;
  onSendMessage: (text: string, fileUrl?: string, fileType?: string, fileName?: string, replyToId?: string) => void;
  onSendVoiceMessage: (audioBlob: Blob) => void;
  onDeleteMessage: (messageId: string) => void;
  onTyping: (isTyping: boolean) => void;
  onRefresh: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onStartCall: (type: "audio" | "video") => void;
  isGroup?: boolean;
}

export function ChatWindow({
  currentUserId,
  partnerId,
  partnerName,
  partnerAvatar,
  messages,
  isPartnerOnline,
  isPartnerTyping,
  onBack,
  onSendMessage,
  onSendVoiceMessage,
  onDeleteMessage,
  onTyping,
  onRefresh,
  onReact,
  onStartCall,
  isGroup
}: ChatWindowProps) {
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; text: string; fileType?: string | null } | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessagesLength = useRef(messages.length);
  const hasScrolledForChatRef = useRef<string | null>(null);

  useEffect(() => {
    if (messageText.length > 0) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    } else {
      onTyping(false);
    }
  }, [messageText]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (!scrollContainerRef.current) return;

    isAutoScrollingRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior });
    setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 200;
    setShowScrollButton(!isAtBottom);
  };

  useEffect(() => {
    // Reset scroll tracker when switching chats
    hasScrolledForChatRef.current = null;
    // Initial attempt (might be empty)
    const timer = setTimeout(() => scrollToBottom("auto"), 200);
    return () => clearTimeout(timer);
  }, [partnerId]);

  useEffect(() => {
    if (messages.length > 0) {
      // If it's the first time we have messages for this chat, force scroll to bottom multiple times
      // to handle layout shifts and image loading delays
      if (hasScrolledForChatRef.current !== partnerId) {
        scrollToBottom("auto");
        const t1 = setTimeout(() => scrollToBottom("auto"), 100);
        const t2 = setTimeout(() => scrollToBottom("auto"), 350);
        hasScrolledForChatRef.current = partnerId;
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      } else if (messages.length > prevMessagesLength.current) {
        // Only auto-scroll for new messages if the user is already near the bottom
        const container = scrollContainerRef.current;
        if (container) {
          const { scrollTop, scrollHeight, clientHeight } = container;
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 450;
          if (isNearBottom) {
            scrollToBottom("smooth");
          }
        }
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, partnerId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 52428800) {
        alert("File size must be less than 50MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: any) => {
    e?.preventDefault();

    if (selectedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('userId', currentUserId);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-f2fe46ac/upload`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: formData,
          }
        );

        const data = await response.json();

        if (data.error) {
          console.error('Upload error:', data.error);
          alert('Failed to upload file: ' + data.error);
          setIsUploading(false);
          return;
        }

        onSendMessage(messageText.trim(), data.fileUrl, data.fileType, data.fileName, replyTo?.id);
        setMessageText("");
        setSelectedFile(null);
        setReplyTo(null);

        // Force scroll to bottom on local send
        setTimeout(() => scrollToBottom("smooth"), 100);

        // Refocus and reset height
        setTimeout(() => {
          if (textInputRef.current) {
            textInputRef.current.focus();
            textInputRef.current.style.height = "inherit";
          }
        }, 10);
      } catch (error: any) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
      } finally {
        setIsUploading(false);
      }
    } else if (messageText.trim()) {
      try {
        if (typeof onSendMessage !== 'function') {
          console.error("FATAL: onSendMessage is NOT a function!");
          alert("Error: Send function missing");
        } else {
          onSendMessage(messageText.trim(), undefined, undefined, undefined, replyTo?.id);
        }

        setMessageText("");
        setReplyTo(null);

        // Force scroll to bottom on local send
        setTimeout(() => scrollToBottom("smooth"), 100);

        // Refocus and reset height
        setTimeout(() => {
          if (textInputRef.current) {
            textInputRef.current.focus();
            textInputRef.current.style.height = "inherit";
          }
        }, 10);
      } catch (err: any) {
        alert("Send error: " + err.message);
      }
    }

    // Refocus input to keep keyboard open (mobile)
    setTimeout(() => textInputRef.current?.focus(), 10);
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-400" />;
    if (fileType.startsWith('video/')) return <Video className="w-5 h-5 text-purple-400" />;
    return <FileText className="w-5 h-5 text-gray-400" />;
  };

  const renderFilePreview = (message: Message, isSent: boolean) => {
    if (!message.fileUrl || !message.fileType) return null;

    if (message.fileType.startsWith('image/')) {
      return (
        <div className="mb-2">
          <img
            src={message.fileUrl}
            alt={message.fileName || "Image"}
            className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setViewingFile({ url: message.fileUrl!, type: message.fileType!, name: message.fileName || 'Image' })}
          />
        </div>
      );
    }

    if (
      message.fileType === 'audio' ||
      message.fileType === 'audio/webm' ||
      message.fileType?.startsWith('audio/') ||
      /\.(mp3|wav|ogg|webm|m4a|aac)$/i.test(message.fileName || '')
    ) {
      return (
        <div className="mb-2">
          <VoicePlayer audioUrl={message.fileUrl} />
        </div>
      );
    }

    if (message.fileType.startsWith('video/')) {
      return (
        <div className="mb-2">
          <video
            src={message.fileUrl}
            controls
            className="max-w-full max-h-64 rounded-lg"
          />
        </div>
      );
    }

    return (
      <div
        className={`flex items-center gap-2 mb-2 p-2 rounded cursor-pointer hover:opacity-80 transition-opacity ${isSent ? 'bg-[#004a3c]' : 'bg-[#1a252d]'}`}
        onClick={() => setViewingFile({ url: message.fileUrl!, type: message.fileType!, name: message.fileName || 'File' })}
      >
        {getFileIcon(message.fileType)}
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{message.fileName}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0b141a] overflow-hidden relative">
      {/* Header - Fixed/Sticky */}
      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shadow-md flex-shrink-0">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="relative">
          <Avatar className="w-10 h-10 border border-gray-700">
            <AvatarImage src={partnerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=2a3942&color=00a884`} />
            <AvatarFallback className="bg-[#2a3942] text-[#00a884] font-bold">
              {partnerName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isPartnerOnline && !isGroup && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] border-2 border-[#202c33] rounded-full"></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold truncate">{partnerName}</h2>
          {!isGroup && (
            <div className="text-gray-400 text-xs flex items-center gap-1">
              {isPartnerTyping ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#00a884] font-bold animate-pulse">typing</span>
                  <div className="flex gap-0.5 mt-0.5">
                    <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce"></span>
                  </div>
                </div>
              ) : isPartnerOnline ? (
                <div className="flex items-center gap-1">
                  <span>Online</span>
                  <span className="w-2 h-2 bg-[#00a884] rounded-full inline-block"></span>
                </div>
              ) : (
                "Offline"
              )}
            </div>
          )}
          {isGroup && isPartnerTyping && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#00a884] text-xs font-bold animate-pulse">Someone is typing</span>
              <div className="flex gap-0.5 mt-0.5">
                <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce"></span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 relative">
          <button
            onClick={onRefresh}
            className="text-gray-400 hover:text-white transition-colors p-2.5 rounded-full hover:bg-white/5"
            title="Refresh messages"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {!isGroup && (
            <>
              <button
                onClick={() => onStartCall("audio")}
                className="p-2.5 text-gray-400 hover:text-[#00a884] hover:bg-white/5 rounded-full transition-all active:scale-95"
                title="Voice Call"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => onStartCall("video")}
                className="p-2.5 text-gray-400 hover:text-[#00a884] hover:bg-white/5 rounded-full transition-all active:scale-95"
                title="Video Call"
              >
                <VideoIcon className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="relative">
            <button
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className={`text-gray-400 hover:text-white transition-colors p-2.5 rounded-full hover:bg-white/5 ${showHeaderMenu ? 'bg-white/10 text-white' : ''}`}
            >
              <EllipsisVertical className="w-5 h-5" />
            </button>

            {showHeaderMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#233138] rounded-lg shadow-2xl border border-gray-700 py-2 z-[100] animate-in fade-in zoom-in slide-in-from-top-2">
                <button
                  onClick={() => { setShowHeaderMenu(false); alert("Coming soon: Chat info"); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#111b21] transition-colors"
                >
                  Contact Info
                </button>
                <button
                  onClick={() => { setShowHeaderMenu(false); alert("Coming soon: Clear chat"); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#111b21] transition-colors"
                >
                  Clear Chat
                </button>
                <div className="h-[1px] bg-gray-700 my-1 mx-2" />
                <button
                  onClick={() => { setShowHeaderMenu(false); onBack(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-[#111b21] transition-colors"
                >
                  Close Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-3 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center">
              No messages yet.<br />Send a message to start the conversation!
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isSent = message.senderId === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${isSent ? "bg-[#005c4b] text-white" : "bg-[#202c33] text-white"
                    }`}
                >
                  {/* Sender Name for Groups */}
                  {isGroup && !isSent && (
                    <p className={`text-xs font-bold mb-1 ${["text-orange-400", "text-pink-400", "text-purple-400", "text-blue-400", "text-green-400"][message.senderId.charCodeAt(0) % 5]
                      }`}>
                      {/* We would need to fetch sender name here or pass it with message. 
                          For now, let's assume message object might have it or we just use ID/Placeholder 
                          Ideally App.tsx should enrich messages with senderName */}
                      ~User
                    </p>
                  )}
                  {/* Reply Context */}
                  {message.replyToId && (
                    <div className={`mb-1 p-2 rounded text-xs border-l-4 ${isSent ? "bg-black/20 border-[#00a884]" : "bg-white/10 border-[#00a884]"} cursor-pointer opacity-80 hover:opacity-100 transition-opacity`}
                      onClick={() => {
                        const target = document.getElementById(`msg-${message.replyToId}`);
                        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      {(() => {
                        const repliedMsg = messages.find(m => m.id === message.replyToId);
                        return (
                          <>
                            <p className="font-bold text-[#00a884]">
                              {repliedMsg?.senderId === currentUserId ? "You" : (repliedMsg?.senderId === partnerId ? partnerName : "User")}
                            </p>
                            <p className="truncate opacity-70">
                              {repliedMsg ? (repliedMsg.text || (repliedMsg.fileType ? "File" : "")) : "Original message deleted"}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {renderFilePreview(message, isSent)}
                  <p className="break-words">{message.text}</p>

                  {/* Reactions Display */}
                  {message.reactions && Object.entries(message.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 -mb-1">
                      {Object.entries(message.reactions).map(([emoji, userIds]) => {
                        if (!userIds || userIds.length === 0) return null;
                        const hasReacted = userIds.includes(currentUserId);
                        return (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReact(message.id, emoji);
                            }}
                            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[10px] transition-all
                              ${hasReacted ? "bg-[#00a884]/20 border border-[#00a884]/30" : "bg-black/20 border border-transparent hover:bg-black/40"}`}
                          >
                            <span>{emoji}</span>
                            {userIds.length > 1 && <span className="font-bold opacity-70">{userIds.length}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setReplyTo({
                          id: message.id,
                          senderName: isSent ? "You" : partnerName,
                          text: message.text,
                          fileType: message.fileType
                        })}
                        className="text-gray-500 hover:text-[#00a884] transition-colors p-1"
                        title="Reply"
                      >
                        <Reply className="w-3 h-3" />
                      </button>
                      {isSent && (
                        <button
                          onClick={() => {
                            if (confirm("Delete this message for everyone?")) {
                              onDeleteMessage(message.id);
                            }
                          }}
                          className="text-gray-500 hover:text-red-500 transition-colors p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div
                        className="relative text-gray-500 hover:text-yellow-500 transition-colors p-2 cursor-pointer touch-manipulation"
                        title="React"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMessageMenu(activeMessageMenu === message.id ? null : message.id);
                        }}
                      >
                        <EllipsisVertical className="w-4 h-4" />
                        <div className={`absolute bottom-full ${isSent ? "right-0 -translate-x-2" : "left-0 translate-x-2"} mb-2 ${activeMessageMenu === message.id ? "flex" : "hidden"} items-center gap-1 bg-[#233138] p-2 rounded-full shadow-2xl border border-gray-700 z-[100] animate-in fade-in zoom-in slide-in-from-bottom-2 whitespace-nowrap`}>
                          {["❤️", "👍", "😂", "😮", "😢", "🙏"].map(emoji => (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                onReact(message.id, emoji);
                                setActiveMessageMenu(null);
                              }}
                              className="hover:scale-125 active:scale-90 transition-transform p-1.5 rounded-full hover:bg-white/10"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-[10px] text-gray-300 min-w-[40px] text-right">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isSent && (
                        message.isRead ? (
                          <CheckCheck className="w-3 h-3 text-blue-400" />
                        ) : (
                          // If partner is online, assume delivered (double gray check)
                          // Note: For groups, we stick to single check or double gray if we implement group ack.
                          // For now, let's treat online partner as "Delivered" state for 1-1 chats.
                          (!isGroup && isPartnerOnline) ? (
                            <CheckCheck className="w-3 h-3 text-gray-400" />
                          ) : (
                            <Check className="w-3 h-3 text-gray-400" />
                          )
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {viewingFile && (
        <FileViewer
          url={viewingFile.url}
          type={viewingFile.type}
          name={viewingFile.name}
          onClose={() => setViewingFile(null)}
        />
      )}

      {showScrollButton && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-20 right-4 bg-[#202c33] text-[#00a884] p-3 rounded-full shadow-2xl border border-gray-700 z-50 animate-in fade-in zoom-in duration-200 hover:bg-[#2a3942]"
        >
          <ArrowLeft className="w-6 h-6 rotate-[-90deg]" />
        </button>
      )}

      {/* Input */}
      <div className="bg-[#202c33] px-4 py-3">
        {replyTo && (
          <ReplyPreview
            repliedMessage={replyTo}
            onCancel={() => setReplyTo(null)}
          />
        )}

        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 bg-[#2a3942] rounded-lg px-3 py-2">
            {getFileIcon(selectedFile.type)}
            <p className="text-sm text-white flex-1 truncate">{selectedFile.name}</p>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isUploading && (
          <div className="mb-2 text-center text-sm text-gray-400">
            Uploading file...
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 items-center"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
          />

          <Button
            type="button"
            onClick={() => {
              fileInputRef.current?.click();
            }}
            className="bg-[#2a3942] hover:bg-[#1a252d] text-gray-400 hover:text-white flex-shrink-0 p-2"
            disabled={isUploading}
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          {isVoiceMode ? (
            <div className="flex-1">
              <VoiceRecorder
                onSend={(blob) => {
                  onSendVoiceMessage(blob);
                  setIsVoiceMode(false);
                }}
                onCancel={() => setIsVoiceMode(false)}
              />
            </div>
          ) : (
            <>
              <textarea
                ref={textInputRef}
                rows={1}
                placeholder="Type a message"
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  // Auto-resize
                  const target = e.target;
                  target.style.height = "inherit";
                  const nextHeight = Math.min(target.scrollHeight, 120);
                  target.style.height = `${nextHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                className="flex-1 bg-[#2a3942] border-none text-white placeholder:text-gray-500 rounded-lg px-3 py-2.5 text-base resize-none focus:outline-none min-h-[44px] max-h-[120px] scrollbar-hide"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
              />

              {messageText.trim() || selectedFile ? (
                <button
                  type="submit"
                  className="bg-[#00a884] hover:bg-[#00956f] text-white flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <Send className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsVoiceMode(true)}
                  className="bg-[#2a3942] hover:bg-[#1a252d] text-gray-400 hover:text-white flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}