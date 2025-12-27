import { useState, useRef } from "react";
import { ArrowLeft, Plus, X, Image as ImageIcon, Send, CircleDashed } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { supabase } from "../../utils/supabase/client";

interface Status {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    text?: string;
    imageUrl?: string;
    timestamp: string;
}

interface StatusListProps {
    currentUser: { id: string; name: string; avatar_url?: string };
    onBack: () => void;
}

export function StatusList({ currentUser, onBack }: StatusListProps) {
    // Mock data for now - in real app would fetch from DB
    const [statuses, setStatuses] = useState<Status[]>([
        {
            id: "1",
            userId: currentUser.id,
            userName: "My Status",
            userAvatar: currentUser.avatar_url,
            text: "Tap to add status update",
            timestamp: new Date().toISOString()
        }
    ]);

    const [viewingStatus, setViewingStatus] = useState<Status | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newStatusText, setNewStatusText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCreateStatus = () => {
        // In a real app, upload image to storage and save to 'statuses' table
        if (!newStatusText) return;

        const newStatus: Status = {
            id: Date.now().toString(),
            userId: currentUser.id,
            userName: currentUser.name,
            userAvatar: currentUser.avatar_url,
            text: newStatusText,
            timestamp: new Date().toISOString()
        };

        setStatuses(prev => [newStatus, ...prev.filter(s => s.id !== "1")]);
        setIsCreating(false);
        setNewStatusText("");
        toast.success("Status updated!");
    };

    return (
        <div className="flex flex-col h-full bg-[#111b21] relative">
            <div className="bg-[#202c33] p-4 flex items-center gap-4 border-b border-gray-800">
                <button onClick={onBack} className="text-gray-400 hover:text-white">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-white text-lg font-bold">Status</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* My Status */}
                <div className="flex items-center gap-4 p-2 hover:bg-[#202c33] rounded-xl cursor-pointer transition-colors"
                    onClick={() => setIsCreating(true)}>
                    <div className="relative">
                        <Avatar className="w-14 h-14 border-2 border-gray-700">
                            <AvatarImage src={currentUser.avatar_url} />
                            <AvatarFallback>{currentUser.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 bg-[#00a884] rounded-full p-1 border-2 border-[#111b21]">
                            <Plus className="w-3 h-3 text-white" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-white font-bold">My Status</h3>
                        <p className="text-gray-400 text-sm">Tap to add status update</p>
                    </div>
                </div>

                <div className="text-gray-500 text-sm font-bold uppercase">Recent updates</div>

                {/* Other Statuses (Mock) */}
                {statuses.filter(s => s.id !== "1" && s.userId !== currentUser.id).length === 0 && (
                    <p className="text-gray-500 text-center py-4">No recent updates</p>
                )}
            </div>

            {/* Create Status Modal */}
            {isCreating && (
                <div className="absolute inset-0 z-50 bg-[#111b21] flex flex-col animate-slide-up">
                    <div className="p-4 flex items-center justify-between">
                        <button onClick={() => setIsCreating(false)} className="text-white">
                            <X className="w-6 h-6" />
                        </button>
                        <h3 className="text-white font-bold">New Status</h3>
                        <div />
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#00a884] to-[#006054]">
                        <Input
                            value={newStatusText}
                            onChange={(e) => setNewStatusText(e.target.value)}
                            placeholder="Type a status..."
                            className="bg-transparent border-none text-center text-2xl text-white placeholder:text-white/50 focus-visible:ring-0"
                            autoFocus
                        />
                    </div>

                    <div className="p-4 bg-[#202c33] flex justify-end">
                        <Button onClick={handleCreateStatus} className="bg-[#00a884] hover:bg-[#008f6f] rounded-full w-12 h-12 p-0 flex items-center justify-center">
                            <Send className="w-5 h-5 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
