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
        error: 'No pages or databases found. Make sure pages and databases are shared with your integration.'
      });
    }

    const pages = await Promise.all(
      data.results.slice(0, 10).map(async (item: any) => {
        if (item.object === 'database') {
          // Handle database
          const databaseId = item.id;
          let title = item.title?.[0]?.plain_text || 'Untitled Database';

          // Query the database to get pages
          const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            }
          });

          const queryData = await queryResponse.json();
          let content = '';

          if (queryData.results && queryData.results.length > 0) {
            queryData.results.forEach((page: any) => {
              const properties = page.properties;
              let pageContent = '';

              // Extract properties as text
              Object.keys(properties).forEach(key => {
                const prop = properties[key];
                if (prop.title && prop.title.length > 0) {
                  pageContent += `${key}: ${prop.title.map((t: any) => t.plain_text).join('')}\n`;
                } else if (prop.rich_text && prop.rich_text.length > 0) {
                  pageContent += `${key}: ${prop.rich_text.map((t: any) => t.plain_text).join('')}\n`;
                } else if (prop.select) {
                  pageContent += `${key}: ${prop.select.name}\n`;
                } else if (prop.multi_select) {
                  pageContent += `${key}: ${prop.multi_select.map((s: any) => s.name).join(', ')}\n`;
                } else if (prop.number !== null && prop.number !== undefined) {
                  pageContent += `${key}: ${prop.number}\n`;
                } else if (prop.date) {
                  pageContent += `${key}: ${prop.date.start}${prop.date.end ? ' to ' + prop.date.end : ''}\n`;
                } else if (prop.checkbox !== null && prop.checkbox !== undefined) {
                  pageContent += `${key}: ${prop.checkbox ? 'Yes' : 'No'}\n`;
                }
              });

              content += pageContent + '\n---\n';
            });
          } else {
            content = 'No items in this database.';
          }

          return { id: databaseId, title: `${title} (Database)`, content };
        } else {
          // Handle regular page
          const pageId = item.id;
          let title = 'Untitled';

          if (item.properties?.title?.title?.[0]?.plain_text) {
            title = item.properties.title.title[0].plain_text;
          } else if (item.properties?.Name?.title?.[0]?.plain_text) {
            title = item.properties.Name.title[0].plain_text;
          } else if (item.parent?.type === 'page_id') {
            const parentResponse = await fetch(`https://api.notion.com/v1/pages/${item.parent.page_id}`, {
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
        }
      })
    );

    return NextResponse.json({ pages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
