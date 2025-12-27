import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Search, User, Users } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { supabase } from "../../utils/supabase/client";

interface NewChatProps {
  onBack: () => void;
  currentUserId: string;
}

export function NewChat({ onBack, currentUserId }: NewChatProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"user" | "group">("user");
  const [searchResult, setSearchResult] = useState<{
    id: string; // userId or groupId
    identifier: string; // username or groupId(text)
    name: string;
    hasChat?: boolean; // for user
    isMember?: boolean; // for group
    requestStatus?: string; // for user
    requestSenderId?: string; // for user
    description?: string; // for group
  } | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const cleanedSearch = searchQuery.trim().toLowerCase().replace(searchType === 'user' ? '@' : '#', '');

    setIsSearching(true);
    setNotFound(false);
    setSearchResult(null);

    try {
      if (searchType === "user") {
        const { data: user } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .eq("username", cleanedSearch)
          .maybeSingle();

        if (user) {
          if (user.id === currentUserId) {
            setNotFound(true);
            return;
          }

          const { data: partnerConvs } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("user_id", user.id);

          const partnerConvIds = partnerConvs?.map(c => c.conversation_id) || [];
          let hasChat = false;
          if (partnerConvIds.length > 0) {
            const { data: existingChat } = await supabase
              .from("conversation_participants")
              .select("conversation_id")
              .eq("user_id", currentUserId)
              .in("conversation_id", partnerConvIds)
              .maybeSingle();
            hasChat = !!existingChat;
          }

          const { data: existingRequest } = await supabase
            .from("chat_requests")
            .select("status, sender_id")
            .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${user.id}),and(sender_id.eq.${user.id},receiver_id.eq.${currentUserId})`)
            .maybeSingle();

          setSearchResult({
            id: user.id,
            identifier: user.username,
            name: user.display_name || user.username,
            hasChat,
            requestStatus: existingRequest?.status,
            requestSenderId: existingRequest?.sender_id
          });
        } else {
          setNotFound(true);
        }
      } else {
        const { data: group } = await supabase
          .from("groups")
          .select("id, name, group_id, description")
          .eq("group_id", cleanedSearch)
          .maybeSingle();

        if (group) {
          const { data: membership } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", group.id)
            .eq("user_id", currentUserId)
            .maybeSingle();

          setSearchResult({
            id: group.id,
            identifier: group.group_id,
            name: group.name,
            description: group.description,
            isMember: !!membership
          });
        } else {
          setNotFound(true);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || isSending) return;
    setIsSending(true);

    try {
      const { error } = await supabase
        .from("chat_requests")
        .upsert({
          sender_id: currentUserId,
          receiver_id: searchResult.id,
          status: "pending"
        }, {
          onConflict: 'sender_id,receiver_id'
        });

      if (error) throw error;

      toast.success("Request sent successfully!");
      setSearchResult(prev => prev ? { ...prev, requestStatus: 'pending', requestSenderId: currentUserId } : null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send request");
    } finally {
      setIsSending(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!searchResult || isSending) return;
    setIsSending(true);

    try {
      const { error } = await supabase
        .from("group_members")
        .insert({
          group_id: searchResult.id,
          user_id: currentUserId,
          role: "member"
        });

      if (error) throw error;

      toast.success("Joined group successfully!");
      setSearchResult(prev => prev ? { ...prev, isMember: true } : null);
    } catch (error: any) {
      console.error("Join group error:", error);
      toast.error("Failed to join group");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#111b21] overflow-hidden">
      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-white text-xl">New Chat / Join Group</h2>
      </div>

      <div className="flex border-b border-gray-800 relative z-10">
        <button
          type="button"
          onClick={() => {
            setSearchType("user");
            setSearchResult(null);
            setNotFound(false);
            setSearchQuery("");
          }}
          className={`flex-1 py-4 text-sm font-bold transition-colors ${searchType === "user" ? "text-[#00a884] border-b-2 border-[#00a884]" : "text-gray-400 hover:text-white"}`}
        >
          Find User
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchType("group");
            setSearchResult(null);
            setNotFound(false);
            setSearchQuery("");
          }}
          className={`flex-1 py-4 text-sm font-bold transition-colors ${searchType === "group" ? "text-[#00a884] border-b-2 border-[#00a884]" : "text-gray-400 hover:text-white"}`}
        >
          Find Group
        </button>
      </div>

      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-md mx-auto">
          <p className="text-gray-400 mb-4">
            {searchType === "user"
              ? "Search for users by their username (e.g. @elgin)"
              : "Search for groups by their Group ID (e.g. #developers)"}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex gap-2 mb-6 relative z-50"
          >
            <div className="relative flex-1 font-bold">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00a884] font-bold pointer-events-none">
                {searchType === "user" ? "@" : "#"}
              </span>
              <Input
                type="text"
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                placeholder={searchType === "user" ? "username" : "group-id"}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setNotFound(false);
                  setSearchResult(null);
                }}
                className="pl-8 bg-[#2a3942] border-none text-white placeholder:text-gray-500 h-12 text-base"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="bg-[#00a884] hover:bg-[#00956f] active:bg-[#007a60] text-white h-12 px-6 rounded-md flex items-center justify-center transition-all"
            >
              <Search className="w-6 h-6 pointer-events-none" />
            </button>
          </form>

          {isSearching && <div className="text-center text-gray-400 py-8">Searching...</div>}

          {notFound && (
            <div className="bg-[#202c33] rounded-lg p-4 text-center">
              <p className="text-gray-400">{searchType === "user" ? "User" : "Group"} not found</p>
              <p className="text-gray-500 text-sm mt-2">Make sure the ID is correct</p>
            </div>
          )}

          {searchResult && (
            <div className="bg-[#202c33] rounded-lg p-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white text-lg font-bold">{searchResult.name}</p>
                  <p className="text-[#00a884] text-sm font-medium">
                    {searchType === "user" ? "@" : "#"}{searchResult.identifier}
                  </p>
                  {searchResult.description && (
                    <p className="text-gray-400 text-sm mt-1">{searchResult.description}</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-[#00a884] rounded-full flex items-center justify-center text-white">
                  {searchType === "user" ? <User className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                </div>
              </div>

              {searchType === "user" ? (
                searchResult.hasChat ? (
                  <p className="text-[#00a884] text-center py-2 text-sm font-medium">You already have a chat with this user</p>
                ) : searchResult.requestStatus === "pending" ? (
                  <div className="text-center py-2">
                    <p className="text-yellow-500 text-sm font-medium">
                      {searchResult.requestSenderId === currentUserId
                        ? "Request already pending"
                        : "Sent you a request!"}
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleSendRequest}
                    disabled={isSending}
                    className="w-full bg-[#00a884] hover:bg-[#00956f] text-white font-bold"
                  >
                    {isSending ? "Sending..." : "Send Chat Request"}
                  </Button>
                )
              ) : (
                searchResult.isMember ? (
                  <p className="text-[#00a884] text-center py-2 text-sm font-medium">You are already a member</p>
                ) : (
                  <Button
                    onClick={handleJoinGroup}
                    disabled={isSending}
                    className="w-full bg-[#00a884] hover:bg-[#00956f] text-white font-bold"
                  >
                    {isSending ? "Joining..." : "Join Group"}
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}