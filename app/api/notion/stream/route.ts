import { NextRequest } from 'next/server';

export const runtime = 'edge';

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

async function processBlocks(blocks: any[], indent = 0): Promise<string> {
  let content = '';
  let numberedCounter = 1;
  let letteredCounter = 1;

  for (const block of blocks) {
    const indentStr = '    '.repeat(indent);

    if (block.type === 'paragraph') {
      const text = block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'heading_1') {
      const text = block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + '# ' + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'heading_2') {
      const text = block.heading_2?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + '## ' + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'heading_3') {
      const text = block.heading_3?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + '### ' + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'bulleted_list_item') {
      const text = block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + '- ' + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'numbered_list_item') {
      const text = block.numbered_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      const letter = String.fromCharCode(96 + letteredCounter);
      if (indent === 0) {
        content += indentStr + numberedCounter + '. ' + text + '\n';
        numberedCounter++;
      } else {
        content += indentStr + letter + '. ' + text + '\n';
        letteredCounter++;
      }
    } else if (block.type === 'to_do') {
      const text = block.to_do?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      const checked = block.to_do?.checked ? '[x]' : '[ ]';
      content += indentStr + checked + ' ' + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'toggle') {
      const text = block.toggle?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + '> ' + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'quote') {
      const text = block.quote?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + '> ' + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'divider') {
      content += indentStr + '---\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'callout') {
      const text = block.callout?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + '> ' + text + '\n';
      numberedCounter = 1;
      letteredCounter = 1;
    } else if (block.type === 'code') {
      const text = block.code?.rich_text?.map((t: any) => t.plain_text).join('') || '';
      content += indentStr + '```\n' + indentStr + text + '\n' + indentStr + '```\n';
      numberedCounter = 1;
      letteredCounter = 1;
    }

    // Process nested children if they exist
    if (block.has_children) {
      const childrenContent = await processBlocks(block.children || [], indent + 1);
      content += childrenContent;
    }
  }

  return content;
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

    let content = '';
    let startCursor: string | undefined = undefined;
    let hasMore = true;
    const allBlocks: any[] = [];

    // Fetch all blocks with pagination
    while (hasMore) {
      const blocksUrl: string = startCursor
        ? `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100&start_cursor=${startCursor}`
        : `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;

      const blocksResponse: Response = await fetch(blocksUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2026-03-11'
        }
      });

      const blocksData: any = await blocksResponse.json();
      allBlocks.push(...(blocksData.results || []));

      hasMore = blocksData.has_more || false;
      startCursor = blocksData.next_cursor || undefined;
    }

    // Fetch children for blocks that have them
    for (const block of allBlocks) {
      if (block.has_children) {
        const childrenResponse = await fetch(`https://api.notion.com/v1/blocks/${block.id}/children?page_size=100`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': '2026-03-11'
          }
        });
        const childrenData = await childrenResponse.json();
        block.children = childrenData.results || [];

        // Fetch grandchildren if needed
        for (const childBlock of block.children) {
          if (childBlock.has_children) {
            const grandchildrenResponse = await fetch(`https://api.notion.com/v1/blocks/${childBlock.id}/children?page_size=100`, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2026-03-11'
              }
            });
            const grandchildrenData = await grandchildrenResponse.json();
            childBlock.children = grandchildrenData.results || [];
          }
        }
      }
    }

    // Process all blocks with their children
    content = await processBlocks(allBlocks, 0);

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

            // Fetch database entries to include their content in the database object for chat context
            let databaseContent = `Database: ${title}\n\n`;

            try {
              // If this is a data_source object, query it directly
              if (item.object === 'data_source') {
                try {
                  const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${databaseId}/query`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${apiKey}`,
                      'Notion-Version': '2026-03-11',
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ page_size: 100 })
                  });

                  const queryData = await queryResponse.json();
                  console.log('Data source query response:', queryData.results?.length, 'entries');

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

                      // Add entry content to database content for prompt preview/chat AI
                      databaseContent += entryContent;
                    }
                  }
                } catch (error) {
                  console.error('Error fetching data source entries:', databaseId, error);
                }
              } else if (item.data_sources && item.data_sources.length > 0) {
                // If this is a database object with data_sources, query each data source
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

                        // Add entry content to database content for prompt preview/chat AI
                        databaseContent += entryContent;
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

                    // Add entry content to database content for prompt preview
                    databaseContent += entryContent;
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching database entries:', error);
            }

            // Send the database/data_source object with full content
            const database = {
              id: databaseId,
              title: title,
              content: databaseContent,
              parent: item.parent,
              object: item.object || 'database',
              url,
              children: []
            };

            controller.enqueue(encoder.encode(JSON.stringify(database) + '\n'));
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
