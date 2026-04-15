import { NextRequest } from 'next/server';

function extractProperty(prop: any): string {
  if (!prop) return '';
  
  switch (prop.type) {
    case 'title':
      return prop.title?.map((t: any) => t.plain_text).join('') || '';
    case 'rich_text':
      return prop.rich_text?.map((t: any) => t.plain_text).join('') || '';
    case 'text':
      return prop.text?.content || '';
    case 'number':
      return prop.number?.toString() || '';
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return prop.multi_select?.map((s: any) => s.name).join(', ') || '';
    case 'date':
      return prop.date?.start || '';
    case 'checkbox':
      return prop.checkbox ? 'Yes' : 'No';
    case 'url':
      return prop.url || '';
    case 'email':
      return prop.email || '';
    case 'phone':
      return prop.phone || '';
    case 'formula':
      return extractProperty(prop.formula);
    case 'relation':
      return prop.relation?.map((r: any) => r.id).join(', ') || '';
    case 'rollup':
      return prop.rollup?.array?.map((r: any) => extractProperty(r)).join(', ') || '';
    case 'people':
      return prop.people?.map((p: any) => p.name).join(', ') || '';
    case 'files':
      return prop.files?.map((f: any) => f.name || f.external?.url).join(', ') || '';
    case 'status':
      return prop.status?.name || '';
    default:
      return '';
  }
}

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
      const titleProp = Object.values(item.properties || {}).find((prop: any): prop is { type: string; title: Array<{ plain_text: string }> } =>
        prop?.type === 'title' && prop?.title?.[0]?.plain_text
      );
      if (titleProp && titleProp.title?.[0]?.plain_text) {
        title = titleProp.title[0].plain_text;
      }
    }

    const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2026-03-11'
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
            'Notion-Version': '2026-03-11',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ page_size: 50 })
        });

        const data = await response.json();

        if (!response.ok || !data.results) {
          const errorMessage = data.message || data.code || `HTTP ${response.status}`;
          controller.enqueue(encoder.encode(JSON.stringify({ error: `Failed to fetch: ${errorMessage}` }) + '\n'));
          controller.close();
          return;
        }

        // Process all items (pages and databases)
        for (const item of data.results) {
          if (item.object === 'page') {
            const page = await processPage(item, apiKey);
            if (page) {
              controller.enqueue(encoder.encode(JSON.stringify(page) + '\n'));
            }
          } else if (item.object === 'database' || item.object === 'data_source') {
            // Process database or data source
            const databaseId = item.id;
            const title = item.title?.[0]?.plain_text || 'Untitled Database';
            const url = `https://www.notion.so/${databaseId.replace(/-/g, '')}`;

            console.log('Sending database/data_source:', item.object, databaseId, title, 'parent:', item.parent);

            // Send the database/data_source object
            const database = {
              id: databaseId,
              title: title,
              content: `Database: ${title}\n\n`,
              parent: item.parent,
              object: item.object || 'database',
              url,
              children: []
            };

            controller.enqueue(encoder.encode(JSON.stringify(database) + '\n'));

            // Then, fetch and send database entries as separate page objects
            try {
              // Try new data sources API first (2026-03-11)
              if (item.data_sources && item.data_sources.length > 0) {
                for (const dataSource of item.data_sources) {
                  try {
                    const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${dataSource.id}/query`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Notion-Version': '2026-03-11',
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ page_size: 100 })
                    });

                    const queryData = await queryResponse.json();

                    if (queryData.results && queryData.results.length > 0) {
                      for (const entry of queryData.results) {
                        let entryTitle = 'Untitled';
                        let entryProps: string[] = [];

                        if (entry.properties) {
                          for (const [propName, propValue] of Object.entries(entry.properties)) {
                            const value = extractProperty(propValue as any);
                            if (value) {
                              if ((propValue as any).type === 'title' && (!entryTitle || entryTitle === 'Untitled')) {
                                entryTitle = value;
                              } else {
                                entryProps.push(`${propName}: ${value}`);
                              }
                            }
                          }
                        }

                        let entryContent = `Entry: ${entryTitle}\n`;
                        if (entryProps.length > 0) {
                          entryContent += entryProps.join('\n') + '\n';
                        }

                        // Send entry as a page object with its actual parent from Notion API
                        const entryPage = {
                          id: entry.id,
                          title: entryTitle,
                          content: entryContent,
                          parent: entry.parent || {
                            type: 'database_id',
                            database_id: databaseId
                          },
                          object: 'page',
                          url: entry.url || `https://www.notion.so/${entry.id.replace(/-/g, '')}`,
                          children: []
                        };

                        controller.enqueue(encoder.encode(JSON.stringify(entryPage) + '\n'));
                      }
                    }
                  } catch (error) {
                    console.error('Error fetching data source entries:', dataSource.id, error);
                  }
                }
              } else {
                // Fallback to old database query API
                const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Notion-Version': '2026-03-11',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ page_size: 100 })
                });

                const queryData = await queryResponse.json();

                if (queryData.results && queryData.results.length > 0) {
                  for (const entry of queryData.results) {
                    let entryTitle = 'Untitled';
                    let entryProps: string[] = [];

                    if (entry.properties) {
                      for (const [propName, propValue] of Object.entries(entry.properties)) {
                        const value = extractProperty(propValue as any);
                        if (value) {
                          if ((propValue as any).type === 'title' && (!entryTitle || entryTitle === 'Untitled')) {
                            entryTitle = value;
                          } else {
                            entryProps.push(`${propName}: ${value}`);
                          }
                        }
                      }
                    }

                    let entryContent = `Entry: ${entryTitle}\n`;
                    if (entryProps.length > 0) {
                      entryContent += entryProps.join('\n') + '\n';
                    }

                    // Send entry as a page object with its actual parent from Notion API
                    const entryPage = {
                      id: entry.id,
                      title: entryTitle,
                      content: entryContent,
                      parent: entry.parent || {
                        type: 'database_id',
                        database_id: databaseId
                      },
                      object: 'page',
                      url: entry.url || `https://www.notion.so/${entry.id.replace(/-/g, '')}`,
                      children: []
                    };

                    controller.enqueue(encoder.encode(JSON.stringify(entryPage) + '\n'));
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching database entries:', error);
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
