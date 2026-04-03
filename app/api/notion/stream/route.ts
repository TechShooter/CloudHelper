import { NextRequest } from 'next/server';

async function processPage(item: any, apiKey: string) {
  try {
    const pageId = item.id;
    let title = 'Untitled';
    const url = `https://www.notion.so/${pageId.replace(/-/g, '')}`;

    if (item.properties?.title?.title?.[0]?.plain_text) {
      title = item.properties.title.title[0].plain_text;
    } else if (item.properties?.Name?.title?.[0]?.plain_text) {
      title = item.properties.Name.title[0].plain_text;
    } else {
      const titleProp = Object.values(item.properties || {}).find((prop: any) =>
        prop?.type === 'title' && prop?.title?.[0]?.plain_text
      );
      if (titleProp && titleProp.title?.[0]?.plain_text) {
        title = titleProp.title[0].plain_text;
      }
    }

    const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28'
      }
    });

    const blocksData = await blocksResponse.json();
    let content = '';

    for (const block of blocksData.results || []) {
      if (block.type === 'paragraph') {
        content += block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
      } else if (block.type === 'heading_1') {
        content += '# ' + block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
      } else if (block.type === 'bulleted_list_item') {
        content += '- ' + block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
      }
    }

    return {
      id: pageId,
      title,
      content,
      parent: item.parent,
      object: 'page',
      url
    };
  } catch (error) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const apiKey = process.env.NOTION_API_KEY;
        if (!apiKey) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'API key not configured' }) + '\n'));
          controller.close();
          return;
        }

        const response = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ page_size: 50 })
        });

        const data = await response.json();

        if (!response.ok || !data.results) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'Failed to fetch' }) + '\n'));
          controller.close();
          return;
        }

        for (const item of data.results) {
          if (item.object === 'page') {
            const page = await processPage(item, apiKey);
            if (page) {
              controller.enqueue(encoder.encode(JSON.stringify(page) + '\n'));
            }
          }
        }

        controller.close();
      } catch (error: any) {
        controller.enqueue(encoder.encode(JSON.stringify({ error: error.message }) + '\n'));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' }
  });
}
