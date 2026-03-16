import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    if (!process.env.NOTION_API_KEY || process.env.NOTION_API_KEY === 'your_notion_integration_token_here') {
      return NextResponse.json({ error: 'Notion API key not configured' }, { status: 400 });
    }

    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { property: 'object', value: 'page' },
        page_size: 20
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Notion API error:', data);
      return NextResponse.json({ 
        error: data.message || `Notion API error: ${data.code || 'Unknown'}` 
      }, { status: response.status });
    }

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ 
        pages: [],
        error: 'No pages found. Make sure pages are shared with your integration.' 
      });
    }

    const pages = await Promise.all(
      data.results.slice(0, 10).map(async (page: any) => {
        const pageId = page.id;
        let title = 'Untitled';
        
        if (page.properties?.title?.title?.[0]?.plain_text) {
          title = page.properties.title.title[0].plain_text;
        } else if (page.properties?.Name?.title?.[0]?.plain_text) {
          title = page.properties.Name.title[0].plain_text;
        } else if (page.parent?.type === 'page_id') {
          const parentResponse = await fetch(`https://api.notion.com/v1/pages/${page.parent.page_id}`, {
            headers: {
              'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
              'Notion-Version': '2022-06-28'
            }
          });
          const parentData = await parentResponse.json();
          title = parentData.properties?.title?.title?.[0]?.plain_text || 'Untitled';
        }
        
        const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28'
          }
        });
        
        const blocksData = await blocksResponse.json();
        let content = '';
        
        blocksData.results?.forEach((block: any) => {
          if (block.type === 'paragraph') {
            content += block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
          } else if (block.type === 'heading_1') {
            content += '# ' + block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
          } else if (block.type === 'heading_2') {
            content += '## ' + block.heading_2?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
          } else if (block.type === 'bulleted_list_item') {
            content += '- ' + block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
          }
        });
        
        return { id: pageId, title, content };
      })
    );

    return NextResponse.json({ pages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
