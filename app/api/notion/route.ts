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

// Helper function to process a database item (extracted for reuse)
async function processDatabaseItem(item: any): Promise<any> {
  // Database is a container - fetch its data sources
  const databaseId = item.id;
  const dbTitle = item.title?.[0]?.plain_text || 'Untitled Database';
  const dataSourceObjects: any[] = [];

  // Fetch each data source under this database
  if (item.data_sources && item.data_sources.length > 0) {
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
      }
    }
  } else {
    // FALLBACK: Old database API - query database directly
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
      const databasePages: any[] = [];

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
            parent: { type: 'database_id', database_id: databaseId },
            object: 'page',
            url: entry.url || `https://www.notion.so/${entry.id.replace(/-/g, '')}`,
            children: []
          });
        }
      }

      // Return database with pages directly as children (no data source wrapper)
      return {
        id: databaseId,
        title: dbTitle,
        content: '', // Empty - content comes from children
        parent: item.parent,
        object: 'database',
        children: databasePages
      };
    } catch (error) {
      // Still return the database object even if query failed, so we don't lose it
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
  return {
    id: databaseId,
    title: dbTitle,
    content: '', // Empty - content comes from data sources
    parent: item.parent,
    object: 'database',
    children: dataSourceObjects
  };
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
    return '';
  }
}

