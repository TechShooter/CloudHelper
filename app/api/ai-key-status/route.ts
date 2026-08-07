import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Reports only whether the deployer has set server-side chat keys — never the
// keys themselves. The UI uses this to let guests chat when the deployer has
// configured GEMINI_API_KEY / GROQ_API_KEY (see /api/chat, which falls back to
// these env vars when the client sends no key).
export async function GET() {
  return NextResponse.json({
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
  });
}