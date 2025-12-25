-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Create group_messages table
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "Anyone can view groups" ON public.groups
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create groups" ON public.groups
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creator can update group" ON public.groups
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Group creator can delete group" ON public.groups
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for group_members
CREATE POLICY "Anyone can view group members" ON public.group_members
    FOR SELECT USING (true);

CREATE POLICY "Users can join groups" ON public.group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups" ON public.group_members
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for group_messages
CREATE POLICY "Group members can view messages" ON public.group_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = group_messages.group_id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Group members can send messages" ON public.group_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = group_messages.group_id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Sender can update their messages" ON public.group_messages
    FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Sender can delete their messages" ON public.group_messages
    FOR DELETE USING (auth.uid() = sender_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_group_id ON public.groups(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON public.group_messages(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for groups table
CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
