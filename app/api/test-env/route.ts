import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    NOTION_API_KEY_exists: !!process.env.NOTION_API_KEY,
    NOTION_API_KEY_prefix: process.env.NOTION_API_KEY?.substring(0, 10),
    all_env_keys: Object.keys(process.env).filter(key => key.includes('NOTION') || key.includes('API'))
  });
}