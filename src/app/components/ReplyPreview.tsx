import { X, Reply } from "lucide-react";

interface ReplyPreviewProps {
    repliedMessage: {
        senderName: string;
        text: string;
        fileType?: string | null;
    };
    onCancel: () => void;
}

export function ReplyPreview({ repliedMessage, onCancel }: ReplyPreviewProps) {
    const getMessagePreview = () => {
        if (repliedMessage.fileType?.startsWith('audio/')) {
            return '🎤 Voice Message';
        }
        if (repliedMessage.fileType?.startsWith('image/')) {
            return '📷 Photo';
        }
        if (repliedMessage.fileType?.startsWith('video/')) {
            return '🎥 Video';
        }
        if (repliedMessage.fileType) {
            return '📎 File';
        }
        return repliedMessage.text;
    };

    return (
        <div className="bg-[#1a252d] border-l-4 border-[#00a884] px-3 py-2 mb-2 rounded-r">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Reply className="w-3 h-3 text-[#00a884]" />
                        <span className="text-[#00a884] text-xs font-medium">{repliedMessage.senderName}</span>
                    </div>
                    <p className="text-gray-400 text-sm truncate">{getMessagePreview()}</p>
                </div>
                <button
                    onClick={onCancel}
                    className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
