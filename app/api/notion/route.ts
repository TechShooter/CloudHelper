import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

let notionKey = process.env.NOTION_API_KEY || '';

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
            'Authorization': `Bearer ${notionKey}`,
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
            'Authorization': `Bearer ${notionKey}`,
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
          'Authorization': `Bearer ${notionKey}`,
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
  batchSize: number,
  delayBetweenBatches: number = 100
): Promise<T[]> {
  const results: T[] = [];
  console.log(`[BATCH-FETCH] 🔄 Starting batch fetch: ${tasks.length} tasks, batch size: ${batchSize}`);
  const batchStart = Date.now();

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(tasks.length / batchSize);
    console.log(`[BATCH-FETCH] 📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} tasks (items ${i + 1}-${Math.min(i + batchSize, tasks.length)})`);
    const batchItemStart = Date.now();

    const batchResults = await Promise.allSettled(batch.map(task => task()));

    let successCount = 0;
    let failureCount = 0;
    batchResults.forEach((result, idx) => {
      const taskNum = i + idx;
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
        successCount++;
      } else if (result.status === 'fulfilled' && result.value === null) {
        // Skip null results
      } else {
        failureCount++;
        // Properly access the reason property for rejected promises
        const error = (result as PromiseRejectedResult).reason;
        console.log(`[BATCH-FETCH] ❌ Task ${taskNum} failed:`, error?.message || error);
      }
    });

    console.log(`[BATCH-FETCH] ✅ Batch ${batchNum} complete: ${successCount} success, ${failureCount} failed (${Date.now() - batchItemStart}ms)`);

    // Add delay between batches to prevent rate limiting (except after last batch)
    if (i + batchSize < tasks.length) {
      console.log(`[BATCH-FETCH] ⏸️  Waiting ${delayBetweenBatches}ms before batch ${batchNum + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  const totalBatchTime = Date.now() - batchStart;
  console.log(`[BATCH-FETCH] ✅ Batch fetch complete in ${totalBatchTime}ms: ${results.length} successful results`);
  return results;
}

// Helper to retry requests with exponential backoff for 429 errors
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 2
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry on abort or other critical errors
      if (response.status === 429 && attempt < maxRetries - 1) {
        // Rate limited - wait before retrying
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 300;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error: any) {
      // If it's an abort error, don't retry
      if (error?.name === 'AbortError') {
        throw error;
      }
      
      if (attempt === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 300));
    }
  }
  
  throw new Error('Max retries exceeded');
}

export async function GET(req: NextRequest) {
  notionKey = req.headers.get('x-api-key-notion') || notionKey || '';
  // Increase timeout for edge runtime - use 25 seconds instead of 15
  // This accounts for Notion API latency and multiple parallel requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  const startTime = Date.now();
  
  try {
    if (!notionKey || notionKey === 'your_notion_integration_token_here') {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: 'Notion API key not configured' }, { status: 400 });
    }

    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
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
    console.log(`[NOTION-API] ✅ Initial search: ${data.results?.length || 0} results, has_more: ${!!data.next_cursor}`);

    if (!response.ok) {
      return NextResponse.json({
        error: data.message || `Notion API error: ${data.code || 'Unknown'}`
      }, { status: response.status });
    }

    // Implement pagination to get ALL pages
    let allResults = [...(data.results || [])];
    let nextCursor = data.next_cursor;

    let pageCount = 1;
    console.log('[NOTION-API] 📖 Starting pagination loop...');

    while (nextCursor && pageCount < 50) { // Safety limit of 50 pages
      console.log(`[NOTION-API] 📄 Page ${pageCount}: fetching with cursor...`);
      
      const paginatedResponse = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionKey}`,
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
        const newCount = paginatedData.results?.length || 0;
        allResults = allResults.concat(paginatedData.results || []);
        nextCursor = paginatedData.next_cursor;
        console.log(`[NOTION-API] ✅ Page ${pageCount}: +${newCount} results (total: ${allResults.length})`);
        pageCount++;
      } else {
        console.log(`[NOTION-API] ⚠️ Pagination stopped at page ${pageCount}`);
        break;
      }
    }
    
    console.log(`[NOTION-API] 📚 Pagination complete: ${allResults.length} total results in ${pageCount} pages`);
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
          'Authorization': `Bearer ${notionKey}`,
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
        const dbResponse = await fetchWithRetry(`https://api.notion.com/v1/databases/${dbId}`, {
          headers: {
            'Authorization': `Bearer ${notionKey}`,
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

    // Process pages in batches and stream results for progressive display
    const BATCH_SIZE = 3;
    const allProcessedPages: any[] = [];
    const allHierarchicalPages: any[] = [];
    
    console.log(`[NOTION-API] 🚀 Starting batch processing of ${data.results.length} items in batches of ${BATCH_SIZE}...`);

    // Process in batches
    for (let i = 0; i < data.results.length; i += BATCH_SIZE) {
      const batch = data.results.slice(i, Math.min(i + BATCH_SIZE, data.results.length));
      console.log(`[NOTION-API] 📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(data.results.length / BATCH_SIZE)} (items ${i + 1}-${Math.min(i + BATCH_SIZE, data.results.length)})`);
      
      const batchResults = await Promise.all(
        batch.map(async (item: any, idx: number) => {
          const globalIdx = i + idx;
          try {
            console.log(`[NOTION-API] 🔄 Processing item ${globalIdx + 1}/${data.results.length}: ${item.object}...`);
            if (item.object === 'database') {
              console.log(`[NOTION-API] 📊 Processing database: ${item.id}`);
              return await processDatabaseItem(item);
            } else {
              // Handle regular page
              const pageId = item.id;
              console.log(`[NOTION-API] 📖 Processing page: ${pageId}`);
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
              const parentResponse = await fetchWithRetry(`https://api.notion.com/v1/pages/${item.parent.page_id}`, {
                headers: {
                  'Authorization': `Bearer ${notionKey}`,
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
                    'Authorization': `Bearer ${notionKey}`,
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

            console.log(`[NOTION-API] 📦 Fetching blocks for page: ${pageId.slice(0, 6)}... (${title})`);
            const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
              headers: {
                'Authorization': `Bearer ${notionKey}`,
                'Notion-Version': '2026-03-11'
              }
            });

            const blocksData = await blocksResponse.json();
            console.log(`[NOTION-API] ✅ Blocks fetched for ${pageId.slice(0, 6)}: ${blocksData.results?.length || 0} blocks`);
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
                const childContent = await extractBlockContent(block.id, notionKey as string, '  ');
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
          console.log(`[NOTION-API] ❌ Error processing item:`, error);
          return null;
        }
      })
      ).then(results => results.filter(item => item !== null));
      
      // Add batch results to accumulated pages
      allProcessedPages.push(...batchResults);
      console.log(`[NOTION-API] ✅ Batch complete: +${batchResults.length} pages (total: ${allProcessedPages.length})`);
      
      // Small delay between batches to avoid overwhelming Notion API
      if (i + BATCH_SIZE < data.results.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Use accumulated pages from batch processing
    const pages = allProcessedPages;

    // Filter out null results
    const filteredPages = pages.filter(page => page !== null);
    console.log(`[NOTION-API] ✅ All pages processed: ${filteredPages.length} valid pages`);
    
    const processedBreakdown = { database: 0, data_source: 0, page: 0, other: 0, null: 0 };
    pages.forEach(p => {
      if (p === null) processedBreakdown.null++;
      else if (p.object === 'database') processedBreakdown.database++;
      else if (p.object === 'data_source') processedBreakdown.data_source++;
      else if (p.object === 'page') processedBreakdown.page++;
      else processedBreakdown.other++;
    });
    console.log(`[NOTION-API] 📊 Breakdown:`, processedBreakdown);

    // Collect all parent IDs that need to be fetched (including databases)
    console.log(`[NOTION-API] 🔍 Collecting missing parent IDs...`);
    const parentIdsToFetch = new Set<string>();
    const pageIdSet = new Set(filteredPages.map(p => p.id)); // O(1) lookup instead of O(n) find
    
    const collectionStart = Date.now();
    filteredPages.forEach(page => {
      if (page.parent?.page_id && !pageIdSet.has(page.parent.page_id)) {
        parentIdsToFetch.add(page.parent.page_id);
      }
      if (page.parent?.database_id && !pageIdSet.has(page.parent.database_id)) {
        parentIdsToFetch.add(page.parent.database_id);
      }
      if (page.parent?.data_source_id && !pageIdSet.has(page.parent.data_source_id)) {
        parentIdsToFetch.add(page.parent.data_source_id);
      }
    });
    console.log(`[NOTION-API] ✅ Parent ID collection took ${Date.now() - collectionStart}ms`);
    console.log(`[NOTION-API] 👨‍👩‍👧 Missing parent IDs to fetch: ${parentIdsToFetch.size}`);

    // Fetch missing parent pages/databases
    // NOTE: Removed .slice(0, 10) limit to properly resolve all parents on Cloudflare
    // This ensures pages are correctly nested instead of becoming orphan root pages
    // Using batch fetching (5 per batch) to prevent overwhelming Notion API
    
    console.log(`[NOTION-API] ⏳ Starting batch fetch of ${parentIdsToFetch.size} missing parents...`);

    const fetchedParents = await batchFetch(
      Array.from(parentIdsToFetch).map(parentId => async () => {
        try {
          // Try to fetch as database first
          const dbResponse = await fetchWithRetry(`https://api.notion.com/v1/databases/${parentId}`, {
            headers: {
              'Authorization': `Bearer ${notionKey}`,
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
              let queryBody: any = { page_size: 50 };
              
              // Check if database has data_sources
              if (dbData.data_sources && dbData.data_sources.length > 0) {
                // Use data source query
                queryUrl = `https://api.notion.com/v1/data_sources/${dbData.data_sources[0].id}/query`;
              } else {
                // Use old database query
                queryUrl = `https://api.notion.com/v1/databases/${parentId}/query`;
              }

              const queryResponse = await fetchWithRetry(queryUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${notionKey}`,
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
          const pageResponse = await fetchWithRetry(`https://api.notion.com/v1/pages/${parentId}`, {
            headers: {
              'Authorization': `Bearer ${notionKey}`,
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
      5 // Batch size: 5 parents per batch with conservative retry logic
    );

    const validParents = fetchedParents.filter(p => p !== null);
    console.log(`[NOTION-API] ✅ Parent fetch complete: ${validParents.length}/${parentIdsToFetch.size} parents resolved`);

    // Analyze fetched parents
    const fetchedByType = { database: 0, page: 0, other: 0 };
    validParents.forEach(p => {
      if (p.object === 'database') fetchedByType.database++;
      else if (p.object === 'page') fetchedByType.page++;
      else fetchedByType.other++;
    });
    console.log(`[NOTION-API] 📊 Fetched parents breakdown:`, fetchedByType);

    // Combine all pages including forced database results
    console.log(`[NOTION-API] 🔀 Combining pages: ${filteredPages.length} filtered + ${validParents.length} parents + ${forcedDatabaseResults.length} forced`);
    const allPages = [...filteredPages, ...validParents, ...forcedDatabaseResults];
    console.log(`[NOTION-API] ✅ Combined total: ${allPages.length} pages`);

    // Filter out pages that are children of data sources from the flat output
    // They will appear as children of their data source in the hierarchical structure
    const flatPages = allPages.filter(item => {
      if (item.object === 'page' && item.parent?.type === 'data_source_id') {
        return false;
      }
      return true;
    });

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
    console.log(`[NOTION-API] 🏗️  Building hierarchical structure from ${allPages.length} pages...`);
    const hierarchyStart = Date.now();
    
    const pageMap = new Map();
    const childPageIds = new Set<string>(); // Track all page IDs that are children to avoid duplication
    const parentToChildrenMap = new Map<string, Set<string>>(); // Track children added per parent
    
    // First pass: create map with children arrays
    console.log(`[NOTION-API] 📍 Pass 1: Creating page map...`);
    allPages.forEach(page => {
      pageMap.set(page.id, { 
        ...page, 
        children: page.children || [],
        _expanded: false // Track expansion state
      });
    });
    console.log(`[NOTION-API] ✅ Page map created: ${pageMap.size} entries`);
    
    // Pre-pass: Collect all page IDs that are already nested as children in any parent
    // This prevents them from appearing as standalone roots
    console.log(`[NOTION-API] 📍 Pre-pass: Collecting nested children...`);
    let nestedChildCount = 0;
    allPages.forEach(page => {
      if (page.children && Array.isArray(page.children)) {
        page.children.forEach((child: any) => {
          childPageIds.add(child.id);
          nestedChildCount++;
        });
      }
    });
    console.log(`[NOTION-API] ✅ Nested children collected: ${nestedChildCount} children in ${childPageIds.size} unique IDs`);
    if (childPageIds.size > 0) {
      console.log(`[NOTION-API] Pre-pass children IDs sample:`, Array.from(childPageIds).slice(0, 10));
    }

    // Second pass: connect parents and children, mark children
    console.log(`[NOTION-API] 📍 Pass 2: Connecting parents and children...`);
    let connectionsAdded = 0;
    const orphanedPages: Array<{id: string, title: string, parentType?: string, parentId?: string}> = [];
    
    const connectionExamples: string[] = [];
    allPages.forEach(page => {
      const parent = page.parent;
      
      if (parent?.type !== 'workspace') {
        // Has a specific parent - try to add to parent's children if parent exists
        let parentId: string | null = null;
        
        if (parent?.type === 'page_id') parentId = parent.page_id;
        else if (parent?.type === 'database_id') parentId = parent.database_id;
        else if (parent?.type === 'data_source_id') parentId = parent.data_source_id;
        else if (parent?.type === 'block_id') parentId = parent.block_id;
        else if (parent?.type === 'agent_id') parentId = parent.agent_id;
        
        if (parentId && pageMap.has(parentId)) {
          // Parent exists in our map - add as child and mark to exclude from roots
          const parentNode = pageMap.get(parentId);
          
          // Track which children we've added to this parent (avoid duplicates)
          if (!parentToChildrenMap.has(parentId)) {
            parentToChildrenMap.set(parentId, new Set());
          }
          const parentChildren = parentToChildrenMap.get(parentId)!;
          
          // Only add if not already added
          if (!parentChildren.has(page.id)) {
            parentNode.children.push(pageMap.get(page.id));
            parentChildren.add(page.id);
            connectionsAdded++;
            
            // Collect examples for logging
            if (connectionExamples.length < 5) {
              connectionExamples.push(`"${page.title}" → "${parentNode.title}"`);
            }
          }
          
          childPageIds.add(page.id); // Mark as child (will not be in rootPages)
        } else if (parentId) {
          // Parent NOT found - will become orphan/root
          orphanedPages.push({
            id: page.id,
            title: page.title,
            parentType: parent?.type,
            parentId: parentId
          });
        }
      }
    });
    console.log(`[NOTION-API] ✅ Pass 2 complete: ${connectionsAdded} connections added`);
    if (connectionExamples.length > 0) {
      console.log(`[NOTION-API] Connection examples:`, connectionExamples.join(', '));
    }
    if (orphanedPages.length > 0) {
      console.log(`[NOTION-API] 🚨 Orphaned pages (${orphanedPages.length}): Missing parents that should be in pageMap`);
      orphanedPages.slice(0, 5).forEach(p => {
        console.log(`[NOTION-API]   - "${p.title}" (${p.id}): parent_${p.parentType}=${p.parentId}`);
      });
    }
    
    // Build rootPages: only pages that are NOT children of anyone
    console.log(`[NOTION-API] 📍 Pass 3: Building root pages (excluding ${childPageIds.size} children)...`);
    const rootPages: any[] = [];
    const excludedPages: string[] = [];
    allPages.forEach(page => {
      if (!childPageIds.has(page.id)) {
        rootPages.push(pageMap.get(page.id));
      } else {
        excludedPages.push(`${page.id} (${page.title})`);
      }
    });
    const hierarchyTime = Date.now() - hierarchyStart;
    console.log(`[NOTION-API] ✅ Hierarchy building complete in ${hierarchyTime}ms`);
    console.log(`[NOTION-API] 🌳 Root pages built: ${rootPages.length} roots`);
    console.log(`[NOTION-API] � Root pages list:`);
    rootPages.forEach((page, idx) => {
      const childCount = page.children?.length || 0;
      console.log(`[NOTION-API]   ${idx + 1}. "${page.title}" (${page.id}) [${page.object}] - ${childCount} children, parent_type=${page.parent?.type}`);
    });
    console.log(`[NOTION-API] �🚫 Excluded from roots: ${excludedPages.length} pages`);
    
    // Verify no children are appearing as roots (would indicate a bug)
    const pageIdsAtRoot = new Set(rootPages.map(p => p.id));
    const childrenAsRoots = Array.from(childPageIds).filter(id => pageIdsAtRoot.has(id));
    if (childrenAsRoots.length > 0) {
      console.error(`[NOTION-API] BUG DETECTED - ${childrenAsRoots.length} children appearing as roots:`, childrenAsRoots);
    }
    
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

    console.log(`[NOTION-API] 🔗 Starting aggregateContent processing...`);
    const aggregateStart = Date.now();
    const hierarchicalPagesAggregated = rootPages.map(aggregateContent);
    console.log(`[NOTION-API] ✅ AggregateContent took ${Date.now() - aggregateStart}ms for ${rootPages.length} roots`);

    clearTimeout(timeoutId);
    const totalTime = Date.now() - startTime;
    
    console.log(`[NOTION-API] 🎉 FINAL RESPONSE READY:`);
    console.log(`[NOTION-API]   - Flat pages: ${flatPages.length}`);
    console.log(`[NOTION-API]   - Hierarchical pages: ${hierarchicalPagesAggregated.length}`);
    console.log(`[NOTION-API]   - Total time: ${totalTime}ms`);

    // Collect debug info for UI display
    const debugInfo = {
      timing: {
        total: totalTime,
        searchPagination: 'included'
      },
      counts: {
        initialResults: data.results?.length || 0,
        flatPages: flatPages.length,
        hierarchicalPages: hierarchicalPagesAggregated.length,
        totalProcessed: allPages.length,
        rootPages: rootPages.length,
        childPages: childPageIds.size,
        parentsFetched: validParents.length,
        forcedDatabases: forcedDatabaseResults.length,
        orphanedPages: orphanedPages.length
      },
      types: combinedByType,
      orphanedPagesList: orphanedPages.slice(0, 10)  // Show first 10 orphaned pages
    };

    return NextResponse.json({
      pages: flatPages, // Flat list for backward compatibility (filtered to remove data source children)
      hierarchicalPages: hierarchicalPagesAggregated, // Unified hierarchical structure
      totalResults: data.results?.length || 0,
      specificDatabaseFound: forcedDatabaseResults.length > 0,
      totalPages: allPages.length,
      debug: debugInfo
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
