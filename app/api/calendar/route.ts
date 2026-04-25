import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    error: 'Calendar API is not available on Edge Runtime. This feature requires Node.js runtime for Google Service Account authentication.',
    events: []
  });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    error: 'Calendar API is not available on Edge Runtime. This feature requires Node.js runtime for Google Service Account authentication.',
    calendars: []
  });
}
