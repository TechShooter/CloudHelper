import { NextRequest, NextResponse } from 'next/server';

// Recursive function to extract blocks including nested children
async function extractBlockContent(blockId: string, apiKey: string, indent: string = ''): Promise<string> {
  try {
    const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28'
      }
    });

    const data = await response.json();
    let content = '';

    if (data.results && data.results.length > 0) {
      for (const block of data.results) {
        let text = '';

        if (block.type === 'paragraph') {
          text = block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + text + '\n';
        } else if (block.type === 'heading_1') {
          text = block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + '# ' + text + '\n';
        } else if (block.type === 'heading_2') {
          text = block.heading_2?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + '## ' + text + '\n';
        } else if (block.type === 'heading_3') {
          text = block.heading_3?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + '### ' + text + '\n';
        } else if (block.type === 'bulleted_list_item') {
          text = block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + '- ' + text + '\n';
        } else if (block.type === 'numbered_list_item') {
          text = block.numbered_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + '1. ' + text + '\n';
        } else if (block.type === 'to_do') {
          const checked = block.to_do?.checked ? '☑' : '☐';
          text = block.to_do?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + `${checked} ` + text + '\n';
        } else if (block.type === 'code') {
          text = block.code?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + '```\n' + text + '\n```\n';
        } else if (block.type === 'quote') {
          text = block.quote?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          if (text) content += indent + '> ' + text + '\n';
        }

        // Recursively extract nested children blocks
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, apiKey, indent + '  ');
          content += childContent;
        }
      }
    }

    return content;
  } catch (error) {
    console.error('Error extracting block content:', error);
    return '';
  }
}

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
            for (const page of queryData.results.slice(0, 5)) { // Limit to 5 pages for performance
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

              // Also extract page content blocks if available
              try {
                const pageBlocksResponse = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children?page_size=50`, {
                  headers: {
                    'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                    'Notion-Version': '2022-06-28'
                  }
                });
                const pageBlocksData = await pageBlocksResponse.json();

                if (pageBlocksData.results && pageBlocksData.results.length > 0) {
                  pageContent += '\nPage Content:\n';
                  pageBlocksData.results.forEach((block: any) => {
                    if (block.type === 'paragraph') {
                      pageContent += block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
                    } else if (block.type === 'bulleted_list_item') {
                      pageContent += '- ' + block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
                    } else if (block.type === 'numbered_list_item') {
                      pageContent += '1. ' + block.numbered_list_item?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
                    }
                  });
                }
              } catch (blockError) {
                console.log('Could not fetch page blocks for database item:', blockError);
              }

              content += pageContent + '\n---\n';
            }
          } else {
            content = 'No items in this database.';
          }

          return { id: databaseId, title: `${title} (Database)`, content };
        } else {
          // Handle regular page
          const pageId = item.id;
          let title = 'Untitled';

          console.log('Processing page:', item.id, 'Properties:', JSON.stringify(item.properties, null, 2));

          if (item.properties?.title?.title?.[0]?.plain_text) {
            title = item.properties.title.title[0].plain_text;
          } else if (item.properties?.Name?.title?.[0]?.plain_text) {
            title = item.properties.Name.title[0].plain_text;
          } else {
            // Fallback: cerca la prima proprietà di tipo title (es. Task in Tasks DB)
            const titleProp = Object.values(item.properties || {}).find((prop: any) =>
              prop?.type === 'title' && prop?.title?.[0]?.plain_text
            );
            if (titleProp && titleProp.title?.[0]?.plain_text) {
              title = titleProp.title[0].plain_text;
            }
          }

          if (title === 'Untitled' && item.parent?.type === 'page_id') {
            const parentResponse = await fetch(`https://api.notion.com/v1/pages/${item.parent.page_id}`, {
              headers: {
                'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
              }
            });
            const parentData = await parentResponse.json();
            title = parentData.properties?.title?.title?.[0]?.plain_text || title;
          }

          console.log('Initial title for page', pageId, ':', title);

          // If still Untitled, try to get title from first content block
          if (title === 'Untitled') {
            try {
              const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=10`, {
                headers: {
                  'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                  'Notion-Version': '2022-06-28'
                }
              });
              const blocksData = await blocksResponse.json();
              if (blocksData.results && blocksData.results.length > 0) {
                for (const block of blocksData.results) {
                  if (block.type === 'heading_1' && block.heading_1?.rich_text?.[0]?.plain_text) {
                    title = block.heading_1.rich_text[0].plain_text;
                    break;
                  } else if (block.type === 'heading_2' && block.heading_2?.rich_text?.[0]?.plain_text) {
                    title = block.heading_2.rich_text[0].plain_text;
                    break;
                  } else if (block.type === 'heading_3' && block.heading_3?.rich_text?.[0]?.plain_text) {
                    title = block.heading_3.rich_text[0].plain_text;
                    break;
                  } else if (block.type === 'paragraph' && block.paragraph?.rich_text?.[0]?.plain_text) {
                    title = block.paragraph.rich_text[0].plain_text.substring(0, 50) + (block.paragraph.rich_text[0].plain_text.length > 50 ? '...' : '');
                    break;
                  }
                }
              }
              console.log('Updated title from content:', title);
            } catch (error) {
              console.log('Could not fetch content for title:', error);
            }
          }

          // Do not skip Untitled pages: keep them with fallback title + id
          if (!title || !title.trim()) {
            title = `Untitled page (${pageId.slice(0, 6)})`;
          }

          const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
            headers: {
              'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
              'Notion-Version': '2022-06-28'
            }
          });

          const blocksData = await blocksResponse.json();
          let content = '';

          // Use for loop instead of forEach to handle async nested block extraction
          for (const block of blocksData.results || []) {
            if (block.type === 'paragraph') {
              content += block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
            } else if (block.type === 'heading_1') {
              content += '# ' + block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
            } else if (block.type === 'heading_2') {
              content += '## ' + block.heading_2?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
            } else if (block.type === 'heading_3') {
              content += '### ' + block.heading_3?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
            } else if (block.type === 'bulleted_list_item') {
              content += '- ' + block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
            } else if (block.type === 'numbered_list_item') {
              content += '1. ' + block.numbered_list_item?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
            } else if (block.type === 'to_do') {
              const checked = block.to_do?.checked ? '☑' : '☐';
              content += `${checked} ` + block.to_do?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
            } else if (block.type === 'code') {
              content += '```\n' + block.code?.rich_text?.map((t: any) => t.plain_text).join('') + '\n```\n';
            } else if (block.type === 'quote') {
              content += '> ' + block.quote?.rich_text?.map((t: any) => t.plain_text).join('') + '\n';
            }

            // Extract nested children if this block has children
            if (block.has_children) {
              const childContent = await extractBlockContent(block.id, process.env.NOTION_API_KEY as string, '  ');
              content += childContent;
            }
          }

          return { id: pageId, title, content };
        }
      })
    );

    // Filter out null results (skipped pages)
    const filteredPages = pages.filter(page => page !== null);

    return NextResponse.json({ pages: filteredPages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
