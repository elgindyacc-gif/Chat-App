import { X, Download, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";

interface FileViewerProps {
    url: string;
    type: string;
    name: string;
    onClose: () => void;
}

export function FileViewer({ url, type, name, onClose }: FileViewerProps) {
    const isImage = type.startsWith('image/');
    const isVideo = type.startsWith('video/');
    const isPDF = type.includes('pdf');

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
                <div className="flex flex-col">
                    <p className="text-white font-medium truncate max-w-[200px] sm:max-w-md">{name}</p>
                    <p className="text-gray-400 text-xs">{type}</p>
                </div>
                <div className="flex items-center gap-2">
                    <a href={url} download={name} className="p-2 text-gray-400 hover:text-white transition-colors">
                        <Download className="w-6 h-6" />
                    </a>
                    <button onClick={onClose} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-7 h-7" />
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="w-full h-full flex items-center justify-center p-4 sm:p-10">
                {isImage ? (
                    <img
                        src={url}
                        alt={name}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                    />
                ) : isVideo ? (
                    <video
                        src={url}
                        controls
                        autoPlay
                        className="max-w-full max-h-full rounded-lg shadow-2xl"
                    />
                ) : isPDF ? (
                    <iframe
                        src={url}
                        className="w-full h-full max-w-5xl bg-white rounded-lg shadow-2xl"
                        title={name}
                    />
                ) : (
                    <div className="bg-[#202c33] p-8 rounded-2xl flex flex-col items-center gap-6 max-w-sm text-center shadow-2xl border border-gray-800">
                        <div className="w-20 h-20 bg-[#00a884]/20 rounded-full flex items-center justify-center">
                            <ExternalLink className="w-10 h-10 text-[#00a884]" />
                        </div>
                        <div>
                            <h3 className="text-white text-xl font-bold mb-2">No Preview Available</h3>
                            <p className="text-gray-400 text-sm">This file type ({type}) cannot be previewed directly. You can download it to view.</p>
                        </div>
                        <a href={url} download={name} className="w-full">
                            <Button className="w-full bg-[#00a884] hover:bg-[#00956f] text-white py-6 text-lg">
                                Download File
                            </Button>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
