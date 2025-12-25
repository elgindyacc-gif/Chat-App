import { Check, X, User } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface ChatRequest {
    id: string;
    sender_id: string;
    sender_name: string;
}

interface RequestListProps {
    requests: ChatRequest[];
    onAccept: (requestId: string, senderId: string) => void;
    onReject: (requestId: string) => void;
}

export function RequestList({ requests, onAccept, onReject }: RequestListProps) {
    if (requests.length === 0) {
        return (
            <div className="p-6 text-center text-gray-400">
                <p className="text-sm">No pending requests</p>
            </div>
        );
    }

    return (
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {requests.map((req) => (
                <div
                    key={req.id}
                    className="flex items-center gap-3 px-3 py-3 border-b border-gray-800/50 hover:bg-[#2a3942]/50 transition-colors"
                >
                    <Avatar className="w-9 h-9 bg-[#00a884]">
                        <AvatarFallback className="bg-[#00a884] text-white text-xs">
                            {req.sender_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{req.sender_name}</p>
                        <p className="text-gray-500 text-[10px] truncate">Sent a chat request</p>
                    </div>

                    <div className="flex gap-1.5">
                        <button
                            onClick={() => onAccept(req.id, req.sender_id)}
                            className="w-7 h-7 flex items-center justify-center bg-[#00a884] hover:bg-[#00956f] rounded-full transition-colors"
                            title="Accept"
                        >
                            <Check className="w-4 h-4 text-white" />
                        </button>
                        <button
                            onClick={() => onReject(req.id)}
                            className="w-7 h-7 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 rounded-full transition-colors"
                            title="Reject"
                        >
                            <X className="w-4 h-4 text-red-500" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
