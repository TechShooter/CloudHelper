import { NextRequest, NextResponse } from 'next/server';

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

// Recursive function to extract blocks including nested children
async function extractBlockContent(blockId: string, apiKey: string, indent: string = ''): Promise<string> {
  try {
    const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2026-03-11'
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
  console.log('Notion API called');
  
  // Abort controller with 15 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    console.log('NOTION_API_KEY exists:', !!process.env.NOTION_API_KEY);

    if (!process.env.NOTION_API_KEY || process.env.NOTION_API_KEY === 'your_notion_integration_token_here') {
      console.log('API key not configured properly');
      clearTimeout(timeoutId);
      return NextResponse.json({ error: 'Notion API key not configured' }, { status: 400 });
    }

    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        page_size: 50  // Reduced from 100 to 50 for faster response
      })
    });

    const data = await response.json();
    console.log('Search API response status:', response.status);
    console.log('Search API response data:', data);

    if (!response.ok) {
      console.error('Notion API error:', data);
      return NextResponse.json({
        error: data.message || `Notion API error: ${data.code || 'Unknown'}`
      }, { status: response.status });
    }

    // Also try to fetch the specific database if provided
    const specificDatabaseId = '29aedf786daa80818d43c896d29bc6b4'; // Tasks to do db
    let specificDbFound = false;

    try {
      const dbResponse = await fetch(`https://api.notion.com/v1/databases/${specificDatabaseId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2026-03-11'
        }
      });

      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        console.log('Specific database found:', {
          id: dbData.id,
          title: dbData.title?.[0]?.plain_text || 'Untitled Database'
        });
        specificDbFound = true;
      } else {
        console.log('Specific database not accessible:', dbResponse.status, dbResponse.statusText);
      }
    } catch (error) {
      console.log('Error checking specific database:', error);
    }

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        pages: [],
        error: 'No pages or databases found. Make sure pages and databases are shared with your integration.'
      });
    }

    const pages = (await Promise.all(
      data.results.map(async (item: any) => {
        try {
          if (item.object === 'database' || item.object === 'data_source') {
            // Handle database or data source - fetch entries with all properties
            const databaseId = item.id;
            let title = item.title?.[0]?.plain_text || 'Untitled Database';
            const databasePages: any[] = [];

            try {
              // Try new data sources API first (2026-03-11)
              if (item.data_sources && item.data_sources.length > 0) {
                for (const dataSource of item.data_sources) {
                  try {
                    const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${dataSource.id}/query`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
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

                        // Create page object for entry with its actual parent from Notion API
                        databasePages.push({
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
                        });
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
                    'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
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

                    // Create page object for entry with its actual parent from Notion API
                    databasePages.push({
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
                    });
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching database entries:', error);
            }

            // Return database object along with its pages
            return [
              {
                id: databaseId,
                title: title,
                content: `Database: ${title}\n\n`,
                parent: item.parent,
                object: item.object || 'database',
                children: [] // Will be populated in hierarchy building
              },
              ...databasePages
            ];
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
              const titleProp = Object.values(item.properties || {}).find((prop: any): prop is { type: string; title: Array<{ plain_text: string }> } =>
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
                  'Notion-Version': '2026-03-11'
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
                    'Notion-Version': '2026-03-11'
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
                'Notion-Version': '2026-03-11'
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

            return {
              id: pageId,
              title,
              content,
              parent: item.parent,
              object: 'page'
            };
          }
        } catch (error) {
          console.log('Error processing item:', item.id, error);
          return null;
        }
      })
    )).flat();

    // Filter out null results (skipped pages)
    const filteredPages = pages.filter(page => page !== null);
    console.log('Successfully processed pages:', filteredPages.length);
    console.log('Processed pages:', filteredPages.map(p => ({ id: p.id, title: p.title, object: p.object })));

    // Collect all parent IDs that need to be fetched (including databases)
    const parentIdsToFetch = new Set<string>();
    filteredPages.forEach(page => {
      if (page.parent?.page_id && !filteredPages.find(p => p.id === page.parent.page_id)) {
        parentIdsToFetch.add(page.parent.page_id);
      }
      if (page.parent?.database_id && !filteredPages.find(p => p.id === page.parent.database_id)) {
        parentIdsToFetch.add(page.parent.database_id);
      }
    });

    console.log('Parent IDs to fetch:', Array.from(parentIdsToFetch));

    // Fetch missing parent pages/databases
    const parentPromises = Array.from(parentIdsToFetch).slice(0, 10).map(async (parentId) => {
      try {
        // Try to fetch as database first
        const dbResponse = await fetch(`https://api.notion.com/v1/databases/${parentId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
            'Notion-Version': '2026-03-11'
          }
        });

        if (dbResponse.ok) {
          const dbData = await dbResponse.json();
          const title = dbData.title?.[0]?.plain_text || 'Untitled Database';
          let databaseContent = `Database: ${title}\n\n`;

          // Fetch database entries with properties
          try {
            const queryResponse = await fetch(`https://api.notion.com/v1/databases/${parentId}/query`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
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

                databaseContent += `Entry: ${entryTitle}\n`;
                if (entryProps.length > 0) {
                  databaseContent += entryProps.join('\n') + '\n';
                }
                databaseContent += '\n---\n\n';
              }
            }
          } catch (error) {
            console.error('Error fetching parent database entries:', error);
          }

          return {
            id: parentId,
            title: title,
            content: databaseContent,
            parent: dbData.parent,
            object: 'database',
            children: []
          };
        }

        // Try to fetch as page
        const pageResponse = await fetch(`https://api.notion.com/v1/pages/${parentId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
            'Notion-Version': '2026-03-11'
          }
        });

        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          let title = 'Untitled';

          if (pageData.properties?.title?.title?.[0]?.plain_text) {
            title = pageData.properties.title.title[0].plain_text;
          } else if (pageData.properties?.Name?.title?.[0]?.plain_text) {
            title = pageData.properties.Name.title[0].plain_text;
          }

          return {
            id: parentId,
            title,
            content: '',
            parent: pageData.parent,
            object: 'page',
            children: []
          };
        }
      } catch (error) {
        console.log('Could not fetch parent:', parentId, error);
      }
      return null;
    });

    const fetchedParents = await Promise.all(parentPromises);
    const validParents = fetchedParents.filter(p => p !== null);

    // Combine all pages
    const allPages = [...filteredPages, ...validParents];

    // Build hierarchical structure
    const pageMap = new Map();
    const rootPages: any[] = [];

    // First pass: create map with children arrays
    allPages.forEach(page => {
      pageMap.set(page.id, { ...page, children: [] });
    });

    // Second pass: build hierarchy
    allPages.forEach(page => {
      const parentId = page.parent?.page_id || page.parent?.database_id;
      
      if (!parentId || page.parent?.type === 'workspace') {
        // Root level page
        rootPages.push(pageMap.get(page.id));
      } else if (pageMap.has(parentId)) {
        // Has a parent in our map
        const parent = pageMap.get(parentId);
        parent.children.push(pageMap.get(page.id));
      } else {
        // Parent not found, treat as root
        rootPages.push(pageMap.get(page.id));
      }
    });

    // Aggregate content for databases
    const aggregateContent = (page: any): any => {
      if (page.object === 'database' && page.children && page.children.length > 0) {
        let aggregatedContent = page.content || '';
        aggregatedContent += '\n\n=== Database Items ===\n\n';
        page.children.forEach((child: any, idx: number) => {
          const processedChild = aggregateContent(child);
          aggregatedContent += `Item ${idx + 1}: ${processedChild.title}\n${processedChild.content}\n\n---\n\n`;
        });
        return { ...page, content: aggregatedContent, children: page.children.map(aggregateContent) };
      }
      return { ...page, children: page.children.map(aggregateContent) };
    };

    const hierarchicalPages = rootPages.map(aggregateContent);

    clearTimeout(timeoutId);
    
    return NextResponse.json({
      pages: filteredPages, // Keep flat list for backward compatibility
      hierarchicalPages: hierarchicalPages, // New hierarchical structure
      totalResults: data.results?.length || 0,
      specificDatabaseFound: specificDbFound
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Notion API error:', error.message);
    return NextResponse.json({ 
      error: error.name === 'AbortError' ? 'Request timeout - Notion API taking too long' : error.message,
      pages: [],
      hierarchicalPages: []
    }, { status: 500 });
  }
}
