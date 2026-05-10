import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

function extractProperty(prop: any): string {
  if (!prop) return '';
  
  const { type } = prop;
  
  // Text array types
  if (type === 'title' || type === 'rich_text') {
    const arr = type === 'title' ? prop.title : prop.rich_text;
    return arr?.map((t: any) => t.plain_text).join('') || '';
  }
  
  // Simple string types
  if (type === 'number') {
    return prop.number !== null && prop.number !== undefined ? prop.number.toString() : '';
  }
  
  if (type === 'select') {
    return prop.select?.name || '';
  }
  
  if (type === 'status') {
    return prop.status?.name || '';
  }
  
  if (type === 'date') {
    if (prop.date?.start) {
      return prop.date.end ? `${prop.date.start} to ${prop.date.end}` : prop.date.start;
    }
    return '';
  }
  
  if (type === 'url') {
    return prop.url || '';
  }
  
  if (type === 'email') {
    return prop.email || '';
  }
  
  if (type === 'phone') {
    return prop.phone_number || '';
  }
  
  // Boolean
  if (type === 'checkbox') return prop.checkbox ? 'Yes' : 'No';
  
  // Array types
  if (type === 'multi_select') return prop.multi_select?.map((s: any) => s.name).join(', ') || '';
  if (type === 'relation') return prop.relation?.map((r: any) => r.id).join(', ') || '';
  if (type === 'people') return prop.people?.map((p: any) => p.name || p.id).join(', ') || '';
  if (type === 'files') return prop.files?.map((f: any) => f.name || f.external?.url || f.file?.url).join(', ') || '';
  
  // Complex types
  if (type === 'formula') {
    if (prop.formula?.type === 'string') return prop.formula.string || '';
    if (prop.formula?.type === 'number') return prop.formula.number?.toString() || '';
    if (prop.formula?.type === 'boolean') return prop.formula.boolean ? 'Yes' : 'No';
    if (prop.formula?.type === 'date') return prop.formula.date?.start || '';
    return '';
  }
  
  if (type === 'rollup') {
    if (prop.rollup?.type === 'number') return prop.rollup.number?.toString() || '';
    if (prop.rollup?.type === 'date') return prop.rollup.date?.start || '';
    if (prop.rollup?.type === 'array') return prop.rollup.array?.map((r: any) => extractProperty(r)).filter((v: string) => v).join(', ') || '';
    return '';
  }
  
  // Created/edited metadata
  if (type === 'created_time' || type === 'last_edited_time') {
    return prop[type] || '';
  }
  
  if (type === 'created_by' || type === 'last_edited_by') {
    return prop[type]?.name || prop[type]?.id || '';
  }
  
  return '';
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
  // Increase timeout for edge runtime - use 25 seconds instead of 15
  // This accounts for Notion API latency and multiple parallel requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  const startTime = Date.now();
  
  try {
    if (!process.env.NOTION_API_KEY || process.env.NOTION_API_KEY === 'your_notion_integration_token_here') {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: 'Notion API key not configured' }, { status: 400 });
    }

    console.log('[NOTION API] Starting request...');

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
    console.log('[NOTION API] Search completed in', Date.now() - startTime, 'ms, results:', data.results?.length);

    if (!response.ok) {
      console.error('Notion API error:', data);
      return NextResponse.json({
        error: data.message || `Notion API error: ${data.code || 'Unknown'}`
      }, { status: response.status });
    }

    // Log what types of objects are returned from search
    const searchResultsBreakdown = { database: 0, page: 0, other: 0 };
    data.results?.forEach((item: any) => {
      if (item.object === 'database') searchResultsBreakdown.database++;
      else if (item.object === 'page') searchResultsBreakdown.page++;
      else searchResultsBreakdown.other++;
    });
    
    console.log('[NOTION] Search API results breakdown:', searchResultsBreakdown);
    console.log('[NOTION] First 3 items from search:', data.results?.slice(0, 3).map((item: any) => ({
      id: item.id,
      object: item.object,
      title: item.title?.[0]?.plain_text || 'N/A',
      hasDataSources: item.data_sources ? item.data_sources.length : 0,
      parent: item.parent
    })));

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
          const itemStartTime = Date.now();
          console.log('[NOTION] Processing item:', item.id, 'Type:', item.object, 'Title:', item.title?.[0]?.plain_text || 'N/A');
          
          if (item.object === 'database') {
            console.log('[NOTION] >>> PROCESSING DATABASE:', item.id, 'Title:', item.title?.[0]?.plain_text || 'N/A');
            // Database is a container - fetch its data sources
            const databaseId = item.id;
            const dbTitle = item.title?.[0]?.plain_text || 'Untitled Database';
            const dataSourceObjects: any[] = [];

            // Fetch each data source under this database
            if (item.data_sources && item.data_sources.length > 0) {
              console.log('[NOTION] Database has data_sources:', item.data_sources.length);
              // NEW API: Database has data sources
              for (const dsRef of item.data_sources) {
                try {
                  // Fetch full data source details
                  const dsResponse = await fetch(`https://api.notion.com/v1/data_sources/${dsRef.id}`, {
                    headers: {
                      'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                      'Notion-Version': '2026-03-11'
                    }
                  });

                  if (!dsResponse.ok) continue;
                  const dataSource = await dsResponse.json();
                  const dsTitle = dataSource.title?.[0]?.plain_text || dsRef.name || 'Untitled Data Source';
                  const dataSourcePages: any[] = [];

                  // Query pages in this data source
                  const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${dsRef.id}/query`, {
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

                      console.log('Processing entry:', entry.id, 'Properties:', Object.keys(entry.properties || {}));

                      if (entry.properties) {
                        for (const [propName, propValue] of Object.entries(entry.properties)) {
                          const value = extractProperty(propValue as any);
                          console.log(`Property ${propName} (${(propValue as any).type}):`, value);
                          if (value) {
                            if ((propValue as any).type === 'title' && (!entryTitle || entryTitle === 'Untitled')) {
                              entryTitle = value;
                            } else {
                              entryProps.push(`${propName}: ${value}`);
                            }
                          }
                        }
                      }

                      console.log('Entry title:', entryTitle, 'Props:', entryProps);
                      let entryContent = entryProps.length > 0 ? entryProps.join('\n') : '';

                      dataSourcePages.push({
                        id: entry.id,
                        title: entryTitle,
                        content: entryContent,
                        parent: { type: 'data_source_id', data_source_id: dsRef.id },
                        object: 'page',
                        url: entry.url || `https://www.notion.so/${entry.id.replace(/-/g, '')}`,
                        children: []
                      });
                    }
                  }

                  // Create data source object with its pages as children
                  dataSourceObjects.push({
                    id: dsRef.id,
                    title: dsTitle,
                    content: '', // Empty - content will come from children
                    parent: { type: 'database_id', database_id: databaseId },
                    object: 'data_source',
                    children: dataSourcePages
                  });
                } catch (error) {
                  console.error('Error fetching data source:', dsRef.id, error);
                }
              }
            } else {
              // FALLBACK: Old database API - query database directly
              console.log('[NOTION] Database has no data_sources, using fallback query API for:', databaseId, dbTitle);
              try {
                const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                    'Notion-Version': '2026-03-11',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ 
                    page_size: 100,
                    filter: {
                      property: 'in_trash',
                      checkbox: {
                        equals: false
                      }
                    }
                  })
                });

                const queryData = await queryResponse.json();
                console.log(`Database ${dbTitle} query returned ${queryData.results?.length || 0} items, has_more: ${queryData.has_more}`);
                if (queryData.has_more) {
                  console.warn(`WARNING: Database ${dbTitle} has more items but pagination not implemented!`);
                }
                const databasePages: any[] = [];

                if (queryData.results && queryData.results.length > 0) {
                  for (const entry of queryData.results) {
                    let entryTitle = 'Untitled';
                    let entryProps: string[] = [];

                    console.log('Processing database entry (fallback):', entry.id, 'Properties:', Object.keys(entry.properties || {}));

                    if (entry.properties) {
                      for (const [propName, propValue] of Object.entries(entry.properties)) {
                        const value = extractProperty(propValue as any);
                        console.log(`  Property ${propName} (${(propValue as any).type}):`, value);
                        if (value) {
                          if ((propValue as any).type === 'title' && (!entryTitle || entryTitle === 'Untitled')) {
                            entryTitle = value;
                          } else {
                            entryProps.push(`${propName}: ${value}`);
                          }
                        }
                      }
                    }

                    console.log('  Entry title:', entryTitle, 'Props count:', entryProps.length);
                    let entryContent = entryProps.length > 0 ? entryProps.join('\n') : '';

                    databasePages.push({
                      id: entry.id,
                      title: entryTitle,
                      content: entryContent,
                      parent: { type: 'database_id', database_id: databaseId },
                      object: 'page',
                      url: entry.url || `https://www.notion.so/${entry.id.replace(/-/g, '')}`,
                      children: []
                    });
                  }
                  console.log(`Database ${dbTitle} processed ${databasePages.length} pages`);
                }

                // Return database with pages directly as children (no data source wrapper)
                console.log('[NOTION] <<< RETURNING DATABASE (fallback success):', databaseId, 'Title:', dbTitle, 'Pages:', databasePages.length);
                return {
                  id: databaseId,
                  title: dbTitle,
                  content: '', // Empty - content comes from children
                  parent: item.parent,
                  object: 'database',
                  children: databasePages
                };
              } catch (error) {
                console.error('[NOTION] Error querying database (fallback):', databaseId, error);
                // Still return the database object even if query failed, so we don't lose it
                console.log('[NOTION] <<< RETURNING DATABASE (fallback with error):', databaseId, 'Title:', dbTitle);
                return {
                  id: databaseId,
                  title: dbTitle,
                  content: 'Failed to load database contents',
                  parent: item.parent,
                  object: 'database',
                  children: []
                };
              }
            }

            // Return database with data sources as children
            console.log('[NOTION] <<< RETURNING DATABASE:', databaseId, 'Title:', dbTitle, 'Children:', dataSourceObjects.length);
            return {
              id: databaseId,
              title: dbTitle,
              content: '', // Empty - content comes from data sources
              parent: item.parent,
              object: 'database',
              children: dataSourceObjects
            };
          } else {
            // Handle regular page
            const pageId = item.id;
            let title = 'Untitled';
            let pageProperties: string[] = [];

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

            // Extract ALL properties (not just title)
            if (item.properties) {
              for (const [propName, propValue] of Object.entries(item.properties)) {
                // Skip title property as it's already used
                if ((propValue as any).type === 'title') continue;
                
                const value = extractProperty(propValue as any);
                console.log(`Page property ${propName} (${(propValue as any).type}):`, value);
                if (value) {
                  pageProperties.push(`${propName}: ${value}`);
                }
              }
            }

            console.log('Page title:', title, 'Properties:', pageProperties);

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

            // Add properties first
            if (pageProperties.length > 0) {
              content += pageProperties.join('\n') + '\n\n';
            }

            // Then add block content
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
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[NOTION] Error processing item:', item.id, 'Object:', item.object, 'Title:', item.title?.[0]?.plain_text || 'N/A', 'Error:', errorMsg);
          // Log full error stack for databases
          if (item.object === 'database' && error instanceof Error) {
            console.error('[NOTION] Database error stack:', error.stack);
          }
          return null;
        }
      })
    )).flat().filter(item => item !== null);

    // Filter out null results
    const filteredPages = pages.filter(page => page !== null);
    
    const processedBreakdown = { database: 0, data_source: 0, page: 0, other: 0, null: 0 };
    pages.forEach(p => {
      if (p === null) processedBreakdown.null++;
      else if (p.object === 'database') processedBreakdown.database++;
      else if (p.object === 'data_source') processedBreakdown.data_source++;
      else if (p.object === 'page') processedBreakdown.page++;
      else processedBreakdown.other++;
    });
    
    console.log('[NOTION] After processing (including nulls):', {
      total: pages.length,
      filtered: filteredPages.length,
      breakdown: processedBreakdown
    });
    
    console.log('[NOTION] Successfully processed pages:', filteredPages.length, 'in', Date.now() - startTime, 'ms');
    console.log('[NOTION] Pages summary:', filteredPages.map(p => ({ id: p.id, title: p.title, object: p.object, children: p.children?.length || 0 })));

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

    console.log('[NOTION] Parent IDs to fetch:', Array.from(parentIdsToFetch).length, 'total');

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
          console.log('[NOTION] Fetching parent database:', title, parentId);
          const databasePages: any[] = [];

          // Fetch database entries with properties using new structure or fallback
          try {
            let queryUrl = '';
            let queryBody: any = { page_size: 100 };
            
            // Check if database has data_sources
            if (dbData.data_sources && dbData.data_sources.length > 0) {
              console.log(`[NOTION] Parent database ${title} has ${dbData.data_sources.length} data sources`);
              // Use data source query
              queryUrl = `https://api.notion.com/v1/data_sources/${dbData.data_sources[0].id}/query`;
            } else {
              console.log(`Parent database ${title} has no data_sources, using fallback`);
              // Use old database query
              queryUrl = `https://api.notion.com/v1/databases/${parentId}/query`;
            }

            const queryResponse = await fetch(queryUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                'Notion-Version': '2026-03-11',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(queryBody)
            });

            const queryData = await queryResponse.json();
            console.log(`Parent database ${title} query returned ${queryData.results?.length || 0} items`);

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

                let entryContent = entryProps.length > 0 ? entryProps.join('\n') : '';

                databasePages.push({
                  id: entry.id,
                  title: entryTitle,
                  content: entryContent,
                  parent: { type: 'database_id', database_id: parentId },
                  object: 'page',
                  url: entry.url || `https://www.notion.so/${entry.id.replace(/-/g, '')}`,
                  children: []
                });
              }
            }
          } catch (error) {
            console.error('Error fetching parent database entries:', error);
          }

          return {
            id: parentId,
            title: title,
            content: '',
            parent: dbData.parent,
            object: 'database',
            children: databasePages
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
    
    // Analyze fetched parents
    const fetchedByType = { database: 0, page: 0, other: 0 };
    validParents.forEach(p => {
      if (p.object === 'database') fetchedByType.database++;
      else if (p.object === 'page') fetchedByType.page++;
      else fetchedByType.other++;
    });
    
    console.log('[NOTION] Fetched parents summary:', {
      totalRequested: Math.min(10, Array.from(parentIdsToFetch).length),
      successfullyFetched: validParents.length,
      byType: fetchedByType
    });

    // Combine all pages
    const allPages = [...filteredPages, ...validParents];
    
    // Log combined breakdown
    const combinedByType = { database: 0, data_source: 0, page: 0, other: 0 };
    allPages.forEach(p => {
      if (p.object === 'database') combinedByType.database++;
      else if (p.object === 'data_source') combinedByType.data_source++;
      else if (p.object === 'page') combinedByType.page++;
      else combinedByType.other++;
    });
    
    console.log('[NOTION] Combined pages (search + parents):', {
      total: allPages.length,
      fromSearch: filteredPages.length,
      fromParentFetch: validParents.length,
      byType: combinedByType
    });

    // Build hierarchical structure
    const pageMap = new Map();
    const rootPages: any[] = [];

    // First pass: create map with children arrays (preserve existing children from data sources)
    allPages.forEach(page => {
      pageMap.set(page.id, { ...page, children: page.children || [] });
    });
    
    // Analyze page map contents
    const pageMapByType = { database: 0, data_source: 0, page: 0, other: 0 };
    allPages.forEach(p => {
      if (p.object === 'database') pageMapByType.database++;
      else if (p.object === 'data_source') pageMapByType.data_source++;
      else if (p.object === 'page') pageMapByType.page++;
      else pageMapByType.other++;
    });
    
    console.log('[NOTION] Page map created:', {
      total: pageMap.size,
      byType: pageMapByType,
      databaseIds: allPages.filter(p => p.object === 'database').map(p => p.id).slice(0, 5),
      dataSourceIds: allPages.filter(p => p.object === 'data_source').map(p => p.id).slice(0, 5)
    });

    // Second pass: build hierarchy
    let parentsNotFound = 0;
    let rootCount = 0;
    let hierarchyChildCount = 0;
    const missingParents: { [key: string]: string[] } = {};
    
    allPages.forEach(page => {
      const parentId = page.parent?.page_id || page.parent?.database_id || page.parent?.data_source_id;
      
      if (!parentId || page.parent?.type === 'workspace') {
        // Root level page
        rootPages.push(pageMap.get(page.id));
        rootCount++;
      } else if (pageMap.has(parentId)) {
        // Has a parent in our map - add to parent's children if not already there
        const parent = pageMap.get(parentId);
        const child = pageMap.get(page.id);
        if (!parent.children.find((c: any) => c.id === child.id)) {
          parent.children.push(child);
          hierarchyChildCount++;
        }
      } else {
        // Parent not found, treat as root
        if (!missingParents[parentId]) {
          missingParents[parentId] = [];
        }
        missingParents[parentId].push(`${page.id}:${page.title}:${page.object}`);
        rootPages.push(pageMap.get(page.id));
        parentsNotFound++;
      }
    });
    
    console.log('[NOTION] Hierarchy built:', {
      totalPages: allPages.length,
      rootPages: rootCount,
      hierarchyAssignedChildren: hierarchyChildCount,
      parentsNotFound: parentsNotFound,
      totalRootPagesArrayLength: rootPages.length,
      missingParentIds: Object.keys(missingParents).slice(0, 10),
      missingParentExamples: Object.entries(missingParents).slice(0, 3).map(([id, children]) => ({
        parentId: id,
        childrenCount: children.length,
        children: children.slice(0, 2)
      }))
    });

    // Aggregate content for databases and data sources
    const aggregateContent = (page: any): any => {
      if (page.object === 'database' && page.children && page.children.length > 0) {
        // Check if children are data sources or direct pages
        const hasDataSources = page.children.some((child: any) => child.object === 'data_source');
        console.log(`Aggregating database: ${page.title}, children: ${page.children.length}, hasDataSources: ${hasDataSources}`);
        
        if (hasDataSources) {
          // Database with data sources: aggregate all data sources
          let aggregatedContent = `Database: ${page.title}\n\n`;
          page.children.forEach((dataSource: any) => {
            const processedDS = aggregateContent(dataSource);
            aggregatedContent += processedDS.content;
          });
          console.log(`Database ${page.title} aggregated content length: ${aggregatedContent.length}`);
          return { ...page, content: aggregatedContent, children: page.children.map(aggregateContent) };
        } else {
          // Database with direct pages (fallback/old API): list all items
          let aggregatedContent = `Database: ${page.title}\n\n`;
          page.children.forEach((item: any, idx: number) => {
            console.log(`  Adding item ${idx + 1}: ${item.title}, content length: ${item.content?.length || 0}`);
            aggregatedContent += `${idx + 1}. ${item.title}\n`;
            if (item.content && item.content.trim()) {
              aggregatedContent += `${item.content}\n`;
            }
            aggregatedContent += '\n';
          });
          console.log(`Database ${page.title} aggregated content length: ${aggregatedContent.length}`);
          return { ...page, content: aggregatedContent, children: page.children.map(aggregateContent) };
        }
      } else if (page.object === 'data_source' && page.children && page.children.length > 0) {
        // Data source: list all items with their properties
        console.log(`Aggregating data source: ${page.title}, children: ${page.children.length}`);
        let aggregatedContent = `Data Source: ${page.title}\n`;
        page.children.forEach((item: any, idx: number) => {
          console.log(`  Adding item ${idx + 1}: ${item.title}, content length: ${item.content?.length || 0}`);
          aggregatedContent += `\n${idx + 1}. ${item.title}\n`;
          if (item.content && item.content.trim()) {
            aggregatedContent += `${item.content}\n`;
          }
        });
        aggregatedContent += '\n';
        console.log(`Data source ${page.title} aggregated content length: ${aggregatedContent.length}`);
        return { ...page, content: aggregatedContent, children: page.children.map(aggregateContent) };
      }
      return { ...page, children: page.children?.map(aggregateContent) || [] };
    };

    const hierarchicalPages = rootPages.map(aggregateContent);

    // Analyze root pages
    const rootPagesByType = { database: 0, data_source: 0, page: 0, other: 0 };
    rootPages.forEach(p => {
      if (p.object === 'database') rootPagesByType.database++;
      else if (p.object === 'data_source') rootPagesByType.data_source++;
      else if (p.object === 'page') rootPagesByType.page++;
      else rootPagesByType.other++;
    });
    
    console.log('[NOTION] Root pages breakdown:', rootPagesByType);
    console.log('[NOTION] Root pages sample:', rootPages.slice(0, 3).map(p => ({
      id: p.id,
      title: p.title,
      object: p.object,
      childrenCount: p.children?.length || 0
    })));

    clearTimeout(timeoutId);
    const totalTime = Date.now() - startTime;
    console.log('[NOTION API] Returning response:', {
      totalPages: filteredPages.length,
      hierarchicalPagesCount: hierarchicalPages.length,
      totalTime: totalTime + 'ms',
      cacheHeaders: 'no-store'
    });
    
    return NextResponse.json({
      pages: filteredPages, // Keep flat list for backward compatibility
      hierarchicalPages: hierarchicalPages, // New hierarchical structure
      totalResults: data.results?.length || 0,
      specificDatabaseFound: specificDbFound
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store'
      }
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    const totalTime = Date.now() - startTime;
    console.error('[NOTION API] Error after', totalTime, 'ms:', error.name, error.message);
    return NextResponse.json({ 
      error: error.name === 'AbortError' ? 'Request timeout - Notion API taking too long' : error.message,
      pages: [],
      hierarchicalPages: []
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store'
      }
    });
  }
}
