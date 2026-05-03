# CloudHelper - Cloudflare Pages Deployment Guide

## What We Did

Split your Next.js app into:
1. **Static Frontend** - Next.js with `output: 'export'`
2. **API Functions** - Cloudflare Pages Functions in `/functions` directory

## Files Changed

### 1. next.config.ts
- Added `output: 'export'` for static site generation
- Added `images: { unoptimized: true }` for static export

### 2. Created /functions/api/
- `chat.js` - AI chat endpoint
- `sheets.js` - Google Sheets API
- `calendar.js` - Google Calendar API

### 3. Still Need to Convert
These API routes still need conversion (they use Supabase):
- `/app/api/chat-persistence/route.ts`
- `/app/api/chats/route.ts`
- `/app/api/nutrients/route.ts`
- `/app/api/notion/route.ts`
- `/app/api/workspace-settings/route.ts`
- `/app/api/test-env/route.ts`

## Cloudflare Pages Settings

**Framework preset:** Next.js

**Build command:** `npm run build`

**Build output directory:** `out`

**Environment Variables (add these in Cloudflare Pages dashboard):**
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `GOOGLE_SHEETS_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY_ID`
- `GOOGLE_CLIENT_ID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## How Cloudflare Pages Functions Work

- Files in `/functions/api/` automatically become API endpoints
- `/functions/api/chat.js` → `/api/chat`
- Each function exports `onRequestGet`, `onRequestPost`, etc.
- They run on Cloudflare's edge network
- Each function has its own 3MB limit (not shared)

## Next Steps

1. **Update packages** (you're doing this now)
2. **Convert remaining API routes** to Cloudflare Pages Functions
3. **Test locally:** `npm run dev`
4. **Deploy to Cloudflare Pages** via GitHub integration
5. **Add environment variables** in Cloudflare dashboard

## Benefits of This Approach

✅ Stays within free tier limits (each function has separate 3MB limit)
✅ No OpenNext complexity
✅ Native Cloudflare Pages support
✅ Faster cold starts
✅ Easier to debug

## Notes

- Static pages are served from CDN (super fast)
- API functions run on-demand at the edge
- No server needed
- Automatic HTTPS
- Global CDN distribution
