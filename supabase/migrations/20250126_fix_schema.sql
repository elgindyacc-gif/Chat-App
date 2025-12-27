-- Migration: Fix Schema Issues
-- Date: 2025-01-26
-- Description: Add missing columns, RLS policies, and performance indexes

-- ============================================
-- 1. Add missing columns to profiles table
-- ============================================

-- Add username column (for user handles)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ============================================
-- 2. Add missing columns to messages table
-- ============================================

-- Add reply_to_id for message replies
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Add reactions column (stores emoji reactions as JSONB)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- 3. Add missing columns to group_messages table
-- ============================================

-- Add reply_to_id for message replies in groups
ALTER TABLE public.group_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL;

-- Add reactions column (stores emoji reactions as JSONB)
ALTER TABLE public.group_messages 
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- 4. Add RLS policies for messages UPDATE
-- ============================================

-- Allow users to update only their own messages
CREATE POLICY "Users can update their own messages" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = sender_id);

-- ============================================
-- 5. Add RLS policies for messages DELETE
-- ============================================

-- Allow users to delete only their own messages
CREATE POLICY "Users can delete their own messages" 
ON public.messages 
FOR DELETE 
USING (auth.uid() = sender_id);

-- ============================================
-- 6. Add performance indexes
-- ============================================

-- Index on conversation_id for faster chat loading
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
ON public.messages(conversation_id);

-- Index on created_at for chronological sorting
CREATE INDEX IF NOT EXISTS idx_messages_created_at 
ON public.messages(created_at DESC);

-- Index on sender_id for user message queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
ON public.messages(sender_id);

-- Index on reply_to_id for fetching reply chains
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id 
ON public.messages(reply_to_id);

-- Index on group_messages reply_to_id
CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to_id 
ON public.group_messages(reply_to_id);

-- Index on conversation_participants user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id 
ON public.conversation_participants(user_id);

-- Index on conversation_participants conversation_id
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id 
ON public.conversation_participants(conversation_id);

-- ============================================
-- 7. Add realtime publication for new columns
-- ============================================

-- Ensure realtime updates work for group_messages
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;

-- ============================================
-- Migration Complete
-- ============================================

-- Verify the changes
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Added columns: username, reply_to_id, reactions';
    RAISE NOTICE 'Added RLS policies for UPDATE and DELETE on messages';
    RAISE NOTICE 'Added performance indexes';
END $$;
