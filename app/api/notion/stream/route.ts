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

// Helper function to process a database item (extracted for reuse)
async function processDatabaseItem(item: any, apiKey: string): Promise<any> {
  console.log('[NOTION STREAM] >>> PROCESSING DATABASE:', item.id, 'Title:', item.title?.[0]?.plain_text || 'N/A');
  
  const databaseId = item.id;
  const dbTitle = item.title?.[0]?.plain_text || 'Untitled Database';
  const dataSourceObjects: any[] = [];

  // Fetch each data source under this database
  if (item.data_sources && item.data_sources.length > 0) {
    console.log('[NOTION STREAM] Database has data_sources:', item.data_sources.length);
    for (const dsRef of item.data_sources) {
      try {
        const dsResponse = await fetch(`https://api.notion.com/v1/data_sources/${dsRef.id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': '2026-03-11'
          }
        });

        if (!dsResponse.ok) continue;
        const dataSource = await dsResponse.json();
        const dsTitle = dataSource.title?.[0]?.plain_text || dsRef.name || 'Untitled Data Source';
        const dataSourcePages: any[] = [];

        const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${dsRef.id}/query`, {
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

        dataSourceObjects.push({
          id: dsRef.id,
          title: dsTitle,
          content: '',
          parent: { type: 'database_id', database_id: databaseId },
          object: 'data_source',
          children: dataSourcePages
        });
      } catch (error) {
        console.error('[NOTION STREAM] Error fetching data source:', dsRef.id, error);
      }
    }
  } else {
    // FALLBACK: Old database API
    console.log('[NOTION STREAM] Database has no data_sources, using fallback query API for:', databaseId);
    try {
      const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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

      return {
        id: databaseId,
        title: dbTitle,
        content: '',
        parent: item.parent,
        object: 'database',
        children: databasePages
      };
    } catch (error) {
      console.error('[NOTION STREAM] Error querying database (fallback):', databaseId, error);
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

  return {
    id: databaseId,
    title: dbTitle,
    content: '',
    parent: item.parent,
    object: 'database',
    children: dataSourceObjects
  };
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

        console.log('[NOTION STREAM] Starting request...');

        const response = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': '2026-03-11',
            'Content-Type': 'application/json'
          },
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
        console.log('[NOTION STREAM] Initial search completed, results:', data.results?.length);

        if (!response.ok || !data.results) {
          const errorMessage = data.message || data.code || `HTTP ${response.status}`;
          controller.enqueue(encoder.encode(JSON.stringify({ error: `Failed to fetch: ${errorMessage}` }) + '\n'));
          controller.close();
          return;
        }

        // Implement pagination to get ALL pages
        let allResults = [...(data.results || [])];
        let nextCursor = data.next_cursor;
        
        console.log('[NOTION STREAM] Starting pagination...');
        let pageCount = 1;
        
        while (nextCursor && pageCount < 50) {
          console.log(`[NOTION STREAM] Fetching page ${pageCount + 1} with cursor...`);
          
          const paginatedResponse = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Notion-Version': '2026-03-11',
              'Content-Type': 'application/json'
            },
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
            console.log(`[NOTION STREAM] Page ${pageCount} fetched, total results so far: ${allResults.length}`);
          } else {
            console.error('[NOTION STREAM] Pagination error:', await paginatedResponse.text());
            break;
          }
        }
        
        console.log(`[NOTION STREAM] Pagination complete. Total results: ${allResults.length}`);
        data.results = allResults;

        // CLOUDFLARE FIX: Force process known databases even if not in search results
        const knownDatabaseIds = [
          '29aedf786daa80818d43c896d29bc6b4', // Tasks to do db
        ];
        let forcedDatabaseResults: any[] = [];

        // Database discovery mechanism
        console.log('[NOTION STREAM] Starting database discovery');
        let discoveredDatabaseIds: string[] = [];

        try {
          const dbSearchResponse = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
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
            console.log('[NOTION STREAM] Database search returned:', dbSearchData.results?.length, 'databases');
            
            dbSearchData.results?.forEach((db: any) => {
              if (db.id && !discoveredDatabaseIds.includes(db.id)) {
                discoveredDatabaseIds.push(db.id);
                console.log('[NOTION STREAM] Discovered database:', db.id, db.title?.[0]?.plain_text || 'Untitled');
              }
            });
          }
        } catch (error) {
          console.log('[NOTION STREAM] Database search failed:', error);
        }

        // Look for database references in page parents
        data.results?.forEach((item: any) => {
          if (item.parent?.database_id && !discoveredDatabaseIds.includes(item.parent.database_id)) {
            discoveredDatabaseIds.push(item.parent.database_id);
            console.log('[NOTION STREAM] Found database from page parent:', item.parent.database_id);
          }
        });

        const allDatabaseIds = [...new Set([...knownDatabaseIds, ...discoveredDatabaseIds])];
        console.log('[NOTION STREAM] Total databases to process:', allDatabaseIds.length);

        for (const dbId of allDatabaseIds) {
          try {
            const dbResponse = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2026-03-11'
              }
            });

            if (dbResponse.ok) {
              const dbData = await dbResponse.json();
              const forcedDb = await processDatabaseItem(dbData, apiKey);
              if (forcedDb) {
                forcedDatabaseResults.push(forcedDb);
                console.log('[NOTION STREAM] Added forced database:', forcedDb.title);
              }
            }
          } catch (error) {
            console.log('[NOTION STREAM] Error checking database:', dbId, error);
          }
        }

        // Process all search results
        const processedItems: any[] = [];
        
        for (const item of data.results) {
          if (item.object === 'page') {
            const page = await processPage(item, apiKey);
            if (page) {
              processedItems.push(page);
            }
          } else if (item.object === 'database') {
            const db = await processDatabaseItem(item, apiKey);
            if (db) {
              processedItems.push(db);
            }
          }
        }

        // Combine with forced database results
        const allItems = [...processedItems, ...forcedDatabaseResults];

        // Build hierarchical structure
        const pageMap = new Map();
        const rootPages: any[] = [];

        allItems.forEach(item => {
          pageMap.set(item.id, { ...item, children: item.children || [] });
        });

        let rootCount = 0;
        allItems.forEach(page => {
          const parentId = page.parent?.page_id || page.parent?.database_id || page.parent?.data_source_id;
          
          if (!parentId || page.parent?.type === 'workspace') {
            // Root level page (workspace parent check)
            rootPages.push(pageMap.get(page.id));
            rootCount++;
          } else if (pageMap.has(parentId)) {
            const parent = pageMap.get(parentId);
            const child = pageMap.get(page.id);
            if (!parent.children.find((c: any) => c.id === child.id)) {
              parent.children.push(child);
            }
          } else {
            // Parent not found, treat as root
            rootPages.push(pageMap.get(page.id));
          }
        });

        console.log('[NOTION STREAM] Hierarchy built:', rootCount, 'root pages');

        // Aggregate content for databases and data sources
        const aggregateContent = (page: any): any => {
          if (page.object === 'database' && page.children && page.children.length > 0) {
            const hasDataSources = page.children.some((child: any) => child.object === 'data_source');
            
            if (hasDataSources) {
              let aggregatedContent = `Database: ${page.title}\n\n`;
              page.children.forEach((dataSource: any) => {
                const processedDS = aggregateContent(dataSource);
                aggregatedContent += processedDS.content;
              });
              return { ...page, content: aggregatedContent, children: page.children.map(aggregateContent) };
            } else {
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

        const hierarchicalPages = rootPages.map(aggregateContent);

        // Stream all items (both flat and hierarchical)
        for (const item of allItems) {
          controller.enqueue(encoder.encode(JSON.stringify(item) + '\n'));
        }

        // Also stream hierarchical structure
        for (const rootPage of hierarchicalPages) {
          controller.enqueue(encoder.encode(JSON.stringify({ ...rootPage, isHierarchical: true }) + '\n'));
        }

        controller.close();
      } catch (error: any) {
        console.error('[NOTION STREAM] Error:', error);
        controller.enqueue(encoder.encode(JSON.stringify({ error: error.message }) + '\n'));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' }
  });
}
