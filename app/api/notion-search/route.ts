import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query = '', filter = null, page_size = 100 } = body;

    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) {
      return NextResponse.json({ error: 'Notion API key not configured' }, { status: 500 });
    }

    // Build request body for Notion API
    const searchBody: any = {
      query,
      page_size: Math.min(page_size, 100), // Max 100 per request
    };

    if (filter) {
      searchBody.filter = filter;
    }

    // Call Notion search API
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Notion API error:', error);
      return NextResponse.json({ error: error.message || 'Search failed' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in notion-search:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