// Helper function to batch and execute promises
async function batchFetch<T>(
  tasks: Array<() => Promise<T>>,
  batchSize: number
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(batch.map(task => task()));

    batchResults.forEach((result, idx) => {
      const taskNum = i + idx;
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
      } else if (result.status === 'fulfilled' && result.value === null) {
        // Skip null results
      } else {
        // Skip failed tasks
      }
    });
  }

  return results;
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

    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        filter: {
          property: 'object',
          value: 'page'
        },
        page_size: 100,
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        }
      })
    });

    let data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        error: data.message || `Notion API error: ${data.code || 'Unknown'}`
      }, { status: response.status });
    }

    // Implement pagination to get ALL pages
    let allResults = [...(data.results || [])];
    let nextCursor = data.next_cursor;

    let pageCount = 1;

    while (nextCursor && pageCount < 50) { // Safety limit of 50 pages
      
      const paginatedResponse = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          filter: {
            property: 'object',
            value: 'page'
          },
          page_size: 100,
          start_cursor: nextCursor,
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time'
          }
        })
      });
      
      if (paginatedResponse.ok) {
        const paginatedData = await paginatedResponse.json();
        allResults = allResults.concat(paginatedData.results || []);
        nextCursor = paginatedData.next_cursor;
        pageCount++;
      } else {
        break;
      }
    }
    
    // Replace data.results with all results
    data.results = allResults;

    // CLOUDFLARE FIX: Force process known databases even if not in search results
    const knownDatabaseIds = [
      '29aedf786daa80818d43c896d29bc6b4', // Tasks to do db
      // TODO: Add the other database IDs as they are discovered
      // From local environment, these databases should exist:
      // - "Recurrent & Routine tasks db" 
      // - "Projects, Big tasks db"
      // - "Old tasks ideas, secondary db"
    ];
    let forcedDatabaseResults: any[] = [];

    // Database discovery mechanism
    let discoveredDatabaseIds: string[] = [];

    // Try to discover databases by querying the search API with different filters
    try {
      // Search with database filter
      const dbSearchResponse = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: 'object',
            value: 'database'
          },
          page_size: 100
        })
      });

      if (dbSearchResponse.ok) {
        const dbSearchData = await dbSearchResponse.json();
        dbSearchData.results?.forEach((db: any) => {
          if (db.id && !discoveredDatabaseIds.includes(db.id)) {
            discoveredDatabaseIds.push(db.id);
          }
        });
      }
    } catch (error) {
    }

    // Additional discovery: Look for database references in page parents
    data.results?.forEach((item: any) => {
      if (item.parent?.database_id && !discoveredDatabaseIds.includes(item.parent.database_id)) {
        discoveredDatabaseIds.push(item.parent.database_id);
      }
    });

    // Combine known and discovered database IDs
    const allDatabaseIds = [...new Set([...knownDatabaseIds, ...discoveredDatabaseIds])];

    for (const dbId of allDatabaseIds) {
      try {
        const dbResponse = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
            'Notion-Version': '2026-03-11'
          }
        });

        if (dbResponse.ok) {
          const dbData = await dbResponse.json();
          const forcedDb = await processDatabaseItem(dbData);
          if (forcedDb) {
            forcedDatabaseResults.push(forcedDb);
          }
        }
      } catch (error) {
      }
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
          if (item.object === 'database') {
            return await processDatabaseItem(item);
          } else {
            // Handle regular page
            const pageId = item.id;
            let title = 'Untitled';
            let pageProperties: string[] = [];

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
                if (value) {
                  pageProperties.push(`${propName}: ${value}`);
                }
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
              } catch (error) {
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

    // Collect all parent IDs that need to be fetched (including databases)
    const parentIdsToFetch = new Set<string>();
    filteredPages.forEach(page => {
      if (page.parent?.page_id && !filteredPages.find(p => p.id === page.parent.page_id)) {
        parentIdsToFetch.add(page.parent.page_id);
      }
      if (page.parent?.database_id && !filteredPages.find(p => p.id === page.parent.database_id)) {
        parentIdsToFetch.add(page.parent.database_id);
      }
      if (page.parent?.data_source_id && !filteredPages.find(p => p.id === page.parent.data_source_id)) {
        parentIdsToFetch.add(page.parent.data_source_id);
      }
    });

    // Fetch missing parent pages/databases
    // NOTE: Removed .slice(0, 10) limit to properly resolve all parents on Cloudflare
    // This ensures pages are correctly nested instead of becoming orphan root pages
    // Using batch fetching (5 per batch) to prevent overwhelming Notion API

    const fetchedParents = await batchFetch(
      Array.from(parentIdsToFetch).map(parentId => async () => {
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
            const databasePages: any[] = [];

            // Fetch database entries with properties using new structure or fallback
            try {
              let queryUrl = '';
              let queryBody: any = { page_size: 100 };
              
              // Check if database has data_sources
              if (dbData.data_sources && dbData.data_sources.length > 0) {
                // Use data source query
                queryUrl = `https://api.notion.com/v1/data_sources/${dbData.data_sources[0].id}/query`;
              } else {
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
        }
        return null;
      }),
      5 // Batch size: process 5 parents per batch
    );

    const validParents = fetchedParents.filter(p => p !== null);

    // Analyze fetched parents
    const fetchedByType = { database: 0, page: 0, other: 0 };
    validParents.forEach(p => {
      if (p.object === 'database') fetchedByType.database++;
      else if (p.object === 'page') fetchedByType.page++;
      else fetchedByType.other++;
    });

    // Combine all pages including forced database results
    const allPages = [...filteredPages, ...validParents, ...forcedDatabaseResults];
    
    // Log combined breakdown
    const combinedByType = { database: 0, data_source: 0, page: 0, other: 0 };
    allPages.forEach(p => {
      if (p.object === 'database') combinedByType.database++;
      else if (p.object === 'data_source') combinedByType.data_source++;
      else if (p.object === 'page') combinedByType.page++;
      else combinedByType.other++;
    });

    // Build unified hierarchical structure following Notion's API model:
    // Workspace → Pages/Databases → Data Sources → Pages
    const pageMap = new Map();
    
    // First pass: create map with children arrays
    allPages.forEach(page => {
      pageMap.set(page.id, { 
        ...page, 
        children: page.children || [],
        _expanded: false // Track expansion state
      });
    });
    
    // Second pass: build hierarchy by connecting parents and children
    const rootPages: any[] = []; // Workspace-level items
    const parentsToChildren = new Map<string, string[]>(); // Track which items are children
    
    allPages.forEach(page => {
      const parent = page.parent;
      
      if (parent?.type === 'workspace') {
        // Root level - add to rootPages
        rootPages.push(pageMap.get(page.id));
      } else {
        // Has a parent - add to parent's children if parent exists in our map
        let parentId: string | null = null;
        
        if (parent?.type === 'page_id') parentId = parent.page_id;
        else if (parent?.type === 'database_id') parentId = parent.database_id;
        else if (parent?.type === 'data_source_id') parentId = parent.data_source_id;
        else if (parent?.type === 'block_id') parentId = parent.block_id;
        else if (parent?.type === 'agent_id') parentId = parent.agent_id;
        
        if (parentId && pageMap.has(parentId)) {
          const parentNode = pageMap.get(parentId);
          if (!parentNode.children.find((c: any) => c.id === page.id)) {
            parentNode.children.push(pageMap.get(page.id));
          }
          if (!parentsToChildren.has(parentId)) {
            parentsToChildren.set(parentId, []);
          }
          parentsToChildren.get(parentId)!.push(page.id);
        } else if (!parentId) {
          // No recognizable parent, treat as root
          rootPages.push(pageMap.get(page.id));
        }
      }
    });
    
    // Sort root pages: databases first, then pages
    rootPages.sort((a, b) => {
      const aIsDb = a.object === 'database' ? 0 : 1;
      const bIsDb = b.object === 'database' ? 0 : 1;
      if (aIsDb !== bIsDb) return aIsDb - bIsDb;
      return (a.title || '').localeCompare(b.title || '');
    });

    // Aggregate content for databases and data sources
    const aggregateContent = (page: any): any => {
      if (page.object === 'database' && page.children && page.children.length > 0) {
        // Check if children are data sources or direct pages
        const hasDataSources = page.children.some((child: any) => child.object === 'data_source');

        if (hasDataSources) {
          // Database with data sources: aggregate all data sources
          let aggregatedContent = `Database: ${page.title}\n\n`;
          page.children.forEach((dataSource: any) => {
            const processedDS = aggregateContent(dataSource);
            aggregatedContent += processedDS.content;
          });
          return { ...page, content: aggregatedContent, children: page.children.map(aggregateContent) };
        } else {
          // Database with direct pages (fallback/old API): list all items
          let aggregatedContent = `Database: ${page.title}\n\n`;
          page.children.forEach((item: any, idx: number) => {
            aggregatedContent += `${idx + 1}. ${item.title}\n`;
            if (item.content && item.content.trim()) {
              aggregatedContent += `${item.content}\n`;
            }
            aggregatedContent += '\n';
          });
          return { ...page, content: aggregatedContent, children: page.children.map(aggregateContent) };
        }
      } else if (page.object === 'data_source' && page.children && page.children.length > 0) {
        // Data source: list all items with their properties
        let aggregatedContent = `Data Source: ${page.title}\n`;
        page.children.forEach((item: any, idx: number) => {
          aggregatedContent += `\n${idx + 1}. ${item.title}\n`;
          if (item.content && item.content.trim()) {
            aggregatedContent += `${item.content}\n`;
          }
        });
        aggregatedContent += '\n';
        return { ...page, content: aggregatedContent, children: page.children.map(aggregateContent) };
      }
      return { ...page, children: page.children?.map(aggregateContent) || [] };
    };

    clearTimeout(timeoutId);
    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      pages: filteredPages, // Flat list for backward compatibility
      hierarchicalPages: rootPages.map(aggregateContent), // Unified hierarchical structure
      totalResults: data.results?.length || 0,
      specificDatabaseFound: forcedDatabaseResults.length > 0,
      totalPages: allPages.length
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
