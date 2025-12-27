import { useState, useRef } from "react";
import { ArrowLeft, Camera, Bell, Mic, Volume2, Save, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { toast } from "sonner";
import { supabase } from "../../utils/supabase/client";

interface User {
    id: string;
    name: string;
    username: string;
    avatar_url?: string;
}

interface SettingsProps {
    user: User;
    onBack: () => void;
    onUpdateProfile: (updatedUser: User) => void;
    onLogout: () => void;
    notificationsEnabled: boolean;
    onEnableNotifications: () => void;
    micEnabled: boolean;
    onEnableMic: () => void;
    soundEnabled: boolean;
    onToggleSound: (enabled: boolean) => void;
    currentSoundId: string;
    notificationSounds: { id: string, name: string, url: string }[];
    onSelectSound: (id: string) => void;
    onTestSound: () => void;
}

export function Settings({
    user,
    onBack,
    onUpdateProfile,
    onLogout,
    notificationsEnabled,
    onEnableNotifications,
    micEnabled,
    onEnableMic,
    soundEnabled,
    onToggleSound,
    currentSoundId,
    notificationSounds,
    onSelectSound,
    onTestSound
}: SettingsProps) {
    const [name, setName] = useState(user.name);
    const [isUpdating, setIsUpdating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpdateName = async () => {
        console.log("Update name clicked, name:", name);
        if (!name.trim()) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ name: name.trim() })
                .eq("id", user.id);

            if (error) throw error;
            onUpdateProfile({ ...user, name: name.trim() });
            toast.success("Profile updated!");
        } catch (err: any) {
            toast.error("Update failed: " + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}-${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: file.type
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from("profiles")
                .update({ avatar_url: publicUrl })
                .eq("id", user.id);

            if (updateError) throw updateError;

            onUpdateProfile({ ...user, avatar_url: publicUrl });
            toast.success("Avatar updated!");
        } catch (err: any) {
            console.error("Upload error details:", err);
            if (err.message?.includes("bucket") || err.statusCode === 400) {
                toast.error("Upload failed. Please ensure the 'avatars' bucket is created and Public in Supabase Storage.");
            } else {
                toast.error("Upload failed: " + err.message);
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#111b21] text-white">
            {/* Header */}
            <div className="p-4 bg-[#202c33] flex items-center gap-4 border-b border-gray-800">
                <button onClick={onBack} className="text-gray-400 hover:text-white">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-lg font-bold">Settings</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Profile Section */}
                <section className="space-y-4">
                    <h3 className="text-[#00a884] text-sm font-bold uppercase tracking-wider">Profile</h3>
                    <div className="flex flex-col items-center gap-4 bg-[#202c33] p-6 rounded-xl border border-gray-800">
                        <div className="relative group">
                            <Avatar className="w-24 h-24 border-2 border-[#00a884]/20">
                                <AvatarImage src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00a884&color=fff`} />
                                <AvatarFallback className="text-2xl">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="absolute bottom-0 right-0 p-2 bg-[#00a884] rounded-full hover:bg-[#06cf9c] transition-all shadow-lg overflow-hidden"
                            >
                                {uploading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Camera className="w-4 h-4 text-white" />
                                )}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                            />
                        </div>

                        <div className="w-full space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 ml-1">Display Name</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="bg-[#2a3942] border-none focus-visible:ring-1 focus-visible:ring-[#00a884]"
                                    />
                                    <Button
                                        onClick={handleUpdateName}
                                        disabled={isUpdating || name === user.name}
                                        className="bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21]"
                                    >
                                        <Save className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 text-center">Your username: @{user.username}</p>
                        </div>
                    </div>
                </section>

                {/* Permissions & Features Section */}
                <section className="space-y-4">
                    <h3 className="text-[#00a884] text-sm font-bold uppercase tracking-wider">Permissions & Notifications</h3>
                    <div className="bg-[#202c33] rounded-xl border border-gray-800 divide-y divide-gray-800">
                        {/* Notifications */}
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${notificationsEnabled ? 'bg-[#00a884]/10 text-[#00a884]' : 'bg-gray-800 text-gray-400'}`}>
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-medium">Desktop Notifications</p>
                                    <p className="text-xs text-gray-500">{notificationsEnabled ? "Currently enabled" : "Currently disabled"}</p>
                                </div>
                            </div>
                            <Button
                                onClick={() => {
                                    console.log("Enable notifications clicked");
                                    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                                        toast.error("Notifications require HTTPS or localhost.");
                                        return;
                                    }
                                    onEnableNotifications();
                                }}
                                disabled={notificationsEnabled}
                                variant={notificationsEnabled ? "ghost" : "outline"}
                                className={notificationsEnabled ? "text-gray-500 cursor-default" : "border-[#00a884] text-[#00a884] hover:bg-[#00a884]/10"}
                            >
                                {notificationsEnabled ? "Enabled" : "Enable"}
                            </Button>
                        </div>

                        {/* Microphone */}
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${micEnabled ? 'bg-[#00a884]/10 text-[#00a884]' : 'bg-gray-800 text-gray-400'}`}>
                                    <Mic className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-medium">Microphone Access</p>
                                    <p className="text-xs text-gray-500">{micEnabled ? "Access granted" : "Required for voice messages"}</p>
                                </div>
                            </div>
                            <Button
                                onClick={() => {
                                    console.log("Enable mic clicked");
                                    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                                        toast.error("Microphone access requires HTTPS or localhost.");
                                        return;
                                    }
                                    onEnableMic();
                                }}
                                disabled={micEnabled}
                                variant={micEnabled ? "ghost" : "outline"}
                                className={micEnabled ? "text-gray-500 cursor-default" : "border-[#00a884] text-[#00a884] hover:bg-[#00a884]/10"}
                            >
                                {micEnabled ? "Enabled" : "Enable"}
                            </Button>
                        </div>

                        {/* Notification Sound */}
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-[#00a884]/10 text-[#00a884]">
                                        <Volume2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Notification Sound</p>
                                        <p className="text-xs text-gray-500">Play sound on new message</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div
                                        onClick={() => onToggleSound(!soundEnabled)}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer shadow-inner transition-colors ${soundEnabled ? 'bg-[#00a884]' : 'bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${soundEnabled ? 'right-0.5' : 'left-0.5'}`} />
                                    </div>
                                    <Button
                                        onClick={onTestSound}
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-[10px] border-[#00a884] text-[#00a884] hover:bg-[#00a884]/10"
                                    >
                                        Test
                                    </Button>
                                </div>
                            </div>

                            {soundEnabled && (
                                <div className="space-y-2 pt-2 border-t border-gray-800">
                                    <p className="text-xs text-gray-400 font-medium">Select Sound:</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {notificationSounds.map((sound) => (
                                            <div
                                                key={sound.id}
                                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${currentSoundId === sound.id ? 'bg-[#00a884]/10 border border-[#00a884]/30' : 'bg-[#2a3942]/50 border border-transparent hover:bg-[#2a3942]'}`}
                                                onClick={() => onSelectSound(sound.id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full ${currentSoundId === sound.id ? 'bg-[#00a884]' : 'bg-gray-600'}`} />
                                                    <span className="text-sm">{sound.name}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const audio = new Audio(sound.url);
                                                        audio.play().catch(err => toast.error("Preview failed"));
                                                    }}
                                                    className="p-1.5 hover:bg-[#00a884]/20 rounded-md text-[#00a884] transition-colors"
                                                    title="Preview Sound"
                                                >
                                                    <Volume2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-600 px-2">
                        Tip: On iPhone, you must "Add to Home Screen" to receive notifications.
                    </p>
                </section>

                {/* Account Section */}
                <section className="space-y-4 pt-4">
                    <Button
                        onClick={() => {
                            console.log("Logout clicked");
                            onLogout();
                        }}
                        variant="ghost"
                        className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10 justify-start gap-3 p-4 h-auto"
                    >
                        <LogOut className="w-5 h-5" />
                        <div className="text-left">
                            <p className="font-bold">Logout</p>
                            <p className="text-[10px] opacity-70">Sign out of your account on this device</p>
                        </div>
                    </Button>
                </section>
            </div>
        </div>
    );
}
