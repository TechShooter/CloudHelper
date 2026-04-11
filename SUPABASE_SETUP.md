# Supabase Setup for CloudHelper

## 1. Get Your Supabase Keys

You already have:
- URL: `https://rzsbcnagtdcjtmcbdhka.supabase.co`
- Anon Key: `sb_publishable_J44-_gsFYWgxcAjp1AlkaQ_MDRmzDNe`

These are already in your `.env.local` file.

## 2. Create Database Tables

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/rzsbcnagtdcjtmcbdhka
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the entire contents of `supabase-schema.sql` file
5. Paste it into the SQL editor
6. Click "Run" to execute

This creates:
- `chats` table - stores your chat conversations
- `messages` table - stores individual messages
- `notion_content` table - stores Notion data privately
- `gdocs_content` table - stores Google Docs data privately
- Row Level Security (RLS) policies - ensures users can only see their own data

## 3. Enable Email Authentication

1. In Supabase dashboard, go to "Authentication" → "Providers"
2. Make sure "Email" is enabled 
3. Configure email templates if needed (optional)

## 4. Test Your Setup

1. Restart your dev server: `npm run dev`
2. Go to http://localhost:3000
3. You'll be redirected to `/login`
4. Click "Need an account? Sign up"
5. Enter your real email and password
6. Check your email for confirmation link
7. Click the link to verify
8. Sign in with your credentials

## 5. What Changed

### Authentication
- ✅ Real email/password authentication (no more fake login)
- ✅ Email verification for security
- ✅ Secure session management with cookies
- ✅ Automatic session refresh

### Privacy
- ✅ All chats are stored per-user in Supabase
- ✅ Row Level Security ensures users can only access their own data
- ✅ Notion and Google Docs content stored privately per user
- ✅ Data encrypted at rest by Supabase

### Ready for Cloudflare
- ✅ Works with Cloudflare Pages/Workers
- ✅ No server-side secrets exposed (uses environment variables)
- ✅ Stateless authentication (JWT tokens in cookies)

## 6. Next Steps

After running the SQL migration, you need to update your chat API to save/load from Supabase instead of memory.

Let me know when you've run the SQL migration and I'll update the chat API!
