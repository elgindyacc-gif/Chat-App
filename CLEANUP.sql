-- IMPORTANT: Execute this in your Supabase SQL Editor to clear application data.
-- This script is "safe" and will not error if some tables are missing.

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- List of tables to truncate
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'messages', 
        'group_messages', 
        'chat_requests', 
        'conversation_participants', 
        'group_members', 
        'conversations', 
        'groups',
        'profiles'
    )) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- DONE: The existing data has been cleared from available tables.
-- Now go to the "Authentication" tab in Supabase to delete user accounts.
