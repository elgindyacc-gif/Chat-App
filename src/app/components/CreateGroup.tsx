import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Users, Camera } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { supabase } from "../../../utils/supabase/client";

interface CreateGroupProps {
    onBack: () => void;
    currentUserId: string;
}

export function CreateGroup({ onBack, currentUserId }: CreateGroupProps) {
    const [name, setName] = useState("");
    const [groupId, setGroupId] = useState("");
    const [description, setDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!name.trim() || !groupId.trim()) {
            toast.error("Please fill in required fields");
            return;
        }

        setIsCreating(true);

        try {
            // 1. Create Group
            const { data: group, error: createError } = await supabase
                .from("groups")
                .insert({
                    name: name.trim(),
                    group_id: groupId.trim().toLowerCase(),
                    description: description.trim(),
                    created_by: currentUserId
                })
                .select()
                .single();

            if (createError) throw createError;

            // 2. Add Creator as Admin
            const { error: memberError } = await supabase
                .from("group_members")
                .insert({
                    group_id: group.id,
                    user_id: currentUserId,
                    role: "admin"
                });

            if (memberError) throw memberError;

            toast.success("Group created successfully!");
            onBack();
        } catch (error: any) {
            console.error("Error creating group:", error);
            if (error.code === '23505') { // Unique constraint violation
                toast.error("Group ID already taken");
            } else {
                toast.error("Failed to create group");
            }
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#111b21]">
            {/* Header */}
            <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-white text-xl">Create New Group</h2>
            </div>

            {/* Content */}
            <div className="flex-1 px-4 py-6 overflow-y-auto">
                <div className="max-w-md mx-auto space-y-6">

                    {/* Group Icon Placeholder */}
                    <div className="flex justify-center">
                        <div className="w-24 h-24 bg-[#2a3942] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#374248] transition-colors relative group">
                            <Camera className="w-8 h-8 text-gray-400" />
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs">Change Icon</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-gray-400 text-sm mb-1 block">Group Name *</label>
                            <Input
                                type="text"
                                placeholder="Enter group name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-[#2a3942] border-none text-white placeholder:text-gray-500 h-12"
                            />
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm mb-1 block">Group ID (Unique) *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00a884] font-bold">#</span>
                                <Input
                                    type="text"
                                    placeholder="unique-group-id"
                                    value={groupId}
                                    onChange={(e) => setGroupId(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                                    className="pl-8 bg-[#2a3942] border-none text-white placeholder:text-gray-500 h-12"
                                />
                            </div>
                            <p className="text-gray-500 text-xs mt-1">Users will use this ID to find and join the group</p>
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm mb-1 block">Description</label>
                            <Input
                                type="text"
                                placeholder="What is this group about?"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-[#2a3942] border-none text-white placeholder:text-gray-500 h-12"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleCreate}
                        disabled={isCreating || !name.trim() || !groupId.trim()}
                        className="w-full bg-[#00a884] hover:bg-[#00956f] text-white py-6 text-lg"
                    >
                        {isCreating ? "Creating..." : "Create Group"}
                    </Button>

                </div>
            </div>
        </div>
    );
}
