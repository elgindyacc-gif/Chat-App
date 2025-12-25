# Deployment Guide 🚀

## Pre-Deployment Checklist

### Supabase Setup
- [x] Database tables created
- [ ] **Storage bucket**: Create `voice-messages` (Public)
- [ ] **SQL field**: Run `alter table messages add column if not exists reply_to_id uuid references messages(id) on delete set null;`
- [x] RLS policies active
- [x] Realtime enabled

### Environment Variables
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Deploy to Vercel (Recommended)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Chat App - Production Ready"
git branch -M main
git remote add origin https://github.com/yourusername/chat-app.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select your GitHub repository
4. Add Environment Variables
5. Click "Deploy"

### Step 3: Test HTTPS
- Voice messages require HTTPS
- Vercel provides free HTTPS automatically

## Alternative: Netlify
Same steps, just use [netlify.com](https://netlify.com)

---

**Your app is ready for production!** 🎉
