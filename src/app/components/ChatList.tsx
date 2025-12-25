import { useState } from "react";
import { MessageCircle, Search, Copy, Check, Bell, X, Users, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface Chat {
  id: string; // conversation_id or group_id
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isGroup?: boolean;
}

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
}

interface ChatListProps {
  chats: Chat[];
  currentUser: User;
  onlineUsers: Set<string>;
  onSelectChat: (partnerId: string, partnerName: string) => void;
  onNewChat: () => void;
  onCreateGroup: () => void;
  onLogout: () => void;
  onAcceptRequest: (requestId: string, senderId: string) => void;
  onRejectRequest: (requestId: string) => void;
  pendingRequests: any[];
}

export function ChatList({
  chats,
  currentUser,
  onlineUsers,
  onSelectChat,
  onNewChat,
  onCreateGroup,
  onLogout,
  onAcceptRequest,
  onRejectRequest,
  pendingRequests
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = chats.filter(chat =>
    chat.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111b21] border-r border-gray-700 w-full">
      {/* Header */}
      <div className="p-4 bg-[#202c33]">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-white text-xl font-bold">Chats</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={onCreateGroup}
              className="text-gray-400 hover:text-white transition-colors"
              title="Create Group"
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={onNewChat}
              className="text-gray-400 hover:text-white transition-colors"
              title="New Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3 mb-4 p-2 bg-[#111b21] rounded-lg border border-gray-800">
          <Avatar className="w-10 h-10 border border-gray-700">
            {currentUser.avatar_url ? (
              <AvatarImage src={currentUser.avatar_url} />
            ) : (
              <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`} />
            )}
            <AvatarFallback className="bg-[#00a884] text-white">
              {currentUser.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate">{currentUser.name}</p>
            <div className="flex items-center gap-2">
              <p className="text-[#00a884] text-xs font-medium truncate">@{currentUser.username}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`@${currentUser.username}`);
                  toast.success("Username copied!");
                }}
                className="text-gray-500 hover:text-[#00a884] transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#2a3942] border-none text-white placeholder:text-gray-400 h-9"
          />
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="p-2 bg-[#202c33] border-t border-gray-800">
          <div className="flex items-center gap-2 px-2 py-1 text-[#00a884] text-xs font-bold uppercase tracking-wider mb-2">
            <Bell className="w-3 h-3" />
            <span>Chat Requests</span>
          </div>
          <div className="space-y-1">
            {pendingRequests.map((req) => (
              <div key={req.id} className="bg-[#111b21] p-3 rounded-lg border border-gray-800">
                <p className="text-white text-sm mb-2 font-medium">
                  <span className="text-[#00a884]">@{req.profiles?.username}</span> want to chat
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptRequest(req.id, req.sender_id)}
                    className="flex-1 bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21] py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Accept
                  </button>
                  <button
                    onClick={() => onRejectRequest(req.id)}
                    className="flex-1 bg-transparent hover:bg-red-500/10 text-red-500 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-red-500/50"
                  >
                    <X className="w-3 h-3" /> Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto chat-list-scrollbar">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4 text-center">
            <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">No messages yet</p>
            <p className="text-sm mt-1">Chat with your friends to see them here.</p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.partnerId, chat.partnerName)}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] cursor-pointer border-b border-[#202c33]/50 transition-colors relative"
            >
              <div className="relative flex-shrink-0">
                <Avatar className="w-12 h-12 border border-gray-800">
                  <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(chat.partnerName)}&background=2a3942&color=00a884`} />
                  <AvatarFallback className="bg-[#2a3942] text-[#00a884] font-bold">
                    {chat.partnerName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!chat.isGroup && onlineUsers.has(chat.partnerId) && (
                  <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[#00a884] border-2 border-[#111b21] rounded-full"></div>
                )}
                {chat.isGroup && (
                  <div className="absolute -bottom-1 -right-1 bg-[#202c33] p-0.5 rounded-full">
                    <Users className="w-3.5 h-3.5 text-[#00a884]" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="text-white font-medium truncate group-hover:text-[#00a884] transition-colors">
                    {chat.partnerName}
                  </h3>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">
                    {formatTime(chat.lastMessageTime)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-400 text-sm truncate pr-4">
                    {chat.lastMessage || "Start a conversation"}
                  </p>
                  {chat.unreadCount > 0 && (
                    <span className="bg-[#00a884] text-[#111b21] text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}