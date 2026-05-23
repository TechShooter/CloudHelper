import { NextRequest } from 'next/server';

export const runtime = 'edge';

function extractProperty(prop: any): string {
  if (!prop) return '';

  const { type } = prop;

  if (type === 'title' || type === 'rich_text') {
    const arr = type === 'title' ? prop.title : prop.rich_text;
    return arr?.map((t: any) => t.plain_text).join('') || '';
  }

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

  if (type === 'url') return prop.url || '';
  if (type === 'email') return prop.email || '';
  if (type === 'phone') return prop.phone_number || '';
  if (type === 'checkbox') return prop.checkbox ? 'Yes' : 'No';
  if (type === 'multi_select') return prop.multi_select?.map((s: any) => s.name).join(', ') || '';
  if (type === 'relation') return prop.relation?.map((r: any) => r.id).join(', ') || '';
  if (type === 'people') return prop.people?.map((p: any) => p.name || p.id).join(', ') || '';
  if (type === 'files') return prop.files?.map((f: any) => f.name || f.external?.url || f.file?.url).join(', ') || '';

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

  if (type === 'created_time' || type === 'last_edited_time') return prop[type] || '';
  if (type === 'created_by' || type === 'last_edited_by') return prop[type]?.name || prop[type]?.id || '';

  return '';
}

async function extractBlockContent(blockId: string, apiKey: string, indent = ''): Promise<string> {
  try {
    const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': '2026-03-11'
      }
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    let content = '';

    for (const block of data.results || []) {
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

      if (block.has_children) {
        content += await extractBlockContent(block.id, apiKey, indent + '  ');
      }
    }

    return content;
  } catch (error) {
    return '';
  }
}

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
        const error = (result as PromiseRejectedResult).reason;
        console.log(`[BATCH-FETCH] ❌ Task ${taskNum} failed:`, error?.message || error);
      }
    });

    console.log(`[BATCH-FETCH] ✅ Batch ${batchNum} complete: ${successCount} success, ${failureCount} failed (${Date.now() - batchItemStart}ms)`);

    if (i + batchSize < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`[BATCH-FETCH] ✅ Batch fetch complete in ${Date.now() - batchStart}ms: ${results.length} successful results`);
  return results;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 2,
  timeoutMs: number = 10000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 300;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    } catch (error: any) {
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
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));
      };

      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey || apiKey === 'your_notion_integration_token_here') {
        send({ type: 'error', message: 'Notion API key not configured' });
        controller.close();
        return;
      }

      const searchController = new AbortController();
      const timeoutId = setTimeout(() => searchController.abort(), 25000);

      try {
        send({ type: 'status', step: 'Starting Notion search', stage: 1, details: 'Querying Notion search API' });

        const response = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Notion-Version': '2026-03-11',
            'Content-Type': 'application/json'
          },
          signal: searchController.signal,
          body: JSON.stringify({
            filter: { property: 'object', value: 'page' },
            page_size: 100,
            sort: { direction: 'descending', timestamp: 'last_edited_time' }
          })
        });

        const data = await response.json();

        if (!response.ok) {
          send({ type: 'error', message: data.message || `Notion API error: ${data.code || 'Unknown'}` });
          return;
        }

        let allResults = [...(data.results || [])];
        let nextCursor = data.next_cursor;
        let pageCount = 1;
        send({ type: 'status', step: 'Searching pages', stage: 2, details: `Found ${allResults.length} results so far` });

        while (nextCursor && pageCount < 50) {
          send({ type: 'status', step: 'Paginating', stage: 2, details: `Fetching page ${pageCount + 1}` });
          const paginatedResponse = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Notion-Version': '2026-03-11',
              'Content-Type': 'application/json'
            },
            signal: searchController.signal,
            body: JSON.stringify({
              filter: { property: 'object', value: 'page' },
              page_size: 100,
              start_cursor: nextCursor,
              sort: { direction: 'descending', timestamp: 'last_edited_time' }
            })
          });

          const paginatedData = await paginatedResponse.json();
          allResults = allResults.concat(paginatedData.results || []);
          nextCursor = paginatedData.next_cursor;
          pageCount++;
          send({ type: 'status', step: 'Paginating', stage: 2, details: `Loaded ${allResults.length} results` });
        }

        if (!allResults.length) {
          send({ type: 'error', message: 'No pages or databases found. Make sure pages and databases are shared with your integration.' });
          return;
        }

        const BATCH_SIZE = 3;
        let processedCount = 0;

        send({ type: 'status', step: 'Processing batches', stage: 3, details: `Processing ${allResults.length} items` });

        for (let i = 0; i < allResults.length; i += BATCH_SIZE) {
          const batch = allResults.slice(i, Math.min(i + BATCH_SIZE, allResults.length));
          const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(allResults.length / BATCH_SIZE);

          const batchResults = await Promise.all(
            batch.map(async (item: any, idx: number) => {
              try {
                if (item.object === 'database') {
                  return await processDatabaseItem(item);
                }

                const pageId = item.id;
                let title = 'Untitled';
                const pageProperties: string[] = [];

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

                if (item.properties) {
                  for (const [propName, propValue] of Object.entries(item.properties)) {
                    if ((propValue as any).type === 'title') continue;
                    const value = extractProperty(propValue as any);
                    if (value) {
                      pageProperties.push(`${propName}: ${value}`);
                    }
                  }
                }

                if (title === 'Untitled' && item.parent?.type === 'page_id') {
                  try {
                    const parentResponse = await fetchWithRetry(`https://api.notion.com/v1/pages/${item.parent.page_id}`, {
                      headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Notion-Version': '2026-03-11'
                      }
                    });
                    const parentData = await parentResponse.json();
                    title = parentData.properties?.title?.title?.[0]?.plain_text || title;
                  } catch (_) {
                    // Ignore title fallback errors
                  }
                }

                if (title === 'Untitled') {
                  try {
                    const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=10`, {
                      headers: {
                        Authorization: `Bearer ${apiKey}`,
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
                  } catch (_) {
                    // Ignore fallback errors
                  }
                }

                if (!title || !title.trim()) {
                  title = `Untitled page (${pageId.slice(0, 6)})`;
                }

                const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Notion-Version': '2026-03-11'
                  }
                });
                const blocksData = await blocksResponse.json();
                let content = '';

                if (pageProperties.length > 0) {
                  content += pageProperties.join('\n') + '\n\n';
                }

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

                  if (block.has_children) {
                    content += await extractBlockContent(block.id, apiKey, '  ');
                  }
                }

                return {
                  id: pageId,
                  title,
                  content,
                  parent: item.parent,
                  object: 'page'
                };
              } catch (error) {
                console.log('[NOTION-STREAM] ❌ Error processing item:', error);
                return null;
              }
            })
          );

          const nonNullPages = batchResults.filter((item): item is any => item !== null);
          processedCount += nonNullPages.length;
          send({
            type: 'page_batch',
            batchIndex,
            totalBatches,
            pages: nonNullPages,
            processedCount,
            totalPages: allResults.length
          });

          send({
            type: 'status',
            step: 'Batch complete',
            stage: 3,
            details: `Processed ${processedCount}/${allResults.length} pages` 
          });
        }

        send({
          type: 'done',
          details: `Finished streaming ${allResults.length} pages`,
          totalPages: allResults.length
        });
      } catch (error: any) {
        console.log('[NOTION-STREAM] ❌ Error in stream:', error);
        send({ type: 'error', message: error?.message || String(error) });
      } finally {
        clearTimeout(timeoutId);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store'
    }
  });
}
