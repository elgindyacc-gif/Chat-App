# 🗄️ Database Migration Guide

## Overview
This guide will help you apply the database schema fixes to your Supabase project.

---

## 📋 Prerequisites

- Access to your Supabase Dashboard
- The migration file: `supabase/migrations/20250126_fix_schema.sql`

---

## 🚀 Step-by-Step Instructions

### 1. Backup Your Database (Recommended)

> [!CAUTION]
> Always backup your database before running migrations!

1. Go to **Supabase Dashboard** → **Database** → **Backups**
2. Click **"Create Backup"** or note the latest automatic backup time

---

### 2. Open SQL Editor

1. Go to **Supabase Dashboard**
2. Navigate to **SQL Editor** (left sidebar)
3. Click **"New Query"**

---

### 3. Run the Migration

1. Open the file: `supabase/migrations/20250126_fix_schema.sql`
2. Copy **all** the SQL content
3. Paste it into the SQL Editor
4. Click **"Run"** (or press `Ctrl+Enter`)

---

### 4. Verify Success

You should see output like:
```
NOTICE: Migration completed successfully!
NOTICE: Added columns: username, reply_to_id, reactions
NOTICE: Added RLS policies for UPDATE and DELETE on messages
NOTICE: Added performance indexes
```

---

### 5. Verify Schema Changes

#### Check `profiles` table:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'username';
```
✅ Should return 1 row showing `username | text`

#### Check `messages` table:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('reply_to_id', 'reactions');
```
✅ Should return 2 rows

#### Check `group_messages` table:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'group_messages' 
AND column_name IN ('reply_to_id', 'reactions');
```
✅ Should return 2 rows

---

## 🧪 Testing the Changes

### Test Reply Functionality
1. Run your app: `npm run dev`
2. Login and open a chat
3. Right-click a message → Select "Reply"
4. Send a reply
5. ✅ Reply should show with reference to original message

### Test Reactions
1. Hover over a message
2. Click the reaction button (😊)
3. Select an emoji
4. ✅ Reaction should appear and persist after refresh

### Test Message Deletion
1. Right-click your own message
2. Select "Delete"
3. ✅ Message should be deleted
4. Try deleting another user's message
5. ✅ Should fail (RLS policy working)

---

## 🔄 Rollback (If Needed)

If something goes wrong, you can rollback the changes:

```sql
-- Remove added columns
ALTER TABLE public.profiles DROP COLUMN IF EXISTS username;
ALTER TABLE public.messages DROP COLUMN IF EXISTS reply_to_id;
ALTER TABLE public.messages DROP COLUMN IF EXISTS reactions;
ALTER TABLE public.group_messages DROP COLUMN IF EXISTS reply_to_id;
ALTER TABLE public.group_messages DROP COLUMN IF EXISTS reactions;

-- Remove policies
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

-- Remove indexes
DROP INDEX IF EXISTS idx_profiles_username;
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_messages_created_at;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_messages_reply_to_id;
DROP INDEX IF EXISTS idx_group_messages_reply_to_id;
DROP INDEX IF EXISTS idx_conversation_participants_user_id;
DROP INDEX IF EXISTS idx_conversation_participants_conversation_id;
```

---

## ❓ Troubleshooting

### Error: "relation already exists"
- **Cause**: Migration was already run
- **Solution**: This is safe to ignore, or check if columns already exist

### Error: "permission denied"
- **Cause**: Insufficient database permissions
- **Solution**: Make sure you're logged in as the project owner

### Error: "column already exists"
- **Cause**: Partial migration was run before
- **Solution**: Safe to ignore, the `IF NOT EXISTS` clauses handle this

---

## ✅ Next Steps

After successful migration:
1. Test all app features thoroughly
2. Monitor performance improvements
3. Proceed with Phase 2: Performance Improvements (see `task.md`)

---

## 📞 Support

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Review error messages carefully
3. Restore from backup if needed
